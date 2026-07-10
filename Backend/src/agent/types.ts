/**
 * Core contracts for the generalized AI agent runtime.
 *
 * Layers (see architecture discussion): Client Context (2), Tool Layer (6), Flow Engine (4),
 * Event Generator (7), Memory (5). The runtime (3) and event bus (8) are the only pieces that
 * aren't plain data shapes — see runtime.ts and Mobile/src/agent/eventBus.ts respectively.
 */

/** Sent by the client with every request so the agent knows what the user is already looking at. */
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

/**
 * The agent never navigates or mutates UI directly — it emits events, and the client decides
 * how to render them. Keep this union additive: new event types must not require old clients
 * to understand them (an unrecognized event type is simply ignored on the client).
 */
export type UIEvent =
  | { type: "open_view"; view: string; params?: Record<string, unknown> }
  | {
      type: "update_state";
      draftKey: string;
      fields: Record<string, unknown>;
      missingFields?: string[];
      status?: "pending" | "ready" | "error";
    }
  | { type: "highlight"; target: string }
  | { type: "focus_input"; target: string }
  | { type: "show_loading"; target?: string; label?: string }
  | { type: "show_toast"; message: string; variant?: "success" | "error" | "info" }
  | { type: "show_modal"; modal: string; params?: Record<string, unknown> }
  | { type: "ask_user"; prompt: string }
  | { type: "navigate_back" }
  | { type: "speak"; text: string };

/** A single capability the agent can invoke. Ownership/scoping is enforced inside `execute`. */
export interface ToolDefinition {
  name: string;
  description: string;
  /** Coarse grouping used by the runtime's keyword-based tool shortlist (see tools/registry.ts). */
  category: string;
  /** Free-text type hints per arg, e.g. "string (required)" — mirrors the existing Gemini function-declaration derivation. */
  parameters: Record<string, string>;
  execute(customerId: string, args: Record<string, any>, ctx?: ClientContext): Promise<any>;
}

export type FlowConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface FlowSlot {
  name: string;
  askPrompt: string;
  /** Defaults to true. Missing optional slots don't block commit — see flows/registry.ts. */
  required?: boolean;
}

export interface FlowExtractResult {
  /** Merged known + newly-extracted values. Never drop a value already present in knownValues. */
  values: Record<string, any>;
  missingSlots: string[];
  confidence: FlowConfidence;
}

export interface FlowCommitResult {
  success: boolean;
  message: string;
  data?: any;
  /**
   * Only for the rare case where the driving screen isn't a plain root-stack view (e.g. a
   * screen nested inside a tab navigator) — the engine still authors the actual event, this
   * only redirects *where*. A flow must never construct a UIEvent itself; that would put UI
   * concerns inside business logic, same reason tools never navigate.
   */
  viewOverride?: { view: string; params?: Record<string, unknown> };
  skipped?: boolean;
  reason?: string;
}

/** A named, resumable workflow: Understand Intent -> Collect Missing Info -> Execute Tools -> Commit. */
export interface Flow {
  key: string;
  /** One-line, human-readable description of what this flow does — shown to the planner (see agent/planner.ts) so it can route messages that don't match `matches()`. */
  description: string;
  /** Cheap keyword/regex fast-path checked before the planner LLM call — saves latency/cost on obvious commands ("set my odometer to 12000"); anything subtler falls through to the planner. */
  matches(utterance: string): boolean;
  /** The screen this flow drives. */
  view: string;
  /** Key used for `update_state` events / the client-side state store. */
  draftKey: string;
  slots: FlowSlot[];
  extract(
    customerId: string,
    utterance: string,
    knownValues: Record<string, any>,
    missingSlotsHint: string[],
  ): Promise<FlowExtractResult>;
  /** Re-validates `values` server-side and commits. Must be safe to call more than once (refine-in-place). */
  commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult>;
}

/**
 * What the Planner decided to do with a message. An array of steps even though today's planner
 * only ever produces one — so a future multi-step plan (e.g. run a tool, then answer) is an
 * additive change to the Execution Engine's loop, not a reshape of this contract.
 */
export type PlanStep =
  | { type: "flow"; flowKey: string }
  | { type: "tool"; toolName: string }
  | { type: "chat" };

export interface ExecutionPlan {
  steps: PlanStep[];
  confidence: FlowConfidence;
}

/** One completed action, kept so the planner doesn't re-ask something already done this session. */
export interface ExecutionRecord {
  type: "flow_committed" | "flow_failed" | "tool_called" | "general_turn";
  key: string;
  at: number;
  summary?: string;
}

/**
 * What's remembered server-side about the session's current workflow. Client memory is never
 * authoritative. Generic on purpose — adding a new flow never requires touching this shape.
 */
export interface AgentMemory {
  /** Current in-progress flow's key, or null if the session isn't mid-workflow. */
  workflow: string | null;
  /** The slot currently being asked about, or null. */
  step: string | null;
  /** Accumulated slot values for `workflow`. */
  slots: Record<string, any>;
  /** Same as `step` today; kept distinct because "what's missing" and "what we last asked" can diverge once a flow supports re-asking. */
  waitingFor: string | null;
  /** Capped, most-recent-first log of completed actions this session. */
  history: ExecutionRecord[];
  updatedAt: number;
}

export interface AgentRequest {
  message: string;
  sessionId?: string;
  clientContext?: ClientContext;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface AgentResponse {
  sessionId: string;
  message: string;
  voiceUrl?: string | null;
  events: UIEvent[];
  toolResults?: Array<{ tool: string; args: any; result: any }>;
  contextUsed?: number;
}
