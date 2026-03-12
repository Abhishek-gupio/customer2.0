import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances as any;

/**
 * CONTEXT SERVICE
 * ================
 * Builds a rich, personalized context string for the AI assistant
 * by fetching the user's profile, vehicles, budgets, and recent activity.
 */
export const contextService = {
    /**
     * Build a comprehensive user context block for AI prompts
     */
    async buildUserContext(customerId: string): Promise<string> {
        try {
            const [customer, vehicles, budgets, recentExpenses, notifications] =
                await Promise.all([
                    // 1. Customer profile
                    db.customer.findUnique({
                        where: { id: customerId },
                        select: {
                            fullName: true,
                            phoneNumber: true,
                            email: true,
                            createdAt: true,
                        },
                    }),

                    // 2. All vehicles with health scores
                    db.customerVehicle.findMany({
                        where: { customerId, isActive: true },
                        include: {
                            healthScore: true,
                            _count: { select: { expenses: true, serviceRecords: true } },
                        },
                    }),

                    // 3. Active budgets
                    db.expenseBudget.findMany({
                        where: { customerId, isActive: true },
                    }),

                    // 4. Recent expenses (last 30 days)
                    db.expense.findMany({
                        where: {
                            customerId,
                            date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                        },
                        orderBy: { date: "desc" },
                        take: 10,
                        select: {
                            amount: true,
                            category: true,
                            date: true,
                            merchantName: true,
                        },
                    }),

                    // 5. Unread notifications
                    db.inAppNotification.findMany({
                        where: { customerId, isRead: false },
                        orderBy: { createdAt: "desc" },
                        take: 5,
                        select: { title: true, body: true, type: true },
                    }),
                ]);

            if (!customer) return "No user profile found.";

            // --- Format user profile ---
            const lines: string[] = [];
            lines.push("=== USER PROFILE ===");
            lines.push(
                `Name: ${customer.fullName || "Unknown"} | Phone: ${customer.phoneNumber}`,
            );
            if (customer.email) lines.push(`Email: ${customer.email}`);
            lines.push(
                `Member since: ${new Date(customer.createdAt).toLocaleDateString("en-IN")}`,
            );

            // --- Vehicles ---
            if (vehicles.length > 0) {
                lines.push("\n=== VEHICLES ===");
                for (const v of vehicles) {
                    const health = v.healthScore
                        ? ` | Health: ${v.healthScore.overallScore}/100`
                        : "";
                    const odo = v.currentOdometer
                        ? ` | Odometer: ${v.currentOdometer} km`
                        : "";
                    lines.push(
                        `${v.make || ""} ${v.model || ""} ${v.year || ""} (${v.registrationNumber})${health}${odo}`,
                    );
                    lines.push(
                        `  Records: ${v._count.expenses} expenses, ${v._count.serviceRecords} services`,
                    );
                }
            }

            // --- Budgets ---
            if (budgets.length > 0) {
                lines.push("\n=== BUDGETS ===");

                // Calculate spend per category for current month
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                for (const b of budgets) {
                    const spent = await db.expense.aggregate({
                        where: {
                            customerId,
                            category: b.category,
                            date: { gte: startOfMonth },
                        },
                        _sum: { amount: true },
                    });
                    const spentAmount = spent._sum.amount || 0;
                    const pct = Math.round((spentAmount / b.amount) * 100);
                    lines.push(
                        `${b.category}: ₹${spentAmount.toLocaleString("en-IN")}/${b.amount.toLocaleString("en-IN")} (${pct}% used)`,
                    );
                }
            }

            // --- Recent expenses ---
            if (recentExpenses.length > 0) {
                lines.push("\n=== RECENT EXPENSES (Last 30 days) ===");
                for (const e of recentExpenses) {
                    lines.push(
                        `₹${e.amount} ${e.category} on ${new Date(e.date).toLocaleDateString("en-IN")}${e.merchantName ? ` at ${e.merchantName}` : ""}`,
                    );
                }
            }

            // --- Pending alerts ---
            if (notifications.length > 0) {
                lines.push("\n=== PENDING ALERTS ===");
                for (const n of notifications) {
                    lines.push(`[${n.type}] ${n.title}: ${n.body}`);
                }
            }

            return lines.join("\n");
        } catch (error) {
            logger.error({ error }, "Failed to build user context");
            return "Unable to load user context.";
        }
    },
};
