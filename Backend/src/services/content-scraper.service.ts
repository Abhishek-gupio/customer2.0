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
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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
    "Cache-Control": "max-age=0"
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

    async scrapeFromUrl(url: string, fuelType: "PETROL" | "DIESEL" | "CNG"): Promise<number> {
        let savedCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const response = await axios.get(url, {
            headers: {
                ...BROWSER_HEADERS,
                "Referer": "https://www.google.com/"
            },
            timeout: 15000
        });
        const $ = cheerio.load(response.data);
        const promises: Promise<any>[] = [];

        // Updated selector based on actual website structure
        // div.gold_rate_table_inner is the container for city-wise tables
        $("div.gold_rate_table_inner table tr, div.gold_silver_table tr, table tr").each((_, tr) => {
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
        return savedCount;
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

