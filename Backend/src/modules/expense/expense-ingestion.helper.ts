import { queues } from "../../config/queue";
import { logger } from "../../config/logger";

/**
 * Queues a newly created expense for embedding into the AI's vector memory.
 *
 * This is the sole producer for the EXPENSE_INGESTION queue. The queue and its worker both
 * existed for a long time with nothing ever enqueuing to them, so `DocumentEmbedding` stayed
 * permanently empty and every RAG retrieval returned nothing for every user.
 *
 * It lives in its own module rather than inside one of the expense services because BOTH
 * `expense.service.createExpense` (the primary orchestrator, and the path the AI's `add_expense`
 * tool goes through) and every branch of `expense-parsing.service` need it — importing it from
 * one service into the other would risk a cycle.
 *
 * Fire-and-forget by design: failing to index must never fail the user's expense write. Falls
 * back to inline ingestion when queues are disabled, mirroring how `budgetCheck` degrades.
 */
export function enqueueExpenseIngestion(expenseId: string): void {
  if (!expenseId) return;
  if (queues?.expenseIngestion) {
    void queues.expenseIngestion
      .add("ingest-expense", { metadata: { expenseId } })
      .catch((err) => logger.error({ err, expenseId }, "Failed to queue expense ingestion"));
    return;
  }
  void import("../../services/ingestion.service")
    .then(({ ingestionService }) => ingestionService.ingestExpense(expenseId))
    .catch((err) => logger.error({ err, expenseId }, "Inline expense ingestion failed"));
}
