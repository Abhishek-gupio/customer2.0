import { logger } from "../config/logger";
import { agentMemoryStore } from "./memory.store";
import { runFlowTurn } from "./flows/engine";
import { fromToolResult } from "./events";
import { Flow, ToolDefinition, UIEvent } from "./types";

/** What the runtime resolved a turn down to — a flow to run, a tool to call directly, or chat. */
export type ResolvedIntent =
  | { kind: "flow"; flow: Flow; knownValues: Record<string, any> }
  | { kind: "tool"; tool: ToolDefinition };

export interface ExecutionResult {
  message: string;
  events: UIEvent[];
  voiceUrl?: string | null;
  toolResults?: Array<{ tool: string; args: any; result: any }>;
  contextUsed?: number;
}

/**
 * Dispatches a resolved flow/tool intent. "chat" isn't handled here — it's the one strategy
 * that genuinely needs a different shape for streaming (token-by-token) vs. non-streaming
 * (buffered), so `runtime.ts` calls `ai.service.ts` directly for that case. Flow and tool
 * intents always resolve in one shot regardless of transport, so they share this one path.
 */
export async function execute(
  customerId: string,
  sessionId: string,
  utterance: string,
  intent: ResolvedIntent,
): Promise<ExecutionResult> {
  if (intent.kind === "flow") {
    try {
      const turn = await runFlowTurn(customerId, intent.flow, utterance, intent.knownValues);
      if (turn.done) {
        await agentMemoryStore.recordAction(sessionId, {
          type: turn.failed ? "flow_failed" : "flow_committed",
          key: turn.flowKey,
          at: Date.now(),
        });
        await agentMemoryStore.clearWorkflow(sessionId);
      } else {
        const memory = await agentMemoryStore.get(sessionId);
        await agentMemoryStore.set(sessionId, {
          ...memory,
          workflow: turn.flowKey,
          step: turn.waitingForSlot,
          waitingFor: turn.waitingForSlot,
          slots: turn.knownValues,
          updatedAt: Date.now(),
        });
      }
      return { message: turn.message, events: turn.events, voiceUrl: null };
    } catch (err) {
      logger.error({ err, flowKey: intent.flow.key, customerId }, "[execution-engine] flow turn failed");
      await agentMemoryStore.clearWorkflow(sessionId);
      return { message: "Something went wrong with that request. Please try again.", events: [] };
    }
  }

  // Direct tool dispatch — only ever offered by the planner for a hand-curated set of
  // read-only tools whose every parameter is optional, so there's no argument-extraction
  // risk in calling with an empty args object.
  try {
    const result = await intent.tool.execute(customerId, {});
    await agentMemoryStore.recordAction(sessionId, { type: "tool_called", key: intent.tool.name, at: Date.now() });
    const message = typeof result?.message === "string" ? result.message : "Here's what I found.";
    return {
      message,
      events: fromToolResult(intent.tool.name, result),
      voiceUrl: null,
      toolResults: [{ tool: intent.tool.name, args: {}, result }],
    };
  } catch (err) {
    logger.error({ err, tool: intent.tool.name, customerId }, "[execution-engine] direct tool call failed");
    return { message: "I couldn't fetch that right now. Please try again.", events: [] };
  }
}
