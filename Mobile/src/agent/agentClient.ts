import { Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { getAccessToken } from '../services/storage';
import { api, getNetworkOnlineState } from '../services/api';
import { AgentResponse, AgentStreamChunk, ClientContext } from './types';
import { publish, publishAll } from './eventBus';
import { navigationRef } from '../navigation/navigationRef';
import { useAgentStateStore } from './stateStore';

/**
 * Everything here is a real, cheaply-available signal — no placeholder/fabricated fields.
 * `visibleComponents`/`loadingStates`/`permissions` are left unset rather than faked: nothing
 * in the app currently tracks those as a queryable registry. Add them here once something
 * does, rather than inventing values now.
 */
function currentClientContext(): ClientContext {
    const state = navigationRef.isReady() ? navigationRef.getState() : undefined;
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : undefined;
    const navigationStack = state?.routes?.map((r) => r.name);
    const drafts = useAgentStateStore.getState().drafts;

    return {
        screen: route?.name,
        navigationStack,
        userSelection: (route?.params as Record<string, unknown>) ?? undefined,
        draftState: Object.keys(drafts).length > 0 ? drafts : undefined,
        deviceCapabilities: {
            os: Platform.OS,
            osVersion: Platform.Version,
            online: getNetworkOnlineState(),
        },
    };
}

interface AgentApiEnvelope {
    success: boolean;
    data: AgentResponse;
}

/**
 * Ceiling on one agent turn. Generous, because a turn may legitimately run a planner call, several
 * tool calls and a generation pass — but finite, so a hung provider cannot leave the chat screen
 * spinning forever with no way to recover.
 */
const AGENT_REQUEST_TIMEOUT_MS = 60_000;

/**
 * The single client entrypoint the app talks to: one call in, one event-bearing response out.
 * Replaces the old chatService/voiceActionService split — the server now owns intent routing,
 * flow state, and tool-calling (Layers 3-6); this file's only job is Layer 1's five
 * responsibilities (send the message + context, apply the returned events).
 *
 * `sessionId` is caller-managed (like the old `chatService.sendMessage`'s second argument) —
 * the app has multiple independent conversation threads (the Hey Gupio overlay, the full chat
 * screen, per-session history), so this file must not pin one global session itself. Pass the
 * caller's current session ref in, and store the returned `sessionId` back into that same ref.
 */
export async function sendAgentMessage(message: string, sessionId?: string): Promise<AgentResponse> {
    const envelope = await api.post<AgentApiEnvelope>('/v1/agent/message', {
        message,
        sessionId,
        clientContext: currentClientContext(),
    });
    const response = envelope.data;
    publishAll(response.events || []);
    return response;
}

/**
 * Streaming counterpart: the UI reacts as each event/token arrives instead of waiting for the
 * full turn. `onChunk` gets called once per SSE line; events on `type: 'event'` chunks are also
 * published to the bus immediately (same as the non-streaming call, just incrementally).
 */
export async function sendAgentMessageStream(
    message: string,
    sessionId: string | undefined,
    onChunk: (chunk: AgentStreamChunk) => void,
    signal?: AbortSignal,
): Promise<void> {
    const token = getAccessToken();

    // A turn can legitimately take a while (planner + tools + generation), but not forever — with
    // no ceiling a hung provider call leaves the chat screen spinning with no way out. The
    // caller's `signal` allows an explicit cancel (e.g. the user navigating away) to abort too.
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onAbort);
    }
    const timeoutId = setTimeout(() => controller.abort(), AGENT_REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/api/v1/agent/message/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ message, sessionId, clientContext: currentClientContext() }),
            signal: controller.signal,
        });
    } catch (error: any) {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        if (controller.signal.aborted) {
            throw new Error('Agent request timed out or was cancelled');
        }
        throw error;
    }

    if (!response.ok) {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
        throw new Error(`Agent stream request failed (${response.status})`);
    }

    // A turn is only complete once the server has sent a terminal frame. Tracked because a 200
    // response whose body carries no usable frames — buffered/stripped by a proxy, truncated, or
    // entirely unparseable — would otherwise let this function resolve as if the turn succeeded,
    // leaving the caller's message bubble streaming forever with no error and no retry.
    let sawTerminalFrame = false;

    const parseSSELines = (text: string) => {
        for (const line of text.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            let chunk: AgentStreamChunk;
            try {
                chunk = JSON.parse(raw);
            } catch {
                // Malformed frame — skip this line rather than abort the whole stream. Kept
                // narrow to JSON.parse on purpose: a throw from `publish`/`onChunk` below is a
                // real bug, and swallowing it here used to hide the server's `error` chunk and
                // leave the message bubble spinning forever.
                continue;
            }
            if (chunk.type === 'event') publish(chunk.event);
            if (chunk.type === 'done' && chunk.events) publishAll(chunk.events);
            if (chunk.type === 'done' || chunk.type === 'error') sawTerminalFrame = true;
            onChunk(chunk);
        }
    };

    // React Native's whatwg-fetch polyfill never populates `response.body`, and only resolves
    // once the whole response has arrived — so on RN this is always false today. Treating that
    // as a *failure* (which is what an earlier `!response.body` throw did) meant the server had
    // already executed the entire turn and the caller then re-sent the same message to the
    // non-streaming endpoint: every message ran twice, duplicating non-idempotent commits.
    // Missing streaming support is not an error; it just means read the body in one pass below.
    try {
        if (response.body && typeof response.body.getReader === 'function') {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split(/\r?\n\r?\n/);
                    buffer = lines.pop() || '';
                    parseSSELines(lines.join('\n'));
                }
                if (buffer) parseSSELines(buffer);
            } finally {
                reader.releaseLock();
            }
        } else {
            // No incremental reader available: the turn has already completed server-side and the
            // full SSE payload is sitting in this same response. Parse it in one pass — loses
            // token-by-token delivery, keeps correctness, and does NOT re-run the turn.
            const text = await response.text();
            parseSSELines(text);
        }
    } finally {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', onAbort);
    }

    // Resolving without a terminal frame would look like success to the caller. Throw instead, so
    // the turn is reported as failed and the UI can recover rather than stream indefinitely.
    if (!sawTerminalFrame) {
        throw new Error('Agent stream ended without completing');
    }
}
