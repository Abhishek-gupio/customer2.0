import { dbInstances } from "@repo/db-customer";
import { ExpenseBudgetInput, ExpenseCategory } from "./expense.validators";

const db = dbInstances;

export const expenseBudgetService = {
  /**
   * Budget Management: Create or Update
   */
  async setBudget(customerId: string, input: ExpenseBudgetInput) {
    return db.expenseBudget.upsert({
      where: {
        customerId_category: {
          customerId,
          category: input.category,
        },
      },
      update: {
        amount: input.amount,
        period: input.period,
        notifyThreshold: input.notifyThreshold,
        isActive: true,
      },
      create: {
        customerId,
        ...input,
      },
    });
  },

  /**
   * Get all active budgets for a customer
   */
  async getBudgets(customerId: string) {
    return db.expenseBudget.findMany({
      where: { customerId, isActive: true },
    });
  },

  /**
   * Analytics: Category Pie Chart
   */
  async getMonthlySummary(customerId: string, month?: number, year?: number) {
    const now = new Date();
    const m = month !== undefined ? month : now.getMonth();
    const y = year || now.getFullYear();

    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);

    const group = await db.expense.groupBy({
      by: ["category"],
      where: {
        customerId,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    return {
      period: `${m + 1}-${y}`,
      breakdown: group.map((g: any) => ({
        category: g.category,
        total: g._sum.amount || 0,
      })),
    };
  },

  /**
   * Utility: Check Budget & Notify
   */
  async checkBudget(
    customerId: string,
    category: ExpenseCategory,
    newExpenseAmount: number,
  ) {
    // Find active budget
    const budget = await db.expenseBudget.findUnique({
      where: { customerId_category: { customerId, category } },
    });

    if (!budget || !budget.isActive) return;

    // Calculate total for this month
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const total = await db.expense.aggregate({
      where: {
        customerId,
        category,
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });

    const currentTotal = total._sum.amount || 0;
    const percentage = (currentTotal / budget.amount) * 100;

    // Trigger Alert if crossed threshold
    if (percentage >= budget.notifyThreshold) {
      // Creating In-App Notification
      await db.inAppNotification.create({
        data: {
          customerId,
          title: `Budget Alert: ${category}`,
          body: `You have used ${Math.round(percentage)}% of your ${category} budget (₹${currentTotal} / ₹${budget.amount}).`,
          type: "WARNING",
          link: "/expenses/budgets",
          metadata: { category, percentage, currentTotal },
        },
      });
    }
  },
};
