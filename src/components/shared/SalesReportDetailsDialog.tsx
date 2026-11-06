import ModalHeader from '../ui/ModalHeader';
import TotalRow from './TotalRow';
import { FileText } from 'lucide-react';
import type { DailySalesEntry } from '../../lib/types';
import { Dialog, DialogContent } from '../ui/Dialog';

const PHP_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function parseAmount(value: string | number | null | undefined) {
  const amount = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

export default function SalesReportDetailsDialog({ entry: viewEntry, onClose }: { entry: DailySalesEntry | null; onClose: () => void }) {
  return (
      <Dialog open={!!viewEntry} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent hideCloseButton aria-describedby={undefined} className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[460px] flex-col overflow-hidden rounded-xl border-0 bg-white p-0 shadow-xl sm:rounded-xl">
          <ModalHeader icon={FileText} title="Monthly report details" closeLabel="Close monthly report details" />
          {viewEntry && (
            <div className="min-h-0 space-y-3 overflow-y-auto bg-[#f1f4fa] p-4">
              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <SectionTitle>Report info</SectionTitle>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                  <SalesReportDetail label="Client" value={viewEntry.clientName} />
                  <SalesReportDetail label="Date" value={viewEntry.date} />
                  <SalesReportDetail label="Booking no." value={viewEntry.bookingNo} />
                  <SalesReportDetail label="Invoice no." value={viewEntry.traceNo} />
                </div>
              </section>
              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <SectionTitle>Delivery details</SectionTitle>
                <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
                  <SalesReportDetail label="Delivery type" value={viewEntry.type} />
                  <SalesReportDetail label="Plate number" value={viewEntry.plateNumber} />
                  <SalesReportDetail label="Assigned team" value={viewEntry.assignedTeam} />
                  <SalesReportDetail label="Garage" value={viewEntry.garage} />
                </div>
              </section>
              <section className="rounded-xl border border-slate-200/70 bg-white p-4">
                <SectionTitle>Payment</SectionTitle>
                <div className="mt-3 space-y-1">
                  {([
                    ['Cash', viewEntry.cashPayment],
                    ['BDO', viewEntry.bdoPayment],
                    ['GCash', viewEntry.gcashPayment],
                    ['Xendit', viewEntry.xenditPayment],
                  ] as const).map(([label, value]) => {
                    const amount = parseAmount(value);
                    const hasAmount = amount > 0;
                    return <div key={label} className={'flex items-center justify-between rounded-lg px-2.5 py-2 text-sm ' + (hasAmount ? 'bg-[#eef0fa] font-medium text-[#1a1f6e]' : 'text-slate-700')}>
                      <span>{label}</span>
                      <span className={hasAmount ? '' : 'text-slate-400'}>{hasAmount ? PHP_FORMATTER.format(amount) : '—'}</span>
                    </div>;
                  })}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 px-2.5">
                  <div className="min-w-0"><p className="text-sm text-slate-600">Date of payment</p><p className="mt-0.5 break-words text-[15px] font-medium text-slate-900">{viewEntry.dateOfPayment || viewEntry.date || '—'}</p></div>
                  <div className="min-w-0"><p className="text-sm text-slate-600">Payment remarks</p><p className={`mt-0.5 break-words text-[15px] ${viewEntry.paymentRemarks ? 'font-medium text-slate-900' : 'text-slate-400'}`}>{viewEntry.paymentRemarks || 'None'}</p></div>
                </div>
                <div className="mt-3 px-2.5"><TotalRow value={PHP_FORMATTER.format(parseAmount(viewEntry.amount || viewEntry.totalDailySales))} /></div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]"><span className="h-4 w-[3px] rounded-full bg-[#e8b800]" aria-hidden="true" />{children}</h3>;
}

function SalesReportDetail({ label, value }: { label: string; value?: string | null }) {
  return <div className="min-w-0"><p className="text-sm text-slate-600">{label}</p><p className="mt-0.5 break-words text-sm font-medium text-slate-900">{value || '—'}</p></div>;
}
