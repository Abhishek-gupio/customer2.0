import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { createTicketSchema } from "../../modules/support/support.validators";
import { supportService } from "../../modules/support/support.service";

const VALID_CATEGORIES = ["VEHICLE", "DOCUMENTS", "VALET", "AI_ASSISTANT", "BILLING", "ACCOUNT", "TECHNICAL", "OTHER"];

// Only "description" is actually asked out loud — category is inferred (defaulting to OTHER)
// and subject is always auto-derived from the description (see extract() below), since real
// users describe their problem once and don't naturally separate a "short version" from a
// "detailed version". Asking for subject first (as this used to) produced a confusing
// "give me a short summary" question that real answers don't map cleanly onto. subject is
// still a declared slot — required so a description-only turn can't silently skip generating
// one — it's just never the one whose askPrompt actually gets spoken.
const SLOTS: Flow["slots"] = [
  { name: "description", askPrompt: "What's the issue you'd like to report?" },
  { name: "subject", askPrompt: "What's the issue you'd like to report?" },
];

function matches(text: string): boolean {
  return (
    /\b(file|create|open|raise|log|report)\b.*\b(ticket|complaint|issue|bug|problem)\b/i.test(text) ||
    /\bsupport ticket\b/i.test(text)
  );
}

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const systemPrompt = `You extract support-ticket details from a short spoken reply for a vehicle management app.
Only these fields matter:
- description: what is actually WRONG — the problem itself, in the user's own words. A request to open/raise/file a ticket is NOT a description, even if that's all they've said so far — it's just them asking to start this process. Leave description null until they actually state a problem.
  Examples: "raise a ticket for me" -> description: null (no problem stated yet). "raise a ticket, my AC is not working" -> description: "AC is not working". "I want to file a complaint" -> description: null. "file a complaint, the app keeps crashing" -> description: "app keeps crashing".
- subject: a short title for the issue (5-100 characters), only once a real description exists. Real users describe their problem once, in one go — they don't separately state a "short version" and a "detailed version". Once description is non-null, GENERATE a concise subject yourself by summarizing it (e.g. "vehicle AC not working", "app crashes on login") — do not leave subject null just because they didn't literally say a short phrase. If description is null, subject must also be null.
- category: one of ${VALID_CATEGORIES.join(", ")} — infer from context (app bug/crash -> TECHNICAL, vehicle problem -> VEHICLE, payment issue -> BILLING, document/RC/insurance -> DOCUMENTS, valet -> VALET, login/account -> ACCOUNT, AI assistant itself -> AI_ASSISTANT), otherwise OTHER. Always give a category guess, never null.

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract/generate content grounded in what the user actually said — do not invent issue details they didn't mention.
Output ONLY raw JSON, no markdown, no explanation: {"subject": string|null, "description": string|null, "category": string}`;

  let parsed: any = {};
  try {
    const raw = await routeText(newReplyText, systemPrompt, { temperature: 0.2, maxOutputTokens: 300 });
    logger.info({ newReplyText, raw }, "[Flow:create_support_ticket] extract raw model output");
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ err, newReplyText }, "[Flow:create_support_ticket] extract parse failed");
    parsed = {};
  }

  const values: Record<string, any> = { ...knownValues };
  if (values.subject == null && typeof parsed.subject === "string" && parsed.subject.trim().length >= 5) {
    values.subject = parsed.subject.trim().slice(0, 100);
  }
  // Never trust the model alone to distinguish "the command to open a ticket" from "an actual
  // description of the problem" — if what it extracted as the description is itself just the
  // trigger phrase restated (matches this flow's own gate), it's not real content. Without
  // this, a misheard/ambiguous first utterance like "raise a ticket for me" can get accepted
  // as its own "description", which then lets the subject-fallback below fill in too, and the
  // ticket silently auto-commits with no real problem ever captured.
  if (
    values.description == null &&
    typeof parsed.description === "string" &&
    parsed.description.trim().length > 0 &&
    !matches(parsed.description.trim())
  ) {
    values.description = parsed.description.trim().slice(0, 5000);
  }
  // If we specifically just asked "what's the issue?" (description was the thing being
  // answered for) and the model still came back with null — a small/fast model can be overly
  // conservative about whether a reply "sounds like a real problem" — trust the user's direct
  // answer instead of asking the same question again. This only fires for an actual answer to
  // our own question, not a fresh command: it still refuses anything that matches this flow's
  // own trigger phrase, so "raise a ticket for me" still can't slip through as its own
  // description the way it did before this whole flow's guard rails existed.
  if (
    values.description == null &&
    missingSlotsHint.includes("description") &&
    newReplyText.trim().length >= 5 &&
    !matches(newReplyText.trim())
  ) {
    values.description = newReplyText.trim().slice(0, 5000);
  }
  if (values.category == null && typeof parsed.category === "string") {
    values.category = parsed.category.toUpperCase();
  }

  // Don't rely on the model alone to separate "subject" from "description" — real users
  // describe an issue once, not as two distinct utterances. If we now have a description but
  // still no subject (the model didn't comply with the prompt's summarize-it-yourself
  // instruction), derive one deterministically so this can't loop forever asking for a
  // "short version" of something the user already fully described.
  if (values.subject == null && typeof values.description === "string" && values.description.length >= 5) {
    values.subject = values.description.slice(0, 80);
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const confidence: FlowExtractResult["confidence"] = missingSlots.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
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
      message:
        "I couldn't create that ticket — the summary needs to be at least 5 characters and a description is required.",
      reason: parsedInput.error.message,
    };
  }

  const ticket = await supportService.createTicket(customerId, parsedInput.data as any);

  return {
    success: true,
    message: "Support ticket created. Our team will look into it.",
    data: { ticketId: ticket.id },
  };
}

registerFlow({
  key: "create_support_ticket",
  description: "File a new support ticket — report a bug, complaint, or issue with the app, vehicle, documents, valet, billing, or account to the Gupio support team.",
  matches,
  slots: SLOTS,
  view: "TicketDetail",
  draftKey: "support_ticket",
  extract,
  commit,
});
