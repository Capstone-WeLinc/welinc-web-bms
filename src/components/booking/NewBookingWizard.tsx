import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '../../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import {
  ChevronRight, ChevronLeft, Check, Package, Truck,
  MapPin, Calendar, Clock, User, Phone, Mail,
  CreditCard, Smartphone, ShieldCheck, AlertCircle, X,
  Building2, Home, ArrowLeftRight, ChevronDown,
} from 'lucide-react';
import type { Booking } from '../../lib/types';
import { DELIVERY_CATEGORY_DEFS, AREAS, getPickupArea, getDeliveryArea } from '../../lib/location-data';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = i % 12 || 12;
  return `${h}:00 ${i < 12 ? 'AM' : 'PM'}`;
});

const SERVICES = [
  { id: 'Lipat Bahay', label: 'Lipat Bahay', sub: 'Residential moving service', icon: <Home size={22} /> },
  { id: 'Office Pull Out', label: 'Office Pull Out', sub: 'Commercial and office relocation', icon: <Building2 size={22} /> },
  { id: 'Corporate Delivery', label: 'Corporate Delivery', sub: 'Business logistics delivery', icon: <Package size={22} /> },
  { id: 'Unit to Unit Transfer', label: 'Unit to Unit Transfer', sub: 'Move between unit or condo floors', icon: <ArrowLeftRight size={22} /> },
];

const TRUCK_TYPES = [
  { id: '6W 14ft. with Lifter', label: '6W 14ft. with Lifter', sub: 'Heavy loads, lifter equipped' },
  { id: '10ft. Closed Van', label: '10ft. Closed Van', sub: 'Medium loads, enclosed' },
  { id: '4W L300 FB Van', label: '4W L300 FB Van', sub: 'Small loads, compact van' },
];

interface AdditionalService {
  id: string; name: string; duration: string; price: number;
  description: string; inclusions: string[]; paymentOptions: string[];
  exclusions: string[]; cashSurcharge?: number;
}

const ADDITIONAL_SERVICES: AdditionalService[] = [
  { id: 'basic-packing', name: 'Basic Packing Service', duration: '6hr', price: 3450, description: 'Basic packing assistance for moving preparation.', inclusions: ['2 Manpower', '1 Cling Wrap', '1 Packaging Tape', 'Used Carton'], paymentOptions: ['Cash (with ₱300 charge)', 'GCash', 'Bank Transfer (No Charge)'], exclusions: ['Condo and Subdivision entry and exit fees'], cashSurcharge: 300 },
  { id: 'standard-packing', name: 'Standard Packing Service', duration: '6hr', price: 5950, description: 'Standard-level packing assistance with additional manpower.', inclusions: ['4 Manpower', '1 Cling Wrap', '1 Packaging Tape', 'Used Carton'], paymentOptions: ['Cash (with ₱300 charge)', 'GCash', 'Bank Transfer (No Charge)'], exclusions: ['Condo and Subdivision entry and exit fees'], cashSurcharge: 300 },
  { id: 'premium-packing', name: 'Premium Packing Service', duration: '6hr', price: 7950, description: 'Premium packing service with additional packaging materials.', inclusions: ['4 Manpower', '1 Cling Wrap', '1 Packaging Tape', '10 pcs Box', '1 Roll Bubble Wrap', 'Used Carton'], paymentOptions: ['Cash (with ₱300 charge)', 'GCash', 'Bank Transfer (No Charge)'], exclusions: ['Condo and Subdivision entry and exit fees'], cashSurcharge: 300 },
  { id: 'ocular-ncr', name: 'Ocular / Site Inspection (NCR)', duration: '2hr', price: 300, description: 'On-site inspection service within NCR.', inclusions: ['1 Motorized Personnel'], paymentOptions: ['Cash', 'GCash', 'Credit/Debit Card', 'Bank Transfer'], exclusions: ['Condo and Subdivision entry and exit fees'] },
  { id: 'ocular-or', name: 'Ocular / Site Inspection (Outside NCR)', duration: '2hr', price: 600, description: 'Provincial or outside NCR ocular/site inspection.', inclusions: ['1 Motorized Personnel'], paymentOptions: ['Cash', 'GCash', 'Credit/Debit Card', 'Bank Transfer'], exclusions: ['Condo and Subdivision entry and exit fees'] },
  { id: 'custom-packing', name: 'Custom Packing Service', duration: '6hr', price: 2720, description: 'Customizable packing service with limited packaging materials.', inclusions: ['1 Manpower', '1 Cling Wrap', '1 Packaging Tape', '1 Bubble Wrap', '6 Boxes'], paymentOptions: ['Cash (with ₱300 charge)', 'GCash', 'Bank Transfer (No Charge)'], exclusions: ['Condo and Subdivision entry and exit fees'], cashSurcharge: 300 },
  { id: 'motorized-helper', name: 'Motorized Helper', duration: '6hr', price: 990, description: 'Motorized helper assistance for small moving tasks.', inclusions: ['1 Motorized Manpower', 'Fuel'], paymentOptions: ['Cash upon delivery', 'GCash', 'Bank Transfer'], exclusions: ['Condo and Subdivision entry and exit fees'] },
  { id: 'motorized-helper-premium', name: 'Motorized Helper Premium', duration: '6hr', price: 1490, description: 'Premium motorized helper assistance.', inclusions: ['1 Motorized Manpower', 'Fuel'], paymentOptions: ['Cash upon delivery', 'GCash', 'Bank Transfer'], exclusions: ['Condo and Subdivision entry and exit fees'] },
];

// ─── Draft ────────────────────────────────────────────────────────────────────
interface Draft {
  serviceType: string; truckType: string;
  firstName: string; lastName: string; email: string; contact: string;
  categoryCode: string;
  pickupCity: string; pickupBarangay: string; pickupAddress: string;
  pickupFloor: string; pickupRoom: string; pickupZip: string; pickupExact: string;
  deliveryCity: string; deliveryBarangay: string; deliveryAddress: string;
  deliveryFloor: string; deliveryRoom: string; deliveryZip: string; deliveryExact: string;
  pickupDate: string; pickupTime: string;
  estimatedItems: string; itemDetails: string; specialInstructions: string;
  fragileItems: boolean; heavyItems: boolean; applianceHandling: boolean;
  packingAssistance: boolean; storageService: boolean; additionalLabor: boolean;
  selectedAdditionalServices: string[];
  hasInsurance: boolean;
  paymentMethod: string; agreeToTerms: boolean;
}

const EMPTY: Draft = {
  serviceType: '', truckType: '',
  firstName: '', lastName: '', email: '', contact: '',
  categoryCode: '',
  pickupCity: '', pickupBarangay: '', pickupAddress: '',
  pickupFloor: '', pickupRoom: '', pickupZip: '', pickupExact: '',
  deliveryCity: '', deliveryBarangay: '', deliveryAddress: '',
  deliveryFloor: '', deliveryRoom: '', deliveryZip: '', deliveryExact: '',
  pickupDate: '', pickupTime: '',
  estimatedItems: '', itemDetails: '', specialInstructions: '',
  fragileItems: false, heavyItems: false, applianceHandling: false,
  packingAssistance: false, storageService: false, additionalLabor: false,
  selectedAdditionalServices: [],
  hasInsurance: false,
  paymentMethod: '', agreeToTerms: false,
};

const STEP_LABELS = ['Service', 'Details', 'Items', 'Insurance', 'Payment', 'Review'];
const INSURANCE_PRICE = 1500;

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; onConfirm: (b: Booking) => void; }

function buildId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const suffix = Math.floor(100000 + Math.random() * 900000);
  return `WL-${year}${month}${day}-${suffix}`;
}
const fmt = (n: number) => `₱${n.toLocaleString()}`;

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function NewBookingWizard({ open, onClose, onConfirm }: Props) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => { if (open) { setStep(1); setD(EMPTY); setExpanded(null); } }, [open]);

  const isU2U = d.serviceType === 'Unit to Unit Transfer';
  const catDef = DELIVERY_CATEGORY_DEFS.find(c => c.code === d.categoryCode);
  const pArea = catDef ? AREAS[getPickupArea(d.categoryCode)] : null;
  const dArea = catDef ? AREAS[getDeliveryArea(d.categoryCode)] : null;
  const pBrgy = d.pickupCity && pArea ? (pArea.barangaysByCity[d.pickupCity] ?? []) : [];
  const dBrgy = d.deliveryCity && dArea ? (dArea.barangaysByCity[d.deliveryCity] ?? []) : [];

  function set<K extends keyof Draft>(k: K, v: Draft[K]) { setD(p => ({ ...p, [k]: v })); }

  function setCat(code: string) {
    setD(p => ({ ...p, categoryCode: code, pickupCity: '', pickupBarangay: '', deliveryCity: '', deliveryBarangay: '' }));
  }

  function toggleSvc(id: string) {
    setD(p => ({
      ...p,
      selectedAdditionalServices: p.selectedAdditionalServices.includes(id)
        ? p.selectedAdditionalServices.filter(s => s !== id)
        : [...p.selectedAdditionalServices, id],
    }));
  }

  // Validation
  const canNext: Record<number, boolean> = {
    1: !!d.serviceType && (isU2U || !!d.truckType),
    2: !!d.firstName && !!d.lastName && !!d.contact && !!d.categoryCode &&
      !!d.pickupCity && !!d.pickupBarangay && !!d.deliveryCity && !!d.deliveryBarangay &&
      !!d.pickupDate && !!d.pickupTime,
    3: true, 4: true,
    5: !!d.paymentMethod && d.agreeToTerms,
    6: false,
  };

  const selectedSvcs = ADDITIONAL_SERVICES.filter(s => d.selectedAdditionalServices.includes(s.id));
  const svcTotal = selectedSvcs.reduce((s, sv) => s + sv.price, 0);
  const insTotal = d.hasInsurance ? INSURANCE_PRICE : 0;
  const cashSurcharge = d.paymentMethod === 'Cash' ? selectedSvcs.reduce((s, sv) => s + (sv.cashSurcharge ?? 0), 0) : 0;
  const grandTotal = svcTotal + insTotal + cashSurcharge;

  function confirm() {
    const specials = [
      d.fragileItems && 'Fragile Items', d.heavyItems && 'Heavy Items',
      d.applianceHandling && 'Appliance Handling', d.packingAssistance && 'Packing Assistance',
      d.storageService && 'Storage Service', d.additionalLabor && 'Additional Labor',
    ].filter(Boolean) as string[];
    const pFull = [d.pickupExact || d.pickupAddress, d.pickupFloor && `Floor ${d.pickupFloor}`, d.pickupRoom && `Room ${d.pickupRoom}`, d.pickupBarangay, d.pickupCity, d.pickupZip].filter(Boolean).join(', ');
    const dFull = [d.deliveryExact || d.deliveryAddress, d.deliveryFloor && `Floor ${d.deliveryFloor}`, d.deliveryRoom && `Room ${d.deliveryRoom}`, d.deliveryBarangay, d.deliveryCity, d.deliveryZip].filter(Boolean).join(', ');
    const amountValue = grandTotal > 0 ? grandTotal : 0;
    onConfirm({
      id: buildId(), client: `${d.firstName} ${d.lastName}`, fullName: `${d.firstName} ${d.lastName}`,
      contact: d.contact, email: d.email, address: dFull,
      service: d.serviceType, serviceType: d.serviceType, deliveryCategory: d.categoryCode,
      date: d.pickupDate, moveDate: d.pickupDate, preferredTime: d.pickupTime,
      status: 'For Plotting', amount: amountValue.toFixed(2),
      totalAmount: grandTotal > 0 ? fmt(grandTotal) : '₱0',
      pickupAddress: pFull, deliveryAddress: dFull, deliveryLocation: d.deliveryCity,
      estimatedItems: parseInt(d.estimatedItems) || 0, itemDetails: d.itemDetails,
      servicesAvailed: specials,
      additionalServicesAvailed: selectedSvcs.map(sv => ({ name: sv.name, price: fmt(sv.price) })),
      hasInsurance: d.hasInsurance, paymentMethod: d.paymentMethod,
      notes: d.specialInstructions, specialInstructions: d.specialInstructions, paymentStatus: 'Pending',
    });
    onClose();
  }

  const nextLabel: Record<number, string> = { 1: 'Continue', 2: 'Continue', 3: 'Continue', 4: 'Continue', 5: 'Review Details', 6: 'Confirm Booking' };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent hideCloseButton className="w-[50vw] max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border-0 bg-white dark:bg-gray-950 shadow-2xl flex flex-col p-0 gap-0">

        {/* ─ Header ─ */}
        <div className="flex-shrink-0 bg-[#1a1f6e] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e8b800] flex items-center justify-center flex-shrink-0">
              <Package size={20} className="text-[#1a1f6e]" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">New Booking</h2>
              <p className="text-white/60 text-sm leading-tight">Step {step} — {STEP_LABELS[step - 1]}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm font-semibold">{step} / 6</span>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ─ Step bar ─ */}
        <div className="flex-shrink-0 flex border-b border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center py-3 text-center border-b-2 transition-colors gap-1 ${i + 1 === step ? 'border-[#1a1f6e] bg-white dark:bg-gray-800' : i + 1 < step ? 'border-emerald-400' : 'border-transparent'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm transition-all ${i + 1 === step ? 'bg-[#1a1f6e] text-white' : i + 1 < step ? 'bg-emerald-400 text-white' : 'bg-slate-200 dark:bg-gray-700 text-slate-500'}`}>
                {i + 1 < step ? <Check size={13} strokeWidth={3} /> : <span>{i + 1}</span>}
              </div>
              <span className={`text-xs font-semibold leading-tight ${i + 1 === step ? 'text-[#1a1f6e] dark:text-indigo-400' : i + 1 < step ? 'text-emerald-500' : 'text-slate-400'}`}>{label}</span>
            </div>
          ))}
        </div>

        {/* ─ Body ─ */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-gray-950">
          {step === 1 && <S1 d={d} set={set} isU2U={isU2U} />}
          {step === 2 && <S2 d={d} set={set} pArea={pArea} dArea={dArea} pBrgy={pBrgy} dBrgy={dBrgy} setCat={setCat} isU2U={isU2U} />}
          {step === 3 && <S3 d={d} set={set} expanded={expanded} setExpanded={setExpanded} toggleSvc={toggleSvc} selectedSvcs={selectedSvcs} svcTotal={svcTotal} />}
          {step === 4 && <S4 d={d} set={set} />}
          {step === 5 && <S5 d={d} set={set} policyOpen={policyOpen} setPolicyOpen={setPolicyOpen} grandTotal={grandTotal} svcTotal={svcTotal} insTotal={insTotal} cashSurcharge={cashSurcharge} selectedSvcs={selectedSvcs} />}
          {step === 6 && <S6 d={d} catDef={catDef} selectedSvcs={selectedSvcs} grandTotal={grandTotal} isU2U={isU2U} />}
        </div>

        {/* ─ Footer ─ */}
        <div className="flex-shrink-0 border-t border-slate-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between bg-white dark:bg-gray-900">
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1.5 px-5 py-2.5 text-base text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer font-semibold">
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button onClick={onClose} className="px-5 py-2.5 text-base text-slate-600 dark:text-gray-300 bg-slate-100 dark:bg-gray-800 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer font-semibold">
              Cancel
            </button>
          )}
          {step < 6 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext[step]}
              className="flex items-center gap-1.5 px-6 py-2.5 text-base bg-[#1a1f6e] text-white rounded-xl hover:bg-[#151b4f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer font-semibold">
              {nextLabel[step]} <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={confirm}
              className="flex items-center gap-1.5 px-6 py-2.5 text-base bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer font-semibold">
              <Check size={16} /> Confirm Booking
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 1 — SERVICE
// ═══════════════════════════════════════════════════════════════════════
function S1({ d, set, isU2U }: { d: Draft; set: Fn; isU2U: boolean }) {
  return (
    <div className="p-5 space-y-5">
      <Sec icon={<Package size={15} />} title="What service do you need?">
        <div className="max-h-[320px] overflow-y-auto pr-1 pb-1">
          <div className="grid grid-cols-2 gap-3">
          {SERVICES.map(sv => {
            const sel = d.serviceType === sv.id;
            return (
              <button key={sv.id} onClick={() => set('serviceType', sv.id)}
                className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all cursor-pointer
                  ${sel ? 'border-[#1a1f6e] bg-[#1a1f6e] text-white shadow-md' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-[#1a1f6e]/40'}`}>
                <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${sel ? 'bg-white/20' : 'bg-slate-100 dark:bg-gray-800 text-[#1a1f6e] dark:text-indigo-400'}`}>
                  {sv.icon}
                </div>
                <p className={`text-sm font-bold leading-tight ${sel ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{sv.label}</p>
                <p className={`text-xs mt-1 leading-tight ${sel ? 'text-white/70' : 'text-slate-500 dark:text-gray-400'}`}>{sv.sub}</p>
                {sel && <div className="mt-2 self-end"><Check size={14} className="text-[#e8b800]" /></div>}
              </button>
            );
          })}
          </div>
        </div>
      </Sec>

      {!isU2U && d.serviceType && (
        <Sec icon={<Truck size={15} />} title="Select Truck Type">
          <div className="max-h-[240px] overflow-y-auto pr-1 space-y-2">
            {TRUCK_TYPES.map(tt => {
              const sel = d.truckType === tt.id;
              return (
                <button key={tt.id} onClick={() => set('truckType', tt.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer
                    ${sel ? 'border-[#1a1f6e] bg-[#1a1f6e]/5 dark:bg-[#1a1f6e]/20' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-slate-300'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#1a1f6e] text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-500'}`}>
                    <Truck size={16} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${sel ? 'text-[#1a1f6e] dark:text-indigo-400' : 'text-slate-800 dark:text-white'}`}>{tt.label}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{tt.sub}</p>
                  </div>
                  {sel && <Check size={15} className="text-[#1a1f6e] dark:text-indigo-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </Sec>
      )}

      {isU2U && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
          <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
          Unit to Unit Transfer does not require a truck or vehicle selection. Floor and Room Number fields will be available in Step 2.
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 2 — PERSONAL INFO + ADDRESS
// ═══════════════════════════════════════════════════════════════════════
function S2({ d, set, pArea, dArea, pBrgy, dBrgy, setCat, isU2U }: {
  d: Draft; set: Fn;
  pArea: typeof AREAS['NCR'] | null; dArea: typeof AREAS['NCR'] | null;
  pBrgy: string[]; dBrgy: string[];
  setCat: (code: string) => void; isU2U: boolean;
}) {
  return (
    <div className="p-5 space-y-5">

      {/* Personal Info */}
      <Sec icon={<User size={15} />} title="Personal Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fld label="First Name *"><input value={d.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First name" className={inp} /></Fld>
          <Fld label="Last Name *"><input value={d.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last name" className={inp} /></Fld>
          <Fld label="Email Address">
            <div className="relative"><Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={d.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" type="email" className={inp + ' pl-8'} /></div>
          </Fld>
          <Fld label="Contact Number *">
            <div className="relative"><Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={d.contact} onChange={e => set('contact', e.target.value)} placeholder="+63 9XX XXX XXXX" className={inp + ' pl-8'} /></div>
          </Fld>
        </div>
      </Sec>

      {/* Delivery Location */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="bg-red-600 px-5 py-3 text-center">
          <h3 className="text-white font-black text-base tracking-widest uppercase">Select Your Delivery Location</h3>
        </div>
        <div className="p-4">
          <div className="max-h-[220px] overflow-y-auto pr-1">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {DELIVERY_CATEGORY_DEFS.map(cat => {
                const sel = d.categoryCode === cat.code;
                return (
                  <button key={cat.code} onClick={() => setCat(cat.code)}
                    className={`flex flex-col items-center justify-center py-3 px-1.5 rounded-xl border-2 transition-all cursor-pointer
                      ${sel ? 'bg-[#e8b800] border-[#e8b800] text-[#1a1f6e] shadow-md' : 'bg-[#1a1f6e] border-[#1a1f6e] text-white hover:bg-[#232a8a]'}`}>
                    <span className="text-sm font-black uppercase leading-tight">{cat.code}</span>
                    <span className={`text-[9px] leading-tight text-center mt-0.5 ${sel ? 'text-[#1a1f6e]/70' : 'text-white/60'}`}>
                      {cat.label.replace('NCR to ', '').replace('North to ', 'N→').replace('South to ', 'S→')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {d.categoryCode && (
            <div className="mt-4 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <Truck size={12} className="flex-shrink-0" />
              <span><strong>{d.categoryCode}</strong> — {DELIVERY_CATEGORY_DEFS.find(c => c.code === d.categoryCode)?.label}. Pickup: <strong>{getPickupArea(d.categoryCode)}</strong> · Delivery: <strong>{getDeliveryArea(d.categoryCode)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Pickup Address */}
      <Sec icon={<MapPin size={15} />} title="Pickup Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fld label="City / Municipality *">
            <SI value={d.pickupCity} onChange={v => { set('pickupCity', v); set('pickupBarangay', ''); }}
              options={pArea?.cities ?? []} placeholder={d.categoryCode ? 'Select city' : 'Select location first'} disabled={!d.categoryCode} />
          </Fld>
          <Fld label="Barangay *">
            <SI value={d.pickupBarangay} onChange={v => set('pickupBarangay', v)}
              options={pBrgy} placeholder={d.pickupCity ? 'Select barangay' : 'Select city first'} disabled={!d.pickupCity} />
          </Fld>
          <Fld label="Address"><input value={d.pickupAddress} onChange={e => set('pickupAddress', e.target.value)} placeholder="Street / building" className={inp} /></Fld>
          <Fld label="ZIP / Postal Code"><input value={d.pickupZip} onChange={e => set('pickupZip', e.target.value)} placeholder="e.g. 1600" className={inp} /></Fld>
          {isU2U && <>
            <Fld label="Floor Number"><input value={d.pickupFloor} onChange={e => set('pickupFloor', e.target.value)} placeholder="e.g. 3" className={inp} /></Fld>
            <Fld label="Room / Unit Number"><input value={d.pickupRoom} onChange={e => set('pickupRoom', e.target.value)} placeholder="e.g. 3B" className={inp} /></Fld>
          </>}
          <div className="sm:col-span-2">
            <Fld label="Pickup Exact Address"><input value={d.pickupExact} onChange={e => set('pickupExact', e.target.value)} placeholder="Complete pickup address for the crew" className={inp} /></Fld>
          </div>
        </div>
      </Sec>

      {/* Delivery Address */}
      <Sec icon={<MapPin size={15} className="text-emerald-500" />} title="Delivery Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fld label="City / Municipality *">
            <SI value={d.deliveryCity} onChange={v => { set('deliveryCity', v); set('deliveryBarangay', ''); }}
              options={dArea?.cities ?? []} placeholder={d.categoryCode ? 'Select city' : 'Select location first'} disabled={!d.categoryCode} />
          </Fld>
          <Fld label="Barangay *">
            <SI value={d.deliveryBarangay} onChange={v => set('deliveryBarangay', v)}
              options={dBrgy} placeholder={d.deliveryCity ? 'Select barangay' : 'Select city first'} disabled={!d.deliveryCity} />
          </Fld>
          <Fld label="Address"><input value={d.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)} placeholder="Street / building" className={inp} /></Fld>
          <Fld label="ZIP / Postal Code"><input value={d.deliveryZip} onChange={e => set('deliveryZip', e.target.value)} placeholder="e.g. 4117" className={inp} /></Fld>
          {isU2U && <>
            <Fld label="Floor Number"><input value={d.deliveryFloor} onChange={e => set('deliveryFloor', e.target.value)} placeholder="e.g. 5" className={inp} /></Fld>
            <Fld label="Room / Unit Number"><input value={d.deliveryRoom} onChange={e => set('deliveryRoom', e.target.value)} placeholder="e.g. 5A" className={inp} /></Fld>
          </>}
          <div className="sm:col-span-2">
            <Fld label="Drop-off Full Address"><input value={d.deliveryExact} onChange={e => set('deliveryExact', e.target.value)} placeholder="Complete drop-off address for the crew" className={inp} /></Fld>
          </div>
        </div>
      </Sec>

      {/* Schedule */}
      <Sec icon={<Calendar size={15} />} title="Pickup Schedule">
        <div className="grid grid-cols-2 gap-3">
          <Fld label="Pickup Date *">
            <div className="relative"><Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input type="date" value={d.pickupDate} onChange={e => set('pickupDate', e.target.value)} min={new Date().toISOString().split('T')[0]} className={inp + ' pl-8'} /></div>
          </Fld>
          <Fld label="Pickup Time *">
            <div className="relative"><Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
              <SI value={d.pickupTime} onChange={v => set('pickupTime', v)} options={TIME_SLOTS} placeholder="Select time" className="pl-8" /></div>
          </Fld>
        </div>
      </Sec>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 3 — ITEMS & ADDITIONAL SERVICES
// ═══════════════════════════════════════════════════════════════════════
function S3({ d, set, expanded, setExpanded, toggleSvc, selectedSvcs, svcTotal }: {
  d: Draft; set: Fn;
  expanded: string | null; setExpanded: (id: string | null) => void;
  toggleSvc: (id: string) => void;
  selectedSvcs: AdditionalService[]; svcTotal: number;
}) {
  const bools = [
    { k: 'fragileItems' as const, label: 'Fragile Items' },
    { k: 'heavyItems' as const, label: 'Heavy Items' },
    { k: 'applianceHandling' as const, label: 'Appliance Handling' },
    { k: 'packingAssistance' as const, label: 'Packing Assistance' },
    { k: 'storageService' as const, label: 'Storage Service' },
    { k: 'additionalLabor' as const, label: 'Additional Labor' },
  ];
  return (
    <div className="p-5 space-y-5">

      {/* Items */}
      <Sec icon={<Package size={15} />} title="Items">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Fld label="Estimated Number of Items">
            <input type="number" min="1" value={d.estimatedItems} onChange={e => set('estimatedItems', e.target.value)} placeholder="e.g. 15" className={inp} />
          </Fld>
          <Fld label="Item Details">
            <textarea value={d.itemDetails} onChange={e => set('itemDetails', e.target.value)} placeholder="Sofa, ref, boxes..." rows={3} className={ta} />
          </Fld>
          <div className="sm:col-span-2">
            <Fld label="Special Instructions">
              <textarea value={d.specialInstructions} onChange={e => set('specialInstructions', e.target.value)} placeholder="Access codes, fragile notes, parking info..." rows={2} className={ta} />
            </Fld>
          </div>
        </div>
      </Sec>

      {/* Special Items */}
      <Sec icon={<ShieldCheck size={15} />} title="Special Items & Additional Services">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {bools.map(item => (
            <label key={item.k} className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${d[item.k] ? 'border-[#1a1f6e] bg-[#1a1f6e]/5 dark:bg-[#1a1f6e]/20' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-slate-300'}`}>
              <input type="checkbox" checked={d[item.k]} onChange={e => set(item.k, e.target.checked)} className="w-4 h-4 accent-[#1a1f6e] flex-shrink-0" />
              <span className={`text-xs font-medium ${d[item.k] ? 'text-[#1a1f6e] dark:text-indigo-400' : 'text-slate-700 dark:text-gray-200'}`}>{item.label}</span>
            </label>
          ))}
        </div>
      </Sec>

      {/* Additional Services Cards */}
      <Sec icon={<CreditCard size={15} />} title="Additional Services">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ADDITIONAL_SERVICES.map(svc => {
            const sel = d.selectedAdditionalServices.includes(svc.id);
            const exp = expanded === svc.id;
            return (
              <div key={svc.id} className={`border-2 rounded-xl overflow-hidden transition-all ${sel ? 'border-[#1a1f6e] shadow-sm' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
                <div className="p-3 cursor-pointer" onClick={() => toggleSvc(svc.id)}>
                  <div className="flex items-start gap-2.5">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${sel ? 'bg-[#1a1f6e] border-[#1a1f6e]' : 'border-slate-300 dark:border-gray-600'}`}>
                      {sel && <Check size={10} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 flex-wrap">
                        <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{svc.name}</p>
                        <p className="text-xs font-black text-[#1a1f6e] dark:text-indigo-400 whitespace-nowrap">{fmt(svc.price)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] bg-slate-100 dark:bg-gray-700 text-slate-500 px-1.5 py-0.5 rounded-full flex items-center gap-1"><Clock size={8} />{svc.duration}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-tight">{svc.description}</p>
                    </div>
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); setExpanded(exp ? null : svc.id); }}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-gray-800 border-t border-slate-100 dark:border-gray-700 text-[10px] text-slate-500 hover:bg-slate-100 cursor-pointer">
                  <span>{exp ? 'Hide details' : 'View details'}</span>
                  <ChevronDown size={11} className={`transition-transform ${exp ? 'rotate-180' : ''}`} />
                </button>
                {exp && (
                  <div className="px-3 pb-3 bg-white dark:bg-gray-900 space-y-2 text-[11px]">
                    <div className="pt-2">
                      <p className="font-semibold text-slate-600 dark:text-gray-300 mb-1">Inclusions</p>
                      <ul className="space-y-0.5">{svc.inclusions.map(i => <li key={i} className="flex items-center gap-1.5 text-slate-500"><Check size={9} className="text-emerald-500" />{i}</li>)}</ul>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-600 dark:text-gray-300 mb-1">Payment Options</p>
                      <ul className="space-y-0.5">{svc.paymentOptions.map(p => <li key={p} className="text-slate-500">• {p}</li>)}</ul>
                    </div>
                    <div>
                      <p className="font-semibold text-red-500 mb-1">Exclusions</p>
                      <ul className="space-y-0.5">{svc.exclusions.map(ex => <li key={ex} className="text-slate-500">• {ex}</li>)}</ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {selectedSvcs.length > 0 && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 space-y-1">
            {selectedSvcs.map(sv => (
              <div key={sv.id} className="flex justify-between text-xs text-slate-700 dark:text-gray-200">
                <span>{sv.name}</span><span className="font-semibold">{fmt(sv.price)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 dark:border-gray-600 pt-1 flex justify-between text-xs font-bold">
              <span>Subtotal</span><span className="text-[#1a1f6e] dark:text-indigo-400">{fmt(svcTotal)}</span>
            </div>
          </div>
        )}
      </Sec>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 4 — INSURANCE
// ═══════════════════════════════════════════════════════════════════════
function S4({ d, set }: { d: Draft; set: Fn }) {
  return (
    <div className="p-5">
      <Sec icon={<ShieldCheck size={15} className="text-emerald-500" />} title="Goods in Transit Insurance">
        <div className={`border-2 rounded-xl transition-all cursor-pointer ${d.hasInsurance ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-slate-300'}`}
          onClick={() => set('hasInsurance', !d.hasInsurance)}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">Goods in Transit Insurance</p>
                  <span className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-500 px-2 py-0.5 rounded-full">6 hr</span>
                </div>
                <p className="text-lg font-black text-emerald-600 mt-1">{fmt(INSURANCE_PRICE)} <span className="text-xs font-normal text-slate-400">- Customer's Place</span></p>
              </div>
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border-2 mt-0.5 ${d.hasInsurance ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-gray-600'}`}>
                {d.hasInsurance && <Check size={13} className="text-white" />}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-700 space-y-3 text-xs text-slate-600 dark:text-gray-300">
              <p className="text-amber-700 dark:text-amber-400 font-medium flex items-start gap-1.5">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                Please note that if insurance is not taken up, our maximum liability is up to the refund of the price of the move or the price of second hand equivalent of the item whichever is smaller.
              </p>
              <p className="font-bold text-slate-700 dark:text-gray-200">Terms and Conditions (T&C) for Inland Transit Insurance for Household Goods/General Cargo/Musical Instruments.</p>
              <ol className="space-y-2 list-decimal list-inside leading-relaxed">
                <li>It is deemed necessary that you should take adequate insurance for your household goods/general cargo. WeLinc offers an optional goods in transit insurance of ₱1,500 for a maximum coverage of up to ₱30,000.</li>
                <li>Insurance endorsement do not cover claims for musical instruments and antique items. Please apply the necessary protection on these items and give very specific instructions to the driver.</li>
                <li>No insurance coverage for Works of Arts, Paintings, Antiques, Vases, Ornaments, Money, Jewelries, Laptops, Liquor, Cutleries, Mirrors, Personal Effects (e.g. shoes, bags, clothing) and Pairs &amp; Sets Clause, etc.</li>
                <li>Insurance does not cover derangement of electrical, electronic and mechanical equipment; rust, oxidation, discoloration, scratching, bending, denting, chipping, pre-existing defects and damages howsoever caused.</li>
                <li>Insurance is based on second-hand replacement clause. WeLinc will refund the price of the item based on prevailing 2nd hand price in the market or up to a maximum of ₱30,000 whichever is smaller.</li>
                <li>Insurance Trip refundable in case of damages. See terms and conditions below. All claims and refunds are subject to investigation.</li>
              </ol>
            </div>
          </div>
        </div>
      </Sec>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 5 — PAYMENT
// ═══════════════════════════════════════════════════════════════════════
function S5({ d, set, policyOpen, setPolicyOpen, grandTotal, svcTotal, insTotal, cashSurcharge, selectedSvcs }: {
  d: Draft; set: Fn; policyOpen: boolean; setPolicyOpen: (v: boolean) => void;
  grandTotal: number; svcTotal: number; insTotal: number; cashSurcharge: number;
  selectedSvcs: AdditionalService[];
}) {
  return (
    <div className="p-5 space-y-5">

      {/* Price summary */}
      {(svcTotal > 0 || insTotal > 0) && (
        <Sec icon={<CreditCard size={15} />} title="Cost Summary">
          <div className="space-y-1.5 text-sm">
            {selectedSvcs.map(sv => <div key={sv.id} className="flex justify-between text-slate-600 dark:text-gray-300"><span>{sv.name}</span><span>{fmt(sv.price)}</span></div>)}
            {insTotal > 0 && <div className="flex justify-between text-slate-600 dark:text-gray-300"><span>Goods in Transit Insurance</span><span>{fmt(insTotal)}</span></div>}
            {cashSurcharge > 0 && <div className="flex justify-between text-amber-600"><span>Cash Surcharge</span><span>+{fmt(cashSurcharge)}</span></div>}
            <div className="border-t border-slate-200 dark:border-gray-700 pt-2 flex justify-between font-bold text-base">
              <span>Total</span><span className="text-[#1a1f6e] dark:text-indigo-400">{fmt(grandTotal)}</span>
            </div>
          </div>
        </Sec>
      )}

      {/* Payment Method */}
      <Sec icon={<Smartphone size={15} />} title="Payment Method *">
        <div className="grid grid-cols-3 gap-3">
          {([
            { id: 'GCash', label: 'GCash', icon: <Smartphone size={20} />, sub: 'Digital wallet' },
            { id: 'Credit Card', label: 'Credit Card', icon: <CreditCard size={20} />, sub: 'Visa / Mastercard' },
            { id: 'COD', label: 'Cash on Delivery', icon: <Truck size={20} />, sub: 'Pay on pickup' },
          ]).map(pm => (
            <button key={pm.id} onClick={() => set('paymentMethod', pm.id)}
              className={`flex flex-col items-center gap-2 py-4 px-2 rounded-xl border-2 cursor-pointer transition-all
                ${d.paymentMethod === pm.id ? 'border-[#1a1f6e] bg-[#1a1f6e]/5 dark:bg-[#1a1f6e]/20 shadow-sm' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-slate-300'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.paymentMethod === pm.id ? 'bg-[#1a1f6e] text-white' : 'bg-slate-100 dark:bg-gray-700 text-slate-500'}`}>{pm.icon}</div>
              <div className="text-center">
                <p className={`text-xs font-bold ${d.paymentMethod === pm.id ? 'text-[#1a1f6e] dark:text-indigo-400' : 'text-slate-700 dark:text-gray-200'}`}>{pm.label}</p>
                <p className="text-[10px] text-slate-400">{pm.sub}</p>
              </div>
            </button>
          ))}
        </div>
        {d.paymentMethod === 'COD' && svcTotal > 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertCircle size={11} />{cashSurcharge > 0 ? `A ₱300 cash surcharge applies per selected packing service.` : 'Cash on delivery selected.'}
          </p>
        )}
      </Sec>

      {/* Policy */}
      <Sec icon={<ShieldCheck size={15} className="text-amber-500" />} title="Policy & Terms">
        <button onClick={() => setPolicyOpen(!policyOpen)}
          className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm font-semibold text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-100 transition-colors">
          <span>Booking Policy & Cancellation Terms</span>
          <ChevronDown size={15} className={`transition-transform ${policyOpen ? 'rotate-180' : ''}`} />
        </button>
        {policyOpen && (
          <div className="mt-3 p-4 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs text-slate-600 dark:text-gray-300 leading-relaxed max-h-56 overflow-y-auto space-y-2">
            <ol className="space-y-2.5 list-decimal list-inside">
              <li>Cancellations/Reschedules made by the hirer within 24-hour of the hire date will result to hirer liable to pay <strong>Three Hundred Pesos (PHP 300)</strong>.</li>
              <li>Cancellations within four (4) hours of the hire date and time will result to the client be liable to pay <strong>Two Thousand Pesos (PHP 2,000)</strong> for pickup location within NCR. For pickup points outside of NCR, within 4 hr cancellation penalty will be <strong>50% of the booking amount</strong>.</li>
              <li>Rescheduling within four (4) hours of the scheduled hire date and time shall incur the following fees:
                <ul className="mt-1 ml-4 space-y-0.5 list-disc"><li><strong>PHP 500</strong> if the team has not yet departed from the dispatch point.</li><li><strong>PHP 1,000</strong> if the team has already departed or arrived at the pickup location.</li></ul>
              </li>
              <li>Any cancellation by WeLinc due to adverse weather, vehicle failure, road accidents or any other factors, the hirer will be offered an alternative date.</li>
              <li>Refunds will be transferred via credit card for credit card payment and via GCash for other payment methods. Clients must provide refund details through Facebook or Viber.</li>
              <li><strong>Damage Reporting Policy:</strong> All damages or concerns must be reported within <strong>forty-eight (48) hours</strong> after delivery. Required reports must include:
                <ul className="mt-1 ml-4 space-y-0.5 list-disc"><li>Clear photos of the damaged item</li><li>Description of the damage</li><li>Client written statement</li></ul>
                Failure to report within the stated period will render the claim invalid.
              </li>
            </ol>
          </div>
        )}

        {/* Agreement */}
        <label className="flex items-start gap-3 mt-3 cursor-pointer p-3 bg-slate-50 dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700">
          <input type="checkbox" checked={d.agreeToTerms} onChange={e => set('agreeToTerms', e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#1a1f6e] flex-shrink-0" />
          <p className="text-xs text-slate-600 dark:text-gray-300 leading-relaxed">
            I have read and agree to WeLinc Logistics' <span className="text-[#1a1f6e] font-semibold">Booking Policy</span> and <span className="text-[#1a1f6e] font-semibold">Terms and Conditions</span>.
          </p>
        </label>
      </Sec>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 6 — REVIEW
// ═══════════════════════════════════════════════════════════════════════
function S6({ d, catDef, selectedSvcs, grandTotal, isU2U }: {
  d: Draft; catDef: typeof DELIVERY_CATEGORY_DEFS[number] | undefined;
  selectedSvcs: AdditionalService[]; grandTotal: number; isU2U: boolean;
}) {
  const specials = [d.fragileItems && 'Fragile Items', d.heavyItems && 'Heavy Items', d.applianceHandling && 'Appliance Handling', d.packingAssistance && 'Packing Assistance', d.storageService && 'Storage Service', d.additionalLabor && 'Additional Labor'].filter(Boolean) as string[];
  return (
    <div className="p-5 space-y-4">
      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        Please review all booking details before confirming. Once confirmed, this booking will be queued for processing.
      </div>

      <RC title="Service"><Rw label="Service Type" value={d.serviceType} />{!isU2U && <Rw label="Truck Type" value={d.truckType} />}</RC>
      <RC title="Customer">
        <Rw label="Name" value={`${d.firstName} ${d.lastName}`} />
        <Rw label="Contact" value={d.contact} />
        <Rw label="Email" value={d.email || '—'} />
      </RC>
      <RC title="Route & Schedule">
        <Rw label="Category" value={catDef ? `${catDef.code} – ${catDef.label}` : '—'} />
        <Rw label="Date & Time" value={`${d.pickupDate}${d.pickupTime ? ` at ${d.pickupTime}` : ''}`} />
      </RC>
      <RC title="Pickup Address">
        <Rw label="City" value={d.pickupCity} />
        <Rw label="Barangay" value={d.pickupBarangay} />
        {d.pickupAddress && <Rw label="Address" value={d.pickupAddress} />}
        {d.pickupZip && <Rw label="ZIP" value={d.pickupZip} />}
        {isU2U && d.pickupFloor && <Rw label="Floor" value={d.pickupFloor} />}
        {isU2U && d.pickupRoom && <Rw label="Room" value={d.pickupRoom} />}
        {d.pickupExact && <Rw label="Exact Address" value={d.pickupExact} />}
      </RC>
      <RC title="Delivery Address">
        <Rw label="City" value={d.deliveryCity} />
        <Rw label="Barangay" value={d.deliveryBarangay} />
        {d.deliveryAddress && <Rw label="Address" value={d.deliveryAddress} />}
        {d.deliveryZip && <Rw label="ZIP" value={d.deliveryZip} />}
        {isU2U && d.deliveryFloor && <Rw label="Floor" value={d.deliveryFloor} />}
        {isU2U && d.deliveryRoom && <Rw label="Room" value={d.deliveryRoom} />}
        {d.deliveryExact && <Rw label="Drop-off Address" value={d.deliveryExact} />}
      </RC>
      {(d.estimatedItems || d.itemDetails) && (
        <RC title="Items">
          {d.estimatedItems && <Rw label="Est. Items" value={`${d.estimatedItems} pcs`} />}
          {d.itemDetails && <Rw label="Details" value={d.itemDetails} />}
          {d.specialInstructions && <Rw label="Instructions" value={d.specialInstructions} />}
        </RC>
      )}
      {specials.length > 0 && (
        <RC title="Special Services"><div className="flex flex-wrap gap-1.5">{specials.map(s => <span key={s} className="px-2 py-0.5 bg-[#1a1f6e]/10 text-[#1a1f6e] dark:text-indigo-300 rounded-lg text-xs">{s}</span>)}</div></RC>
      )}
      {selectedSvcs.length > 0 && (
        <RC title="Additional Services">
          {selectedSvcs.map(sv => <div key={sv.id} className="flex justify-between text-sm"><span className="text-slate-700 dark:text-gray-200">{sv.name}</span><span className="font-semibold">{fmt(sv.price)}</span></div>)}
        </RC>
      )}
      <RC title="Insurance & Payment">
        <Rw label="Insurance" value={d.hasInsurance ? `Yes — ${fmt(INSURANCE_PRICE)}` : 'No'} />
        <Rw label="Payment Method" value={d.paymentMethod} />
        {grandTotal > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-gray-800 flex justify-between font-bold text-sm">
            <span className="text-slate-700 dark:text-gray-200">Total</span>
            <span className="text-[#1a1f6e] dark:text-indigo-400">{fmt(grandTotal)}</span>
          </div>
        )}
      </RC>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════
type Fn = <K extends keyof Draft>(k: K, v: Draft[K]) => void;
const inp = 'w-full px-3 py-2.5 text-base border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1a1f6e]/20 dark:text-white placeholder:text-slate-400 transition-colors';
const ta = inp + ' resize-none';

function Sec({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-gray-800 bg-slate-50/60 dark:bg-gray-800/40">
        <span className="text-[#1a1f6e] dark:text-indigo-400">{icon}</span>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-sm font-semibold text-slate-600 dark:text-gray-300 mb-1.5">{label}</label>{children}</div>;
}

function SI({ value, onChange, options, placeholder, disabled, className }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; disabled?: boolean; className?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={`h-11 text-base ${className ?? ''}`}><SelectValue placeholder={placeholder ?? 'Select...'} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o} className="text-base">{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function RC({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-slate-50 dark:bg-gray-800 border-b border-slate-100 dark:border-gray-800">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function Rw({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-400 dark:text-gray-500 min-w-[130px] flex-shrink-0 text-sm">{label}</span>
      <span className="text-slate-700 dark:text-gray-200 font-medium flex-1 text-sm">{value || '—'}</span>
    </div>
  );
}