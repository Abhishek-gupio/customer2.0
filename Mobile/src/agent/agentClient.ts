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
): Promise<void> {
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}/api/v1/agent/message/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message, sessionId, clientContext: currentClientContext() }),
    });

    if (!response.body || !response.ok) {
        throw new Error(`Agent stream request failed (${response.status})`);
    }

    const parseSSELines = (text: string) => {
        for (const line of text.split(/\r?\n/)) {
            if (!line.startsWith('data:')) continue;
            const raw = line.slice(5).trim();
            if (!raw) continue;
            try {
                const chunk: AgentStreamChunk = JSON.parse(raw);
                if (chunk.type === 'event') publish(chunk.event);
                if (chunk.type === 'done' && chunk.events) publishAll(chunk.events);
                onChunk(chunk);
            } catch {
                // malformed line — skip rather than abort the whole stream
            }
        }
    };

    if (response.body.getReader) {
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
        // Some RN environments don't support response.body.getReader() — fall back to reading
        // the whole response at once (loses incremental delivery, keeps correctness).
        const text = await response.text();
        parseSSELines(text);
    }
}
