import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success } from "../../utils/apiResponse";
import { contentScraperService } from "../../services/content-scraper.service";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../../config/logger";

const db = dbInstances as any;

/** DiscoveryContent model may be missing if client is stale or migration not run; guard all access */
const discoveryContent = db?.discoveryContent;

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
            // 1. Check cache for today's content (only if DiscoveryContent model is available)
            let cachedNews: { id?: string; content: any } | null = null;
            let cachedVideos: { id?: string; content: any } | null = null;
            if (discoveryContent) {
                cachedNews = await discoveryContent.findFirst({
                    where: { type: 'NEWS', date: { gte: today } }
                });
                cachedVideos = await discoveryContent.findFirst({
                    where: { type: 'VIDEO', date: { gte: today } }
                });
            }

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

            // 3. Update cache (only if model available)
            if (discoveryContent && news.length > 0) {
                await discoveryContent.upsert({
                    where: { id: cachedNews?.id || 'new-news-id' },
                    update: { content: news, date: today },
                    create: { type: 'NEWS', content: news, date: today }
                }).catch(() => { });
            }
            if (discoveryContent && videos.length > 0) {
                await discoveryContent.upsert({
                    where: { id: cachedVideos?.id || 'new-videos-id' },
                    update: { content: videos, date: today },
                    create: { type: 'VIDEO', content: videos, date: today }
                }).catch(() => { });
            }

            return success(res, { news, videos });

        } catch (err) {
            logger.error({ err }, "Failed to fetch discovery content");
            // Fallback: try last cached or empty
            if (!discoveryContent) {
                return success(res, { news: [], videos: [] });
            }
            try {
                const lastNews = await discoveryContent.findFirst({
                    where: { type: 'NEWS' },
                    orderBy: { date: 'desc' }
                });
                const lastVideos = await discoveryContent.findFirst({
                    where: { type: 'VIDEO' },
                    orderBy: { date: 'desc' }
                });
                return success(res, {
                    news: (lastNews?.content as any) || [],
                    videos: (lastVideos?.content as any) || []
                });
            } catch {
                return success(res, { news: [], videos: [] });
            }
        }
    }),
};
