import { dbInstances } from "@repo/db-customer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { notificationService } from "./notification.service";

const db = dbInstances as any;
const genAI = env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
    : null;

/**
 * PROACTIVE CHAT SERVICE
 * =======================
 * AI-initiated notifications that check for conditions
 * and generate personalized advice for the user.
 */
export const proactiveChatService = {
    /**
     * Main entry: checks all conditions and sends notifications
     */
    async checkAndNotify() {
        logger.info("Running Proactive AI Check...");

        const customers = await db.customer.findMany({
            select: { id: true, fullName: true },
        });

        for (const customer of customers) {
            try {
                const alerts = await this.gatherAlerts(customer.id);
                if (alerts.length === 0) continue;

                // Generate AI message from alerts
                const message = await this.generateProactiveMessage(
                    customer.fullName || "there",
                    alerts,
                );

                if (message) {
                    await notificationService.notifyCustomer(customer.id, {
                        title: "🤖 AI Assistant — Heads Up!",
                        body: message,
                        type: "AI_PROACTIVE",
                        metadata: { alerts, source: "proactive-ai" },
                    });

                    logger.info(
                        { customerId: customer.id, alertCount: alerts.length },
                        "Proactive AI notification sent",
                    );
                }
            } catch (err) {
                logger.error(
                    { err, customerId: customer.id },
                    "Proactive check failed for customer",
                );
            }
        }
    },

    /**
     * Gather all alert conditions for a customer
     */
    async gatherAlerts(customerId: string): Promise<string[]> {
        const alerts: string[] = [];
        const now = new Date();

        // 1. Budget overspend check
        const budgets = await db.expenseBudget.findMany({
            where: { customerId, isActive: true },
        });

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        for (const budget of budgets) {
            const spent = await db.expense.aggregate({
                where: {
                    customerId,
                    category: budget.category,
                    date: { gte: startOfMonth },
                },
                _sum: { amount: true },
            });
            const spentAmt = spent._sum.amount || 0;
            const pct = (spentAmt / budget.amount) * 100;

            if (pct >= 100) {
                alerts.push(
                    `BUDGET EXCEEDED: ${budget.category} — spent ₹${Math.round(spentAmt)} of ₹${budget.amount} budget (${Math.round(pct)}%)`,
                );
            } else if (pct >= budget.notifyThreshold) {
                alerts.push(
                    `BUDGET WARNING: ${budget.category} — spent ₹${Math.round(spentAmt)} of ₹${budget.amount} budget (${Math.round(pct)}%)`,
                );
            }
        }

        // 2. Documents expiring within 7 days
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        const expiringDocs = await db.vehicleDocument.findMany({
            where: {
                customerId,
                expiryDate: { lte: expiryDate, gte: now },
            },
            select: { type: true, expiryDate: true, documentNumber: true },
        });

        for (const doc of expiringDocs) {
            const daysLeft = Math.ceil(
                (new Date(doc.expiryDate).getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            );
            alerts.push(
                `DOCUMENT EXPIRING: ${doc.type}${doc.documentNumber ? ` (${doc.documentNumber})` : ""} expires in ${daysLeft} days`,
            );
        }

        // 3. Vehicle health below 50
        const vehicles = await db.customerVehicle.findMany({
            where: { customerId, isActive: true },
            include: { healthScore: true },
        });

        for (const v of vehicles) {
            if (v.healthScore && v.healthScore.overallScore < 50) {
                alerts.push(
                    `LOW HEALTH: ${v.make} ${v.model} (${v.registrationNumber}) health is ${v.healthScore.overallScore}/100 — service recommended`,
                );
            }
        }

        return alerts;
    },

    /**
     * Use Gemini to generate a friendly, personalized proactive message
     */
    async generateProactiveMessage(
        userName: string,
        alerts: string[],
    ): Promise<string | null> {
        if (!genAI || alerts.length === 0) return null;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `You are Gupio, a friendly AI car assistant. Generate a SHORT notification message (2-3 sentences max) for ${userName}.

Here are the alerts to communicate:
${alerts.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Rules:
- Be friendly and concise
- Use Indian currency format (₹)
- Prioritize the most urgent alert
- If multiple alerts, summarize briefly
- End with a helpful suggestion
- No greetings like "Hey" or "Hi"`;

        try {
            const result = await model.generateContent(prompt);
            return result.response.text().trim();
        } catch (error) {
            logger.error({ error }, "Proactive AI message generation failed");
            return alerts[0]; // Fallback to raw alert text
        }
    },
};
