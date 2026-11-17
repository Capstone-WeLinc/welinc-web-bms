import { apiProblem } from '../../lib/api-shapes';
import ModalHeader from '../../components/ui/ModalHeader';
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/pageheader/Pageheader";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  Building2,
  Home,
  Layers3,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import DeleteConfirmModal from "../../components/shared/DeleteConfirmModal";
import { toast } from "sonner";
import { api } from "../../lib/api";

type Kind = "primary" | "additional" | "material";
type Item = {
  id: string;
  name: string;
  description?: string | null;
  duration?: string | null;
  price?: number;
  isActive?: boolean;
  status?: string | null;
};
const blank = { name: "", description: "", duration: "", price: "" };
type RequiredField = "name" | "description" | "duration" | "price";
const controlClass = "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-[#1a1f6e] focus:ring-2 focus:ring-[#1a1f6e]/20 placeholder:text-slate-400";
const invalidControlClass = "!border-red-500 focus:!border-red-500 focus:!ring-red-500/10";
const peso = (value: number) =>
  `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function serviceIcon(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized === "corporate delivery") return BriefcaseBusiness;
  if (normalized === "lipat bahay") return Home;
  if (normalized === "office pull out") return Building2;
  if (normalized === "unit to unit transfer") return ArrowLeftRight;
  return Package;
}

function activeValue(item: Item): boolean | undefined {
  if (typeof item.isActive === "boolean") return item.isActive;
  if (typeof item.status === "string") {
    const status = item.status.trim().toLowerCase();
    if (status === "active") return true;
    if (status === "inactive") return false;
  }
  return undefined;
}

export default function ServicesOffered() {
  const [tab, setTab] = useState<Kind>("primary");
  const [primaryServices, setPrimaryServices] = useState<Item[]>([]);
  const [services, setServices] = useState<Item[]>([]);
  const [materials, setMaterials] = useState<Item[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(blank);
  const [touched, setTouched] = useState<Set<RequiredField>>(new Set());
  const [saving, setSaving] = useState(false);
  const endpoint = tab === "primary" ? "booking-services" : tab === "additional" ? "services-offered" : "protective-materials";

  const load = async () => {
    try {
      const [primary, a, b] = await Promise.all([
        api.get<Item[]>("/bms/config/booking-services"),
        api.get<Item[]>("/bms/config/services-offered"),
        api.get<Item[]>("/bms/config/protective-materials"),
      ]);
      setPrimaryServices(primary.data ?? []);
      setServices(a.data ?? []);
      setMaterials(b.data ?? []);
    } catch {
      toast.error("Unable to load services and materials");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const rows = useMemo(
    () =>
      (tab === "primary" ? primaryServices : tab === "additional" ? services : materials).filter((item) =>
        `${item.name} ${item.description ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [tab, primaryServices, services, materials, search],
  );
  const showForm = (item?: Item) => {
    setEditing(item ?? null);
    setForm(
      item
        ? {
            name: item.name,
            description: item.description ?? "",
            duration: item.duration ?? "",
            price: String(item.price ?? ""),
          }
        : blank,
    );
    setTouched(new Set());
    setOpen(true);
  };
  const touch = (field: RequiredField) =>
    setTouched((current) => new Set(current).add(field));
  const nameInvalid = touched.has("name") && !form.name.trim();
  const descriptionInvalid = touched.has("description") && !form.description.trim();
  const durationInvalid = touched.has("duration") && !form.duration.trim();
  const priceError = touched.has("price")
    ? form.price.trim() === ""
      ? "This field is required."
      : !Number.isFinite(Number(form.price)) || Number(form.price) < 0
        ? "Enter a valid price."
        : undefined
    : undefined;
  const priceInvalid = Boolean(priceError);
  const save = async () => {
    const requiredFields: RequiredField[] =
      tab === "additional"
        ? ["name", "description", "duration", "price"]
        : tab === "material"
          ? ["name", "price"]
          : ["name", "description"];
    setTouched(new Set(requiredFields));
    if (!form.name.trim()) return;
    if (tab !== "material" && !form.description.trim()) return;
    if (tab === "additional" && !form.duration.trim()) return;
    const price = Number(form.price);
    if (tab !== "primary" && (form.price.trim() === "" || !Number.isFinite(price) || price < 0)) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        ...(tab !== "primary" && { price }),
        ...(tab === "additional" && { duration: form.duration.trim() }),
      };
      if (editing)
        await api.patch(`/bms/config/${endpoint}/${editing.id}`, payload);
      else await api.post(`/bms/config/${endpoint}`, payload);
      toast.success(
        `${tab === "material" ? "Material" : "Service"} ${editing ? "updated" : "added"} successfully`,
      );
      setOpen(false);
      await load();
    } catch (error: unknown) {
      toast.error(apiProblem(error).message || "Unable to save item");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      {
        const response = await api.get<Array<{
          service?: string;
          serviceType?: string;
          servicesAvailed?: string[];
          additionalServicesAvailed?: Array<{ name?: string }> | string[];
          protectiveMaterials?: string[];
          additionalMaterials?: string[] | string | null;
        }>>("/booking");
        const targetName = deleteTarget.name.trim().toLowerCase();
        const containsTarget = (values?: string[] | string | Array<{ name?: string }> | null) => {
          const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(/[;,|]/) : [];
          return list.some((value) => {
            const name = typeof value === "string" ? value : value?.name;
            return name?.trim().toLowerCase() === targetName;
          });
        };
        const isInUse = (response.data ?? []).some((booking) => tab === "primary"
          ? [booking.service, booking.serviceType].some((name) => name?.trim().toLowerCase() === targetName)
          : tab === "additional"
            ? containsTarget(booking.servicesAvailed) || containsTarget(booking.additionalServicesAvailed)
            : containsTarget(booking.protectiveMaterials) || containsTarget(booking.additionalMaterials));
        if (isInUse) {
          toast.error(`This ${tab === "material" ? "material" : "service"} is used by existing bookings and cannot be deleted.`);
          setDeleteTarget(null);
          return;
        }
      }
      await api.delete(`/bms/config/${endpoint}/${deleteTarget.id}`);
      toast.success("Item removed");
      setDeleteTarget(null);
      await load();
    } catch (error: unknown) {
      toast.error(apiProblem(error).message || "Unable to verify whether this item is used. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers3}
        title="SERVICES OFFERED"
        subtitle={<>Manage booking add-ons and <span className="font-medium text-[#d4a72c]">protective materials in one place.</span></>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<button
          onClick={() => showForm()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1a1f6e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#141a6b] sm:w-auto"
        >
          <Plus size={16} />
          ADD {tab === "material" ? "MATERIAL" : "SERVICE"}
        </button>}
      />
      <section className="space-y-6">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
          <Tab
            active={tab === "primary"}
            onClick={() => setTab("primary")}
            icon={<Package size={17} />}
            label="Services"
          />
          <Tab
            active={tab === "additional"}
            onClick={() => setTab("additional")}
            icon={<Layers3 size={17} />}
            label="Additional Services"
          />
          <Tab
            active={tab === "material"}
            onClick={() => setTab("material")}
            icon={<Package size={17} />}
            label="Protective Materials"
          />
        </div>
        <label className="relative block w-full lg:max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab === "material" ? "materials" : "services"}...`}
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#0a0f2e]/20"
          />
        </label>
      </section>
      <section className="space-y-4">
        {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading services">
              {Array.from({ length: 6 }, (_, index) => <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex gap-3"><div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" /><div className="min-w-0 flex-1 space-y-2 pt-1"><div className="h-4 w-2/3 rounded bg-slate-100" /><div className="h-3 w-full rounded bg-slate-100" /><div className="h-3 w-4/5 rounded bg-slate-100" /></div></div>
              </div>)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-center">
              <Search size={22} className="mb-2 text-slate-400" aria-hidden="true" />
              <p className="text-sm text-slate-600">{search.trim() ? `No ${tab === "material" ? "protective materials" : tab === "additional" ? "additional services" : "services"} match your search.` : `No ${tab === "material" ? "protective materials" : tab === "additional" ? "additional services" : "services"} found.`}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((item) => {
                const Icon = serviceIcon(item.name);
                const active = activeValue(item);
                return <article key={item.id} tabIndex={0} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-[#1a1f6e] hover:shadow-lg hover:shadow-[#1a1f6e]/15 focus-visible:-translate-y-0.5 focus-visible:border-[#1a1f6e] focus-visible:shadow-lg focus-visible:shadow-[#1a1f6e]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/20">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef0fa] text-[#1a1f6e] transition-colors group-hover:bg-[#1a1f6e] group-hover:text-[#e8b800] group-focus-visible:bg-[#1a1f6e] group-focus-visible:text-[#e8b800]">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="text-base font-medium text-slate-900">{item.name}</h3>
                        {active === false && <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-600">Inactive</span>}
                      </div>
                      {tab !== "material" && <p className="mt-0.5 text-sm text-slate-600">{item.description || "No description provided."}</p>}
                      {tab === "additional" && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item.duration || "Duration not set"}</span><span className="text-sm font-medium text-[#1a1f6e]">{peso(item.price ?? 0)}</span></div>}
                      {tab === "material" && <p className="mt-2 text-sm font-medium text-[#1a1f6e]">{peso(item.price ?? 0)}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" aria-label={`Edit ${item.name}`} onClick={() => showForm(item)} className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/20"><Pencil size={16} aria-hidden="true" /></button>
                      <button type="button" aria-label={`Delete ${item.name}`} onClick={() => setDeleteTarget(item)} className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"><Trash2 size={16} aria-hidden="true" /></button>
                    </div>
                  </div>
                </article>;
              })}
            </div>
          )
        }
      </section>
      {open && (() => {
        const noun = tab === "primary" ? "service" : tab === "additional" ? "additional service" : "protective material";
        const isMaterial = tab === "material";
        return (
        <Modal
          onClose={() => setOpen(false)}
          icon={editing ? Pencil : undefined}
          title={`${editing ? "Edit" : "Add"} ${noun}`}
          subtitle={editing?.name}
          closeDisabled={saving}
        >
          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => { event.preventDefault(); if (!saving) void save(); }}
          >
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#f1f4fa] p-4">
              <FormSection title={isMaterial ? "Material details" : "Service details"}>
                <Field label="Name" required error={nameInvalid ? "This field is required." : undefined}>
                  <input
                    className={`${controlClass} h-11 ${nameInvalid ? invalidControlClass : ""}`}
                    required
                    aria-invalid={nameInvalid}
                    maxLength={150}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    onBlur={() => touch("name")}
                    placeholder={isMaterial ? "e.g. Bubble wrap" : "Enter service name"}
                  />
                </Field>
                {!isMaterial && (
                  <Field label="Description" required error={descriptionInvalid ? "This field is required." : undefined} characterCount={`${form.description.length} / 300 characters`}>
                    <textarea
                      className={`${controlClass} min-h-[98px] py-3 ${descriptionInvalid ? invalidControlClass : ""}`}
                      required
                      aria-invalid={descriptionInvalid}
                      maxLength={300}
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      onBlur={() => touch("description")}
                      placeholder="Describe what this service includes"
                    />
                  </Field>
                )}
              </FormSection>

              {tab !== "primary" && (
                <FormSection title={tab === "additional" ? "Pricing & duration" : "Pricing"}>
                  <div className={`grid gap-4 ${tab === "additional" ? "sm:grid-cols-2" : ""}`}>
                    {tab === "additional" && (
                      <Field label="Duration" required error={durationInvalid ? "This field is required." : undefined}>
                        <input
                          className={`${controlClass} h-11 ${durationInvalid ? invalidControlClass : ""}`}
                          required
                          aria-invalid={durationInvalid}
                          placeholder="e.g. 2hr"
                          value={form.duration}
                          onChange={(e) => setForm({ ...form, duration: e.target.value })}
                          onBlur={() => touch("duration")}
                        />
                      </Field>
                    )}
                    <Field label="Price" required error={priceError}>
                      <div className={`mt-1.5 flex h-11 overflow-hidden rounded-lg border bg-white transition focus-within:ring-2 ${priceInvalid ? "!border-red-500 focus-within:!border-red-500 focus-within:!ring-red-500/10" : "border-slate-300 focus-within:border-[#1a1f6e] focus-within:ring-[#1a1f6e]/20"}`}>
                        <span aria-hidden="true" className="flex shrink-0 items-center border-r border-slate-200 px-3 text-base text-slate-900">₱</span>
                        <input
                          className="min-w-0 flex-1 border-0 bg-transparent px-3 text-base tabular-nums text-slate-900 outline-none placeholder:text-slate-400"
                          type="number"
                          required
                          aria-invalid={priceInvalid}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          onBlur={() => touch("price")}
                        />
                      </div>
                    </Field>
                  </div>
                </FormSection>
              )}
            </div>

            <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-fit items-center justify-center whitespace-nowrap rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 w-fit items-center whitespace-nowrap rounded-lg bg-[#030848] px-5 text-sm font-semibold text-white hover:bg-[#141a6b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8b800] disabled:opacity-50"
              >
                {saving ? "Saving..." : editing ? "Save changes" : `Add ${isMaterial ? "material" : "service"}`}
              </button>
            </footer>
          </form>
        </Modal>
        );
      })()}
      <DeleteConfirmModal
        open={!!deleteTarget}
        title={`Delete ${tab === "primary" ? "Service" : tab === "additional" ? "Additional Service" : "Protective Material"}`}
        itemName={deleteTarget?.name}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
      />
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${active ? "bg-[#1a1f6e] text-white shadow-sm" : "text-slate-600"}`}
    >
      {icon}
      {label}
    </button>
  );
}
function Modal({
  onClose,
  icon,
  title,
  subtitle,
  closeDisabled = false,
  children,
}: {
  onClose: () => void;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="services-offered-modal-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <ModalHeader plain titleId="services-offered-modal-title" icon={icon} title={title} subtitle={subtitle} onClose={onClose} closeDisabled={closeDisabled} closeLabel={`Close ${title.toLowerCase()}`} />
        {children}
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1a1f6e]">
        <span aria-hidden="true" className="h-4 w-[3px] rounded-full bg-[#e8b800]" />
        {title}
      </h3>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}
function Field({
  label,
  required = false,
  children,
  error,
  characterCount,
}: {
  label: string;
  required?: boolean;
  children: React.ReactElement;
  error?: string;
  characterCount?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}{required && <span className="ml-1 text-red-600">*</span>}</span>
      {children}
      {(error || characterCount) && (
        <span className={`mt-1.5 flex items-center gap-3 text-sm ${error ? "justify-between" : "justify-end"}`}>
          {error && <span className="font-medium text-red-600">{error}</span>}
          {characterCount && <span className="ml-auto text-right text-slate-500">{characterCount}</span>}
        </span>
      )}
    </label>
  );
}
