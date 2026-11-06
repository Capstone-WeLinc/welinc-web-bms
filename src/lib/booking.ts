import type { BookingStatus } from './types';

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
