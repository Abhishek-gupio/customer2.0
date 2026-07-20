import axios from "axios";

const BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
};

async function testScrape(url: string) {
    console.log(`Testing URL: ${url}`);
    try {
        const response = await axios.get(url, {
            headers: {
                ...BROWSER_HEADERS,
                "Referer": "https://www.google.com/"
            },
            timeout: 10000
        });
        console.log(`✅ Success! Status: ${response.status}`);
        console.log(`Content length: ${response.data.length}`);
    } catch (err: any) {
        console.error(`❌ Failed! Status: ${err.response?.status || err.code}`);
        if (err.response?.data) {
            console.log(`Data snippet: ${err.response.data.slice(0, 500)}`);
        }
    }
}

const urls = [
    "https://www.goodreturns.in/petrol-price.html",
    "https://www.goodreturns.in/diesel-price.html"
];

(async () => {
    for (const url of urls) {
        await testScrape(url);
    }
})();
