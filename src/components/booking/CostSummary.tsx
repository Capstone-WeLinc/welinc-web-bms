import TotalRow from '../shared/TotalRow';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { Booking } from '../../lib/types';
import { COD_FEE_LABEL, cashChargeLabel } from '../services/detailLists';

export type CostLine = { label: string; value: string; muted?: boolean };

export const PROTECTIVE_MATERIALS = [
  { name: '20x20x20 Box', price: 130 },
  { name: 'Bubble Wrap', price: 1000 },
  { name: 'Cling Wrap', price: 400 },
  { name: 'Half Bubble Wrap', price: 500 },
  { name: 'Packaging Tape', price: 50 },
];
export const INSURANCE_PRICE = 1500;
/** Added once to a booking paid by cash on delivery. Additional services may add their own cash charge on top (spec bms/0013). */
export const COD_SURCHARGE = 300;

export const formatCost = (amount: number) => `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export function parseAmount(value: string | number | null | undefined) {
  const text = String(value ?? '').replace(/[^0-9.-]/g, '');
  const amount = text ? Number(text) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

/** Itemizes a booking by what was availed. The stored total stays authoritative, so any gap from the listed items gets its own line. */
export function buildCostLines(booking: Booking, total: number, materials: Array<{ name: string; price: number }>) {
  const truck = booking.selectedTruck;
  const items: Array<{ label: string; amount: number | null; prefix?: string }> = [
    ...(truck?.name ? [{ label: truck.name, amount: parseAmount(truck.rate) }] : []),
    ...(booking.additionalServicesAvailed ?? []).map(service => ({ label: service.name, amount: parseAmount(service.price) })),
    // A material repeated in the list means more than one unit (Wix imports store quantity this way).
    ...Object.entries((booking.protectiveMaterials ?? []).reduce<Record<string, number>>((counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }), {}))
      .map(([name, count]) => {
        const price = materials.find(material => material.name.toLowerCase() === name.toLowerCase())?.price;
        return { label: count > 1 ? `${name} ×${count}` : name, amount: price === undefined ? null : price * count };
      }),
    ...(booking.hasInsurance ? [{ label: 'Goods in Transit Insurance', amount: INSURANCE_PRICE }] : []),
    // Saved with the booking when it was paid in cash (spec bms/0013); older bookings have none.
    ...(booking.additionalServicesAvailed ?? []).filter(service => (service.cashCharge ?? 0) > 0)
      .map(service => ({ label: cashChargeLabel(service.name), amount: service.cashCharge as number, prefix: '+' })),
    ...((booking.paymentMethod || booking.requestedPaymentMethod) === 'COD' ? [{ label: COD_FEE_LABEL, amount: COD_SURCHARGE, prefix: '+' }] : []),
  ];
  const lines: CostLine[] = items.map(({ label, amount, prefix = '' }) => amount === null
    ? { label, value: 'Not listed', muted: true }
    : { label, value: `${prefix}${formatCost(amount)}` });
  const listed = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const difference = Math.round((total - listed) * 100) / 100;
  if (difference > 0) lines.push({ label: 'Other charges', value: `+${formatCost(difference)}` });
  if (difference < 0) lines.push({ label: 'Adjustment', value: `-${formatCost(-difference)}` });
  return lines;
}

/** Bookings store material names only, so prices come from the catalog. Falls back to the defaults when it can't be read. */
export async function loadMaterialPrices() {
  try {
    const { data } = await api.get<Array<{ name: string; price: number }>>('/bms/config/protective-materials');
    return data?.length ? data.map(item => ({ name: item.name, price: Number(item.price) })) : PROTECTIVE_MATERIALS;
  } catch {
    return PROTECTIVE_MATERIALS;
  }
}

// Shared by the new booking wizard, the booking details modal, and the job order modal so their tallies stay identical.
export function CostSummary({ lines, total }: { lines: CostLine[]; total: string }) {
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="flex justify-between gap-4 text-[14.5px] text-slate-700">
          <span className="min-w-0 break-words">{line.label}</span>
          <span className={`shrink-0 text-right tabular-nums ${line.muted ? 'text-slate-400' : ''}`}>{line.value}</span>
        </div>
      ))}
      <TotalRow value={total} />
    </div>
  );
}

/** Cost summary for a saved booking. Pass `total` when the caller has its own authoritative amount. */
export function BookingCostSummary({ booking, total }: { booking: Booking; total?: number }) {
  const [materials, setMaterials] = useState(PROTECTIVE_MATERIALS);
  const hasMaterials = !!booking.protectiveMaterials?.length;

  useEffect(() => {
    if (!hasMaterials) return;
    let cancelled = false;
    void loadMaterialPrices().then(prices => { if (!cancelled) setMaterials(prices); });
    return () => { cancelled = true; };
  }, [hasMaterials]);

  const amount = total ?? parseAmount(booking.totalAmount || booking.amount) ?? 0;
  return <CostSummary lines={buildCostLines(booking, amount, materials)} total={formatCost(amount)} />;
}
