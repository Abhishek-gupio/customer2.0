/**
 * Headless JS task handler for Android NotificationListenerService.
 *
 * Runs in the background when the device receives any status-bar notification.
 * Filters for known banking/UPI app packages and financial keywords,
 * then sends the text to the backend `parse/text` API to auto-create expenses.
 */
import { API_BASE_URL } from '../config';
import { getAccessToken, getAutoExpenseEnabled } from './storage';

// ─── Known Indian banking / UPI app packages ────────────────────────────
const BANKING_PACKAGES = new Set([
    // UPI apps
    'com.google.android.apps.nbu.paisa.user', // Google Pay
    'com.phonepe.app',                         // PhonePe
    'net.one97.paytm',                         // Paytm
    'in.org.npci.upiapp',                      // BHIM
    'com.whatsapp',                            // WhatsApp Pay
    'in.amazon.mShop.android.shopping',        // Amazon Pay

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

// ─── Send to backend ────────────────────────────────────────────────────
async function sendToBackend(text: string): Promise<void> {
    const token = getAccessToken();
    if (!token) {
        console.log('[NotifExpense] No auth token — skipping');
        return;
    }

    const url = `${API_BASE_URL}/api/v1/expenses/parse/text`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text, source: 'NOTIFICATION' }),
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
            console.log('[NotifExpense] ❌ API error:', res.status, data?.message);
        }
    } catch (err) {
        console.error('[NotifExpense] Network error:', err);
    }
}

// ─── Main headless handler ──────────────────────────────────────────────
export const headlessNotificationListener = async ({ notification }: { notification: string }) => {
    try {
        // 0. Check user toggle
        if (!getAutoExpenseEnabled()) return;

        if (!notification) return;

        const parsed = JSON.parse(notification);
        const { app, text, bigText, title } = parsed;

        // 1. Check if from a known banking app
        const isKnownApp = BANKING_PACKAGES.has(app);

        // 2. Get the fullest text available
        const content = bigText || text || title || '';
        if (!content || content.length < 10) return;

        // 3. If not a known app, check for financial keywords
        if (!isKnownApp && !isFinancialText(content)) return;

        // 4. Local dedup
        if (isDuplicate(content)) return;

        // 5. Send to backend (auto-creates expense)
        console.log(`[NotifExpense] 📩 Processing notification from ${app}: ${content.substring(0, 80)}...`);
        await sendToBackend(content);
    } catch (err) {
        console.error('[NotifExpense] Handler error:', err);
    }
};
