import { apiProblem } from '../../lib/api-shapes';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '../ui/Dialog';
import ModalHeader from '../ui/ModalHeader';
import { DatePicker } from '../ui/DatePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { loadCrew } from './crewData';
import {
  CREW_STATUS_OPTIONS,
  LICENSE_TYPES,
  portalAccountUrl,
  updateCrewMember,
  type CrewMember,
  type CrewRole,
  type CrewStatus,
} from '../../lib/api/crewService';

/**
 * Edit form for a driver's or helper's BMS details, in the One UI modal layout (navy header, section
 * cards, footer actions). Name, email and contact number come from the account in Auth: they are
 * shown read-only here, with a link to edit them in the portal (spec bms/0012).
 */

const REQUIRED = 'This field is required.';
const MOBILE = 'Enter a 10-digit Philippine mobile number starting with 9.';

/** The 10 digits after +63, from any of +639…, 639…, 09… or 9…. */
const subscriberDigits = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
};
const formatSubscriber = (value: string) => {
  const digits = subscriberDigits(value);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(' ');
};
const isValidMobile = (value: string) => /^9\d{9}$/.test(subscriberDigits(value));
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
const sameText = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

const controlClass = 'mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 placeholder:text-slate-400';
const invalidControlClass = '!border-red-500 focus:!border-red-500 focus:!ring-red-500/10';

type FormState = {
  status: CrewStatus;
  licenseNo: string;
  licenseType: string;
  licenseExpiry: string;
  emergencyName: string;
  emergencyContact: string;
};
type FieldKey = keyof FormState;

const toForm = (member: CrewMember): FormState => ({
  status: member.status,
  licenseNo: member.licenseNo,
  licenseType: member.licenseType || 'Professional',
  licenseExpiry: member.licenseExpiry,
  emergencyName: member.emergencyName,
  emergencyContact: member.emergencyContact,
});

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
        <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />
        {title}
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/**
 * The profile card: the account's own details, which only the portal edits, followed by the
 * BMS work status passed in as children.
 */
function ProfileSection({ member, children }: { member: CrewMember; children: ReactNode }) {
  const formatted = member.contact.replace(/^\+63(\d{3})(\d{3})(\d{4})$/, '+63 $1 $2 $3');
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
          <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />
          Profile
        </h3>
        <a href={portalAccountUrl(member.userId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1a1f6e] underline-offset-4 hover:underline">
          Edit in portal <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><dt className="text-sm font-medium text-slate-700">Full name</dt><dd className="mt-1 text-base text-slate-900">{member.fullName || '-'}</dd></div>
        <div className="min-w-0"><dt className="text-sm font-medium text-slate-700">Email</dt><dd className="mt-1 truncate text-base text-slate-900">{member.email || '-'}</dd></div>
        <div><dt className="text-sm font-medium text-slate-700">Contact number</dt><dd className="mt-1 text-base tabular-nums text-slate-900">{formatted || '-'}</dd></div>
      </dl>
      <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, error, children, wide = false }: { label: string; error?: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-sm font-medium text-slate-700">{label}<span className="ml-1 text-red-600">*</span></span>
      {children}
      {error && <span className="mt-1.5 block text-sm font-medium text-red-600">{error}</span>}
    </div>
  );
}

function PhoneField({ label, value, error, onChange, onBlur }: { label: string; value: string; error?: string; onChange: (value: string) => void; onBlur: () => void }) {
  return (
    <Field label={label} error={error}>
      <div className={`mt-1.5 flex h-11 overflow-hidden rounded-lg border bg-white transition focus-within:ring-2 ${error ? '!border-red-500 focus-within:!ring-red-500/10' : 'border-slate-300 focus-within:border-[#1a1f6e] focus-within:ring-[#1a1f6e]/20'}`}>
        <span aria-hidden="true" className="flex shrink-0 items-center border-r border-slate-200 px-3 text-base text-slate-900">+63</span>
        <input
          type="tel"
          inputMode="numeric"
          aria-label={`${label}, after +63`}
          aria-invalid={Boolean(error)}
          value={formatSubscriber(value)}
          placeholder="912 345 6789"
          onBlur={onBlur}
          onChange={event => {
            const digits = subscriberDigits(event.target.value);
            onChange(digits ? `+63${digits}` : '');
          }}
          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-base tabular-nums text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
    </Field>
  );
}

function ChoiceField({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label} className="mt-1.5 h-11 rounded-lg border-slate-300 px-3 text-base text-slate-900 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-slate-200 p-1 shadow-[0_14px_36px_rgba(15,23,42,0.16)]">
          {options.map(option => (
            <SelectItem key={option} value={option} className="my-0.5 rounded-lg py-2.5 text-sm font-medium hover:bg-[#d4a72c] hover:text-black focus:bg-[#d4a72c] focus:text-black data-[highlighted]:bg-[#d4a72c] data-[highlighted]:text-black">{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export default function CrewEditDialog({ target, onClose, onSaved }: {
  /** The driver or helper to edit; null keeps the dialog closed. Crew are never added here. */
  target: { role: CrewRole; id: string } | null;
  onClose: () => void;
  onSaved: (member: CrewMember) => void;
}) {
  const [member, setMember] = useState<CrewMember | null>(null);
  const [drivers, setDrivers] = useState<CrewMember[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [touched, setTouched] = useState<Set<FieldKey>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDriver = target?.role === 'DRIVER';
  const noun = isDriver ? 'driver' : 'helper';

  // Load the full record (emergency contact and license fields included) each time the dialog opens.
  // The whole list is kept so a driver's license number is checked for duplicates.
  useEffect(() => {
    if (!target) return;
    let active = true;
    setMember(null);
    setForm(null);
    setTouched(new Set());
    setLoadError(false);
    loadCrew(target.role)
      .then(list => {
        if (!active) return;
        const found = list.find(item => item.id === target.id);
        if (!found) { setLoadError(true); return; }
        setMember(found);
        setForm(toForm(found));
        setDrivers(target.role === 'DRIVER' ? list : []);
      })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [target]);

  const fields: FieldKey[] = isDriver
    ? ['licenseNo', 'licenseExpiry', 'emergencyName', 'emergencyContact']
    : ['emergencyName', 'emergencyContact'];

  const fieldError = (key: FieldKey): string => {
    if (!form) return '';
    const value = String(form[key] ?? '').trim();
    switch (key) {
      case 'emergencyContact':
        if (!subscriberDigits(value)) return REQUIRED;
        return isValidMobile(value) ? '' : MOBILE;
      case 'licenseExpiry':
        if (!value) return REQUIRED;
        return isDate(value) ? '' : 'Enter a valid date.';
      case 'licenseNo': {
        if (!value) return REQUIRED;
        if (value.length > 50) return 'Use 50 characters or fewer.';
        const other = drivers.find(driver => driver.id !== member?.id && sameText(driver.licenseNo, value));
        return other ? `This license number is already used by ${other.fullName}.` : '';
      }
      case 'emergencyName':
        if (!value) return REQUIRED;
        return value.length > 160 ? 'Use 160 characters or fewer.' : '';
      default:
        return '';
    }
  };
  const errorFor = (key: FieldKey) => (touched.has(key) ? fieldError(key) : '');
  const touch = (key: FieldKey) => setTouched(current => (current.has(key) ? current : new Set(current).add(key)));
  const set = <K extends FieldKey>(key: K, value: FormState[K]) => setForm(current => (current ? { ...current, [key]: value } : current));

  const close = () => { if (!saving) onClose(); };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!target || !form || saving) return;
    setTouched(new Set(fields));
    if (fields.some(key => fieldError(key))) return;
    setSaving(true);
    try {
      const input = {
        status: form.status,
        licenseNo: form.licenseNo.trim(),
        licenseType: form.licenseType,
        licenseExpiry: form.licenseExpiry,
        emergencyName: form.emergencyName.trim(),
        emergencyContact: form.emergencyContact,
      };
      const saved = await updateCrewMember(target.role, target.id, input);
      toast.success(`${isDriver ? 'Driver' : 'Helper'} updated`, { description: `${saved.fullName}'s team details were saved.` });
      // The service reads dates as UTC days; hand back the Manila days that were actually saved.
      onSaved({ ...saved, licenseExpiry: isDriver ? form.licenseExpiry : saved.licenseExpiry });
      onClose();
    } catch (error: unknown) {
      toast.error(apiProblem(error).message || `Unable to save the ${noun}.`);
    } finally {
      setSaving(false);
    }
  }

  const text = (key: FieldKey, label: string, maxLength: number, placeholder: string, wide = false) => (
    <Field label={label} error={errorFor(key)} wide={wide}>
      <input
        aria-label={label}
        aria-invalid={Boolean(errorFor(key))}
        maxLength={maxLength}
        placeholder={placeholder}
        value={form ? String(form[key]) : ''}
        onChange={event => set(key, event.target.value as never)}
        onBlur={() => touch(key)}
        className={`${controlClass} ${errorFor(key) ? invalidControlClass : ''}`}
      />
    </Field>
  );

  const date = (key: 'licenseExpiry', label: string) => (
    <Field label={label} error={errorFor(key)}>
      <DatePicker
        value={form?.[key] ?? ''}
        onChange={value => { set(key, value); touch(key); }}
        onBlur={() => touch(key)}
        invalid={Boolean(errorFor(key))}
        popover
        className="mt-1.5 [&>button]:h-11 [&>button]:w-full [&>button]:rounded-lg"
      />
    </Field>
  );

  return (
    <Dialog open={!!target} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent hideCloseButton aria-describedby={undefined} className="!flex !flex-col w-[calc(100%-2rem)] max-w-[640px] max-h-[calc(100dvh-2rem)] min-h-0 overflow-hidden rounded-2xl border-0 bg-white p-0 gap-0 shadow-xl">
        <ModalHeader title={`Edit ${noun}`} subtitle={member?.fullName || undefined} closeLabel={`Close edit ${noun}`} closeDisabled={saving} onClose={close} />

        <form noValidate onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f1f4fa] p-4">
            {loadError ? (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200/70 bg-white px-5 text-center text-sm text-slate-600">
                This {noun} could not be loaded. Close this window and try again.
              </div>
            ) : !form || !member ? (
              <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading {noun} details...
              </div>
            ) : <>
              <ProfileSection member={member}>
                <ChoiceField label="Status" value={form.status} options={CREW_STATUS_OPTIONS} onChange={value => set('status', value as CrewStatus)} />
              </ProfileSection>

              {isDriver && (
                <FormSection title="License">
                  {text('licenseNo', 'License number', 50, 'e.g. N01-23-456789')}
                  <ChoiceField label="License type" value={form.licenseType} options={LICENSE_TYPES} onChange={value => set('licenseType', value)} />
                  {date('licenseExpiry', 'License expiry')}
                </FormSection>
              )}

              <FormSection title="Emergency contact">
                {text('emergencyName', 'Contact name', 160, 'Enter contact name')}
                <PhoneField label="Contact number" value={form.emergencyContact} error={errorFor('emergencyContact')} onChange={value => set('emergencyContact', value)} onBlur={() => touch('emergencyContact')} />
              </FormSection>
            </>}
          </div>

          <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              disabled={saving}
              onClick={close}
              className="inline-flex h-10 w-fit items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form}
              className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg bg-[#030848] px-5 text-sm font-semibold text-white hover:bg-[#141a6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b800] disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
