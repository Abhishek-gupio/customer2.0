export function getPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function isValidIndianPhone(phone: string): boolean {
  return /^\d{10}$/.test(getPhoneDigits(phone));
}

export function validateIndianPhone(phone: string): string {
  const trimmedPhone = phone.trim();
  const digitOnlyPhone = trimmedPhone.replace(/\D/g, '');

  if (!trimmedPhone) {
    return 'Phone number is required';
  }

  if (/[A-Za-z]/.test(trimmedPhone)) {
    return 'Enter a valid phone number';
  }

  if (digitOnlyPhone.length < 10) {
    return 'Enter a 10-digit phone number';
  }

  if (!/^\d{10}$/.test(digitOnlyPhone)) {
    return 'Enter a valid phone number';
  }

  if (!isValidIndianPhone(phone)) {
    return 'Enter a valid phone number';
  }

  return '';
}
