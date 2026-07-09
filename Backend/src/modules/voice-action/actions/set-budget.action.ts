import { registerVoiceAction } from "../voice-action.registry";
import { VoiceAction, VoiceActionExtractResult, VoiceActionCommitResult } from "../voice-action.types";
import { callAI } from "../../../services/ai-provider.service";
import { logger } from "../../../config/logger";
import { expenseBudgetSchema } from "../../expense/expense.validators";
import { expenseService } from "../../expense/expense.service";

const SLOTS: VoiceAction["slots"] = [
  {
    name: "category",
    askPrompt: "Which category should the budget be for — fuel, toll, service, parking, insurance, or challan?",
  },
  { name: "amount", askPrompt: "How much should the monthly budget be?" },
];

async function extract(
  _customerId: string,
  newReplyText: string,
  knownValues: Record<string, any>,
  missingSlotsHint: string[],
): Promise<VoiceActionExtractResult> {
  const systemPrompt = `You extract vehicle-expense budget details from a short spoken reply.
Only these fields matter:
- category: one of FUEL, TOLL, SERVICE, PARKING, INSURANCE, CHALLAN, EMI, REPAIR, OTHER
- amount: a positive number (the monthly budget amount)

The user is currently answering for: ${missingSlotsHint.join(", ") || "nothing outstanding"}.
Only extract a field if it is clearly present in what the user just said — do not guess or invent a value.
Output ONLY raw JSON, no markdown, no explanation: {"category": string|null, "amount": number|null}`;

  let parsed: any = {};
  try {
    const raw = await callAI(newReplyText, systemPrompt, { temperature: 0.1, maxOutputTokens: 150 });
    const cleanJson = raw.replace(/```json/i, "").replace(/```/g, "").trim();
    parsed = JSON.parse(cleanJson);
  } catch (err) {
    logger.debug({ err }, "[VoiceAction:set_budget] extract parse failed");
    parsed = {};
  }

  // knownValues is authoritative — never let a later turn's extraction overwrite an
  // already-resolved slot, even if the model re-derives a different value for it.
  const values: Record<string, any> = { ...knownValues };
  for (const slot of SLOTS) {
    if (values[slot.name] != null) continue;
    if (slot.name === "category" && parsed.category) {
      values.category = String(parsed.category).trim().toUpperCase();
    }
    if (slot.name === "amount" && parsed.amount != null && Number(parsed.amount) > 0) {
      values.amount = Number(parsed.amount);
    }
  }

  const missingSlots = SLOTS.map((s) => s.name).filter((name) => values[name] == null);
  const confidence: "HIGH" | "MEDIUM" | "LOW" = missingSlots.length === 0 ? "HIGH" : "LOW";

  return { values, missingSlots, confidence };
}

async function commit(customerId: string, values: Record<string, any>): Promise<VoiceActionCommitResult> {
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
    navigateParams: {
      initialCategory: parsedInput.data.category,
      initialAmount: parsedInput.data.amount,
      justSetViaVoice: true,
    },
  };
}

registerVoiceAction({
  key: "set_budget",
  slots: SLOTS,
  targetScreen: "BudgetSettings",
  extract,
  commit,
});
