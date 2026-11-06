import ModalHeader from '../ui/ModalHeader';
import type { ReactNode } from 'react';
import { AlertCircle, Package } from 'lucide-react';
import type { Booking } from '../../lib/types';
import { normalizeBookingStatus } from '../../lib/booking';
import StatusBadge from '../shared/StatusBadge';
import { Dialog, DialogContent } from '../ui/Dialog';
import BookingMap from './BookingMap';
import { formatPhoneLocal } from '../../lib/phone';
import { BookingCostSummary } from './CostSummary';

const serviceChipClass = 'rounded-lg border border-[#1a1f6e]/20 bg-[#f5f6fd] px-2.5 py-1 text-xs font-medium text-[#1a1f6e]';

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{title}</h3>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value, divided = false }: { label: string; value: string; divided?: boolean }) {
  const muted = !value || value === '-';
  return (
    <div className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start gap-3 ${divided ? 'border-b border-slate-100 pb-2.5' : ''}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`break-words text-[15px] ${muted ? 'font-normal text-slate-400' : 'font-medium text-slate-900'}`}>{muted ? 'Not set' : value}</span>
    </div>
  );
}

function RouteStop({ label, value, landmark }: { label: string; value?: string; landmark?: string }) {
  const landmarkText = landmark?.trim();
  return (
    <div className="min-w-0">
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`mt-0.5 break-words text-[14.5px] leading-relaxed ${value ? 'font-medium text-slate-900' : 'font-normal text-slate-400'}`}>{value || 'Not set'}</p>
      {landmarkText && <p className="mt-0.5 break-words text-sm text-slate-600">Landmark / Map Pin: {landmarkText}</p>}
    </div>
  );
}

/** Read-only booking details, styled like the job order details modal. */
export default function BookingDetailsDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const truck = booking?.selectedTruck;
  return (
    <Dialog open={!!booking} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl border-0 bg-white p-0 text-slate-800 shadow-xl sm:rounded-xl lg:w-[min(78vw,56rem)] xl:w-[min(68vw,56rem)]"
      >
        <ModalHeader
          icon={Package}
          title="Booking details"
          subtitle={booking?.bookingNo ?? '-'}
          aside={booking && <StatusBadge status={normalizeBookingStatus(booking.status)} variant="outline" />}
          onClose={onClose}
          closeLabel="Close booking details"
        />

        {booking && (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f1f4fa] p-4">
            {booking.discrepancyNote && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm leading-relaxed text-rose-800">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Booking Note</p>
                  <p>{booking.discrepancyNote}</p>
                </div>
              </div>
            )}

            <DetailCard title="Customer">
              <DetailRow label="Name" value={booking.fullName || booking.client} />
              <DetailRow label="Contact" value={formatPhoneLocal(booking.contact)} />
              <DetailRow label="Email" value={booking.email || ''} />
            </DetailCard>

            <DetailCard title="Service">
              <DetailRow label="Service Type" value={booking.serviceType || booking.service} />
              {truck?.truckTypeId && <DetailRow label="Truck Type" value={truck.truckTypeId} />}
              {truck?.name && <DetailRow label="Preferred Truck" value={`${truck.name} — ₱${Number(truck.rate).toLocaleString()}`} />}
            </DetailCard>

            <DetailCard title="Route & Schedule">
              {booking.deliveryCategory && <DetailRow label="Category" value={booking.deliveryCategory} />}
              <DetailRow label="Date & Time" value={`${booking.moveDate || booking.date}${booking.preferredTime ? ` at ${booking.preferredTime}` : ''}`} />
            </DetailCard>

            <DetailCard title="Route">
              <div className="flex gap-3">
                <div className="flex w-3 shrink-0 flex-col items-center py-1"><span className="h-2.5 w-2.5 rounded-full bg-[#1a1f6e]" /><span className="my-1 min-h-8 flex-1 border-l-2 border-dashed border-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-[#e8b800]" /></div>
                <div className="min-w-0 flex-1 space-y-4">
                  <RouteStop label="Pickup address" value={booking.pickupAddress} landmark={booking.pickupLandmark} />
                  <RouteStop label="Drop-off address" value={booking.deliveryAddress || booking.address} landmark={booking.deliveryLandmark} />
                </div>
              </div>
            </DetailCard>

            <DetailCard title="Route & Estimated Time">
              {booking.pickupAddress && booking.deliveryAddress ? (
                <BookingMap
                  pickupAddress={booking.pickupAddress}
                  deliveryAddress={booking.deliveryAddress}
                  pickupLandmark={booking.pickupLandmark}
                  deliveryLandmark={booking.deliveryLandmark}
                  showMap
                />
              ) : (
                <p className="text-sm text-slate-600">Both the pickup and delivery addresses are required to estimate travel time.</p>
              )}
            </DetailCard>

            {(booking.estimatedItems != null || booking.itemDetails || booking.specialInstructions) && (
              <DetailCard title="Items">
                {booking.estimatedItems != null && <DetailRow label="Est. Items" value={`${booking.estimatedItems} pcs`} />}
                {booking.itemDetails && <DetailRow label="Details" value={booking.itemDetails} />}
                {booking.specialInstructions && <DetailRow label="Instructions" value={booking.specialInstructions} />}
              </DetailCard>
            )}

            {!!booking.servicesAvailed?.length && (
              <DetailCard title="Special Services">
                <div className="flex flex-wrap gap-2">{booking.servicesAvailed.map(service => <span key={service} className={serviceChipClass}>{service}</span>)}</div>
              </DetailCard>
            )}

            <DetailCard title="Permit">
              <DetailRow label="Barangay / Subdivision Permit" value={booking.permitRequired ? 'Yes — Required' : 'Not required'} />
            </DetailCard>

            <DetailCard title="Insurance & Payment">
              <DetailRow divided label="Insurance" value={booking.hasInsurance ? 'Yes' : 'No'} />
              <DetailRow label="Payment Method" value={booking.paymentMethod || booking.requestedPaymentMethod || ''} />
            </DetailCard>

            <DetailCard title="Cost Summary">
              <BookingCostSummary booking={booking} />
            </DetailCard>
          </div>
        )}

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            Close
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
