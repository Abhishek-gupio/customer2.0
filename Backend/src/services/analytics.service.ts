import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances as any;

/**
 * ANALYTICS SERVICE
 * ==================
 * Tracks chat interactions (tools used, response times, user feedback)
 * and provides aggregated analytics for the dashboard.
 */
export const analyticsService = {
    /**
     * Track a single chat interaction
     */
    async trackInteraction(data: {
        customerId: string;
        sessionId: string;
        toolName?: string;
        intent?: string;
        responseTimeMs?: number;
        hadToolCall?: boolean;
        hadImage?: boolean;
        wasStreaming?: boolean;
    }) {
        try {
            await db.chatAnalytics.create({ data });
        } catch (error) {
            // Non-critical — log and continue
            logger.error({ error }, "Failed to track chat analytics");
        }
    },

    /**
     * Submit user feedback (thumbs up/down) for a session
     */
    async submitFeedback(
        customerId: string,
        sessionId: string,
        score: number,
    ) {
        // Validate score
        if (score !== 1 && score !== -1) {
            throw new Error("Feedback score must be 1 (thumbs up) or -1 (thumbs down)");
        }

        // Update the latest analytics entry for this session
        const latest = await db.chatAnalytics.findFirst({
            where: { sessionId, customerId },
            orderBy: { createdAt: "desc" },
        });

        if (latest) {
            await db.chatAnalytics.update({
                where: { id: latest.id },
                data: { feedback: score },
            });
        } else {
            // Create a feedback-only entry
            await db.chatAnalytics.create({
                data: { customerId, sessionId, feedback: score },
            });
        }
    },

    /**
     * Get aggregated analytics for a customer
     */
    async getAnalytics(customerId: string, days: number = 30) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [
            totalInteractions,
            toolUsage,
            avgResponseTime,
            feedbackStats,
            dailyUsage,
        ] = await Promise.all([
            // Total interactions
            db.chatAnalytics.count({
                where: { customerId, createdAt: { gte: since } },
            }),

            // Tool usage breakdown
            db.chatAnalytics.groupBy({
                by: ["toolName"],
                where: {
                    customerId,
                    createdAt: { gte: since },
                    toolName: { not: null },
                },
                _count: { toolName: true },
                orderBy: { _count: { toolName: "desc" } },
            }),

            // Average response time
            db.chatAnalytics.aggregate({
                where: {
                    customerId,
                    createdAt: { gte: since },
                    responseTimeMs: { not: null },
                },
                _avg: { responseTimeMs: true },
            }),

            // Feedback summary
            db.chatAnalytics.groupBy({
                by: ["feedback"],
                where: {
                    customerId,
                    createdAt: { gte: since },
                    feedback: { not: null },
                },
                _count: { feedback: true },
            }),

            // Daily usage (last 7 days)
            db.$queryRawUnsafe(
                `SELECT DATE("createdAt") as date, COUNT(*)::int as count 
         FROM "customer"."ChatAnalytics" 
         WHERE "customerId" = $1 AND "createdAt" >= $2 
         GROUP BY DATE("createdAt") 
         ORDER BY date DESC 
         LIMIT 7`,
                customerId,
                since,
            ),
        ]);

        const thumbsUp =
            feedbackStats.find((f: any) => f.feedback === 1)?._count?.feedback || 0;
        const thumbsDown =
            feedbackStats.find((f: any) => f.feedback === -1)?._count?.feedback || 0;

        return {
            period: `${days} days`,
            totalInteractions,
            avgResponseTimeMs: Math.round(
                avgResponseTime._avg?.responseTimeMs || 0,
            ),
            toolUsage: toolUsage.map((t: any) => ({
                tool: t.toolName,
                count: t._count.toolName,
            })),
            feedback: {
                thumbsUp,
                thumbsDown,
                satisfactionRate:
                    thumbsUp + thumbsDown > 0
                        ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
                        : null,
            },
            dailyUsage,
        };
    },
};
