import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { contentScraperService } from "../../services/content-scraper.service";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";

const db = dbInstances as any;

/**
 * DISCOVERY CONTROLLER
 * Handles trending car news and videos with a 24-hour cache.
 */
export const discoveryController = {
    // GET /v1/discovery/trending
    getTrendingContent: asyncHandler(async (req: Request, res: Response) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            // 1. Check cache for today's content
            const cachedNews = await db.discoveryContent.findFirst({
                where: { type: 'NEWS', date: { gte: today } }
            });
            const cachedVideos = await db.discoveryContent.findFirst({
                where: { type: 'VIDEO', date: { gte: today } }
            });

            if (cachedNews && cachedVideos) {
                logger.debug("Discovery content served from 24-hour cache");
                return success(res, {
                    news: cachedNews.content,
                    videos: cachedVideos.content
                });
            }

            // 2. Fetch fresh content if cache missing or expired
            logger.info("Discovery cache expired or missing. Fetching fresh content...");
            const [news, videos] = await Promise.all([
                contentScraperService.fetchCarNews(),
                contentScraperService.fetchCarVideos()
            ]);

            // 3. Update cache
            if (news.length > 0) {
                await db.discoveryContent.upsert({
                    where: { id: cachedNews?.id || 'new-news-id' }, // Simplified upsert
                    update: { content: news, date: today },
                    create: { type: 'NEWS', content: news, date: today }
                }).catch(() => { }); // Ignore duplicate errors if parallel requests occur
            }

            if (videos.length > 0) {
                await db.discoveryContent.upsert({
                    where: { id: cachedVideos?.id || 'new-videos-id' },
                    update: { content: videos, date: today },
                    create: { type: 'VIDEO', content: videos, date: today }
                }).catch(() => { });
            }

            return success(res, { news, videos });

        } catch (err) {
            logger.error({ err }, "Failed to fetch discovery content");
            // Fallback to most recent available content if today fails
            const lastNews = await db.discoveryContent.findFirst({
                where: { type: 'NEWS' },
                orderBy: { date: 'desc' }
            });
            const lastVideos = await db.discoveryContent.findFirst({
                where: { type: 'VIDEO' },
                orderBy: { date: 'desc' }
            });

            return success(res, {
                news: lastNews?.content || [],
                videos: lastVideos?.content || []
            });
        }
    }),
};
