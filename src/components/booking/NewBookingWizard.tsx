import ModalHeader from '../ui/ModalHeader';
import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '../../components/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import {
  ChevronRight, ChevronLeft, Check, Package, Truck,
  MapPin, Calendar, Clock, User, Phone, Mail,
  CreditCard, Smartphone, ShieldCheck, AlertCircle, 
  Building2, Home, ArrowLeftRight, ChevronDown, Briefcase,
} from 'lucide-react';
import type { Booking } from '../../lib/types';
import { DELIVERY_CATEGORY_DEFS, AREAS, getPickupArea, getDeliveryArea } from '../../lib/location-data';
import { getZipCode, getZipCodes } from '../../lib/zip-codes';
import { DatePicker } from '../ui/DatePicker';
import { api } from '../../lib/api';
import { formatPhoneLocal } from '../../lib/phone';
import { ReviewCard as RC, ReviewRow as Rw } from './ReviewCard';
import { BookingFormField as StepTwoField, BookingFormSection as StepTwoSection } from './BookingFormFields';
import { COD_SURCHARGE, CostSummary, INSURANCE_PRICE, PROTECTIVE_MATERIALS, type CostLine } from './CostSummary';
import { ServiceDetailsSections } from '../services/ServiceDetails';
import { COD_FEE_LABEL, cashChargeLabel, detailLists, type ServiceDetailLists } from '../services/detailLists';
import { stepThreeTextarea, stepTwoControl, stepTwoInvalid } from './bookingFormStyles';
import { filterTruckRates, hasPreferredTruckSelection, preferredTruckCharge, truckContextChanged, truckRateView, type PreferredTruckRate } from './truckRates';

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
  { id: '6W 14ft. with Lifter', label: '6W 14ft. with Lifter', sub: 'Heavy loads, lifter equipped', capacity: '3,000 kg' },
  { id: '10ft. Closed Van', label: '10ft. Closed Van', sub: 'Medium loads, enclosed', capacity: '1,500 kg' },
  { id: '4W L300 FB Van', label: '4W L300 FB Van', sub: 'Small loads, compact van', capacity: '1,000 kg' },
];

const ITEM_DETAILS_MAX_LENGTH = 500;
const SPECIAL_INSTRUCTIONS_MAX_LENGTH = 300;

/** An additional service with its View details lists, read from Services Offered (spec bms/0013). */
interface AdditionalService extends ServiceDetailLists {
  id: string; name: string; duration: string; price: number; description: string;
  /** Added when the booking is paid in cash, on top of the cash-on-delivery surcharge. */
  cashCharge: number;
}

// Used only when the Services Offered catalog can't be read; keep in step with its seed.
const ADDITIONAL_SERVICES: AdditionalService[] = [
  { id: 'basic-packing', name: 'Basic Packing Service', duration: '6hr', price: 3450, description: 'Basic packing assistance for moving preparation.', inclusions: ['2 staff members', '1 cling wrap', '1 packaging tape', 'Used cartons', '6 hours of packing service'], paymentOptions: ['Cash (with an additional PHP 500 charge)', 'GCash (no additional charge)', 'Bank transfer (no additional charge)'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 500 },
  { id: 'standard-packing', name: 'Standard Packing Service', duration: '6hr', price: 5950, description: 'Standard-level packing assistance with additional manpower.', inclusions: ['4 staff members', '1 cling wrap', '1 packaging tape', 'Used cartons', '6 hours of packing service'], paymentOptions: ['Cash (with an additional PHP 500 charge)', 'GCash (no additional charge)', 'Bank transfer (no additional charge)'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 500 },
  { id: 'premium-packing', name: 'Premium Packing Service', duration: '6hr', price: 7950, description: 'Premium packing service with additional packaging materials.', inclusions: ['4 staff members', '1 cling wrap', '1 packaging tape', '10 boxes', '1 roll of bubble wrap', 'Used cartons', '6 hours of packing service'], paymentOptions: ['Cash (with an additional PHP 500 charge)', 'GCash (no additional charge)', 'Bank transfer (no additional charge)'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 500 },
  { id: 'ocular-ncr', name: 'Ocular / Site Inspection (NCR)', duration: '2hr', price: 300, description: 'On-site inspection service within NCR.', inclusions: ['1 motorized staff member', '2 hours of ocular/site inspection'], paymentOptions: ['Cash (with an additional PHP 500 charge)', 'GCash (no additional charge)', 'Bank transfer (no additional charge)'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 500 },
  { id: 'ocular-or', name: 'Ocular / Site Inspection (Outside NCR)', duration: '2hr', price: 600, description: 'Provincial or outside NCR ocular/site inspection.', inclusions: ['1 motorized staff member', '2 hours of ocular/site inspection'], paymentOptions: ['Cash', 'GCash', 'Credit/debit card', 'Bank transfer'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 0 },
  { id: 'custom-packing', name: 'Custom Packing Service', duration: '6hr', price: 2720, description: 'Customizable packing service with limited packaging materials.', inclusions: ['1 staff member', '1 cling wrap', '1 packaging tape', '1 bubble wrap', '6 boxes', 'Up to 6 hours of packing service'], paymentOptions: ['Cash (with an additional PHP 500 charge)', 'GCash (no additional charge)', 'Bank transfer (no additional charge)'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 500 },
  { id: 'motorized-helper', name: 'Motorized Helper', duration: '6hr', price: 990, description: 'Motorized helper assistance for small moving tasks.', inclusions: ['1 motorized staff member', 'Fuel', 'Up to 6 hours of service', 'An additional PHP 100 per succeeding hour'], paymentOptions: ['Cash upon delivery', 'GCash', 'Bank transfer'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 0 },
  { id: 'motorized-helper-premium', name: 'Motorized Helper Premium', duration: '6hr', price: 1490, description: 'Premium motorized helper assistance.', inclusions: ['1 motorized staff member', 'Fuel', 'Up to 6 hours of service', 'An additional PHP 100 per succeeding hour'], paymentOptions: ['Cash upon delivery', 'GCash', 'Bank transfer'], exclusions: ['Condominium and subdivision entry and exit fees'], cashCharge: 0 },
];

// ─── Draft ────────────────────────────────────────────────────────────────────
interface Draft {
  serviceType: string; truckType: string; selectedTruck: PreferredTruckRate | null;
  firstName: string; lastName: string; email: string; contact: string;
  categoryCode: string;
  pickupCity: string; pickupBarangay: string; pickupAddress: string;
  pickupFloor: string; pickupRoom: string; pickupZip: string; pickupExact: string; pickupLandmark: string;
  deliveryCity: string; deliveryBarangay: string; deliveryAddress: string;
  deliveryFloor: string; deliveryRoom: string; deliveryZip: string; deliveryExact: string; deliveryLandmark: string;
  pickupDate: string; pickupTime: string;
  estimatedItems: string; itemDetails: string; specialInstructions: string;
  fragileItems: boolean; heavyItems: boolean; applianceHandling: boolean;
  selectedProtectiveMaterials: string[];
  selectedAdditionalServices: string[];
  hasInsurance: boolean;
  permitRequired: boolean;
  paymentMethod: string; agreeToTerms: boolean;
}

const EMPTY: Draft = {
  serviceType: '', truckType: '', selectedTruck: null,
  firstName: '', lastName: '', email: '', contact: '',
  categoryCode: '',
  pickupCity: '', pickupBarangay: '', pickupAddress: '',
  pickupFloor: '', pickupRoom: '', pickupZip: '', pickupExact: '', pickupLandmark: '',
  deliveryCity: '', deliveryBarangay: '', deliveryAddress: '',
  deliveryFloor: '', deliveryRoom: '', deliveryZip: '', deliveryExact: '', deliveryLandmark: '',
  pickupDate: '', pickupTime: '',
  estimatedItems: '', itemDetails: '', specialInstructions: '',
  fragileItems: false, heavyItems: false, applianceHandling: false,
  selectedProtectiveMaterials: [],
  selectedAdditionalServices: [],
  hasInsurance: false,
  permitRequired: false,
  paymentMethod: '', agreeToTerms: false,
};

const STEP_LABELS = ['Service', 'Details', 'Items', 'Insurance', 'Payment', 'Review'];

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

// Validation helpers (module scope)
function isValidContact(contact: string) {
  return /^\+639\d{9}$/.test(contact);
}
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function formatPhilippineNumber(contact: string) {
  const subscriber = contact.replace(/^\+63/, '').replace(/\D/g, '').slice(0, 10);
  return subscriber.replace(/(\d{3})(\d{0,3})(\d{0,4})/, (_, first, second, third) =>
    [first, second, third].filter(Boolean).join(' '),
  );
}
function isValidZip(zip: string) {
  if (!zip) return true; // optional field — validate only if provided
  return /^\d{4}$/.test(zip);
}
function isValidAddress(address: string) {
  if (!address) return true; // optional field — validate only if provided
  return /^[\w\d\s.,#\-/()]+$/.test(address.trim());
}
function isValidItemCount(value: string) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 && count <= 100;
}
function isDateInPast(dateStr: string) {
  if (!dateStr) return false;
  const sel = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sel < today;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function NewBookingWizard({ open, onClose, onConfirm }: Props) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>(EMPTY);
  // Each additional service's details open and close on their own, so several can be read side by side.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [policyOpen, setPolicyOpen] = useState(false);
  const [touched, setTouched] = useState<Set<keyof Draft>>(new Set());
  const [serviceCatalog, setServiceCatalog] = useState<AdditionalService[]>(ADDITIONAL_SERVICES);
  const [materialCatalog, setMaterialCatalog] = useState(PROTECTIVE_MATERIALS);
  const [primaryServiceCatalog, setPrimaryServiceCatalog] = useState(SERVICES);

  useEffect(() => { if (open) { setStep(1); setD(EMPTY); setExpanded(new Set()); setTouched(new Set()); } }, [open]);
  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get<Array<{ id: string; name: string; description?: string }>>('/bms/config/booking-services'),
      api.get<Array<{ id: string; name: string; description?: string; duration?: string; price: number; cashCharge?: number; inclusions?: string[]; paymentOptions?: string[]; exclusions?: string[] }>>('/bms/config/services-offered'),
      api.get<Array<{ name: string; price: number }>>('/bms/config/protective-materials'),
    ]).then(([primaryServices, services, materials]) => {
      if (primaryServices.data?.length) setPrimaryServiceCatalog(primaryServices.data.map(item => ({ id: item.name, label: item.name, sub: item.description || '', icon: <Package size={22} /> })));
      // The View details lists come from the catalog too; they used to be dropped here, so View details showed nothing.
      if (services.data?.length) setServiceCatalog(services.data.map(item => ({ ...item, duration: item.duration || '-', description: item.description || '', cashCharge: Number(item.cashCharge) || 0, ...detailLists(item) })));
      if (materials.data?.length) setMaterialCatalog(materials.data.map(item => ({ name: item.name, price: Number(item.price) })));
    }).catch(() => {});
  }, [open]);

  const isU2U = d.serviceType === 'Unit to Unit Transfer';
  const catDef = DELIVERY_CATEGORY_DEFS.find(c => c.code === d.categoryCode);
  const pArea = catDef ? AREAS[getPickupArea(d.categoryCode)] : null;
  const dArea = catDef ? AREAS[getDeliveryArea(d.categoryCode)] : null;
  const pBrgy = d.pickupCity && pArea ? (pArea.barangaysByCity[d.pickupCity] ?? []) : [];
  const dBrgy = d.deliveryCity && dArea ? (dArea.barangaysByCity[d.deliveryCity] ?? []) : [];

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD(p => {
      const next = { ...p, [k]: v };
      if (truckContextChanged(
        { truckTypeId: p.truckType, locationCode: p.categoryCode },
        { truckTypeId: next.truckType, locationCode: next.categoryCode },
      )) next.selectedTruck = null;
      return next;
    });
  }
  function touch(k: keyof Draft) { setTouched(previous => new Set(previous).add(k)); }

  function setCat(code: string) {
    setD(p => {
      const next = { ...p, categoryCode: code, pickupCity: '', pickupBarangay: '', pickupZip: '', deliveryCity: '', deliveryBarangay: '', deliveryZip: '' };
      if (truckContextChanged(
        { truckTypeId: p.truckType, locationCode: p.categoryCode },
        { truckTypeId: next.truckType, locationCode: next.categoryCode },
      )) next.selectedTruck = null;
      return next;
    });
  }

  function toggleSvc(id: string) {
    setD(p => ({
      ...p,
      selectedAdditionalServices: p.selectedAdditionalServices.includes(id)
        ? p.selectedAdditionalServices.filter(s => s !== id)
        : [...p.selectedAdditionalServices, id],
    }));
  }

  function toggleProtectiveMaterial(name: string) {
    setD(p => ({
      ...p,
      selectedProtectiveMaterials: p.selectedProtectiveMaterials.includes(name)
        ? p.selectedProtectiveMaterials.filter(item => item !== name)
        : [...p.selectedProtectiveMaterials, name],
    }));
  }

  // Validation
  const canNext: Record<number, boolean> = {
    1: !!d.serviceType && (isU2U || !!d.truckType),
    2: !!d.firstName && !!d.lastName && !!d.contact && isValidContact(d.contact) && !!d.categoryCode &&
      hasPreferredTruckSelection(d.selectedTruck, d.truckType, d.categoryCode, isU2U) &&
      !!d.pickupCity && !!d.pickupBarangay && !!d.deliveryCity && !!d.deliveryBarangay &&
      !!d.pickupAddress && !!d.deliveryAddress &&
      !!d.pickupDate && !!d.pickupTime && !isDateInPast(d.pickupDate) && !!d.email && isValidEmail(d.email) && isValidZip(d.pickupZip) && isValidZip(d.deliveryZip) &&
      isValidAddress(d.pickupAddress) && isValidAddress(d.deliveryAddress) && isValidAddress(d.pickupExact) && isValidAddress(d.deliveryExact),
    3: isValidItemCount(d.estimatedItems),
    4: true,
    5: !!d.paymentMethod && d.agreeToTerms,
    6: false,
  };

  const selectedSvcs = serviceCatalog.filter(s => d.selectedAdditionalServices.includes(s.id));
  const svcTotal = selectedSvcs.reduce((s, sv) => s + sv.price, 0);
  const selectedMaterials = materialCatalog.filter(material => d.selectedProtectiveMaterials.includes(material.name));
  const materialsTotal = selectedMaterials.reduce((sum, material) => sum + material.price, 0);
  const insTotal = d.hasInsurance ? INSURANCE_PRICE : 0;
  const cashSurcharge = d.paymentMethod === 'COD' ? COD_SURCHARGE : 0;
  // Paying in cash also adds each selected additional service's own cash charge (spec bms/0013).
  const serviceCashCharges = d.paymentMethod === 'COD'
    ? selectedSvcs.filter(service => service.cashCharge > 0).map(service => ({ name: service.name, amount: service.cashCharge }))
    : [];
  const serviceCashTotal = serviceCashCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const truckTotal = preferredTruckCharge(d.selectedTruck, isU2U);
  const grandTotal = truckTotal + svcTotal + materialsTotal + insTotal + cashSurcharge + serviceCashTotal;
  const costLines: CostLine[] = [
    ...(truckTotal > 0 ? [{ label: d.selectedTruck?.name ?? 'Preferred truck', value: fmt(truckTotal) }] : []),
    ...selectedSvcs.map(service => ({ label: service.name, value: fmt(service.price) })),
    ...selectedMaterials.map(material => ({ label: material.name, value: fmt(material.price) })),
    ...(insTotal > 0 ? [{ label: 'Goods in Transit Insurance', value: fmt(insTotal) }] : []),
    ...serviceCashCharges.map(charge => ({ label: cashChargeLabel(charge.name), value: `+${fmt(charge.amount)}` })),
    ...(cashSurcharge > 0 ? [{ label: COD_FEE_LABEL, value: `+${fmt(cashSurcharge)}` }] : []),
  ];

  function confirm() {
    const specials = [
      d.fragileItems && 'Fragile Items', d.heavyItems && 'Heavy Items',
      d.applianceHandling && 'Appliance Handling',
    ].filter(Boolean) as string[];
    const composeAddress = (parts: Array<string | undefined>) => parts.map(part => part?.trim()).filter((part): part is string => !!part).filter((part, index, values) => values.findIndex(value => value.toLowerCase() === part.toLowerCase()) === index).join(', ');
    const pFull = composeAddress([d.pickupAddress, d.pickupFloor && `Floor ${d.pickupFloor}`, d.pickupRoom && `Room ${d.pickupRoom}`, d.pickupBarangay, d.pickupCity, d.categoryCode ? getPickupArea(d.categoryCode) : '', d.pickupZip]);
    const dFull = composeAddress([d.deliveryAddress, d.deliveryFloor && `Floor ${d.deliveryFloor}`, d.deliveryRoom && `Room ${d.deliveryRoom}`, d.deliveryBarangay, d.deliveryCity, d.categoryCode ? getDeliveryArea(d.categoryCode) : '', d.deliveryZip]);
    const amountValue = grandTotal > 0 ? grandTotal : 0;
    onConfirm({
      id: buildId(), client: `${d.firstName} ${d.lastName}`, fullName: `${d.firstName} ${d.lastName}`,
      contact: d.contact, email: d.email, address: dFull,
      service: d.serviceType, serviceType: d.serviceType, deliveryCategory: d.categoryCode,
      date: d.pickupDate, moveDate: d.pickupDate, preferredTime: d.pickupTime,
      status: 'For Plotting', amount: amountValue.toFixed(2),
      totalAmount: grandTotal > 0 ? fmt(grandTotal) : '₱0',
      pickupAddress: pFull, deliveryAddress: dFull, deliveryLocation: d.deliveryCity,
      pickupLandmark: d.pickupLandmark.trim() || undefined,
      deliveryLandmark: d.deliveryLandmark.trim() || undefined,
      estimatedItems: parseInt(d.estimatedItems) || 0, itemDetails: d.itemDetails,
      servicesAvailed: specials,
      protectiveMaterials: d.selectedProtectiveMaterials,
      additionalServicesAvailed: selectedSvcs.map(sv => {
        const cashCharge = serviceCashCharges.find(charge => charge.name === sv.name)?.amount;
        return { name: sv.name, price: fmt(sv.price), ...(cashCharge ? { cashCharge } : {}) };
      }),
      hasInsurance: d.hasInsurance, paymentMethod: d.paymentMethod,
      notes: d.specialInstructions, specialInstructions: d.specialInstructions, paymentStatus: 'Pending',
      permitRequired: d.permitRequired,
      selectedTruck: !isU2U && d.selectedTruck ? {
        id: d.selectedTruck.id, name: d.selectedTruck.name, rate: d.selectedTruck.rate,
        truckTypeId: d.selectedTruck.truckTypeId, locationCode: d.selectedTruck.locationCode,
      } : undefined,
    });
    onClose();
  }

  const nextLabel: Record<number, string> = { 1: 'Continue', 2: 'Continue', 3: 'Continue', 4: 'Continue', 5: 'Review Details', 6: 'Confirm Booking' };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent
        hideCloseButton
        onInteractOutside={event => {
          if ((event.target as HTMLElement).closest('[data-datepicker-portal]')) event.preventDefault();
        }}
        className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl dark:bg-gray-950 lg:w-[min(78vw,56rem)] xl:w-[min(68vw,56rem)]"
      >

        {/* ─ Header ─ */}
        <ModalHeader
          icon={Package}
          title="New booking"
          subtitle={`Step ${step} of 6 · ${STEP_LABELS[step - 1]}`}
          onClose={onClose}
          closeLabel="Close new booking"
        />

        {/* ─ Step bar ─ */}
        <nav aria-label="Booking steps" className="relative grid shrink-0 grid-cols-6 border-b border-slate-200 bg-white">
          <div className="pointer-events-none absolute left-[8.333333%] right-[8.333333%] top-[22px] h-[3px] -translate-y-1/2 bg-slate-200" aria-hidden="true">
            <div className="h-full bg-[#e8b800] transition-[width] duration-300" style={{ width: `${((step - 1) / 5) * 100}%` }} />
          </div>
          {STEP_LABELS.map((label, i) => {
            const stepNumber = i + 1;
            const current = stepNumber === step;
            const done = stepNumber < step;
            return <div key={label} aria-current={current ? 'step' : undefined} className={`relative z-10 flex min-w-0 flex-col items-center justify-start gap-1 border-b-2 px-0.5 py-2 text-center ${current ? 'border-[#1a1f6e]' : 'border-transparent'}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${current ? 'bg-[#1a1f6e] text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {done ? <Check size={14} strokeWidth={2.5} /> : <span>{stepNumber}</span>}
              </div>
              <span className={`text-[12.5px] leading-tight ${current ? 'font-medium text-[#1a1f6e]' : 'text-slate-500'}`}>{label}</span>
            </div>;
          })}
        </nav>

        {/* ─ Body ─ */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f1f4fa] p-4">
          {step === 1 && <S1 d={d} set={set} isU2U={isU2U} services={primaryServiceCatalog} touched={touched} touch={touch} />}
          {step === 2 && <S2 d={d} set={set} pArea={pArea} dArea={dArea} pBrgy={pBrgy} dBrgy={dBrgy} setCat={setCat} isU2U={isU2U} touched={touched} touch={touch} />}
          {step === 3 && <S3 d={d} set={set} expanded={expanded} setExpanded={setExpanded} toggleSvc={toggleSvc} toggleProtectiveMaterial={toggleProtectiveMaterial} serviceCatalog={serviceCatalog} materialCatalog={materialCatalog} touched={touched} touch={touch} />}
          {step === 4 && <S4 d={d} set={set} />}
          {step === 5 && <S5 d={d} set={set} policyOpen={policyOpen} setPolicyOpen={setPolicyOpen} grandTotal={grandTotal} costLines={costLines} touched={touched} touch={touch} serviceCashCharges={serviceCashCharges} />}
          {step === 6 && <S6 d={d} catDef={catDef} costLines={costLines} grandTotal={grandTotal} truckTotal={truckTotal} isU2U={isU2U} />}
        </div>

        {/* ─ Footer ─ */}
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
          {step > 1 ? (
            <button type="button" onClick={() => setStep(s => s - 1)} className="inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <button type="button" onClick={onClose} className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Cancel
            </button>
          )}
          <div className="ml-auto flex min-w-0 items-center justify-end gap-3">
          {step < 6 ? (
            <button onClick={() => {
              if (!canNext[step]) {
                if (step === 2) window.dispatchEvent(new Event('new-booking-step2-validate'));
                return;
              }
              setStep(s => s + 1);
            }} disabled={!canNext[step] && step !== 2} aria-disabled={!canNext[step]}
              className={`inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg px-5 text-sm font-medium transition-colors ${canNext[step] ? 'bg-[#030848] text-white hover:bg-[#141a6b]' : 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'}`}>
              {nextLabel[step]} <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={confirm}
              className="inline-flex h-10 w-fit items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#030848] px-5 text-sm font-medium text-white transition-colors hover:bg-[#141a6b]">
              <Check size={16} /> Confirm Booking
            </button>
          )}
          {step < 6 && step !== 1 && step !== 2 && step !== 3 && step !== 5 && !canNext[step] && <p className="max-w-[min(42vw,22rem)] text-right text-sm text-slate-500">Complete the required fields to continue.</p>}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 1 — SERVICE
// ═══════════════════════════════════════════════════════════════════════
function StepOneSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
    <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">{icon}{title}</h3>
    {children}
  </section>;
}

function primaryServiceIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes('corporate')) return <Briefcase size={19} />;
  if (normalized.includes('lipat') || normalized.includes('bahay') || normalized.includes('residential')) return <Home size={19} />;
  if (normalized.includes('office') || normalized.includes('pull out')) return <Building2 size={19} />;
  if (normalized.includes('unit to unit') || normalized.includes('transfer')) return <ArrowLeftRight size={19} />;
  return <Package size={19} />;
}

// Every rate of these truck types uses one photo, including rows whose stored imageUrl points at an older one.
// The photos have a navy background, which the card's photo area matches.
const SHARED_TRUCK_PHOTOS: Record<string, string> = {
  '6W 14ft. with Lifter': '/images/truck-rates/6w-14ft.png',
  '10ft. Closed Van': '/images/truck-rates/10ft-closed-van.png',
  '4W L300 FB Van': '/images/truck-rates/4w-l300.png',
};

function preferredTruckPhoto(rate: PreferredTruckRate) {
  return SHARED_TRUCK_PHOTOS[rate.truckTypeId] ?? rate.imageUrl;
}

function S1({ d, set, isU2U, services, touched, touch }: { d: Draft; set: Fn; isU2U: boolean; services: Array<{ id: string; label: string; sub: string; icon: React.ReactNode }>; touched: Set<keyof Draft>; touch: (key: keyof Draft) => void }) {
  const serviceInvalid = touched.has('serviceType') && !d.serviceType;
  const truckInvalid = touched.has('truckType') && !d.truckType;
  return (
    <div className="space-y-3">
      <StepOneSection icon={<Package size={16} />} title="What service do you need?">
        <div role="radiogroup" aria-label="What service do you need?" className="grid grid-cols-2 gap-2.5">
          {services.map(sv => {
            const sel = d.serviceType === sv.id;
            return <button key={sv.id} type="button" role="radio" aria-checked={sel} onClick={() => set('serviceType', sv.id)} onBlur={() => touch('serviceType')}
              className={`relative flex min-h-[68px] cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 ${sel ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sel ? 'bg-[#1a1f6e] text-[#e8b800]' : 'bg-[#eef0fa] text-[#1a1f6e]'}`}>{primaryServiceIcon(sv.label)}</span>
              <span className="min-w-0 pr-5"><span className="block text-[14.5px] font-medium leading-tight text-slate-900">{sv.label}</span><span className="mt-0.5 block text-sm leading-tight text-slate-600">{sv.sub}</span></span>
              {sel && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1f6e] text-white"><Check size={13} strokeWidth={2.5} /></span>}
            </button>;
          })}
        </div>
        {serviceInvalid && <p className="mt-2 text-xs text-red-600">This field is required.</p>}
      </StepOneSection>

      {!isU2U && d.serviceType && <StepOneSection icon={<Truck size={16} />} title="Select truck type">
        <div className="space-y-2">
          {TRUCK_TYPES.map(tt => {
            const sel = d.truckType === tt.id;
            return <button key={tt.id} type="button" role="radio" aria-checked={sel} onClick={() => set('truckType', tt.id)} onBlur={() => touch('truckType')}
              className={`flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 ${sel ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${sel ? 'bg-[#1a1f6e] text-[#e8b800]' : 'bg-[#eef0fa] text-[#1a1f6e]'}`}><Truck size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-medium leading-tight text-slate-900">{tt.label}</span><span className="mt-0.5 block text-sm leading-tight text-slate-600">{tt.sub}</span></span>
              {tt.capacity && <span className="shrink-0 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{tt.capacity}</span>}
              <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${sel ? 'border-[5px] border-[#1a1f6e] bg-white' : 'border-slate-400 bg-white'}`} />
            </button>;
          })}
        </div>
        {truckInvalid && <p className="mt-2 text-xs text-red-600">This field is required.</p>}
      </StepOneSection>}

      {isU2U && <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Unit to Unit Transfer does not require a truck or vehicle selection. Floor and Room Number fields will be available in Step 2.</div>}

      {d.serviceType && <StepOneSection icon={<ShieldCheck size={16} />} title="Permit requirement">
        <label className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${d.permitRequired ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ShieldCheck size={19} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[14.5px] font-medium leading-tight text-slate-900">Barangay / subdivision permit required</span><span className="mt-0.5 block text-sm leading-tight text-slate-600">Check if the pickup or delivery location requires a gate pass or entry permit</span></span>
          <input type="checkbox" checked={d.permitRequired} onChange={e => set('permitRequired', e.target.checked)} aria-label="Barangay or subdivision permit required" className="h-5 w-5 shrink-0 accent-[#1a1f6e]" />
        </label>
      </StepOneSection>}
    </div>
  );
}
// STEP 2 — PERSONAL INFO + ADDRESS
// ═══════════════════════════════════════════════════════════════════════
function S2({ d, set, pArea, dArea, pBrgy, dBrgy, setCat, isU2U, touched, touch }: {
  d: Draft; set: Fn;
  pArea: typeof AREAS['NCR'] | null; dArea: typeof AREAS['NCR'] | null;
  pBrgy: string[]; dBrgy: string[];
  setCat: (code: string) => void; isU2U: boolean;
  touched: Set<keyof Draft>; touch: (key: keyof Draft) => void;
}) {
  const [truckRates, setTruckRates] = useState<PreferredTruckRate[]>([]);
  const [truckRatesLoading, setTruckRatesLoading] = useState(false);
  const [truckRatesError, setTruckRatesError] = useState(false);
  const [truckRatesRetry, setTruckRatesRetry] = useState(0);
  const emailInvalid = touched.has('email') && (!d.email || !isValidEmail(d.email));
  const requiredInvalid = (field: keyof Draft, valid: boolean) => touched.has(field) && !valid;
  const pickupZipOptions = getZipCodes(getPickupArea(d.categoryCode), d.pickupBarangay, d.pickupCity);
  const deliveryZipOptions = getZipCodes(getDeliveryArea(d.categoryCode), d.deliveryBarangay, d.deliveryCity);
  const categoryInvalid = requiredInvalid('categoryCode', !!d.categoryCode);
  const selectedCategory = DELIVERY_CATEGORY_DEFS.find(category => category.code === d.categoryCode);
  const today = new Date();
  const todayValue = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const oneYearFromToday = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  const maxBookingDate = [oneYearFromToday.getFullYear(), String(oneYearFromToday.getMonth() + 1).padStart(2, '0'), String(oneYearFromToday.getDate()).padStart(2, '0')].join('-');

  useEffect(() => {
    if (!d.categoryCode || !d.truckType || isU2U) {
      setTruckRates([]);
      setTruckRatesError(false);
      setTruckRatesLoading(false);
      return;
    }
    let active = true;
    setTruckRatesLoading(true);
    setTruckRatesError(false);
    const params = new URLSearchParams({ location: d.categoryCode, truckTypeId: d.truckType });
    api.get<PreferredTruckRate[]>(`/booking/truck-rates?${params.toString()}`)
      .then(({ data }) => { if (active) setTruckRates(Array.isArray(data) ? filterTruckRates(data, d.truckType, d.categoryCode) : []); })
      .catch(() => { if (active) { setTruckRates([]); setTruckRatesError(true); } })
      .finally(() => { if (active) setTruckRatesLoading(false); });
    return () => { active = false; };
  }, [d.categoryCode, d.truckType, isU2U, truckRatesRetry]);

  const truckRateState = truckRateView(truckRates, d.truckType, d.categoryCode, truckRatesLoading, truckRatesError);
  const truckTypeLabel = TRUCK_TYPES.find(type => type.id === d.truckType)?.label || d.truckType;

  useEffect(() => {
    const validateAndFocusFirstInvalid = () => {
      const fields: Array<keyof Draft> = [
        'firstName', 'lastName', 'email', 'contact', 'categoryCode',
        'pickupCity', 'pickupBarangay', 'pickupAddress', 'pickupZip',
        'deliveryCity', 'deliveryBarangay', 'deliveryAddress', 'deliveryZip',
        'pickupDate', 'pickupTime',
      ];
      fields.forEach(touch);
      const firstInvalid: keyof Draft | undefined =
        !d.firstName ? 'firstName' :
        !d.lastName ? 'lastName' :
        !isValidEmail(d.email) ? 'email' :
        !isValidContact(d.contact) ? 'contact' :
        !d.categoryCode ? 'categoryCode' :
        !d.pickupCity ? 'pickupCity' :
        !d.pickupBarangay ? 'pickupBarangay' :
        !d.pickupAddress || !isValidAddress(d.pickupAddress) ? 'pickupAddress' :
        !isValidZip(d.pickupZip) ? 'pickupZip' :
        !d.deliveryCity ? 'deliveryCity' :
        !d.deliveryBarangay ? 'deliveryBarangay' :
        !d.deliveryAddress || !isValidAddress(d.deliveryAddress) ? 'deliveryAddress' :
        !isValidZip(d.deliveryZip) ? 'deliveryZip' :
        !d.pickupDate || isDateInPast(d.pickupDate) ? 'pickupDate' :
        !d.pickupTime ? 'pickupTime' : undefined;
      if (!firstInvalid) return;
      requestAnimationFrame(() => {
        const field = document.querySelector<HTMLElement>(`[data-step2-field="${firstInvalid}"]`);
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.querySelector<HTMLElement>('input, button, [role="combobox"]')?.focus({ preventScroll: true });
      });
    };
    window.addEventListener('new-booking-step2-validate', validateAndFocusFirstInvalid);
    return () => window.removeEventListener('new-booking-step2-validate', validateAndFocusFirstInvalid);
  }, [d, touch]);

  useEffect(() => {
    const province = d.categoryCode ? getPickupArea(d.categoryCode) : '';
    const allFilled = d.pickupAddress && d.pickupBarangay && d.pickupCity && province && d.pickupZip;
    if (allFilled) {
      const pComposed = [d.pickupAddress, d.pickupBarangay, d.pickupCity, province, d.pickupZip].filter(Boolean).join(', ');
      if (pComposed !== d.pickupExact) set('pickupExact', pComposed);
    } else if (d.pickupExact) {
      set('pickupExact', '');
    }
  }, [d.pickupAddress, d.pickupFloor, d.pickupRoom, d.pickupBarangay, d.pickupCity, d.pickupZip, d.categoryCode]);

  useEffect(() => {
    const province = d.categoryCode ? getDeliveryArea(d.categoryCode) : '';
    const allFilled = d.deliveryAddress && d.deliveryBarangay && d.deliveryCity && province && d.deliveryZip;
    if (allFilled) {
      const dComposed = [d.deliveryAddress, d.deliveryBarangay, d.deliveryCity, province, d.deliveryZip].filter(Boolean).join(', ');
      if (dComposed !== d.deliveryExact) set('deliveryExact', dComposed);
    } else if (d.deliveryExact) {
      set('deliveryExact', '');
    }
  }, [d.deliveryAddress, d.deliveryFloor, d.deliveryRoom, d.deliveryBarangay, d.deliveryCity, d.deliveryZip, d.categoryCode]);

  useEffect(() => {
    if (d.categoryCode && d.pickupBarangay) {
      const options = getZipCodes(getPickupArea(d.categoryCode), d.pickupBarangay, d.pickupCity);
      if (options.includes(d.pickupZip)) return;
      const zip = getZipCode(getPickupArea(d.categoryCode), d.pickupBarangay, d.pickupCity);
      if (zip !== d.pickupZip) set('pickupZip', zip);
    }
  }, [d.categoryCode, d.pickupBarangay, d.pickupCity]);

  useEffect(() => {
    if (d.categoryCode && d.deliveryBarangay) {
      const options = getZipCodes(getDeliveryArea(d.categoryCode), d.deliveryBarangay, d.deliveryCity);
      if (options.includes(d.deliveryZip)) return;
      const zip = getZipCode(getDeliveryArea(d.categoryCode), d.deliveryBarangay, d.deliveryCity);
      if (zip !== d.deliveryZip) set('deliveryZip', zip);
    }
  }, [d.categoryCode, d.deliveryBarangay, d.deliveryCity]);

  const availableTimes = useMemo(() => {
    if (!d.pickupDate) return TIME_SLOTS;
    const today = new Date().toISOString().split('T')[0];
    if (d.pickupDate !== today) return TIME_SLOTS;
    const now = new Date();
    const currentHour = now.getHours();
    return TIME_SLOTS.filter((_, idx) => idx > currentHour);
  }, [d.pickupDate]);

    return (
    <div className="space-y-3">
      <StepTwoSection icon={<User size={16} />} title="Personal information">
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
          <StepTwoField id="firstName" label="First name" required>
            <input id="firstName" value={d.firstName} onChange={e => set('firstName', e.target.value)} onBlur={() => touch('firstName')} placeholder="First name" aria-invalid={requiredInvalid('firstName', !!d.firstName)} className={`${stepTwoControl} ${requiredInvalid('firstName', !!d.firstName) ? stepTwoInvalid : ''}`} />
            {requiredInvalid('firstName', !!d.firstName) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
          <StepTwoField id="lastName" label="Last name" required>
            <input id="lastName" value={d.lastName} onChange={e => set('lastName', e.target.value)} onBlur={() => touch('lastName')} placeholder="Last name" aria-invalid={requiredInvalid('lastName', !!d.lastName)} className={`${stepTwoControl} ${requiredInvalid('lastName', !!d.lastName) ? stepTwoInvalid : ''}`} />
            {requiredInvalid('lastName', !!d.lastName) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
          <StepTwoField id="email" label="Email address" required>
            <div className="relative"><Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input id="email" value={d.email} onChange={e => set('email', e.target.value)} onBlur={() => touch('email')} placeholder="email@gmail.com" type="email" aria-invalid={emailInvalid} className={`${stepTwoControl} pl-9 ${emailInvalid ? stepTwoInvalid : ''}`} />
            </div>
            {emailInvalid && <p className="mt-1 text-sm text-red-600">{d.email ? 'The email address entered is invalid.' : 'This field is required.'}</p>}
          </StepTwoField>
          <StepTwoField id="contact" label="Contact number" required>
            <div className={`flex h-[42px] overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-[#1a1f6e]/20 ${requiredInvalid('contact', isValidContact(d.contact)) ? 'border-red-400 focus-within:!ring-red-400/20' : 'border-slate-300 focus-within:border-[#1a1f6e]'}`}>
              <span className="flex shrink-0 items-center gap-2 border-r border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"><Phone size={16} aria-hidden="true" /><span>+63</span></span>
              <input id="contact" value={formatPhilippineNumber(d.contact)} onChange={e => set('contact', `+63${e.target.value.replace(/\D/g, '').slice(0, 10)}`)} onBlur={() => touch('contact')} inputMode="numeric" placeholder="912 345 6789" aria-invalid={requiredInvalid('contact', isValidContact(d.contact))} className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
            </div>
            {requiredInvalid('contact', isValidContact(d.contact)) && <p className="mt-1 text-sm text-red-600">{d.contact ? 'Enter a valid 10-digit Philippine mobile number.' : 'This field is required.'}</p>}
          </StepTwoField>
        </div>
      </StepTwoSection>

      <section data-step2-field="categoryCode" className={`overflow-hidden rounded-xl border bg-white shadow-sm ${categoryInvalid ? 'border-red-400' : 'border-slate-200/70'}`}>
        <h3 className="bg-[#e32328] px-4 py-3 text-center text-sm font-bold uppercase tracking-wider text-white">Select your delivery location</h3>
        <div className="p-3.5">
          <div role="radiogroup" aria-label="Delivery zone" aria-invalid={categoryInvalid} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {DELIVERY_CATEGORY_DEFS.map(cat => {
              const selected = d.categoryCode === cat.code;
              const region = cat.code === 'NC' ? 'NCR' : cat.code === 'NCH' ? 'NCR + Motorized Helper' : cat.code === 'NN' ? 'N → North' : cat.code === 'SS' ? 'S → South' : cat.deliveryArea;
              return <button key={cat.code} type="button" role="radio" aria-checked={selected} onClick={() => setCat(cat.code)} onBlur={() => touch('categoryCode')}
                className={`flex min-h-[56px] cursor-pointer flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8b800] focus-visible:ring-offset-2 ${selected ? 'bg-[#e8b800] text-[#1a1f6e]' : 'bg-[#1a1f6e] text-white hover:bg-[#141a6b]'}`}>
                <span className="text-sm font-bold leading-tight">{cat.code}</span>
                <span className={`mt-0.5 line-clamp-2 text-xs leading-tight ${selected ? 'text-[#1a1f6e]' : 'text-indigo-200'}`}>{region}</span>
              </button>;
            })}
          </div>
          {selectedCategory && <div role="status" aria-live="polite" className="mt-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
            <Truck size={17} className="shrink-0" aria-hidden="true" />
            <p><span className="font-semibold">{selectedCategory.code}</span> — {selectedCategory.label}. Pickup: <span className="font-semibold">{selectedCategory.pickupArea}</span> · Delivery: <span className="font-semibold">{selectedCategory.deliveryArea}</span></p>
          </div>}
          {categoryInvalid && <p className="mt-2 text-sm text-red-600">Choose a delivery zone.</p>}
        </div>
      </section>

      {!isU2U && d.categoryCode && <StepTwoSection icon={<Truck size={16} />} title="Select your preferred truck">
        <p className="mb-3 text-sm text-slate-600">{truckRateState === 'loading' ? `Loading ${truckTypeLabel} options for ${d.categoryCode}…` : `${truckRates.length} options for ${truckTypeLabel} in ${d.categoryCode}`}</p>
        {truckRateState === 'loading' && <div role="status" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map(index => <div key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-hidden="true"><div className="h-28 animate-pulse bg-slate-100" /><div className="space-y-2 p-4"><div className="h-5 w-3/4 animate-pulse rounded bg-slate-100" /><div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" /><div className="h-4 w-full animate-pulse rounded bg-slate-100" /></div></div>)}
        </div>}
        {truckRateState === 'error' && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <span>Truck options could not be loaded.</span>
          <button type="button" onClick={() => setTruckRatesRetry(value => value + 1)} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">Retry</button>
        </div>}
        {truckRateState === 'empty' && <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <Truck size={20} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          <div><p className="font-medium text-slate-800">No {truckTypeLabel} rates for {d.categoryCode} yet</p><p className="mt-1">Pick another location or change the truck type in Step 1.</p></div>
        </div>}
        {truckRateState === 'options' && <div role="radiogroup" aria-label="Preferred truck" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {truckRates.map(rate => {
            const selected = d.selectedTruck?.id === rate.id;
            const truckPhoto = preferredTruckPhoto(rate);
            return <button key={rate.id} type="button" role="radio" aria-checked={selected} onClick={() => set('selectedTruck', rate)}
              className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 ${selected ? 'border-2 border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-200 hover:border-[#1a1f6e]/50'}`}>
              <span className={`relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 text-sm font-medium ${SHARED_TRUCK_PHOTOS[rate.truckTypeId] ? 'bg-[#013062]' : selected && !truckPhoto ? 'bg-[#1a1f6e] text-[#e8b800]' : 'bg-[#eef0fa] text-[#1a1f6e]'}`}>
                {truckPhoto ? <img src={truckPhoto} alt={`Truck for ${rate.name}`} className="h-full w-full object-contain" /> : <><Truck size={36} strokeWidth={2.5} /><span>Truck photo</span></>}
                <span aria-hidden="true" className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[#1a1f6e] bg-[#1a1f6e]' : 'border-slate-300 bg-white'}`}>{selected && <span className="h-2 w-2 rounded-full bg-white" />}</span>
              </span>
              <span className="flex flex-1 flex-col p-3.5">
                <span className="block text-[15px] font-medium leading-snug text-slate-900">{rate.name}</span>
                <span className="mb-3 mt-1 block text-sm text-slate-600">{rate.dimensions}</span>
                <span className="mb-3 mt-auto block border-t border-slate-200" />
                <span className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-sm text-slate-700">6 hr</span>
                  <span className="text-lg font-semibold tabular-nums text-[#1a1f6e]">{new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(Number(rate.rate))}</span>
                </span>
              </span>
            </button>;
          })}
        </div>}
      </StepTwoSection>}

      <StepTwoSection icon={<MapPin size={16} />} title="Pickup address">
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
          <StepTwoField id="pickupCity" label="City / municipality" required>
            <SI id="pickupCity" value={d.pickupCity} onChange={v => { set('pickupCity', v); set('pickupBarangay', ''); set('pickupZip', ''); }} onBlur={() => touch('pickupCity')} className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 ${requiredInvalid('pickupCity', !!d.pickupCity) ? stepTwoInvalid : ''}`} invalid={requiredInvalid('pickupCity', !!d.pickupCity)} options={pArea?.cities ?? []} placeholder={d.categoryCode ? 'Select a city' : 'Select a zone first'} disabled={!d.categoryCode} />
            {requiredInvalid('pickupCity', !!d.pickupCity) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
          <StepTwoField id="pickupBarangay" label="Barangay" required>
            <SI id="pickupBarangay" value={d.pickupBarangay} onChange={v => { set('pickupBarangay', v); set('pickupZip', ''); }} onBlur={() => touch('pickupBarangay')} className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 ${requiredInvalid('pickupBarangay', !!d.pickupBarangay) ? stepTwoInvalid : ''}`} invalid={requiredInvalid('pickupBarangay', !!d.pickupBarangay)} options={pBrgy} placeholder={d.pickupCity ? 'Select a barangay' : 'Select a city first'} disabled={!d.pickupCity} />
            {requiredInvalid('pickupBarangay', !!d.pickupBarangay) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
          <StepTwoField id="pickupAddress" label="Address" required>
            <input id="pickupAddress" value={d.pickupAddress} onChange={e => set('pickupAddress', e.target.value)} onBlur={() => touch('pickupAddress')} placeholder="Street / building" aria-invalid={requiredInvalid('pickupAddress', !!d.pickupAddress && isValidAddress(d.pickupAddress))} className={`${stepTwoControl} ${requiredInvalid('pickupAddress', !!d.pickupAddress && isValidAddress(d.pickupAddress)) ? stepTwoInvalid : ''}`} />
            {requiredInvalid('pickupAddress', !!d.pickupAddress && isValidAddress(d.pickupAddress)) && <p className="mt-1 text-sm text-red-600">{d.pickupAddress ? 'Please enter a valid pickup address.' : 'This field is required.'}</p>}
          </StepTwoField>
          <StepTwoField id="pickupZip" label="ZIP / postal code">
            {pickupZipOptions.length > 1 ? <SI id="pickupZip" value={d.pickupZip} onChange={v => set('pickupZip', v)} options={pickupZipOptions} placeholder="Select or type a ZIP code" className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 ${d.pickupZip && !isValidZip(d.pickupZip) ? stepTwoInvalid : ''}`} invalid={!!d.pickupZip && !isValidZip(d.pickupZip)} /> : <input id="pickupZip" value={d.pickupZip} onChange={e => set('pickupZip', e.target.value)} maxLength={4} inputMode="numeric" placeholder="e.g. 1600" aria-invalid={!!d.pickupZip && !isValidZip(d.pickupZip)} className={`${stepTwoControl} ${d.pickupZip && !isValidZip(d.pickupZip) ? stepTwoInvalid : ''}`} />}
            {d.pickupZip && !isValidZip(d.pickupZip) && <p className="mt-1 text-sm text-red-600">ZIP must be exactly 4 digits.</p>}
          </StepTwoField>
          {isU2U && <>
            <StepTwoField id="pickupFloor" label="Floor number"><input id="pickupFloor" value={d.pickupFloor} onChange={e => set('pickupFloor', e.target.value)} placeholder="e.g. 3" className={stepTwoControl} /></StepTwoField>
            <StepTwoField id="pickupRoom" label="Room / unit number"><input id="pickupRoom" value={d.pickupRoom} onChange={e => set('pickupRoom', e.target.value)} placeholder="e.g. 3B" className={stepTwoControl} /></StepTwoField>
          </>}
          <StepTwoField id="pickupExact" label="Pickup exact address" className="col-span-2">
            <input id="pickupExact" value={d.pickupExact} disabled placeholder="Complete pickup address for the crew" className={`${stepTwoControl} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`} />
            {d.pickupExact && !isValidAddress(d.pickupExact) && <p className="mt-1 text-sm text-red-600">Please enter a valid pickup exact address.</p>}
          </StepTwoField>
          <StepTwoField id="pickupLandmark" label={<>Landmark / map pin <span className="font-normal text-slate-500">(optional)</span></>} className="col-span-2">
            <input id="pickupLandmark" value={d.pickupLandmark} onChange={e => set('pickupLandmark', e.target.value)} placeholder="e.g. Near SM City or 14.676, 121.043" className={stepTwoControl} />
          </StepTwoField>
        </div>
      </StepTwoSection>

      <StepTwoSection icon={<MapPin size={16} />} title="Delivery address">
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
          <StepTwoField id="deliveryCity" label="City / municipality" required>
            <SI id="deliveryCity" value={d.deliveryCity} onChange={v => { set('deliveryCity', v); set('deliveryBarangay', ''); set('deliveryZip', ''); }} onBlur={() => touch('deliveryCity')} className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 ${requiredInvalid('deliveryCity', !!d.deliveryCity) ? stepTwoInvalid : ''}`} invalid={requiredInvalid('deliveryCity', !!d.deliveryCity)} options={dArea?.cities ?? []} placeholder={d.categoryCode ? 'Select a city' : 'Select a zone first'} disabled={!d.categoryCode} />
            {requiredInvalid('deliveryCity', !!d.deliveryCity) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
          <StepTwoField id="deliveryBarangay" label="Barangay" required>
            <SI id="deliveryBarangay" value={d.deliveryBarangay} onChange={v => { set('deliveryBarangay', v); set('deliveryZip', ''); }} onBlur={() => touch('deliveryBarangay')} className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100 ${requiredInvalid('deliveryBarangay', !!d.deliveryBarangay) ? stepTwoInvalid : ''}`} invalid={requiredInvalid('deliveryBarangay', !!d.deliveryBarangay)} options={dBrgy} placeholder={d.deliveryCity ? 'Select a barangay' : 'Select a city first'} disabled={!d.deliveryCity} />
            {requiredInvalid('deliveryBarangay', !!d.deliveryBarangay) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
          <StepTwoField id="deliveryAddress" label="Address" required>
            <input id="deliveryAddress" value={d.deliveryAddress} onChange={e => set('deliveryAddress', e.target.value)} onBlur={() => touch('deliveryAddress')} placeholder="Street / building" aria-invalid={requiredInvalid('deliveryAddress', !!d.deliveryAddress && isValidAddress(d.deliveryAddress))} className={`${stepTwoControl} ${requiredInvalid('deliveryAddress', !!d.deliveryAddress && isValidAddress(d.deliveryAddress)) ? stepTwoInvalid : ''}`} />
            {requiredInvalid('deliveryAddress', !!d.deliveryAddress && isValidAddress(d.deliveryAddress)) && <p className="mt-1 text-sm text-red-600">{d.deliveryAddress ? 'Please enter a valid delivery address.' : 'This field is required.'}</p>}
          </StepTwoField>
          <StepTwoField id="deliveryZip" label="ZIP / postal code">
            {deliveryZipOptions.length > 1 ? <SI id="deliveryZip" value={d.deliveryZip} onChange={v => set('deliveryZip', v)} options={deliveryZipOptions} placeholder="Select or type a ZIP code" className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 ${d.deliveryZip && !isValidZip(d.deliveryZip) ? stepTwoInvalid : ''}`} invalid={!!d.deliveryZip && !isValidZip(d.deliveryZip)} /> : <input id="deliveryZip" value={d.deliveryZip} onChange={e => set('deliveryZip', e.target.value)} maxLength={4} inputMode="numeric" placeholder="e.g. 4117" aria-invalid={!!d.deliveryZip && !isValidZip(d.deliveryZip)} className={`${stepTwoControl} ${d.deliveryZip && !isValidZip(d.deliveryZip) ? stepTwoInvalid : ''}`} />}
            {d.deliveryZip && !isValidZip(d.deliveryZip) && <p className="mt-1 text-sm text-red-600">ZIP must be exactly 4 digits.</p>}
          </StepTwoField>
          {isU2U && <>
            <StepTwoField id="deliveryFloor" label="Floor number"><input id="deliveryFloor" value={d.deliveryFloor} onChange={e => set('deliveryFloor', e.target.value)} placeholder="e.g. 5" className={stepTwoControl} /></StepTwoField>
            <StepTwoField id="deliveryRoom" label="Room / unit number"><input id="deliveryRoom" value={d.deliveryRoom} onChange={e => set('deliveryRoom', e.target.value)} placeholder="e.g. 5A" className={stepTwoControl} /></StepTwoField>
          </>}
          <StepTwoField id="deliveryExact" label="Drop-off full address" className="col-span-2">
            <input id="deliveryExact" value={d.deliveryExact} disabled placeholder="Complete drop-off address for the crew" className={`${stepTwoControl} disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400`} />
            {d.deliveryExact && !isValidAddress(d.deliveryExact) && <p className="mt-1 text-sm text-red-600">Please enter a valid drop-off address.</p>}
          </StepTwoField>
          <StepTwoField id="deliveryLandmark" label={<>Landmark / map pin <span className="font-normal text-slate-500">(optional)</span></>} className="col-span-2">
            <input id="deliveryLandmark" value={d.deliveryLandmark} onChange={e => set('deliveryLandmark', e.target.value)} placeholder="e.g. Beside barangay hall or 14.650, 121.102" className={stepTwoControl} />
          </StepTwoField>
        </div>
      </StepTwoSection>

      <StepTwoSection icon={<Calendar size={16} />} title="Pickup schedule">
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-3">
          <StepTwoField id="pickupDate" label="Pickup date" required>
            <DatePicker id="pickupDate" value={d.pickupDate} onChange={v => set('pickupDate', v)} onBlur={() => touch('pickupDate')} min={todayValue} max={maxBookingDate} invalid={requiredInvalid('pickupDate', !!d.pickupDate && !isDateInPast(d.pickupDate))} placement="top" placeholder="Select pickup date" className="[&>button]:!h-[42px] [&>button]:!rounded-lg [&>button]:!border-slate-300 [&>button]:!text-sm [&>button[aria-invalid=true]]:!border-red-400" />
            {requiredInvalid('pickupDate', !!d.pickupDate && !isDateInPast(d.pickupDate)) && <p className="mt-1 text-sm text-red-600">{d.pickupDate ? 'Pickup date cannot be in the past.' : 'This field is required.'}</p>}
          </StepTwoField>
          <StepTwoField id="pickupTime" label="Pickup time" required>
            <div className="relative"><Clock size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[#1a1f6e]" />
              <SI id="pickupTime" value={d.pickupTime} onChange={v => set('pickupTime', v)} onBlur={() => touch('pickupTime')} options={availableTimes} placeholder="Select or type a time" invalid={requiredInvalid('pickupTime', !!d.pickupTime)} className={`h-[42px] w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm text-slate-900 focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 ${requiredInvalid('pickupTime', !!d.pickupTime) ? stepTwoInvalid : ''}`} />
            </div>
            {requiredInvalid('pickupTime', !!d.pickupTime) && <p className="mt-1 text-sm text-red-600">This field is required.</p>}
          </StepTwoField>
        </div>
      </StepTwoSection>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 3 — ITEMS & ADDITIONAL SERVICES
// ═══════════════════════════════════════════════════════════════════════
const stepThreeInput = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20'
const formatAddonPrice = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount)

function StepThreeSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
    <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">{icon}{title}</h3>
    {children}
  </section>
}

function StepThreeField({ id, label, required = false, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-700">{label}{required && <span className="text-red-600"> *</span>}</label>
    {children}
  </div>
}

function S3({ d, set, expanded, setExpanded, toggleSvc, toggleProtectiveMaterial, serviceCatalog, materialCatalog, touched, touch }: {
  d: Draft; set: Fn;
  expanded: Set<string>; setExpanded: (ids: Set<string>) => void;
  toggleSvc: (id: string) => void;
  toggleProtectiveMaterial: (name: string) => void;
  serviceCatalog: AdditionalService[]; materialCatalog: typeof PROTECTIVE_MATERIALS;
  touched: Set<keyof Draft>; touch: (key: keyof Draft) => void;
}) {
  const itemCountInvalid = touched.has('estimatedItems') && !isValidItemCount(d.estimatedItems);
  const bools = [
    { k: 'fragileItems' as const, label: 'Fragile items' },
    { k: 'heavyItems' as const, label: 'Heavy items' },
    { k: 'applianceHandling' as const, label: 'Appliance handling' },
  ];
  const sortedServices = [...serviceCatalog].sort((a, b) => a.price - b.price);

  return <div className="space-y-3">
    <StepThreeSection icon={<Package size={16} />} title="Items">
      <div className="w-full sm:w-1/2">
        <StepThreeField id="estimatedItems" label="Estimated number of items" required>
          <input id="estimatedItems" type="number" inputMode="numeric" min="1" max="100" value={d.estimatedItems} onChange={e => set('estimatedItems', e.target.value)} onBlur={() => touch('estimatedItems')} placeholder="e.g. 15" aria-invalid={itemCountInvalid} className={`${stepThreeInput} ${itemCountInvalid ? '!border-red-400' : ''}`} />
          {itemCountInvalid && <p className="mt-1 text-sm text-red-600">{d.estimatedItems === '' ? 'This field is required.' : 'Enter a whole number from 1 to 100.'}</p>}
        </StepThreeField>
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <StepThreeField id="itemDetails" label="Item details">
          <textarea id="itemDetails" value={d.itemDetails} onChange={e => set('itemDetails', e.target.value)} placeholder="Sofa, ref, boxes..." rows={4} maxLength={ITEM_DETAILS_MAX_LENGTH} className={`${stepThreeTextarea} h-28`} />
          <p className="mt-1 text-right text-xs text-slate-500">{d.itemDetails.length} / {ITEM_DETAILS_MAX_LENGTH} characters</p>
        </StepThreeField>
        <StepThreeField id="specialInstructions" label="Special instructions">
          <textarea id="specialInstructions" value={d.specialInstructions} onChange={e => set('specialInstructions', e.target.value)} placeholder="Access codes, fragile notes, parking info..." rows={4} maxLength={SPECIAL_INSTRUCTIONS_MAX_LENGTH} className={`${stepThreeTextarea} h-28`} />
          <p className="mt-1 text-right text-xs text-slate-500">{d.specialInstructions.length} / {SPECIAL_INSTRUCTIONS_MAX_LENGTH} characters</p>
        </StepThreeField>
      </div>
    </StepThreeSection>

    <StepThreeSection icon={<ShieldCheck size={16} />} title="Special items">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {bools.map(item => <label key={item.k} className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${d[item.k] ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
          <input type="checkbox" checked={d[item.k]} onChange={e => set(item.k, e.target.checked)} className="peer sr-only" />
          <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${d[item.k] ? 'border-[#1a1f6e] bg-[#1a1f6e]' : 'border-slate-400 bg-white'} peer-focus-visible:ring-2 peer-focus-visible:ring-[#1a1f6e]/30`}>{d[item.k] && <Check size={13} className="text-white" />}</span>
          <span className="text-[14.5px] font-medium text-slate-900">{item.label}</span>
        </label>)}
      </div>
    </StepThreeSection>

    <StepThreeSection icon={<Package size={16} />} title="Protective materials">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {materialCatalog.map(material => {
          const selected = d.selectedProtectiveMaterials.includes(material.name);
          return <label key={material.name} className={`relative flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${selected ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
            <input type="checkbox" checked={selected} onChange={() => toggleProtectiveMaterial(material.name)} className="peer sr-only" />
            <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-[#1a1f6e] bg-[#1a1f6e]' : 'border-slate-400 bg-white'} peer-focus-visible:ring-2 peer-focus-visible:ring-[#1a1f6e]/30`}>{selected && <Check size={13} className="text-white" />}</span>
            <span className="min-w-0 flex-1 text-slate-900">{material.name}</span>
            <span className="shrink-0 font-medium text-[#1a1f6e]">{formatAddonPrice(material.price)}</span>
          </label>;
        })}
      </div>
    </StepThreeSection>

    <StepThreeSection icon={<CreditCard size={16} />} title="Additional services">
      <div className="grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
            {sortedServices.map(svc => {
              const selected = d.selectedAdditionalServices.includes(svc.id);
              const expandedDetails = expanded.has(svc.id);
              const duration = svc.duration.replace(/(\d+)\s*hr\b/i, '$1 hr');
              return <div key={svc.id} className={`rounded-xl border transition-colors ${selected ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white'}`}>
                <label className="relative flex cursor-pointer items-start gap-2.5 p-3">
                  <input type="checkbox" checked={selected} onChange={() => toggleSvc(svc.id)} className="peer sr-only" />
                  <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-[#1a1f6e] bg-[#1a1f6e]' : 'border-slate-400 bg-white'} peer-focus-visible:ring-2 peer-focus-visible:ring-[#1a1f6e]/30`}>{selected && <Check size={13} className="text-white" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2"><span className="text-[14.5px] font-medium leading-snug text-slate-900">{svc.name}</span><span className="shrink-0 font-medium text-[#1a1f6e]">{formatAddonPrice(svc.price)}</span></span>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 text-xs text-slate-600"><Clock size={12} />{duration}</span>
                    <span className="mt-1 block text-[13px] text-slate-600">{svc.description}</span>
                  </span>
                </label>
                <div className="px-3 pb-3 pl-10">
                  <button type="button" aria-expanded={expandedDetails} onClick={() => { const next = new Set(expanded); if (expandedDetails) next.delete(svc.id); else next.add(svc.id); setExpanded(next); }} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#1a1f6e] hover:underline">
                    {expandedDetails ? 'Hide details' : 'View details'} <ChevronRight size={14} className={`transition-transform ${expandedDetails ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedDetails && <div className="mt-2"><ServiceDetailsSections details={svc} compact /></div>}
                </div>
              </div>;
            })}
      </div>
    </StepThreeSection>
  </div>;
}
// STEP 4 — INSURANCE
// ═══════════════════════════════════════════════════════════════════════
function S4({ d, set }: { d: Draft; set: Fn }) {
  return (
    <div className="p-5">
      <Sec icon={<ShieldCheck size={16} className="text-[#1a1f6e]" />} title={<span className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Goods in Transit Insurance</span>}>
        <div className={`border-2 rounded-xl transition-all cursor-pointer ${d.hasInsurance ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-slate-300'}`}
          onClick={() => set('hasInsurance', !d.hasInsurance)}>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-medium text-slate-900">Goods in Transit Insurance</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">6 hr</span>
                </div>
                <p className="mt-1 text-[22px] font-medium text-emerald-600">{fmt(INSURANCE_PRICE)} <span className="text-[13px] font-normal text-slate-500">· Customer's Place</span></p>
              </div>
              <div className={`mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md border-2 ${d.hasInsurance ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-gray-600'}`}>
                {d.hasInsurance && <Check size={13} className="text-white" />}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-gray-700 space-y-3 text-xs text-slate-600 dark:text-gray-300">
              <p className="flex items-start gap-1.5 text-[13.5px] font-medium leading-relaxed text-amber-700">
                <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
                Please note that if insurance is not taken up, our maximum liability is up to the refund of the price of the move or the price of second hand equivalent of the item whichever is smaller.
              </p>
              <p className="!mb-2.5 !mt-3.5 text-sm font-medium text-slate-900">Terms and Conditions (T&C) for Inland Transit Insurance for Household Goods/General Cargo/Musical Instruments.</p>
              <ol className="list-inside list-decimal leading-[1.6]">
                <li className="mb-2.5 text-[13.5px] text-slate-700">It is deemed necessary that you should take adequate insurance for your household goods/general cargo. WeLinc offers an optional goods in transit insurance of ₱1,500 for a maximum coverage of up to ₱30,000.</li>
                <li className="mb-2.5 text-[13.5px] text-slate-700">Insurance endorsement do not cover claims for musical instruments and antique items. Please apply the necessary protection on these items and give very specific instructions to the driver.</li>
                <li className="mb-2.5 text-[13.5px] text-slate-700">No insurance coverage for Works of Arts, Paintings, Antiques, Vases, Ornaments, Money, Jewelries, Laptops, Liquor, Cutleries, Mirrors, Personal Effects (e.g. shoes, bags, clothing) and Pairs &amp; Sets Clause, etc.</li>
                <li className="mb-2.5 text-[13.5px] text-slate-700">Insurance does not cover derangement of electrical, electronic and mechanical equipment; rust, oxidation, discoloration, scratching, bending, denting, chipping, pre-existing defects and damages howsoever caused.</li>
                <li className="mb-2.5 text-[13.5px] text-slate-700">Insurance is based on second-hand replacement clause. WeLinc will refund the price of the item based on prevailing 2nd hand price in the market or up to a maximum of ₱30,000 whichever is smaller.</li>
                <li className="mb-2.5 text-[13.5px] text-slate-700">Insurance Trip refundable in case of damages. See terms and conditions below. All claims and refunds are subject to investigation.</li>
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
function S5({ d, set, policyOpen, setPolicyOpen, grandTotal, costLines, touched, touch, serviceCashCharges }: {
  d: Draft; set: Fn; policyOpen: boolean; setPolicyOpen: (v: boolean) => void;
  grandTotal: number; costLines: CostLine[];
  touched: Set<keyof Draft>; touch: (key: keyof Draft) => void;
  /** Each selected additional service's own cash charge, when paying in cash. */
  serviceCashCharges: Array<{ name: string; amount: number }>;
}) {
  const paymentMethodInvalid = touched.has('paymentMethod') && !d.paymentMethod;
  const termsInvalid = touched.has('agreeToTerms') && !d.agreeToTerms;
  return (
    <div className="p-5 space-y-5">

      {/* Price summary */}
      {costLines.length > 0 && (
        <Sec icon={<CreditCard size={16} />} title={<span className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Cost Summary</span>}>
          <CostSummary lines={costLines} total={fmt(grandTotal)} />
        </Sec>
      )}

      {/* Payment Method */}
      <Sec icon={<Smartphone size={16} />} title={<><span className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Payment Method</span><span className="text-xs font-medium tracking-wider text-red-600"> *</span></>}>
        <div role="radiogroup" aria-label="Payment method" className={`grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl ${paymentMethodInvalid ? 'ring-1 ring-red-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
          {([
            { id: 'GCash', label: 'GCash', icon: <Smartphone size={22} />, sub: 'Digital wallet' },
            { id: 'Credit Card', label: 'Credit Card', icon: <CreditCard size={22} />, sub: 'Visa / Mastercard' },
            { id: 'Xendit', label: 'Xendit', icon: <CreditCard size={22} />, sub: 'Wallets, cards, direct debit, retail & PayLater' },
            { id: 'COD', label: 'Cash on Delivery', icon: <Truck size={22} />, sub: `Pay on pickup (+${fmt(COD_SURCHARGE)})` },
          ]).map(pm => (
            <button type="button" role="radio" aria-checked={d.paymentMethod === pm.id} key={pm.id} onClick={() => { set('paymentMethod', pm.id); touch('paymentMethod'); }} onBlur={() => touch('paymentMethod')}
              className={`relative flex flex-col items-center gap-2 rounded-xl border px-2 py-4 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e] focus-visible:ring-offset-2
                ${d.paymentMethod === pm.id ? 'border-[1.5px] border-[#1a1f6e] bg-[#f5f6fd]' : 'border-slate-300 bg-white hover:border-[#1a1f6e]/50'}`}>
              {d.paymentMethod === pm.id && <span aria-hidden="true" className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1f6e] text-white"><Check size={13} /></span>}
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${d.paymentMethod === pm.id ? 'bg-[#1a1f6e] text-[#e8b800]' : 'bg-slate-100 text-slate-600'}`}>{pm.icon}</div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-slate-900">{pm.label}</p>
                <p className="text-[12.5px] leading-snug text-slate-600">{pm.sub}</p>
              </div>
            </button>
          ))}
        </div>
        {paymentMethodInvalid && <p className="mt-2 text-xs text-red-600">This field is required.</p>}
        {d.paymentMethod === 'COD' && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertCircle size={12} className="shrink-0" />
            <span>
              A {fmt(COD_SURCHARGE)} cash-on-delivery surcharge has been added to your total.
              {serviceCashCharges.length > 0 && <> Paying in cash also adds {serviceCashCharges.map(charge => `${fmt(charge.amount)} for ${charge.name}`).join(', ')}.</>}
            </span>
          </p>
        )}
      </Sec>

      {/* Policy */}
      <Sec icon={<ShieldCheck size={16} className="text-[#1a1f6e]" />} title={<><span className="text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">Policy & Terms</span><span className="text-xs font-medium tracking-wider text-red-600"> *</span></>}>
        <button onClick={() => setPolicyOpen(!policyOpen)}
          className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-[14.5px] font-medium text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-100 transition-colors">
          <span>Booking Policy & Cancellation Terms</span>
          <ChevronDown size={15} className={`transition-transform ${policyOpen ? 'rotate-180' : ''}`} />
        </button>
        {policyOpen && (
          <div className="mt-3 max-h-[230px] overflow-y-auto rounded-xl border border-slate-300 bg-white p-4 text-[13.5px] leading-[1.6] text-slate-700 dark:bg-gray-900 dark:text-gray-300">
            <ol className="list-decimal list-inside">
              <li className="mb-2">Cancellations/Reschedules made by the hirer within 24-hour of the hire date will result to hirer liable to pay <strong className="font-medium text-slate-900">Three Hundred Pesos (PHP 300)</strong>.</li>
              <li className="mb-2">Cancellations within four (4) hours of the hire date and time will result to the client be liable to pay <strong className="font-medium text-slate-900">Two Thousand Pesos (PHP 2,000)</strong> for pickup location within NCR. For pickup points outside of NCR, within 4 hr cancellation penalty will be <strong className="font-medium text-slate-900">50% of the booking amount</strong>.</li>
              <li className="mb-2">Rescheduling within four (4) hours of the scheduled hire date and time shall incur the following fees:
                <ul className="mt-1 ml-4 space-y-0.5 list-disc"><li><strong className="font-medium text-slate-900">PHP 500</strong> if the team has not yet departed from the dispatch point.</li><li><strong className="font-medium text-slate-900">PHP 1,000</strong> if the team has already departed or arrived at the pickup location.</li></ul>
              </li>
              <li className="mb-2">Any cancellation by WeLinc due to adverse weather, vehicle failure, road accidents or any other factors, the hirer will be offered an alternative date.</li>
              <li className="mb-2">Refunds will be transferred via credit card for credit card payment and via GCash for other payment methods. Clients must provide refund details through Facebook or Viber.</li>
              <li className="mb-2"><strong>Damage Reporting Policy:</strong> All damages or concerns must be reported within <strong>forty-eight (48) hours</strong> after delivery. Required reports must include:
                <ul className="mt-1 ml-4 space-y-0.5 list-disc"><li>Clear photos of the damaged item</li><li>Description of the damage</li><li>Client written statement</li></ul>
                Failure to report within the stated period will render the claim invalid.
              </li>
            </ol>
          </div>
        )}

        {/* Agreement */}
        <label className={`flex items-start gap-3 mt-3 cursor-pointer p-3 rounded-xl border transition-colors ${termsInvalid ? 'border-red-500 bg-slate-50 dark:bg-gray-800' : 'border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800'}`}>
          <input type="checkbox" required aria-invalid={termsInvalid} checked={d.agreeToTerms} onBlur={() => touch('agreeToTerms')} onChange={e => { set('agreeToTerms', e.target.checked); touch('agreeToTerms'); }} className="mt-0.5 h-[22px] w-[22px] flex-shrink-0 rounded-md accent-[#1a1f6e]" />
          <p className="text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
            I have read and agree to WeLinc Logistics' <span className="font-medium text-[#1a1f6e]">Booking Policy</span> and <span className="font-medium text-[#1a1f6e]">Terms and Conditions</span>.
          </p>
        </label>
        {termsInvalid && <p className="mt-2 text-xs text-red-600">You must agree to the Booking Policy and Terms and Conditions to continue.</p>}
      </Sec>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 6 — REVIEW
// ═══════════════════════════════════════════════════════════════════════
function S6({ d, catDef, costLines, grandTotal, truckTotal, isU2U }: {
  d: Draft; catDef: typeof DELIVERY_CATEGORY_DEFS[number] | undefined;
  costLines: CostLine[]; grandTotal: number; truckTotal: number; isU2U: boolean;
}) {
  const specials = [d.fragileItems && 'Fragile Items', d.heavyItems && 'Heavy Items', d.applianceHandling && 'Appliance Handling'].filter(Boolean) as string[];
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm leading-relaxed text-amber-800">
        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
        Please review all booking details before confirming. Once confirmed, this booking will be queued for processing.
      </div>

      <RC title="Customer" icon={<User size={16} />}>
        <Rw label="Name" value={`${d.firstName} ${d.lastName}`} />
        <Rw label="Contact" value={formatPhoneLocal(d.contact)} />
        <Rw label="Email" value={d.email || '—'} />
      </RC>
      <RC title="Service" icon={<Briefcase size={16} />}><Rw label="Service Type" value={d.serviceType} />{!isU2U && <Rw label="Truck Type" value={d.truckType} />}{truckTotal > 0 && d.selectedTruck?.name && <Rw label="Preferred Truck" value={d.selectedTruck.name} />}</RC>
      <RC title="Route & Schedule" icon={<Calendar size={16} />}>
        <Rw label="Category" value={catDef ? `${catDef.code} – ${catDef.label}` : '—'} />
        <Rw label="Date & Time" value={`${d.pickupDate}${d.pickupTime ? ` at ${d.pickupTime}` : ''}`} />
      </RC>
      <RC title="Pickup Address" icon={<MapPin size={16} />}>
        <Rw label="City" value={d.pickupCity} />
        <Rw label="Barangay" value={d.pickupBarangay} />
        {d.pickupAddress && <Rw label="Address" value={d.pickupAddress} />}
        {d.pickupZip && <Rw label="ZIP" value={d.pickupZip} />}
        {isU2U && d.pickupFloor && <Rw label="Floor" value={d.pickupFloor} />}
        {isU2U && d.pickupRoom && <Rw label="Room" value={d.pickupRoom} />}
        {d.pickupExact && <Rw label="Exact Address" value={d.pickupExact} />}
        {d.pickupLandmark && <Rw label="Landmark / Map Pin" value={d.pickupLandmark} />}
      </RC>
      <RC title="Delivery Address" icon={<MapPin size={16} />}>
        <Rw label="City" value={d.deliveryCity} />
        <Rw label="Barangay" value={d.deliveryBarangay} />
        {d.deliveryAddress && <Rw label="Address" value={d.deliveryAddress} />}
        {d.deliveryZip && <Rw label="ZIP" value={d.deliveryZip} />}
        {isU2U && d.deliveryFloor && <Rw label="Floor" value={d.deliveryFloor} />}
        {isU2U && d.deliveryRoom && <Rw label="Room" value={d.deliveryRoom} />}
        {d.deliveryExact && <Rw label="Drop-off Address" value={d.deliveryExact} />}
        {d.deliveryLandmark && <Rw label="Landmark / Map Pin" value={d.deliveryLandmark} />}
      </RC>
      {(d.estimatedItems || d.itemDetails) && (
        <RC title="Items" icon={<Package size={16} />}>
          {d.estimatedItems && <Rw label="Est. Items" value={`${d.estimatedItems} pcs`} />}
          {d.itemDetails && <Rw label="Details" value={d.itemDetails} />}
          {d.specialInstructions && <Rw label="Instructions" value={d.specialInstructions} />}
        </RC>
      )}
      {specials.length > 0 && (
        <RC title="Special Services" icon={<Package size={16} />}><div className="flex flex-wrap gap-2">{specials.map(s => <span key={s} className="rounded-lg border border-[#1a1f6e]/20 bg-[#f5f6fd] px-2.5 py-1 text-xs font-medium text-[#1a1f6e]">{s}</span>)}</div></RC>
      )}
      {d.permitRequired && (
        <RC title="Permit" icon={<ShieldCheck size={16} />}><Rw label="Barangay / Subdivision Permit" value="Yes — Required" /></RC>
      )}
      <RC title="Insurance & Payment" icon={<CreditCard size={16} />}>
        <Rw label="Insurance" value={d.hasInsurance ? 'Yes' : 'No'} />
        <Rw label="Payment Method" value={d.paymentMethod} />
      </RC>
      {costLines.length > 0 && (
        <RC title="Cost Summary" icon={<CreditCard size={16} />}>
          <CostSummary lines={costLines} total={fmt(grandTotal)} />
        </RC>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════════
type Fn = <K extends keyof Draft>(k: K, v: Draft[K]) => void;

function Sec({ icon, title, children }: { icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) {
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

function SI({ value, onChange, options, placeholder, disabled, className, onBlur, id, invalid }: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder?: string; disabled?: boolean; className?: string; onBlur?: () => void; id?: string; invalid?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-invalid={invalid} onBlur={onBlur} className={`h-11 text-base ${className ?? ''}`}><SelectValue placeholder={placeholder ?? 'Select or type...'} /></SelectTrigger>
      <SelectContent>{options.map(o => <SelectItem key={o} value={o} className="text-base">{o}</SelectItem>)}</SelectContent>
    </Select>
  );
}
