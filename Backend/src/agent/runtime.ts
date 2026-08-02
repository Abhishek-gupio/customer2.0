import crypto from "crypto";
import { aiService } from "../services/ai.service";
import { AgentRequest, AgentResponse, ClientContext } from "./types";
import { agentMemoryStore } from "./memory.store";
import { matchFlow, getFlow, listFlows } from "./flows/registry";
import { getTool, TOOLS } from "./tools/registry";
import { planTurn } from "./planner";
import { execute, ResolvedIntent } from "./executionEngine";
import "./flows"; // registers all flows as a side effect
import { fromNavigate } from "./events";

// Tools safe for the planner to dispatch directly, without going through Gemini's own
// tool-calling loop: every one of these is read-only and every parameter is optional (no
// argument-extraction risk in calling with `{}`). Hand-curated, not auto-detected from
// "all params optional" — a couple of tools are technically all-optional but excluded on
// purpose (e.g. `sync_challans` hits a paid third-party API and should only fire on explicit
// user intent, not a planner guess).
const DIRECT_DISPATCH_TOOL_NAMES = new Set([
  "get_smart_recommendations",
  "get_profile",
  "get_current_trip_info",
  "list_my_vehicles",
  "get_vehicle_status",
  "get_maintenance_advisor",
  "get_notifications",
  "list_support_tickets",
  "get_challans",
  "get_document_status",
  "list_documents",
  "get_driving_trips_summary",
  "get_service_history",
  "get_upcoming_service_parts",
  "get_expenses_summary",
]);
const DIRECT_DISPATCH_TOOLS = TOOLS.filter((t) => DIRECT_DISPATCH_TOOL_NAMES.has(t.name));

// If a pending flow is waiting on a slot and the user's next message is one of these, they're
// abandoning it, not answering it — e.g. "cancel", "never mind", "forget it", "stop that".
const CANCEL_PHRASE = /^\s*(cancel|never\s*mind|nevermind|forget it|stop(\s+that)?|nahi|nahi\s*chahiye|chodo|band\s*karo|skip\s*(it|that)?)\s*[.!]*\s*$/i;

/**
 * The Planner (Layer 3's reasoning step): decides what this turn is, producing an
 * ExecutionPlan-backed intent rather than a flow/general binary.
 *
 *   1. Continuing a workflow already in progress for this session? Only if the new message
 *      still looks like it belongs to that workflow — an explicit cancel phrase, or a message
 *      that clearly matches a *different* flow's own gate (e.g. "plan a trip for me" while a
 *      support-ticket flow is mid-question), abandons the stale pending flow instead of being
 *      misinterpreted as an answer to whatever it was asking. Otherwise, keep running it.
 *   2. Else, does a cheap keyword gate match? -> that flow, zero LLM cost.
 *   3. Else, ask the planner: does this message's *intent* match a known workflow or a simple
 *      read-only lookup, even if the wording doesn't match anything literally?
 *   4. Otherwise -> null, meaning the Execution Engine's "chat" strategy (RAG + tool-calling +
 *      Gemini/Groq generation, unchanged) handles it.
 */
async function resolveIntent(
  customerId: string,
  sessionId: string,
  utterance: string,
  clientContext?: ClientContext,
): Promise<ResolvedIntent | null> {
  const memory = await agentMemoryStore.get(customerId, sessionId);
  const pendingFlow = memory.workflow ? getFlow(memory.workflow) : undefined;

  if (pendingFlow) {
    if (CANCEL_PHRASE.test(utterance)) {
      await agentMemoryStore.clearWorkflow(customerId, sessionId);
      return null; // falls through to "chat", which will just acknowledge naturally
    }
    const differentFlow = matchFlow(utterance);
    if (differentFlow && differentFlow.key !== pendingFlow.key) {
      // The user moved on to something else entirely — start that instead of force-feeding
      // this message into the stale flow's extractor as if it answered its question.
      await agentMemoryStore.clearWorkflow(customerId, sessionId);
      return { kind: "flow", flow: differentFlow, knownValues: {} };
    }
    if (differentFlow && differentFlow.key === pendingFlow.key) {
      // Re-stating this flow's own trigger is a restart, not an answer to the outstanding
      // question. Carrying the old slots forward here is how "set my fuel budget" ... "no, set
      // the parking budget to 2000" ended up writing ₹2000 against FUEL: the stale category
      // survived and only the amount was taken from the correction.
      //
      // The attempt counter deliberately survives the reset. Clearing it too would let a user who
      // keeps restating the trigger loop forever — each restart returning the cap to zero — which
      // is exactly the unbounded-cost case the cap exists to stop.
      const attemptsSoFar = memory.slots?.__attempts;
      await agentMemoryStore.clearWorkflow(customerId, sessionId);
      return {
        kind: "flow",
        flow: pendingFlow,
        knownValues: attemptsSoFar != null ? { __attempts: attemptsSoFar } : {},
      };
    }
    return { kind: "flow", flow: pendingFlow, knownValues: memory.slots };
  }

  const gated = matchFlow(utterance);
  if (gated) {
    return { kind: "flow", flow: gated, knownValues: {} };
  }

  const plan = await planTurn(utterance, listFlows(), DIRECT_DISPATCH_TOOLS, clientContext?.screen);
  if (plan.confidence === "LOW") return null;

  const step = plan.steps[0];
  if (step?.type === "flow") {
    const flow = getFlow(step.flowKey);
    if (flow) return { kind: "flow", flow, knownValues: {} };
  }
  if (step?.type === "tool") {
    const tool = getTool(step.toolName);
    if (tool) return { kind: "tool", tool };
  }
  return null;
}

/** Non-streaming entrypoint — one request in, one event-bearing response out. */
export async function handleAgentMessage(customerId: string, request: AgentRequest): Promise<AgentResponse> {
  const sessionId = request.sessionId || crypto.randomUUID();
  const utterance = request.message.trim();

  const intent = await resolveIntent(customerId, sessionId, utterance, request.clientContext);
  if (intent) {
    const result = await execute(customerId, sessionId, utterance, intent);
    return { sessionId, ...result };
  }

  // Execution Engine's "chat" strategy — the existing RAG + tool-calling + Gemini/Groq
  // generation pipeline, reused as-is.
  const imageBuffer = request.imageBase64 ? Buffer.from(request.imageBase64, "base64") : undefined;
  const chatResponse = await aiService.chat(
    customerId,
    utterance,
    sessionId,
    imageBuffer,
    request.imageMimeType,
    false,
  );
  await agentMemoryStore.recordAction(customerId, sessionId, { type: "general_turn", key: "chat", at: Date.now() });

  return {
    sessionId: chatResponse.sessionId || sessionId,
    message: chatResponse.message,
    voiceUrl: chatResponse.voiceUrl ?? null,
    events: fromNavigate(chatResponse.navigate),
    toolResults: chatResponse.toolResults,
    contextUsed: chatResponse.contextUsed,
  };
}

/**
 * Streaming entrypoint. Flow/tool intents resolve in one shot (extract+commit, or a single
 * tool call, aren't token generation), so "streaming" them means emitting their events as
 * separate lines rather than one bundled response. The chat strategy forwards
 * `ai.service.ts`'s real token-by-token stream unchanged.
 */
export async function* handleAgentMessageStream(
  customerId: string,
  request: AgentRequest,
): AsyncGenerator<string> {
  const sessionId = request.sessionId || crypto.randomUUID();
  const utterance = request.message.trim();

  yield JSON.stringify({ type: "session", sessionId });

  const intent = await resolveIntent(customerId, sessionId, utterance, request.clientContext);
  if (intent) {
    const result = await execute(customerId, sessionId, utterance, intent);
    for (const event of result.events) {
      yield JSON.stringify({ type: "event", event });
    }
    yield JSON.stringify({
      type: "done",
      message: result.message,
      voiceUrl: result.voiceUrl,
      toolResults: result.toolResults,
    });
    return;
  }

  const imageBuffer = request.imageBase64 ? Buffer.from(request.imageBase64, "base64") : undefined;
  const stream = aiService.chatStream(customerId, utterance, sessionId, imageBuffer, request.imageMimeType);

  for await (const rawChunk of stream) {
    let chunk: any;
    try {
      chunk = JSON.parse(rawChunk);
    } catch {
      yield rawChunk;
      continue;
    }

    if (chunk.type === "done") {
      const events = fromNavigate(chunk.navigate);
      yield JSON.stringify({ ...chunk, events });
      await agentMemoryStore.recordAction(customerId, sessionId, { type: "general_turn", key: "chat", at: Date.now() });
      continue;
    }

    yield JSON.stringify(chunk);
  }
}
