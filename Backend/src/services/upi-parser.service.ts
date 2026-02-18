import { logger } from "../config/logger";

/**
 * UPI NOTIFICATION PARSER
 * ========================
 * Parses UPI payment notifications from:
 * - Google Pay (GPay)
 * - PhonePe
 * - Paytm
 * - BHIM UPI
 * - Bank SMS (SBI, HDFC, ICICI, Axis, etc.)
 * - FASTag Recharge
 *
 * Returns structured expense data from raw notification text.
 */

export interface UPIParsedResult {
  amount: number;
  merchantName: string | null;
  upiId: string | null;
  category: string; // FUEL, TOLL, SERVICE, PARKING, etc.
  confidence: "HIGH" | "MEDIUM" | "LOW";
  source: string; // GPAY, PHONEPE, PAYTM, BANK_SMS, etc.
  transactionId: string | null;
  date: Date;
  rawText: string;
}

// Category keyword mapping (expanded for UPI context)
const CATEGORY_RULES: {
  category: string;
  keywords: string[];
  confidence: "HIGH" | "MEDIUM";
}[] = [
  {
    category: "FUEL",
    keywords: [
      "petrol",
      "fuel",
      "diesel",
      "cng",
      "pump",
      "gas station",
      "oil",
      "indian oil",
      "iocl",
      "hp ",
      "hpcl",
      "bharat petroleum",
      "bpcl",
      "shell",
      "essar",
      "reliance petrol",
      "nayara",
      "filling station",
      "m/s",
      "petrole",
      "petroleum",
    ],
    confidence: "HIGH",
  },
  {
    category: "TOLL",
    keywords: [
      "toll",
      "fastag",
      "nhai",
      "plaza",
      "highway",
      "ihmcl",
      "netc",
      "etc ",
      "electronic toll",
    ],
    confidence: "HIGH",
  },
  {
    category: "PARKING",
    keywords: [
      "parking",
      "park ",
      "valet",
      "multi level parking",
      "smart parking",
      "paytm parking",
    ],
    confidence: "HIGH",
  },
  {
    category: "SERVICE",
    keywords: [
      "service",
      "repair",
      "garage",
      "workshop",
      "mechanic",
      "auto ",
      "motors",
      "honda service",
      "maruti service",
      "hyundai service",
      "toyota service",
      "tata motors",
      "mahindra",
      "bosch",
      "tyre",
      "tire",
      "wheel",
      "alignment",
      "car wash",
      "dent",
      "paint",
      "spare parts",
      "accessories",
    ],
    confidence: "MEDIUM",
  },
  {
    category: "CHALLAN",
    keywords: [
      "challan",
      "fine",
      "traffic",
      "police",
      "violation",
      "e-challan",
      "echallan",
    ],
    confidence: "HIGH",
  },
  {
    category: "INSURANCE",
    keywords: [
      "insurance",
      "policy",
      "premium",
      "acko",
      "digit",
      "bajaj allianz",
      "icici lombard",
      "hdfc ergo",
      "tata aig",
      "new india assurance",
      "motor insurance",
    ],
    confidence: "HIGH",
  },
];

// UPI App detection patterns
const UPI_APP_PATTERNS = [
  { name: "GPAY", patterns: [/google pay/i, /gpay/i, /tez/i] },
  { name: "PHONEPE", patterns: [/phonepe/i, /phone pe/i] },
  { name: "PAYTM", patterns: [/paytm/i, /pay ?tm/i] },
  { name: "BHIM", patterns: [/bhim/i, /upi/i] },
  { name: "CRED", patterns: [/cred/i] },
  { name: "AMAZON_PAY", patterns: [/amazon ?pay/i] },
];

// Amount extraction patterns (Indian formats)
const AMOUNT_PATTERNS = [
  /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i, // Rs. 2,000.00
  /(?:debited|paid|sent|transferred)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i, // debited 2000
  /(?:amount|amt)\s*(?:rs\.?|inr|₹)?\s*:?\s*([\d,]+(?:\.\d{1,2})?)/i, // amount: 2000
  /([\d,]+(?:\.\d{2})?)\s*(?:debited|deducted|spent)/i, // 2000 debited
];

// Merchant extraction patterns
const MERCHANT_PATTERNS = [
  /(?:paid to|sent to|transferred to|at)\s+([A-Za-z0-9\s&.'-]+?)(?:\s+(?:on|via|ref|upi|$))/i,
  /(?:to|at)\s+([A-Z][A-Za-z0-9\s&.'-]{2,30})/, // "to SHELL PETROL PUMP"
  /(?:VPA|UPI)\s*:?\s*([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/i, // UPI ID extraction
  /(?:credited to|debited for)\s+([A-Za-z0-9\s&.'-]+)/i,
];

// UPI ID extraction
const UPI_ID_PATTERN = /([a-zA-Z0-9._-]+@[a-zA-Z0-9]+)/;

// Transaction ID extraction
const TXN_ID_PATTERNS = [
  /(?:ref|txn|transaction)\s*(?:no|id|#)?\s*:?\s*([A-Z0-9]+)/i,
  /(?:UPI)\s*(?:ref|Ref)\s*(?:no)?\s*:?\s*(\d+)/i,
];

export const upiParserService = {
  /**
   * Main parser: takes raw notification text and returns structured expense data
   */
  parse(text: string): UPIParsedResult | null {
    if (!text || text.length < 5) return null;

    const normalized = text.toLowerCase();

    // 1. Extract Amount
    const amount = this.extractAmount(text);
    if (!amount || amount <= 0) {
      logger.debug({ text }, "UPI Parser: No amount found");
      return null;
    }

    // 2. Detect Source App
    const source = this.detectSource(text);

    // 3. Extract Merchant
    const merchantName = this.extractMerchant(text);

    // 4. Extract UPI ID
    const upiMatch = text.match(UPI_ID_PATTERN);
    const upiId = upiMatch ? upiMatch[1] : null;

    // 5. Extract Transaction ID
    const transactionId = this.extractTransactionId(text);

    // 6. Categorize Based on Merchant + Keywords
    const { category, confidence } = this.categorize(normalized, merchantName);

    return {
      amount,
      merchantName,
      upiId,
      category,
      confidence,
      source,
      transactionId,
      date: new Date(),
      rawText: text,
    };
  },

  /**
   * Extract amount from text using multiple patterns
   */
  extractAmount(text: string): number {
    for (const pattern of AMOUNT_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (amount > 0 && amount < 10000000) return amount; // Sanity check: < 1 crore
      }
    }
    return 0;
  },

  /**
   * Detect which UPI app sent the notification
   */
  detectSource(text: string): string {
    for (const app of UPI_APP_PATTERNS) {
      if (app.patterns.some((p) => p.test(text))) {
        return app.name;
      }
    }
    // Check for bank SMS patterns
    if (/(?:sbi|hdfc|icici|axis|kotak|pnb|bob|canara|union)/i.test(text)) {
      return "BANK_SMS";
    }
    return "UPI_UNKNOWN";
  },

  /**
   * Extract merchant name from notification
   */
  extractMerchant(text: string): string | null {
    for (const pattern of MERCHANT_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const merchant = match[1].trim();
        // Clean up: remove trailing words like "on", "via"
        const cleaned = merchant.replace(/\s+(on|via|ref|upi|$)/gi, "").trim();
        if (cleaned.length >= 2 && cleaned.length <= 50) {
          return cleaned;
        }
      }
    }
    return null;
  },

  /**
   * Extract transaction reference ID
   */
  extractTransactionId(text: string): string | null {
    for (const pattern of TXN_ID_PATTERNS) {
      const match = text.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  },

  /**
   * Categorize the expense based on merchant name and keywords
   */
  categorize(
    normalizedText: string,
    merchantName: string | null,
  ): { category: string; confidence: "HIGH" | "MEDIUM" | "LOW" } {
    const searchText = `${normalizedText} ${(merchantName || "").toLowerCase()}`;

    for (const rule of CATEGORY_RULES) {
      if (rule.keywords.some((k) => searchText.includes(k))) {
        return { category: rule.category, confidence: rule.confidence };
      }
    }

    return { category: "OTHER", confidence: "LOW" };
  },

  /**
   * Batch parse: for processing multiple notifications at once
   */
  parseBatch(texts: string[]): UPIParsedResult[] {
    return texts
      .map((t) => this.parse(t))
      .filter((r): r is UPIParsedResult => r !== null);
  },

  /**
   * Check if a text looks like a financial transaction notification
   */
  isTransactionNotification(text: string): boolean {
    const lower = text.toLowerCase();
    const financialKeywords = [
      "debited",
      "credited",
      "paid",
      "sent",
      "received",
      "transaction",
      "txn",
      "upi",
      "neft",
      "imps",
      "rs.",
      "rs ",
      "inr",
      "₹",
      "amount",
    ];
    return financialKeywords.some((k) => lower.includes(k));
  },
};
