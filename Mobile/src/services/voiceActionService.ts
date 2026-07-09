import { api } from './api';

/**
 * Generic voice-action orchestration: preview -> ask-if-incomplete -> commit -> navigate.
 * New backend voice actions (Backend/src/modules/voice-action) only need one routing gate
 * added to VOICE_ACTION_GATES below — no bespoke pending-state/confirm-flow code per feature.
 */
export type VoiceActionResolution = {
    sessionId?: string;
    message: string;
    voiceUrl?: null;
    contextUsed: number;
    toolResults?: any[];
    agentSteps?: any[];
    navigate?: { screen: string; params?: Record<string, unknown> };
};

type PendingVoiceAction = {
    actionKey: string;
    knownValues: Record<string, any>;
    expiresAt: number;
};

const PENDING_VOICE_ACTION_TTL_MS = 3 * 60 * 1000;
const pendingVoiceActions = new Map<string, PendingVoiceAction>();

function ensureSessionKey(sessionId?: string): string {
    return sessionId || `voice-action-${Math.random().toString(36).slice(2)}`;
}

function getEffectiveText(message: string): string {
    const trimmed = message.trim();
    if (!trimmed) return trimmed;
    const match = trimmed.match(/user (?:request|message):\s*([\s\S]*)$/i);
    return match?.[1]?.trim() || trimmed;
}

type VoiceActionGate = {
    actionKey: string;
    looksLikeMatch: (text: string) => boolean;
};

// One cheap routing gate per registered backend action. Add a line here when a new action is
// registered server-side — the rest of this file (pending state, ask/commit/navigate) is generic.
const VOICE_ACTION_GATES: VoiceActionGate[] = [
    {
        actionKey: 'set_budget',
        looksLikeMatch: (text) =>
            /\b(set|update|change)\b.*\bbudget\b/i.test(text) || /\bbudget\b.*\b(set|to|of|as)\b/i.test(text),
    },
    {
        actionKey: 'create_support_ticket',
        looksLikeMatch: (text) =>
            /\b(file|create|open|raise|log|report)\b.*\b(ticket|complaint|issue|bug|problem)\b/i.test(text) ||
            /\bsupport ticket\b/i.test(text),
    },
    {
        actionKey: 'verify_fastag',
        looksLikeMatch: (text) => /\b(verify|check)\b.*\b(fastag|bank account|beneficiary)\b/i.test(text) || /\bfastag verification\b/i.test(text),
    },
    {
        actionKey: 'verify_dl',
        looksLikeMatch: (text) =>
            /\b(verify|check)\b.*\b(dl|driving licen[cs]e|license)\b/i.test(text) || /\bdl verification\b/i.test(text),
    },
    {
        actionKey: 'request_valet_drop',
        looksLikeMatch: (text) =>
            /\b(request|call|book|get)\b.*\bvalet\b/i.test(text) ||
            /\bvalet\b.*\b(drop|service|pickup|pick up)\b/i.test(text) ||
            /\bdrop my (car|vehicle)\b/i.test(text),
    },
    {
        actionKey: 'set_odometer',
        looksLikeMatch: (text) =>
            /\b(update|set|log|record)\b.*\bodometer\b/i.test(text) ||
            /\bodometer\b.*\b(reading|is|update|km|kms)\b/i.test(text) ||
            /\bmy (car|vehicle|bike) (has done|is at)\b/i.test(text),
    },
];

async function previewVoiceAction(actionKey: string, text: string, knownValues: Record<string, any>): Promise<any> {
    const response = await api.post<any>(`/v1/voice-actions/${actionKey}/preview`, { text, knownValues });
    return (response as any)?.data ?? response;
}

async function commitVoiceAction(actionKey: string, values: Record<string, any>, previewedAt?: string): Promise<any> {
    const response = await api.post<any>(`/v1/voice-actions/${actionKey}/commit`, { values, previewedAt });
    return (response as any)?.data ?? response;
}

function buildCommitResolution(sessionId: string, actionKey: string, commitResult: any): VoiceActionResolution {
    const base = { sessionId, voiceUrl: null as null, agentSteps: [] as any[] };

    if (commitResult?.stale) {
        return {
            ...base,
            message: commitResult.reason || 'That has expired. Please say the command again.',
            contextUsed: 0,
            toolResults: [],
        };
    }

    if (commitResult?.skipped) {
        return {
            ...base,
            message: commitResult.reason || 'That was already done — skipping.',
            contextUsed: 0,
            toolResults: [],
        };
    }

    if (commitResult?.success) {
        return {
            ...base,
            message: commitResult.message || 'Done.',
            contextUsed: 1,
            toolResults: [{ kind: 'voice_action_committed', actionKey }],
            navigate: commitResult.navigate,
        };
    }

    return {
        ...base,
        message: commitResult?.message || 'I could not complete that. Please try again.',
        contextUsed: 0,
        toolResults: [],
    };
}

async function resolveFromPreview(sessionId: string, actionKey: string, preview: any): Promise<VoiceActionResolution> {
    if (!preview?.success) {
        return {
            sessionId,
            message: 'I could not understand that. Please try again.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }

    if (preview.requiresConfirmation) {
        pendingVoiceActions.set(sessionId, {
            actionKey,
            knownValues: preview.values || {},
            expiresAt: Date.now() + PENDING_VOICE_ACTION_TTL_MS,
        });
        return {
            sessionId,
            message: preview.askPrompt || 'Should I go ahead with this?',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [{ kind: 'voice_action_pending_confirmation', actionKey }],
            agentSteps: [],
        };
    }

    try {
        const commitResult = await commitVoiceAction(actionKey, preview.values, preview.previewedAt);
        return buildCommitResolution(sessionId, actionKey, commitResult);
    } catch {
        return {
            sessionId,
            message: 'I could not complete that right now. Please try again.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }
}

/**
 * Handles a reply to a pending voice-action question from a previous turn (e.g. answering
 * "which category?" with "fuel"). Must run before the fresh-command gate so a short slot-filling
 * reply isn't mistaken for an unrelated new command. Returns null if there's no pending action
 * for this session, or if it expired — both fall through to normal handling.
 */
export async function tryResolvePendingVoiceAction(
    message: string,
    sessionId: string | undefined,
): Promise<VoiceActionResolution | null> {
    if (!sessionId) return null;
    const pending = pendingVoiceActions.get(sessionId);
    if (!pending) return null;
    pendingVoiceActions.delete(sessionId);

    if (Date.now() > pending.expiresAt) return null;

    const text = getEffectiveText(message);

    try {
        const preview = await previewVoiceAction(pending.actionKey, text, pending.knownValues);
        return resolveFromPreview(sessionId, pending.actionKey, preview);
    } catch {
        return {
            sessionId,
            message: 'Something went wrong. Please try again.',
            voiceUrl: null,
            contextUsed: 0,
            toolResults: [],
            agentSteps: [],
        };
    }
}

/**
 * Gates a fresh message against every registered voice action and, on a match, drives the
 * preview -> ask-if-incomplete -> commit flow generically.
 */
export async function tryResolveLocalVoiceAction(
    message: string,
    sessionId: string | undefined,
): Promise<VoiceActionResolution | null> {
    const text = getEffectiveText(message);
    if (!text) return null;

    const gate = VOICE_ACTION_GATES.find((g) => g.looksLikeMatch(text));
    if (!gate) return null;

    const key = ensureSessionKey(sessionId);

    try {
        const preview = await previewVoiceAction(gate.actionKey, text, {});
        return resolveFromPreview(key, gate.actionKey, preview);
    } catch {
        return null; // fall through to general chat rather than fail the whole turn
    }
}
