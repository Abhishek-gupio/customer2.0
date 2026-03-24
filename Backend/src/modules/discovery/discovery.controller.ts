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
        const now = new Date();
        const cacheWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000); // 6h rolling cache
        const forceRefresh = req.query.refresh === "1" || req.query.force === "1";

        try {
            // 1. Check cache for today's content (only if DiscoveryContent model is available)
            let cachedNews: { id?: string; content: any } | null = null;
            let cachedVideos: { id?: string; content: any } | null = null;
            if (discoveryContent && !forceRefresh) {
                cachedNews = await discoveryContent.findFirst({
                    where: { type: 'NEWS', date: { gte: cacheWindowStart } },
                    orderBy: { date: 'desc' },
                });
                cachedVideos = await discoveryContent.findFirst({
                    where: { type: 'VIDEO', date: { gte: cacheWindowStart } },
                    orderBy: { date: 'desc' },
                });
            }

            const newsFromCache =
                cachedNews && Array.isArray(cachedNews.content) ? cachedNews.content : [];
            const videosFromCache =
                cachedVideos && Array.isArray(cachedVideos.content) ? cachedVideos.content : [];

            const needNews = newsFromCache.length === 0;
            const needVideos = videosFromCache.length === 0;

            if (!needNews && !needVideos) {
                logger.debug("Discovery content served from cache");
                return success(res, {
                    news: newsFromCache,
                    videos: videosFromCache,
                });
            }

            // 2. Fetch only missing slices (both rows can exist while one Json array is empty — refetch that side)
            logger.info(
                { needNews, needVideos },
                "Discovery cache partial or empty. Fetching fresh content where needed...",
            );
            const [news, videos] = await Promise.all([
                needNews ? contentScraperService.fetchCarNews() : Promise.resolve(newsFromCache),
                needVideos ? contentScraperService.fetchCarVideos() : Promise.resolve(videosFromCache),
            ]);

            // 3. Update cache (only if model available)
            if (discoveryContent && news.length > 0) {
                await discoveryContent.upsert({
                    where: { id: cachedNews?.id || 'new-news-id' },
                    update: { content: news, date: now },
                    create: { type: 'NEWS', content: news, date: now }
                }).catch(() => { });
            }
            if (discoveryContent && videos.length > 0) {
                await discoveryContent.upsert({
                    where: { id: cachedVideos?.id || 'new-videos-id' },
                    update: { content: videos, date: now },
                    create: { type: 'VIDEO', content: videos, date: now }
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
                const n = lastNews?.content;
                const v = lastVideos?.content;
                return success(res, {
                    news: Array.isArray(n) ? n : [],
                    videos: Array.isArray(v) ? v : [],
                });
            } catch {
                return success(res, { news: [], videos: [] });
            }
        }
    }),
};
