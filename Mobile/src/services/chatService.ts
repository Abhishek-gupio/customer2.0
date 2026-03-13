import { api, doRefresh } from './api';
import { API_BASE_URL } from '../config';
import { getAccessToken } from './storage';

// ============================================================================
// Types
// ============================================================================
export interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    metadata?: {
        voiceUrl?: string;
        toolResults?: any[];
        agentSteps?: any[];
        hadImage?: boolean;
    };
    createdAt: string;
}

export interface ChatSession {
    id: string;
    title: string;
    updatedAt: string;
}

export interface ChatResponse {
    data: {
        sessionId: string;
        message: string;
        voiceUrl?: string | null;
        contextUsed: number;
        toolResults?: any[];
        agentSteps?: any[];
    };
}

export interface SessionsResponse {
    data: ChatSession[];
}

export interface HistoryResponse {
    data: {
        id: string;
        title: string;
        summary?: string;
        messages: ChatMessage[];
    };
}

export interface AnalyticsResponse {
    data: {
        period: string;
        totalInteractions: number;
        avgResponseTimeMs: number;
        toolUsage: { tool: string; count: number }[];
        feedback: {
            thumbsUp: number;
            thumbsDown: number;
            satisfactionRate: number | null;
        };
        dailyUsage: { date: string; count: number }[];
    };
}

// SSE chunk types
export interface SSEChunk {
    type: 'session' | 'chunk' | 'tool_start' | 'tool_result' | 'tool_error' | 'done' | 'error';
    sessionId?: string;
    text?: string;
    tool?: string;
    message?: string;
    result?: any;
    error?: string;
    voiceUrl?: string;
    contextUsed?: number;
    toolResults?: any[];
}

// ============================================================================
// Chat Service
// ============================================================================
export const chatService = {
    /**
     * Send a chat message (standard, non-streaming)
     */
    async sendMessage(
        message: string,
        sessionId?: string,
        options?: { agentMode?: boolean; image?: { uri: string; type: string; name: string } },
    ): Promise<ChatResponse['data']> {
        if (options?.image) {
            // Use FormData for image upload
            const formData = new FormData();
            formData.append('message', message);
            if (sessionId) formData.append('sessionId', sessionId);
            if (options.agentMode) formData.append('agentMode', 'true');
            formData.append('image', {
                uri: options.image.uri,
                type: options.image.type,
                name: options.image.name,
            } as any);

            const result = await api.upload<ChatResponse>('/v1/chat', formData);
            return result.data;
        }

        const body: any = { message };
        if (sessionId) body.sessionId = sessionId;
        if (options?.agentMode) body.agentMode = true;

        const result = await api.post<ChatResponse>('/v1/chat', body);
        return result.data;
    },

    /**
     * Send a chat message with SSE streaming
     * Calls the callback for each received chunk
     */
    async sendMessageStream(
        message: string,
        sessionId: string | undefined,
        onChunk: (chunk: SSEChunk) => void,
        options?: { image?: { uri: string; type: string; name: string } },
    ): Promise<void> {
        const url = `${API_BASE_URL}/api/v1/chat/stream`;

        let body: any;
        let headers: Record<string, string> = {};

        if (options?.image) {
            const formData = new FormData();
            formData.append('message', message);
            if (sessionId) formData.append('sessionId', sessionId);
            formData.append('image', {
                uri: options.image.uri,
                type: options.image.type,
                name: options.image.name,
            } as any);
            body = formData;
            headers = { Accept: 'text/event-stream' };
        } else {
            body = JSON.stringify({ message, sessionId });
            headers = {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            };
        }

        const setAuthHeader = () => {
            const t = getAccessToken();
            if (t) headers.Authorization = `Bearer ${t}`;
        };

        setAuthHeader();
        if (!headers.Authorization) await doRefresh();
        setAuthHeader();

        let response = await fetch(url, {
            method: 'POST',
            headers,
            body,
        });

        if (response.status === 401) {
            const refreshed = await doRefresh();
            if (refreshed) {
                setAuthHeader();
                response = await fetch(url, { method: 'POST', headers, body });
            }
        }

        if (!response.ok) {
            throw new Error(`Stream failed: ${response.status}`);
        }

        const parseSSELines = (text: string) => {
            const lines = text.split(/\r?\n/);
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const chunk = JSON.parse(line.slice(6)) as SSEChunk;
                        onChunk(chunk);
                    } catch {
                        // Skip malformed chunks
                    }
                }
            }
        };

        const reader = response.body?.getReader();
        if (reader) {
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop() || '';
                    parseSSELines(lines.join('\n'));
                }
                if (buffer) parseSSELines(buffer);
            } finally {
                reader.releaseLock();
            }
        } else {
            // React Native or other envs may not support response.body.getReader()
            const text = await response.text();
            parseSSELines(text);
        }
    },

    /**
     * List all chat sessions
     */
    async listSessions(): Promise<ChatSession[]> {
        const result = await api.get<SessionsResponse>('/v1/chat/sessions');
        return result.data;
    },

    /**
     * Get chat history for a session
     */
    async getHistory(sessionId: string): Promise<HistoryResponse['data']> {
        const result = await api.get<HistoryResponse>(
            `/v1/chat/sessions/${sessionId}`,
        );
        return result.data;
    },

    /**
     * Get chat analytics
     */
    async getAnalytics(days = 30): Promise<AnalyticsResponse['data']> {
        const result = await api.get<AnalyticsResponse>(
            `/v1/chat/analytics?days=${days}`,
        );
        return result.data;
    },

    /**
     * Submit feedback (thumbs up/down)
     */
    async submitFeedback(sessionId: string, score: 1 | -1): Promise<void> {
        await api.post('/v1/chat/feedback', { sessionId, score });
    },
};
