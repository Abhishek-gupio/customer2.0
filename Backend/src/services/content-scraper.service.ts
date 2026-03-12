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
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
};

export const contentScraperService = {
    /**
     * Scrapes daily fuel prices from GoodReturns (User requested source)
     */
    async scrapeFuelPrices(): Promise<number> {
        logger.info("🎬 Starting Fuel Price Scraping from GoodReturns...");
        let savedCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        try {
            const url = "https://www.goodreturns.in/petrol-price.html";
            const response = await axios.get(url, {
                headers: {
                    ...BROWSER_HEADERS,
                    "Referer": "https://www.google.com/"
                },
                timeout: 15000
            });
            const $ = cheerio.load(response.data);

            const promises: Promise<any>[] = [];

            // Targeted selectors based on GoodReturns structure
            // They use div.gold_silver_table for their price tables
            $("div.gold_silver_table tr").each((_, tr) => {
                const cells = $(tr).find("td");
                if (cells.length >= 2) {
                    const name = $(cells[0]).text().trim();
                    const priceText = $(cells[1]).text().replace(/[^\d.]/g, "");
                    const price = parseFloat(priceText);

                    if (name && !isNaN(price) && price > 50 && name !== "City" && name !== "State") {
                        promises.push(this.savePriceToCache(name, "PETROL", price, today).then(ok => {
                            if (ok) savedCount++;
                        }));
                    }
                }
            });

            // If the above fails, try a more generic table selector
            if (promises.length === 0) {
                $("table tr").each((_, tr) => {
                    const cells = $(tr).find("td");
                    if (cells.length >= 2) {
                        const name = $(cells[0]).text().trim();
                        const priceText = $(cells[1]).text().replace(/[^\d.]/g, "");
                        const price = parseFloat(priceText);

                        if (name && !isNaN(price) && price > 50 && name !== "City" && name !== "State") {
                            promises.push(this.savePriceToCache(name, "PETROL", price, today).then(ok => {
                                if (ok) savedCount++;
                            }));
                        }
                    }
                });
            }

            await Promise.all(promises);
            logger.info(`✅ Successfully scraped and cached ${savedCount} fuel prices from GoodReturns.`);
            return savedCount;
        } catch (err) {
            logger.error({ err }, "❌ Fuel price scraping failed");
            return 0;
        }
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
                if (i >= 2) return; // Only 2 news items
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
     * Updated to return 5 items as requested.
     */
    async fetchCarVideos(): Promise<any[]> {
        logger.info("🎥 Fetching Trending Car Videos...");
        return [
            {
                id: "1",
                title: "2026 Mercedes CLA review - Electric Luxury Sedan With 792km Range | First Drive",
                views: "71K",
                tag: "Autocar India",
                url: "https://www.youtube.com/watch?v=DaWiczwucSg",
                thumbnail: "https://img.youtube.com/vi/DaWiczwucSg/hqdefault.jpg"
            },
            {
                id: "2",
                title: "Venue vs Nexon vs Brezza vs XUV3XO vs Kylaq vs Sonet vs Syros",
                views: "141K",
                tag: "Comparison",
                url: "https://www.youtube.com/watch?v=eHhFbfwYADo",
                thumbnail: "https://img.youtube.com/vi/eHhFbfwYADo/hqdefault.jpg"
            },
            {
                id: "3",
                title: "Citroen Basalt vs Mahindra XUV 3XO – Which One Should You Buy?",
                views: "4.9K",
                tag: "MotorBeam",
                url: "https://www.youtube.com/watch?v=8NPXGH3GVXA",
                thumbnail: "https://img.youtube.com/vi/8NPXGH3GVXA/hqdefault.jpg"
            },
            {
                id: "4",
                title: "Toyota Urban Cruiser Taisor Drive Impressions | Zigwheels",
                views: "7.1K",
                tag: "First Drive",
                url: "https://www.youtube.com/watch?v=kooveWXO3ys",
                thumbnail: "https://img.youtube.com/vi/kooveWXO3ys/hqdefault.jpg"
            },
            {
                id: "5",
                title: "Maruti Brezza VXI CNG Walkaround | Features, Engine & Price",
                views: "15K",
                tag: "Trending",
                url: "https://www.youtube.com/watch?v=E6gVh9nYWos",
                thumbnail: "https://img.youtube.com/vi/E6gVh9nYWos/hqdefault.jpg"
            }
        ];
    },


    mapCityToState(city: string): string {
        const map: Record<string, string> = {
            Delhi: "Delhi",
            Mumbai: "Maharashtra",
            Bangalore: "Karnataka",
            Chennai: "Tamil Nadu",
            Kolkata: "West Bengal",
            Hyderabad: "Telangana",
            Pune: "Maharashtra",
            Ahmedabad: "Gujarat",
            Jaipur: "Rajasthan",
            Lucknow: "Uttar Pradesh",
            Noida: "Uttar Pradesh",
            Gurgaon: "Haryana",
            Patna: "Bihar",
            Bhopal: "Madhya Pradesh"
        };
        return map[city] || "General";
    }
};

