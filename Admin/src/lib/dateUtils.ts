/**
 * Formats a date string, number, or Date object to dd/mm/yyyy.
 * @param date The date to format.
 * @returns A formatted date string or a placeholder if invalid.
 */
export const formatDate = (date?: string | number | Date | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  // Using en-GB for dd/mm/yyyy format
  return d.toLocaleDateString('en-GB');
};

/**
 * Formats a date string, number, or Date object to dd/mm/yyyy hh:mm.
 * @param date The date to format.
 * @returns A formatted date-time string or a placeholder if invalid.
 */
export const formatDateTime = (date?: string | number | Date | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  // Using en-GB for dd/mm/yyyy hh:mm format
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Formats a date string, number, or Date object to hh:mm AM/PM.
 * @param date The date to format.
 * @returns A formatted time string or a placeholder if invalid.
 */
export const formatTime = (date?: string | number | Date | null): string => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
