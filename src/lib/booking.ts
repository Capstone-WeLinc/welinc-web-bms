import type { Booking, BookingStatus } from './types';

/**
 * Canonical booking-status normalization used by every page in the app.
 *
 * This is the single source of truth so the same booking always renders
 * with the same label and the same color wherever it appears:
 *   - /admin/booking and /cs/bookings (BookingModule)
 *   - AdminDashboard "Recent Bookings" widget
 *   - CsDashboard "Recent Bookings" widget
 *   - AdminScheduling
 *
 * Rules (kept in sync with the BookingModule's filter set):
 *   "Confirmed" / "Scheduled" -> "Assigned" (legacy aliases)
 *   "Discrepancy"    -> "For Plotting"   (needs review before scheduling)
 *   "For Correction" -> "For Plotting"   (legacy alias for "Discrepancy")
 *   anything else    -> as-is
 */
export function normalizeBookingStatus(status: string): BookingStatus {
  if (status === 'Confirmed' || status === 'Scheduled') return 'Assigned';
  if (status === 'Discrepancy' || status === 'For Correction') return 'For Plotting';
  return status as BookingStatus;
}

/**
 * Formats a Booking.amount (which can be string or number) as a Philippine
 * peso string. Falls back to "₱0.00" when the amount is missing, null,
 * empty, or unparseable. This is the single source of truth so the same
 * booking shows the same amount text on every page.
 */
export function formatBookingAmount(amount: string | number | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') {
    return '₱0.00';
  }
  const numeric = typeof amount === 'number' ? amount : Number(String(amount).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(numeric)) return '₱0.00';
  return `₱${numeric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const pesoCents = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return 0;
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
};

/** The downpayment as the API expects it: a peso string, or null when it is cleared. */
export function downpaymentValue(booking: Pick<Booking, 'downpayment'>): string | null {
  const text = String(booking.downpayment ?? '').trim();
  return text && pesoCents(text) > 0 ? text : null;
}

export function downpaymentChanged(next: Pick<Booking, 'downpayment'>, original: Pick<Booking, 'downpayment'>) {
  return pesoCents(downpaymentValue(next)) !== pesoCents(downpaymentValue(original));
}

export function downpaymentError(booking: Pick<Booking, 'downpayment' | 'amount'>) {
  const text = String(booking.downpayment ?? '').trim();
  if (!text) return '';
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) return 'Enter a peso amount with up to 2 decimals.';
  const amount = pesoCents(booking.amount);
  if (amount > 0 && pesoCents(text) > amount) return 'Downpayment cannot exceed the booking amount.';
  return '';
}

/** What the client still owes: the total less the downpayment and verified collections, never below zero. */
export function remainingBalance(total: string | number | null | undefined, downpayment: string | number | null | undefined, paid: string | number | null | undefined = 0) {
  return Math.max(0, pesoCents(total) - pesoCents(downpayment) - pesoCents(paid)) / 100;
}
