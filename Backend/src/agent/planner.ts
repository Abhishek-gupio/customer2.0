import { routeText } from "./modelRouter";
import { logger } from "../config/logger";
import { ExecutionPlan, Flow, ToolDefinition } from "./types";

/**
 * The reasoning step keyword gates can't do: "I have ₹5,000 for my next vacation" or "I need a
 * holiday" don't match any flow's regex, but both clearly mean plan_trip. This produces an
 * ExecutionPlan (not just a flow/general binary) so the Execution Engine has a real decision to
 * dispatch on: start a known workflow, call a specific read-only tool directly, or hand off to
 * the general chat pipeline (which itself already does RAG + tool-calling + generation).
 *
 * Direct tool dispatch is offered only for a hand-curated set of read-only, all-optional-args
 * tools (the caller passes these in, see `DIRECT_DISPATCH_TOOL_NAMES` in runtime.ts) — called
 * with no arguments, they still return something useful (e.g. `get_challans` with no vehicle
 * given returns a per-vehicle summary). Anything that actually needs extracted arguments (an
 * amount, a specific vehicle by name, a date) stays on the general chat pipeline, whose Gemini
 * function-calling already extracts arguments reliably; re-implementing that here with no
 * safety net isn't worth the risk for something already handled well.
 */
export async function planTurn(
  utterance: string,
  flows: Flow[],
  directDispatchTools: ToolDefinition[],
  currentScreen?: string,
): Promise<ExecutionPlan> {
  if (flows.length === 0 && directDispatchTools.length === 0) {
    return { steps: [{ type: "chat" }], confidence: "HIGH" };
  }

  const flowCatalog = flows.map((f) => `- flow:${f.key} — ${f.description}`).join("\n");
  const toolCatalog = directDispatchTools.map((t) => `- tool:${t.name} — ${t.description}`).join("\n");
  const screenHint = currentScreen ? `\nThe user is currently looking at the "${currentScreen}" screen.` : "";

  const systemPrompt = `You are the intent router for a vehicle-management app's AI agent. Decide how to handle the user's message: start a known workflow, call a simple read-only lookup directly, or hand it to general conversation.

Known workflows (multi-turn, may ask follow-up questions):
${flowCatalog || "(none)"}

Simple read-only lookups (answer immediately, no follow-up questions, no arguments needed):
${toolCatalog || "(none)"}
${screenHint}

Rules:
- Choose a workflow if the user's underlying intent matches it, even if phrasing is indirect or casual (e.g. "I have some money saved for a getaway" means flow:plan_trip, not just literal "plan a trip").
- Choose a lookup ONLY if the user is clearly just asking for that exact information with nothing else needed.
- Do not choose either just because a related word is mentioned in passing — the user must actually want that outcome now.
- If genuinely unsure, prefer "chat" — a wrong workflow/lookup start is more disruptive than falling back to normal conversation, which can still reason and call tools itself.
Output ONLY raw JSON, no markdown, no explanation: {"action": "flow"|"tool"|"chat", "key": string|null, "confidence": "HIGH"|"MEDIUM"|"LOW"}`;

  try {
    const raw = await routeText(utterance, systemPrompt, { temperature: 0.1, maxOutputTokens: 100 });
    const clean = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);
    const confidence = parsed.confidence ?? "MEDIUM";

    if (parsed.action === "flow" && typeof parsed.key === "string" && flows.some((f) => f.key === parsed.key)) {
      return { steps: [{ type: "flow", flowKey: parsed.key }], confidence };
    }
    if (parsed.action === "tool" && typeof parsed.key === "string" && directDispatchTools.some((t) => t.name === parsed.key)) {
      return { steps: [{ type: "tool", toolName: parsed.key }], confidence };
    }
    return { steps: [{ type: "chat" }], confidence };
  } catch (err) {
    logger.warn({ err }, "[planner] classification failed, defaulting to chat");
    return { steps: [{ type: "chat" }], confidence: "LOW" };
  }
}
