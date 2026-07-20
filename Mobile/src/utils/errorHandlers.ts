export function getErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return fallback;
}

export function isOfflineError(error: unknown): boolean {
  const message = getErrorMessage(error, '').toLowerCase();

  return (
    message.includes('network error') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('internet connection') ||
    message.includes('offline')
  );
}

export function getNetworkAwareErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
  offlineFallback = 'You are offline. Check your internet connection and try again.',
): string {
  if (isOfflineError(error)) {
    return offlineFallback;
  }

  return getErrorMessage(error, fallback);
}

export function getAuthErrorMessage(error: unknown): string {
  const message = getErrorMessage(error, 'Unable to continue. Please try again.');
  const normalized = message.toLowerCase();

  if (normalized.includes('user not found')) {
    return 'User not found';
  }

  if (isOfflineError(error)) {
    return 'Network error. Please try again.';
  }

  if (isOtpCooldownError(error)) {
    return 'OTP already sent. Please check your phone.';
  }

  if (
    normalized.includes('invalid or expired otp') ||
    normalized.includes('invalid otp') ||
    normalized.includes('expired otp')
  ) {
    return 'Enter a valid OTP';
  }

  if (
    normalized.includes('invalid phone') ||
    normalized.includes('invalid number') ||
    normalized.includes('not a valid')
  ) {
    return 'Enter valid phone number';
  }

  return message;
}

export function isOtpCooldownError(error: unknown): boolean {
  const message = getErrorMessage(error, '').toLowerCase();

  return (
    message.includes('too many requests') ||
    message.includes('before requesting another otp')
  );
}
