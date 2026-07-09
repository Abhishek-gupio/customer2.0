import { registerVoiceAction } from "../voice-action.registry";
import { VoiceAction, VoiceActionExtractResult, VoiceActionCommitResult } from "../voice-action.types";
import { callAI } from "../../../services/ai-provider.service";
import { logger } from "../../../config/logger";
import { createTicketSchema } from "../../support/support.validators";
import { supportService } from "../../support/support.service";

const VALID_CATEGORIES = [
  "VEHICLE",
  "DOCUMENTS",
  "VALET",
  "AI_ASSISTANT",
  "BILLING",
  "ACCOUNT",
  "TECHNICAL",
  "OTHER",
];

// Only subject + description are asked for by voice — category is inferred (defaulting to
// OTHER) rather than a third spoken slot, since it's classifiable from context and a 3-question
// sequence for "file a ticket" is more friction than the content is worth.
const SLOTS: VoiceAction["slots"] = [
  { name: "subject", askPrompt: "What's a short summary of the issue, in a few words?" },
  { name: "description", askPrompt: "Can you describe the issue in a bit more detail?" },
];

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<VoiceActionExtractResult> {
  const systemPrompt = `You extract support-ticket details from a short spoken reply for a vehicle management app.
Only these fields matter:
- subject: a short summary of the issue, between 5 and 100 characters
- description: a fuller explanation of the issue
- category: one of ${VALID_CATEGORIES.join(", ")} — infer from context (app bug/crash -> TECHNICAL, vehicle problem -> VEHICLE, payment issue -> BILLING, document/RC/insurance -> DOCUMENTS, valet -> VALET, login/account -> ACCOUNT, AI assistant itself -> AI_ASSISTANT), otherwise OTHER. Always give a category guess, never null.

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract subject/description if clearly present in what the user just said — do not guess or invent content they didn't say.
Output ONLY raw JSON, no markdown, no explanation: {"subject": string|null, "description": string|null, "category": string}`;

  let parsed: any = {};
  try {
    const raw = await callAI(newReplyText, systemPrompt, { temperature: 0.2, maxOutputTokens: 300 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.debug({ err }, "[VoiceAction:create_support_ticket] extract parse failed");
    parsed = {};
  }

  // knownValues is authoritative — never overwrite an already-resolved slot.
  const values: Record<string, any> = { ...knownValues };
  if (values.subject == null && typeof parsed.subject === "string" && parsed.subject.trim().length >= 5) {
    values.subject = parsed.subject.trim().slice(0, 100);
  }
  if (values.description == null && typeof parsed.description === "string" && parsed.description.trim().length > 0) {
    values.description = parsed.description.trim().slice(0, 5000);
  }
  if (values.category == null && typeof parsed.category === "string") {
    values.category = parsed.category.toUpperCase();
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const confidence: "HIGH" | "MEDIUM" | "LOW" = missingSlots.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<VoiceActionCommitResult> {
  const category = VALID_CATEGORIES.includes(String(values.category).toUpperCase())
    ? String(values.category).toUpperCase()
    : "OTHER";

  const parsedInput = createTicketSchema.safeParse({
    subject: values.subject,
    description: values.description,
    category,
  });

  if (!parsedInput.success) {
    return {
      success: false,
      message: "I couldn't create that ticket — the summary needs to be at least 5 characters and a description is required.",
      reason: parsedInput.error.message,
    };
  }

  const ticket = await supportService.createTicket(customerId, parsedInput.data as any);

  return {
    success: true,
    message: "Support ticket created. Our team will look into it.",
    navigateParams: { ticketId: ticket.id },
  };
}

registerVoiceAction({
  key: "create_support_ticket",
  slots: SLOTS,
  targetScreen: "TicketDetail",
  extract,
  commit,
});
