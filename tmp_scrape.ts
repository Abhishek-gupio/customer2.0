import { contentScraperService } from "./Backend/src/services/content-scraper.service";
import { logger } from "./Backend/src/config/logger";

async function runScraper() {
    try {
        console.log("Triggering manual fuel price scrape...");
        const count = await contentScraperService.scrapeFuelPrices();
        console.log(`Manual scrape finished. Saved ${count} prices.`);
        process.exit(0);
    } catch (err) {
        console.error("Manual scrape failed:", err);
        process.exit(1);
    }
}

runScraper();
