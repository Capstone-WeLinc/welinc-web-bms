/**
 * Shows a Philippine mobile number the local way, "0917 123 4567", whether it
 * was saved as +639171234567, 639171234567, 9171234567 or 09171234567.
 * Anything that is not a recognisable mobile number is shown as entered.
 */
export function formatPhoneLocal(value?: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  let local = '';
  if (digits.length === 12 && digits.startsWith('639')) local = `0${digits.slice(2)}`;
  else if (digits.length === 10 && digits.startsWith('9')) local = `0${digits}`;
  else if (digits.length === 11 && digits.startsWith('09')) local = digits;
  if (!local) return trimmed;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
