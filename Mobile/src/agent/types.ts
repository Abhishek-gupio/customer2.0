/** Mirrors Backend/src/agent/types.ts — keep these two in sync by hand (no shared package today). */

export interface ClientContext {
    screen?: string;
    selectedItem?: string;
    visibleComponents?: string[];
    draftState?: Record<string, unknown>;
    navigationStack?: string[];
    userSelection?: Record<string, unknown>;
    permissions?: string[];
    deviceCapabilities?: Record<string, unknown>;
}

export type UIEvent =
    | { type: 'open_view'; view: string; params?: Record<string, unknown> }
    | {
          type: 'update_state';
          draftKey: string;
          fields: Record<string, unknown>;
          missingFields?: string[];
          status?: 'pending' | 'ready' | 'error';
      }
    | { type: 'highlight'; target: string }
    | { type: 'focus_input'; target: string }
    | { type: 'show_loading'; target?: string; label?: string }
    | { type: 'show_toast'; message: string; variant?: 'success' | 'error' | 'info' }
    | { type: 'show_modal'; modal: string; params?: Record<string, unknown> }
    | { type: 'ask_user'; prompt: string }
    | { type: 'navigate_back' }
    | { type: 'speak'; text: string };

/**
 * One executed tool call. `kind` is the discriminant this app branches on to confirm a write
 * actually happened — absence of it is treated as "not confirmed", so it must be emitted by the
 * backend for every mutating tool (see `kindForToolResult` in Backend/src/agent/events.ts).
 *
 * `'sos'` is produced locally by chatService's emergency pre-check, not by the server — it is
 * listed here because the same array is read by both paths.
 */
export interface ToolResult {
    tool?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    kind?: 'expense_created' | 'profile_updated' | 'sos';
    /** Present only on locally-produced `kind: 'sos'` results. */
    sosAlertId?: string;
    type?: string;
    latitude?: number;
    longitude?: number;
}

export interface AgentResponse {
    sessionId: string;
    message: string;
    voiceUrl?: string | null;
    events: UIEvent[];
    toolResults?: ToolResult[];
    contextUsed?: number;
}

/** One line of the `/v1/agent/message/stream` SSE response. */
export type AgentStreamChunk =
    | { type: 'session'; sessionId?: string }
    | { type: 'event'; event: UIEvent }
    | { type: 'chunk'; text?: string }
    | { type: 'tool_start'; tool?: string }
    | { type: 'tool_result'; tool?: string; message?: string; result?: any }
    | { type: 'tool_error'; tool?: string; error?: string }
    | {
          type: 'done';
          message?: string;
          voiceUrl?: string | null;
          events?: UIEvent[];
          toolResults?: ToolResult[];
          contextUsed?: number;
      }
    | { type: 'error'; message?: string };
