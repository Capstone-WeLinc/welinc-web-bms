const BOOKING_STATUS_EVENT = 'welinc:booking-status-updated';
const BOOKING_STATUS_STORAGE_KEY = 'welinc:booking-status-update';

export interface BookingStatusUpdate {
  bookingId: string;
  status: string;
  updatedAt: number;
}

export function notifyBookingStatusUpdated(bookingId: string, status: string) {
  if (typeof window === 'undefined') return;
  const update: BookingStatusUpdate = { bookingId, status, updatedAt: Date.now() };
  window.dispatchEvent(new CustomEvent<BookingStatusUpdate>(BOOKING_STATUS_EVENT, { detail: update }));
  window.localStorage.setItem(BOOKING_STATUS_STORAGE_KEY, JSON.stringify(update));
}

export function subscribeToBookingStatusUpdates(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handleLocalUpdate = () => callback();
  const handleStorageUpdate = (event: StorageEvent) => {
    if (event.key === BOOKING_STATUS_STORAGE_KEY) callback();
  };
  window.addEventListener(BOOKING_STATUS_EVENT, handleLocalUpdate);
  window.addEventListener('storage', handleStorageUpdate);
  return () => {
    window.removeEventListener(BOOKING_STATUS_EVENT, handleLocalUpdate);
    window.removeEventListener('storage', handleStorageUpdate);
  };
}
