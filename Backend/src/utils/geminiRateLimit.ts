/**
 * Detect if an error from Gemini (or similar Google AI API) is a rate limit / quota error.
 * Use this to return 429 to the client instead of 500 so they see "try again later".
 */
export function isGeminiRateLimitError(err: any): boolean {
  if (!err) return false;
  const status = err?.response?.status ?? err?.status;
  if (status === 429) return true;
  const msg = String(
    err?.message ??
      err?.response?.data?.error?.message ??
      err?.response?.data?.message ??
      ""
  ).toLowerCase();
  return (
    /rate limit/i.test(msg) ||
    /resource exhausted/i.test(msg) ||
    /quota exceeded/i.test(msg) ||
    /too many requests/i.test(msg) ||
    /429/i.test(msg)
  );
}
