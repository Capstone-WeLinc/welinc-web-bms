import ModalHeader from '../ui/ModalHeader';
import type { FormEvent, ReactNode } from 'react';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import type { Booking } from '../../lib/types';
import { downpaymentError, formatBookingAmount, normalizeBookingStatus, remainingBalance } from '../../lib/booking';
import { Dialog, DialogContent } from '../ui/Dialog';
import { DatePicker } from '../ui/DatePicker';
import { stepThreeTextarea, stepTwoControl, stepTwoInvalid } from './bookingFormStyles';

const valueText = '!text-[15px] font-medium placeholder:font-normal';
const lockedControl = 'h-[42px] w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-500';
const subscriberDigits = (value: string) => value.replace(/\D/g, '').replace(/^63/, '').replace(/^0/, '').slice(0, 10);
/** Keeps a peso amount typeable: digits, one decimal point, at most 2 decimals. */
const pesoInput = (value: string) => {
  const [whole, ...rest] = value.replace(/[^\d.]/g, '').split('.');
  return rest.length ? `${whole.slice(0, 8)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 8);
};
const formatSubscriber = (digits: string) => [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(' ');

type EditBookingDialogProps = {
  booking: Booking | null;
  onChange: (update: (booking: Booking) => Booking) => void;
  touched: Set<string>;
  onTouch: (field: string) => void;
  getError: (field: string) => string;
  /** The formatted date value. Admin can change it; CS changes it through a reschedule request. */
  dateValue: string;
  canEditDate: boolean;
  saving: boolean;
  canSubmit: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
};

function BookingFormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />{title}</h3>
      {children}
    </section>
  );
}

function BookingFormField({ id, label, required = false, className = '', children }: { id: string; label: string; required?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm text-slate-600">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children}
    </div>
  );
}

/** Booking edit form, styled like the job order details modal. Validation and saving stay with the page. */
export default function EditBookingDialog({ booking, onChange, touched, onTouch, getError, dateValue, canEditDate, saving, canSubmit, onSubmit, onClose }: EditBookingDialogProps) {
  const invalid = (field: string) => touched.has(field) && !!getError(field);
  const control = (field: string) => `${stepTwoControl} ${valueText} ${invalid(field) ? stepTwoInvalid : ''}`;
  const message = (field: string) => invalid(field) ? <p className="mt-1 text-sm text-red-600">{getError(field)}</p> : null;
  const submitReady = canSubmit && !saving;

  return (
    <Dialog open={!!booking} onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent
        hideCloseButton
        onInteractOutside={event => {
          if ((event.target as HTMLElement).closest('[data-datepicker-portal]')) event.preventDefault();
        }}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl border-0 bg-white p-0 text-slate-800 shadow-xl sm:rounded-xl lg:w-[min(78vw,56rem)] xl:w-[min(68vw,56rem)]"
      >
        <ModalHeader
          title="Edit booking"
          subtitle={booking?.bookingNo ?? '-'}
          onClose={onClose}
          closeDisabled={saving}
          closeLabel="Close edit booking"
        />

        {booking && (
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f1f4fa] p-4">
              <BookingFormSection title="Permit requirement">
                <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${booking.permitRequired ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ShieldCheck size={19} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-medium leading-tight text-slate-900">Barangay / subdivision permit required</span><span className="mt-0.5 block text-sm leading-tight text-slate-600">Check if the pickup or delivery location requires a gate pass or entry permit</span></span>
                  <input type="checkbox" checked={Boolean(booking.permitRequired)} onChange={e => { const checked = e.target.checked; onChange(prev => ({ ...prev, permitRequired: checked })); }} aria-label="Barangay or subdivision permit required" className="h-5 w-5 shrink-0 accent-[#1a1f6e]" />
                </label>
              </BookingFormSection>

              <BookingFormSection title="Personal information">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
                  <BookingFormField id="editFullName" label="Full name" required className="sm:col-span-2">
                    <input id="editFullName" value={booking.fullName || booking.client} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, fullName: value, client: value })); }} onBlur={() => onTouch('name')} aria-invalid={invalid('name')} placeholder="Full name" className={control('name')} />
                    {message('name')}
                  </BookingFormField>
                  <BookingFormField id="editEmail" label="Email address" required>
                    <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input id="editEmail" type="email" value={booking.email || ''} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, email: value })); }} onBlur={() => onTouch('email')} aria-invalid={invalid('email')} placeholder="email@gmail.com" className={`${control('email')} pl-9`} />
                    </div>
                    {message('email')}
                  </BookingFormField>
                  <BookingFormField id="editContact" label="Contact number" required>
                    <div className={`flex h-[42px] overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-[#1a1f6e]/20 ${invalid('contact') ? 'border-red-400 focus-within:!ring-red-400/20' : 'border-slate-300 focus-within:border-[#1a1f6e]'}`}>
                      <span className="flex shrink-0 items-center gap-2 border-r border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"><Phone size={16} aria-hidden="true" /><span>+63</span></span>
                      <input id="editContact" type="tel" inputMode="numeric" value={formatSubscriber(subscriberDigits(booking.contact || ''))} onChange={e => { const digits = subscriberDigits(e.target.value); onChange(prev => ({ ...prev, contact: digits ? `+63${digits}` : '' })); }} onBlur={() => onTouch('contact')} aria-invalid={invalid('contact')} placeholder="912 345 6789" className={`h-full min-w-0 flex-1 bg-transparent px-3 text-slate-900 outline-none placeholder:text-slate-400 ${valueText}`} />
                    </div>
                    {message('contact')}
                  </BookingFormField>
                </div>
              </BookingFormSection>

              <BookingFormSection title="Service & schedule">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
                  <BookingFormField id="editService" label="Service" required>
                    <input id="editService" value={booking.service} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, service: value })); }} onBlur={() => onTouch('service')} aria-invalid={invalid('service')} className={control('service')} />
                    {message('service')}
                  </BookingFormField>
                  <BookingFormField id="editStatus" label="Status">
                    <input id="editStatus" readOnly disabled value={normalizeBookingStatus(booking.status)} className={lockedControl} />
                  </BookingFormField>
                  <BookingFormField id="editDate" label="Move date" required={canEditDate}>
                    {canEditDate ? (
                      <div onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onTouch('date'); }}>
                        <DatePicker id="editDate" popover required value={dateValue} onChange={value => onChange(prev => ({ ...prev, date: value, moveDate: value }))} onBlur={() => onTouch('date')} invalid={invalid('date')} className="[&>button]:h-[42px] [&>button]:rounded-lg [&>button]:border-slate-300 [&>button]:px-3 [&>button]:!text-[15px] [&>button]:font-medium [&>button]:text-slate-900 [&>button]:focus-visible:border-[#1a1f6e] [&>button]:focus-visible:ring-2 [&>button]:focus-visible:ring-[#1a1f6e]/20" />
                        {message('date')}
                      </div>
                    ) : (
                      <input id="editDate" readOnly disabled value={dateValue} className={lockedControl} />
                    )}
                  </BookingFormField>
                </div>
              </BookingFormSection>

              <BookingFormSection title="Payment">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
                  <BookingFormField id="editAmount" label="Booking amount">
                    <input id="editAmount" readOnly disabled value={formatBookingAmount(booking.amount)} className={lockedControl} />
                  </BookingFormField>
                  <BookingFormField id="editDownpayment" label="Downpayment">
                    <div className={`flex h-[42px] overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-[#1a1f6e]/20 ${invalid('downpayment') ? 'border-red-400 focus-within:!ring-red-400/20' : 'border-slate-300 focus-within:border-[#1a1f6e]'}`}>
                      <span className="flex shrink-0 items-center border-r border-slate-300 bg-slate-50 px-3 text-sm text-slate-700">₱</span>
                      <input id="editDownpayment" inputMode="decimal" value={booking.downpayment ?? ''} onChange={e => { const value = pesoInput(e.target.value); onChange(prev => ({ ...prev, downpayment: value })); }} onBlur={() => onTouch('downpayment')} aria-invalid={invalid('downpayment')} placeholder="0.00" className={`h-full min-w-0 flex-1 bg-transparent px-3 text-slate-900 outline-none placeholder:text-slate-400 ${valueText}`} />
                    </div>
                    {message('downpayment')}
                  </BookingFormField>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#eef0fa] px-3 py-2.5 text-[#1a1f6e]" aria-live="polite">
                  <span className="text-sm font-medium">Remaining balance</span>
                  <span className="text-base font-semibold tabular-nums">{formatBookingAmount(remainingBalance(booking.amount, downpaymentError(booking) ? 0 : booking.downpayment))}</span>
                </div>
              </BookingFormSection>

              <BookingFormSection title="Pickup & delivery">
                <div className="grid grid-cols-1 gap-x-3.5 gap-y-3 sm:grid-cols-2">
                  <BookingFormField id="editPickup" label="Pick-up address" required>
                    <input id="editPickup" value={booking.pickupAddress || ''} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, pickupAddress: value })); }} onBlur={() => onTouch('pickup')} aria-invalid={invalid('pickup')} placeholder="Street / building" className={control('pickup')} />
                    {message('pickup')}
                  </BookingFormField>
                  <BookingFormField id="editDelivery" label="Delivery address" required>
                    <input id="editDelivery" value={booking.deliveryAddress || booking.address || ''} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, deliveryAddress: value, address: value })); }} onBlur={() => onTouch('delivery')} aria-invalid={invalid('delivery')} placeholder="Street / building" className={control('delivery')} />
                    {message('delivery')}
                  </BookingFormField>
                </div>
              </BookingFormSection>

              <BookingFormSection title="Items">
                <div className="space-y-3">
                  <BookingFormField id="editItems" label="Item details" required>
                    <textarea id="editItems" value={booking.itemDetails || ''} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, itemDetails: value })); }} onBlur={() => onTouch('items')} aria-invalid={invalid('items')} placeholder="Sofa, ref, boxes..." rows={4} className={`${stepThreeTextarea} ${valueText} h-28 ${invalid('items') ? stepTwoInvalid : ''}`} />
                    {message('items')}
                  </BookingFormField>
                  <BookingFormField id="editInstructions" label="Special instructions">
                    <textarea id="editInstructions" value={booking.specialInstructions || ''} onChange={e => { const value = e.target.value; onChange(prev => ({ ...prev, specialInstructions: value })); }} placeholder="Access codes, fragile notes, parking info..." rows={4} className={`${stepThreeTextarea} ${valueText} h-28`} />
                  </BookingFormField>
                </div>
              </BookingFormSection>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
              <button type="button" disabled={saving} onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={!submitReady} className={`inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg px-5 text-sm font-medium transition-colors ${submitReady ? 'bg-[#030848] text-white hover:bg-[#141a6b]' : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'}`}>
                {saving ? 'Updating...' : 'Update booking'}
              </button>
            </footer>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
