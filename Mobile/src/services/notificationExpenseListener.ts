/**
 * Headless JS task handler for Android NotificationListenerService.
 *
 * Runs in the background when the device receives any status-bar notification.
 * Filters for known banking/UPI app packages and financial keywords,
 * then sends the text to the backend `parse/text` API to auto-create expenses.
 */
import { API_BASE_URL } from '../config';
import { getAccessToken, getAutoExpenseEnabled, setLastReceivedOtp } from './storage';

// ─── Known Indian banking / UPI app packages ────────────────────────────
const BANKING_PACKAGES = new Set([
    // UPI apps
    'com.google.android.apps.nbu.paisa.user', // Google Pay
    'com.phonepe.app',                         // PhonePe
    'net.one97.paytm',                         // Paytm
    'in.org.npci.upiapp',                      // BHIM
    'com.whatsapp',                            // WhatsApp Pay
    'in.amazon.mShop.android.shopping',        // Amazon Pay

    // SMS apps (to catch transaction alerts)
    'com.google.android.apps.messaging',       // Google Messages
    'com.samsung.android.messaging',           // Samsung Messages
    'com.android.messaging',                   // AOSP Messages
    'com.oneplus.mms',                         // OnePlus Messages

    // Banks
    'com.sbi.SBIFreedom',                      // SBI YONO
    'com.sbi.lotusintouch',                    // SBI YONO Lite
    'com.csam.icici.bank.imobile',             // ICICI iMobile
    'com.icicibank.app',                       // ICICI (alt)
    'com.axis.mobile',                         // Axis Mobile
    'com.hdfc.mobilebanking',                  // HDFC Mobile
    'com.bankofbaroda.mconnect',               // BOB
    'com.msf.kbank.mobile',                    // Kotak
    'com.snapwork.hdfc',                       // HDFC PayZapp

    // Wallets / others
    'com.mobikwik_new',                        // MobiKwik
    'com.freecharge.android',                  // Freecharge
    'in.juspay.namma',                         // Namma Yatri
]);

const OTP_SOURCE_PACKAGES = new Set([
    'com.google.android.apps.messaging',
    'com.samsung.android.messaging',
    'com.android.messaging',
    'com.oneplus.mms',
]);

// ─── Financial keywords (fallback for unknown apps) ─────────────────────
const FINANCIAL_KEYWORDS = [
    'debited', 'credited', 'debit', 'credit',
    'UPI', 'NEFT', 'IMPS', 'RTGS',
    'spent', 'paid', 'received',
    'Rs.', 'Rs ', 'INR', '₹',
    'A/c', 'Acct', 'a/c',
    'transaction', 'txn',
    'fastag', 'petrol', 'fuel', 'toll',
];

const OTP_KEYWORDS = [
    'otp',
    'one time password',
    'one-time password',
    'verification code',
    'gupio',
];

// ─── Local dedup: avoid re-sending the same notification ────────────────
const recentHashes = new Set<string>();
const MAX_HASH_SIZE = 200;

function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return String(hash);
}

function isDuplicate(text: string): boolean {
    const hash = simpleHash(text);
    if (recentHashes.has(hash)) return true;
    recentHashes.add(hash);
    if (recentHashes.size > MAX_HASH_SIZE) {
        // Remove oldest entry
        const first = recentHashes.values().next().value;
        if (first) recentHashes.delete(first);
    }
    return false;
}

// ─── Check if notification text looks financial ─────────────────────────
function isFinancialText(text: string): boolean {
    const lower = text.toLowerCase();
    return FINANCIAL_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

function extractOtp(text: string): string | null {
    const lower = text.toLowerCase();
    const hasOtpKeyword = OTP_KEYWORDS.some(keyword => lower.includes(keyword));
    const isGupioMessage = lower.includes('gupio');
    if (!hasOtpKeyword || !isGupioMessage) {
        return null;
    }

    const patterns = [
        /\botp(?:\s+is|\s*[:\-])?\s*(\d{4,8})\b/i,
        /\b(\d{4,8})\b(?=.*\botp\b)/i,
        /\b(\d{4,8})\b(?=.*\bgupio\b)/i,
        /\b(\d{6})\b/,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[1]) return match[1];
    }

    return null;
}

// Primary vehicle lookup (cached)
let cachedPrimaryVehicleId: string | null = null;
let lastPrimaryVehicleFetch = 0;
const PRIMARY_VEHICLE_TTL_MS = 5 * 60 * 1000;

async function getPrimaryVehicleId(token: string): Promise<string | null> {
    const now = Date.now();
    if (cachedPrimaryVehicleId && now - lastPrimaryVehicleFetch < PRIMARY_VEHICLE_TTL_MS) {
        return cachedPrimaryVehicleId;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/v1/vehicles`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return null;

        const list = Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data)
                ? data
                : [];
        const primary = list.find((v: any) => v?.isPrimary) || list[0];
        cachedPrimaryVehicleId = primary?.id ?? null;
        lastPrimaryVehicleFetch = now;
        return cachedPrimaryVehicleId;
    } catch {
        return null;
    }
}

// Send to backend
async function sendToBackend(text: string): Promise<void> {
    const token = getAccessToken();
    if (!token) {
        console.log('[NotifExpense] No auth token — skipping');
        return;
    }

    const vehicleId = await getPrimaryVehicleId(token);
    const url = `${API_BASE_URL}/api/v1/expenses/parse/text`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                text,
                source: 'NOTIFICATION',
                ...(vehicleId ? { vehicleId } : {}),
            }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
            const result = data?.data ?? data;
            if (result?.success) {
                console.log('[NotifExpense] ✅ Auto-created expense:', result.expense?.amount, result.expense?.category);
            } else if (result?.skipped) {
                console.log('[NotifExpense] ⏭️ Skipped:', result.reason);
            }
        } else {
            const message =
                data?.error?.message ??
                data?.message ??
                (typeof data === 'string' ? data : undefined);
            console.log('[NotifExpense] ❌ API error:', res.status, message ?? data);
        }
    } catch (err) {
        console.error('[NotifExpense] Network error:', err);
    }
}

// ─── Main headless handler ──────────────────────────────────────────────
export const headlessNotificationListener = async ({ notification }: { notification: string }) => {
    try {
        if (!notification) return;

        const parsed = JSON.parse(notification);
        const { app, text, bigText, title } = parsed;

        // 1. Get the fullest text available
        const content = bigText || text || title || '';
        if (!content || content.length < 10) return;

        const otpText = `${title || ''}\n${content}`;
        const otp =
            OTP_SOURCE_PACKAGES.has(app) || String(title || '').toLowerCase().includes('gupio')
                ? extractOtp(otpText)
                : null;
        if (otp) {
            setLastReceivedOtp(otp);
            console.log(`[NotifExpense] Stored OTP from ${app}: ${otp}`);
        }

        // Android may redact sensitive notification text on lockscreen or for messaging apps.
        // Those placeholders are not parseable and will cause 400s; skip them.
        const lowerContent = String(content).toLowerCase();
        if (
            lowerContent.includes('sensitive notification content hidden') ||
            lowerContent.includes('is doing work in the background')
        ) {
            console.log(`[NotifExpense] 🔒 Redacted/non-transaction notification from ${app} — skipping`);
            return;
        }

        // 2. Check user toggle for expense parsing only
        if (!getAutoExpenseEnabled()) return;

        // 3. Check if from a known banking app
        const isKnownApp = BANKING_PACKAGES.has(app);

        // 4. If not a known app, check for financial keywords
        if (!isKnownApp && !isFinancialText(content)) return;

        // 5. Local dedup
        if (isDuplicate(content)) return;

        console.log(`[NotifExpense] 📩 Processing notification from ${app}: ${content.substring(0, 80)}...`);
        await sendToBackend(content);
    } catch (err) {
        console.error('[NotifExpense] Handler error:', err);
    }
};
