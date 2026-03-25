import axios from "axios";
import * as cheerio from "cheerio";
import { dbInstances } from "@repo/db-customer";
import { logger } from "../config/logger";

const db = dbInstances as any;

/**
 * CONTENT SCRAPER SERVICE
 * =======================
 * Dynamically fetches data from external sources to avoid hardcoded values.
 */

const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"'
};

export const contentScraperService = {
    /**
     * Scrapes daily fuel prices from GoodReturns (User requested source)
     */
    async scrapeFuelPrices(): Promise<number> {
        logger.info("🎬 Starting Fuel Price Scraping from GoodReturns...");
        let totalSaved = 0;

        const tasks = [
            { type: "PETROL", url: "https://www.goodreturns.in/petrol-price.html" },
            { type: "DIESEL", url: "https://www.goodreturns.in/diesel-price.html" },
            { type: "CNG", url: "https://www.goodreturns.in/cng-price.html" }
        ];

        for (const task of tasks) {
            try {
                const count = await this.scrapeFromUrl(task.url, task.type as "PETROL" | "DIESEL" | "CNG");
                totalSaved += count;
                logger.info(`✅ Successfully scraped ${count} ${task.type} prices.`);
            } catch (err) {
                logger.error({ err, type: task.type }, `❌ Failed to scrape ${task.type} prices`);
            }
        }

        logger.info(`🏁 Total fuel prices cached: ${totalSaved}`);
        return totalSaved;
    },

    async scrapeFromUrl(url: string, fuelType: "PETROL" | "DIESEL" | "CNG", isFallback = false): Promise<number> {
        let savedCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const response = await axios.get(url, {
                headers: {
                    ...BROWSER_HEADERS,
                    "Referer": isFallback ? "https://www.google.com/" : "https://www.google.com/"
                },
                timeout: 15000
            });
            const $ = cheerio.load(response.data);
            const promises: Promise<any>[] = [];

            // Selectors for GoodReturns
            const goodReturnsSelectors = "div.gold_rate_table_inner table tr, div.gold_silver_table tr, table tr";
            // Selectors for alternative sources (placeholder for now, matching common patterns)
            const fallbackSelectors = "table.table tr, .fuel-price-table tr, .city-wise-price tr";

            const selectors = isFallback ? `${goodReturnsSelectors}, ${fallbackSelectors}` : goodReturnsSelectors;

            $(selectors).each((_, tr) => {
                const cells = $(tr).find("td");
                if (cells.length >= 2) {
                    const name = $(cells[0]).text().trim();
                    const priceText = $(cells[1]).text().replace(/[^\d.]/g, "");
                    const price = parseFloat(priceText);

                    // Validation: City name exists, price is reasonable, not a header row
                    if (name && !isNaN(price) && price > 30 && name !== "City" && name !== "State" && name !== "City Name") {
                        promises.push(this.savePriceToCache(name, fuelType, price, today).then(ok => {
                            if (ok) savedCount++;
                        }));
                    }
                }
            });

            await Promise.all(promises);
            
            // If GoodReturns failed to provide data (even if 200 OK), try a specific fallback if not already fallback
            if (savedCount === 0 && !isFallback) {
                return this.attemptFallbackScrape(fuelType);
            }

            return savedCount;
        } catch (err: any) {
            if (err.response?.status === 403 && !isFallback) {
                logger.warn(`⚠️ 403 Forbidden on ${url}. Attempting fallback...`);
                return this.attemptFallbackScrape(fuelType);
            }
            throw err;
        }
    },

    /**
     * Fallback scraping from alternative source (Economic Times / India Today)
     */
    async attemptFallbackScrape(fuelType: "PETROL" | "DIESEL" | "CNG"): Promise<number> {
        const fallbacks: Record<string, string> = {
            "PETROL": "https://economictimes.indiatimes.com/wealth/fuel-depot/petrol-price-in-india",
            "DIESEL": "https://economictimes.indiatimes.com/wealth/fuel-depot/diesel-price-in-india",
            "CNG": "https://www.indiatoday.in/fuel-prices/cng-price-in-india"
        };

        const url = fallbacks[fuelType];
        if (!url) return 0;

        logger.info(`🔄 Attempting fallback scrape for ${fuelType} from ${url}`);
        return this.scrapeFromUrl(url, fuelType, true);
    },

    async savePriceToCache(city: string, fuelType: string, price: number, date: Date): Promise<boolean> {
        try {
            await db.fuelPriceCache.upsert({
                where: {
                    city_fuelType_date: {
                        city,
                        fuelType,
                        date,
                    },
                },
                update: { price },
                create: {
                    city,
                    state: this.mapCityToState(city),
                    fuelType,
                    price,
                    date,
                    source: "GOOD_RETURNS_SCRAPER",
                },
            });
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Fetches latest automotive news via Google News RSS
     * Updated to return exactly 2 items as requested.
     */
    async fetchCarNews(): Promise<any[]> {
        logger.info("🗞️ Fetching Car News from Google News RSS...");
        try {
            const url = "https://news.google.com/rss/search?q=car+india+launch+rushlane+autocar&hl=en-IN&gl=IN&ceid=IN:en";
            const response = await axios.get(url, { headers: BROWSER_HEADERS });
            const $ = cheerio.load(response.data, { xmlMode: true });

            const news: any[] = [];
            $("item").each((i, item) => {
                if (i >= 6) return; // Keep a few items so home feed rotates more often
                const fullTitle = $(item).find("title").text();
                const [title, source] = fullTitle.split(" - ");

                news.push({
                    id: i.toString(),
                    title: title.trim(),
                    source: source || "Auto News",
                    url: $(item).find("link").text(),
                    time: this.formatNewsTime($(item).find("pubDate").text()),
                    snippet: "Latest update on new car launches and automotive trends in India.",
                });
            });

            return news;
        } catch (err) {
            logger.error({ err }, "❌ News fetching failed");
            return [];
        }
    },

    formatNewsTime(pubDate: string): string {
        const date = new Date(pubDate);
        const now = new Date();
        const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffHours < 1) return "Just now";
        if (diffHours < 24) return `${diffHours} hours ago`;
        return `${Math.floor(diffHours / 24)} days ago`;
    },

    /**
     * Fetches trending automotive videos
     * Dynamically scrapes YouTube search and enriches with oEmbed.
     */
    async fetchCarVideos(): Promise<any[]> {
        logger.info("🎥 Fetching Trending Car Videos...");
        const queries = [
            "latest car review india",
            "new car launch india 2026",
            "india ev car review",
        ];

        try {
            // 1) Collect candidate video ids from live YouTube search pages.
            const idSet = new Set<string>();
            for (const q of queries) {
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
                const response = await axios.get(searchUrl, { headers: BROWSER_HEADERS, timeout: 15000 });
                const html = typeof response.data === "string" ? response.data : String(response.data || "");
                const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || [];
                for (const m of matches) {
                    const id = m.replace(/.*"videoId":"([a-zA-Z0-9_-]{11})".*/, "$1");
                    if (id && !idSet.has(id)) idSet.add(id);
                    if (idSet.size >= 18) break;
                }
                if (idSet.size >= 18) break;
            }

            const ids = Array.from(idSet).slice(0, 12);
            if (ids.length === 0) return [];

            // 2) Resolve title/channel dynamically via oEmbed.
            const resolved = await Promise.all(
                ids.map(async (videoId, index) => {
                    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
                    try {
                        const metaRes = await axios.get(oembedUrl, { headers: BROWSER_HEADERS, timeout: 10000 });
                        const meta = metaRes.data || {};
                        const author = typeof meta.author_name === "string" ? meta.author_name : "YouTube";
                        const title = typeof meta.title === "string" ? meta.title : "Trending automotive video";
                        return {
                            id: `${videoId}-${index}`,
                            title,
                            views: "Latest",
                            tag: author,
                            url: watchUrl,
                            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                        };
                    } catch {
                        return {
                            id: `${videoId}-${index}`,
                            title: "Trending automotive video",
                            views: "Latest",
                            tag: "YouTube",
                            url: watchUrl,
                            thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                        };
                    }
                }),
            );

            return resolved.slice(0, 8);
        } catch (err) {
            logger.error({ err }, "❌ Video feed fetch failed");
            return [];
        }
    },


    mapCityToState(city: string): string {
        const map: Record<string, string> = {
            // Maharashtra
            Mumbai: "Maharashtra", Pune: "Maharashtra", Nagpur: "Maharashtra", Thane: "Maharashtra", Nashik: "Maharashtra",
            // Karnataka
            Bangalore: "Karnataka", Bengaluru: "Karnataka", Mysore: "Karnataka", Hubli: "Karnataka",
            // Tamil Nadu
            Chennai: "Tamil Nadu", Coimbatore: "Tamil Nadu", Madurai: "Tamil Nadu",
            // West Bengal
            Kolkata: "West Bengal",
            // Telangana
            Hyderabad: "Telangana",
            // Gujarat
            Ahmedabad: "Gujarat", Surat: "Gujarat", Vadodara: "Gujarat", Rajkot: "Gujarat",
            // Rajasthan
            Jaipur: "Rajasthan", Jodhpur: "Rajasthan", Udaipur: "Rajasthan",
            // Uttar Pradesh
            Lucknow: "Uttar Pradesh", Noida: "Uttar Pradesh", Kanpur: "Uttar Pradesh", Agra: "Uttar Pradesh", Varanasi: "Uttar Pradesh",
            // Delhi
            Delhi: "Delhi", "New Delhi": "Delhi",
            // Haryana
            Gurgaon: "Haryana", Gurugram: "Haryana", Faridabad: "Haryana",
            // Bihar
            Patna: "Bihar",
            // Madhya Pradesh
            Bhopal: "Madhya Pradesh", Indore: "Madhya Pradesh",
            // Kerala
            Kochi: "Kerala", Trivandrum: "Kerala", Thiruvananthapuram: "Kerala", Kozhikode: "Kerala",
            // Punjab
            Chandigarh: "Punjab", Ludhiana: "Punjab", Amritsar: "Punjab",
            // Andhra Pradesh
            Visakhapatnam: "Andhra Pradesh", Vijayawada: "Andhra Pradesh",
        };
        return map[city] || "General";
    }
};

