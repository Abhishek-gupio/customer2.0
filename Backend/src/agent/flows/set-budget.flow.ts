import { registerFlow } from "./registry";
import { Flow, FlowExtractResult, FlowCommitResult } from "../types";
import { routeText } from "../modelRouter";
import { logger } from "../../config/logger";
import { expenseBudgetSchema } from "../../modules/expense/expense.validators";
import { expenseService } from "../../modules/expense/expense.service";

const SLOTS: Flow["slots"] = [
  {
    name: "category",
    askPrompt: "Which category should the budget be for — fuel, toll, service, parking, insurance, or challan?",
  },
  { name: "amount", askPrompt: "How much should the monthly budget be?" },
];

/**
 * Read-only budget questions must not reach this flow — committing writes a budget, so
 * "how much budget do I have left to spend" previously turned a question into an overwrite.
 * Checked before the intent patterns, which stay broad for voice recall.
 */
/**
 * Narrowed after the first version blocked real commands: `spent` killed "set my fuel budget to
 * 5000, I have spent too much" and `is my` killed "change budget: fuel is my biggest expense, set
 * it to 6000". Only phrasings that are unambiguously a question are listed now — an imperative
 * verb elsewhere in the sentence should still reach the flow.
 */
const INFORMATIONAL =
  /\b(how much|how many|what('s| is)?\s+(my|the)|whats my|do i have|how many.*left|what.*remaining|show me|tell me)\b/i;

function matches(text: string): boolean {
  if (INFORMATIONAL.test(text)) return false;
  return /\b(set|update|change)\b.*\bbudget\b/i.test(text) || /\bbudget\b.*\b(set|to|of|as)\b/i.test(text);
}

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<FlowExtractResult> {
  const systemPrompt = `You extract vehicle-expense budget details from a short spoken reply.
Only these fields matter:
- category: one of FUEL, TOLL, SERVICE, PARKING, INSURANCE, CHALLAN, EMI, REPAIR, OTHER
- amount: a positive number (the monthly budget amount)

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a field if it is clearly present in what the user just said — do not guess or invent a value.
Output ONLY raw JSON, no markdown, no explanation: {"category": string|null, "amount": number|null}`;

  let parsed: any = {};
  try {
    const raw = await routeText(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 150 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.warn({ err }, "[Flow:set_budget] extract parse failed");
    parsed = {};
  }

  // A newly extracted *valid* value overwrites the stored one, so a user correcting a mis-heard
  // answer ("no, the parking budget") actually lands. This still honours the contract's "never
  // drop a value already present in knownValues": when the extractor returns null (the common
  // case for a field the user didn't mention this turn), the existing value is left untouched.
  const values: Record<string, any> = { ...knownValues };
  if (parsed.category) {
    values.category = String(parsed.category).trim().toUpperCase();
  }
  if (parsed.amount != null && Number(parsed.amount) > 0) {
    values.amount = Number(parsed.amount);
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const confidence: FlowExtractResult["confidence"] = missingSlots.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<FlowCommitResult> {
  const parsedInput = expenseBudgetSchema.safeParse({
    category: values.category,
    amount: Number(values.amount),
  });

  if (!parsedInput.success) {
    return {
      success: false,
      message: "That doesn't look like a valid budget — please say a category and an amount.",
      reason: parsedInput.error.message,
    };
  }

  await expenseService.setBudget(customerId, parsedInput.data);

  return {
    success: true,
    message: `Monthly ${parsedInput.data.category} budget set to ₹${parsedInput.data.amount.toLocaleString("en-IN")}.`,
    data: {
      initialCategory: parsedInput.data.category,
      initialAmount: parsedInput.data.amount,
      justSetViaVoice: true,
    },
  };
}

registerFlow({
  key: "set_budget",
  description: "Set or update a monthly spending budget for one expense category (fuel, toll, service, parking, insurance, challan, EMI, repair, other).",
  matches,
  slots: SLOTS,
  view: "BudgetSettings",
  draftKey: "budget",
  extract,
  commit,
});
