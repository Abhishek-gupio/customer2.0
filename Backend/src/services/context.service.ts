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

            const vehicleIds = vehicles.map((v: any) => v.id);

            // --- Expense summaries ---
            if (vehicleIds.length > 0) {
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

                const [monthSpend, last30Spend] = await Promise.all([
                    db.expense.aggregate({
                        where: {
                            customerId,
                            date: { gte: startOfMonth },
                        },
                        _sum: { amount: true },
                    }),
                    db.expense.aggregate({
                        where: {
                            customerId,
                            date: { gte: last30Days },
                        },
                        _sum: { amount: true },
                    }),
                ]);

                lines.push("\n=== EXPENSE SUMMARY ===");
                lines.push(
                    `This month: â‚¹${(monthSpend?._sum?.amount || 0).toLocaleString("en-IN")}`,
                );
                lines.push(
                    `Last 30 days: â‚¹${(last30Spend?._sum?.amount || 0).toLocaleString("en-IN")}`,
                );
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

            // --- Documents (summary) ---
            if (vehicleIds.length > 0) {
                try {
                    const docs = await db.customerDocument.findMany({
                        where: { customerId },
                        orderBy: { createdAt: "desc" },
                        take: 10,
                        select: {
                            type: true,
                            expiryDate: true,
                            documentNumber: true,
                            vehicle: { select: { make: true, model: true } },
                        },
                    });
                    if (docs.length > 0) {
                        lines.push("\n=== DOCUMENTS (Recent) ===");
                        for (const d of docs) {
                            const vehicleLabel = d.vehicle
                                ? `${d.vehicle.make || ""} ${d.vehicle.model || ""}`.trim()
                                : "General";
                            const expiry = d.expiryDate
                                ? new Date(d.expiryDate).toLocaleDateString("en-IN")
                                : "No expiry";
                            const docNo = d.documentNumber ? ` (${d.documentNumber})` : "";
                            lines.push(`${d.type}${docNo} â€” ${vehicleLabel}, Expiry: ${expiry}`);
                        }
                    }
                } catch (e) {
                    logger.debug({ e }, "Failed to load document context");
                }
            }

            // --- Service records (recent) ---
            if (vehicleIds.length > 0) {
                try {
                    const serviceRecords = await db.serviceRecord.findMany({
                        where: { vehicleId: { in: vehicleIds } },
                        orderBy: { createdAt: "desc" },
                        take: 5,
                        select: {
                            serviceType: true,
                            odometerAtService: true,
                            garageName: true,
                            createdAt: true,
                            vehicleId: true,
                        },
                    });
                    if (serviceRecords.length > 0) {
                        lines.push("\n=== SERVICE HISTORY (Recent) ===");
                        for (const s of serviceRecords) {
                            const vehicle = vehicles.find((v: any) => v.id === s.vehicleId);
                            const vehicleLabel = vehicle
                                ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim()
                                : "Vehicle";
                            lines.push(
                                `${s.serviceType || "Service"} on ${new Date(s.createdAt).toLocaleDateString("en-IN")} â€” ${vehicleLabel}` +
                                `${s.odometerAtService ? ` @ ${s.odometerAtService} km` : ""}` +
                                `${s.garageName ? ` (${s.garageName})` : ""}`,
                            );
                        }
                    }
                } catch (e) {
                    logger.debug({ e }, "Failed to load service history context");
                }
            }

            // --- Challans (unpaid) ---
            if (vehicleIds.length > 0) {
                try {
                    const challans = await db.challan.findMany({
                        where: { vehicleId: { in: vehicleIds }, status: "UNPAID" },
                        orderBy: { createdAt: "desc" },
                        take: 5,
                        select: {
                            challanNumber: true,
                            amount: true,
                            createdAt: true,
                            vehicleId: true,
                        },
                    });
                    if (challans.length > 0) {
                        lines.push("\n=== CHALLANS (Unpaid) ===");
                        for (const c of challans) {
                            const vehicle = vehicles.find((v: any) => v.id === c.vehicleId);
                            const vehicleLabel = vehicle
                                ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim()
                                : "Vehicle";
                            lines.push(
                                `${c.challanNumber} â€” â‚¹${c.amount} on ${new Date(c.createdAt).toLocaleDateString("en-IN")} (${vehicleLabel})`,
                            );
                        }
                    }
                } catch (e) {
                    logger.debug({ e }, "Failed to load challan context");
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
