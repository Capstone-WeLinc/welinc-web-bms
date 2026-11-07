import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Edit2, KeyRound, Plus, Trash2, Unlock, UserRoundCheck, Users } from "lucide-react";
import PageHeader from "../../components/pageheader/Pageheader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select";
import {
  ActionButton,
  ActionMenu,
  ConfirmationModal,
  DataTable,
  Pagination,
  SearchInput,
  StatusBadge,
  ToastNotification,
} from "../../components/ui";
import {
  createUser,
  getManagedUsers,
  resetUserPassword,
  unlockUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  type UserCreateInput,
  type UserRecord,
  type UserRole,
} from "../../lib/api/userService";
import {
  CREW_STATUS_OPTIONS,
  LICENSE_TYPES,
  createCrewMember,
  deleteCrewMember,
  getCrew,
  updateCrewMember,
  type CrewInput,
  type CrewMember,
  type CrewRole,
  type CrewStatus,
} from "../../lib/api/crewService";

type ToastState = {
  type: "success" | "error" | "warning" | "info";
  message: string;
};

type ManagedRole = UserRole | CrewRole;

/** One table row: a sign-in account, or a driver/helper crew record. */
type ManagedRow =
  | { key: string; kind: "account"; name: string; role: ManagedRole; user: UserRecord }
  | { key: string; kind: "crew"; name: string; role: CrewRole; crew: CrewMember };

type UserForm = {
  name: string;
  email: string;
  role: ManagedRole | "";
  isActive: boolean;
  // Crew-only fields (Driver and Helper)
  contact: string;
  status: CrewStatus;
  joinDate: string;
  licenseNo: string;
  licenseType: string;
  licenseExpiry: string;
  emergencyName: string;
  emergencyContact: string;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): UserForm => ({
  name: "",
  email: "",
  role: "",
  isActive: true,
  contact: "",
  status: "Available",
  joinDate: todayIso(),
  licenseNo: "",
  licenseType: "Professional",
  licenseExpiry: "",
  emergencyName: "",
  emergencyContact: "",
});

const ACCOUNT_ROLES: UserRole[] = ["ADMIN", "CUSTOMER_SUPPORT", "OPERATIONS"];
const CREW_ROLES: CrewRole[] = ["DRIVER", "HELPER"];

const ROLE_LABELS: Record<ManagedRole, string> = {
  ADMIN: "Administrator",
  CUSTOMER_SUPPORT: "Customer Service",
  OPERATIONS: "Operations",
  DRIVER: "Driver",
  HELPER: "Helper",
};

const isCrewRole = (role: ManagedRole | ""): role is CrewRole => role === "DRIVER" || role === "HELPER";

const normalizeIdentity = (value?: string | null) => (value ?? "").trim().toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The 10 digits after +63, from any of +639…, 639…, 09… or 9…. */
const subscriberDigits = (value: string) => {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("63")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
};
const formatSubscriber = (value: string) => {
  const digits = subscriberDigits(value);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(" ");
};
const isValidMobile = (value: string) => /^9\d{9}$/.test(subscriberDigits(value));

const baseInputClass =
  "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-[var(--color-text-primary)] outline-none disabled:cursor-not-allowed disabled:opacity-70";
/** Red border and ring while the field has an error, like the old Add Driver / Add Helper forms. */
const inputClass = (error = "") =>
  `${baseInputClass} ${error
    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
    : "border-[var(--color-border)] focus:border-[var(--color-brand-primary)]"}`;
const labelClass = "grid content-start gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]";

type FieldKey = "role" | "name" | "email" | "contact" | "joinDate" | "licenseNo" | "licenseExpiry" | "emergencyName" | "emergencyContact";

function Field({ label, children, error = "", required = true, errorId }: { label: string; children: ReactNode; error?: string; required?: boolean; errorId?: string }) {
  return (
    <label className={labelClass}>
      <span>{label}{required ? <span className="text-red-600"> *</span> : null}</span>
      {children}
      {error ? <span id={errorId} className="text-sm font-normal text-red-600">{error}</span> : null}
    </label>
  );
}

/** Searchable dropdown styled like the form's text inputs. */
function FormSelect({ value, onChange, options, placeholder, disabled, onBlur, error = "", describedBy }: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  disabled?: boolean;
  onBlur?: () => void;
  error?: string;
  describedBy?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`${inputClass(error)} h-auto text-sm font-normal shadow-none focus:ring-0 data-[placeholder]:text-[var(--color-text-secondary)] dark:border-[var(--color-border)] dark:bg-[var(--color-input-bg)] dark:text-[var(--color-text-primary)]`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function PhoneInput({ value, onChange, onBlur, label, error = "", errorId }: { value: string; onChange: (value: string) => void; onBlur: () => void; label: string; error?: string; errorId?: string }) {
  return (
    <div className={`flex overflow-hidden rounded-lg border bg-[var(--color-input-bg)] ${error ? "border-red-500 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20" : "border-[var(--color-border)] focus-within:border-[var(--color-brand-primary)]"}`}>
      <span className="flex shrink-0 items-center border-r border-[var(--color-border)] px-3 text-[var(--color-text-secondary)]">+63</span>
      <input
        type="tel"
        inputMode="numeric"
        aria-label={`${label}, after +63`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        value={formatSubscriber(value)}
        placeholder="912 345 6789"
        onBlur={onBlur}
        onChange={(event) => {
          const digits = subscriberDigits(event.target.value);
          onChange(digits ? `+63${digits}` : "");
        }}
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[var(--color-text-primary)] outline-none"
      />
    </div>
  );
}

function CrewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4 border-t border-[#dde3eb] pt-4 sm:grid-cols-2">
      <legend className="float-left mb-1 w-full text-xs font-bold uppercase tracking-wide text-[#141827] sm:col-span-2">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [form, setForm] = useState<UserForm>(emptyForm);
  // Errors show once a field has been left, or after Save is pressed.
  const [touched, setTouched] = useState<Set<FieldKey>>(new Set());
  const [editingRow, setEditingRow] = useState<ManagedRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<UserRecord | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null);
  const [deleteCrewTarget, setDeleteCrewTarget] = useState<CrewMember | null>(null);
  const [editConfirmationOpen, setEditConfirmationOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const editingUser = editingRow?.kind === "account" ? editingRow.user : null;
  const editingCrew = editingRow?.kind === "crew" ? editingRow.crew : null;
  const crewForm = isCrewRole(form.role);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [accounts, drivers, helpers] = await Promise.allSettled([getManagedUsers(), getCrew("DRIVER"), getCrew("HELPER")]);
    if (accounts.status === "fulfilled") setUsers(accounts.value);
    if (drivers.status === "fulfilled" && helpers.status === "fulfilled") setCrew([...drivers.value, ...helpers.value]);
    if (showLoading) {
      if (accounts.status === "rejected") setToast({ type: "error", message: "Unable to load users." });
      else if (drivers.status === "rejected" || helpers.status === "rejected") setToast({ type: "warning", message: "Drivers and helpers could not be loaded." });
      else setToast((current) => (current?.type === "error" ? null : current));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);

    const refreshUsers = () => void loadData();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshUsers();
    };
    const refreshInterval = window.setInterval(refreshUsers, 10_000);

    window.addEventListener("focus", refreshUsers);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshUsers);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadData]);

  useEffect(() => {
    const closeMenu = () => setOpenMenuId(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const rows = useMemo<ManagedRow[]>(() => [
    ...users.map((user) => ({ key: `account-${user.id}`, kind: "account" as const, name: user.name, role: user.role, user })),
    ...crew.map((member) => ({ key: `${member.role.toLowerCase()}-${member.id}`, kind: "crew" as const, name: member.fullName, role: member.role, crew: member })),
  ], [users, crew]);

  const filteredRows = useMemo(() => {
    const query = normalizeIdentity(search);
    return rows
      .filter((row) => {
        const values = row.kind === "account"
          ? [row.name, row.user.email, ROLE_LABELS[row.role], row.user.isLocked ? "Locked" : row.user.status]
          : [row.name, row.crew.empId, row.crew.email, row.crew.contact, ROLE_LABELS[row.role], row.crew.status];
        return values.join(" ").toLowerCase().includes(query);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [search, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);

  const setField = <K extends keyof UserForm>(key: K, value: UserForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const touch = (key: FieldKey) =>
    setTouched((current) => (current.has(key) ? current : new Set(current).add(key)));

  const openCreate = () => {
    setEditingRow(null);
    setForm(emptyForm());
    setTouched(new Set());
    setFormOpen(true);
  };

  const openEdit = (row: ManagedRow) => {
    setOpenMenuId(null);
    setEditingRow(row);
    setTouched(new Set());
    if (row.kind === "account") {
      setForm({ ...emptyForm(), name: row.user.name, email: row.user.email, role: row.user.role, isActive: row.user.status === "Active" });
    } else {
      const member = row.crew;
      setForm({
        ...emptyForm(),
        name: member.fullName,
        email: member.email,
        role: member.role,
        contact: member.contact,
        status: member.status,
        joinDate: member.joinDate,
        licenseNo: member.licenseNo,
        licenseType: member.licenseType || "Professional",
        licenseExpiry: member.licenseExpiry,
        emergencyName: member.emergencyName,
        emergencyContact: member.emergencyContact,
      });
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    if (processing) return;
    setFormOpen(false);
    setEditingRow(null);
    setForm(emptyForm());
    setTouched(new Set());
  };

  const errorMessage = (error: unknown, fallback: string) => {
    const responseMessage =
      typeof error === "object" && error !== null && "response" in error
        ? (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message
        : undefined;
    return Array.isArray(responseMessage) ? responseMessage.join(", ") : responseMessage ?? fallback;
  };

  const finishSave = () => {
    setFormOpen(false);
    setEditingRow(null);
    setForm(emptyForm());
    setTouched(new Set());
  };

  const persistUser = async (name: string, email: string, role: UserRole) => {
    setProcessing(true);
    try {
      if (editingUser) {
        const updated = await updateUser(editingUser.id, { name, email });
        const withRole = editingUser.role === role ? updated : await updateUserRole(editingUser.id, role);
        setUsers((current) =>
          current.map((user) => (user.id === editingUser.id ? { ...user, ...updated, role: withRole.role } : user)),
        );
        setToast({ type: "success", message: "User updated successfully." });
      } else {
        const input: UserCreateInput = { name, email, role, isActive: form.isActive };
        const created = await createUser(input);
        setUsers((current) => [created, ...current]);
        await loadData();
        setToast(
          created.setupEmailSent
            ? { type: "success", message: `User created. An account-setup email with a one-time code was sent to ${email}.` }
            : { type: "warning", message: `User created, but the account-setup email was not sent to ${email}. Configure SMTP and create the account again to send a new code.` },
        );
      }
      finishSave();
    } catch (error) {
      console.error("Failed to save user", error);
      setToast({ type: "error", message: errorMessage(error, "Unable to save the user.") });
      setFormOpen(true);
    } finally {
      setProcessing(false);
    }
  };

  const crewInput = (): CrewInput => ({
    fullName: form.name.trim(),
    email: form.email.trim(),
    contact: form.contact,
    status: form.status,
    joinDate: form.joinDate,
    licenseNo: form.licenseNo.trim(),
    licenseType: form.licenseType,
    licenseExpiry: form.licenseExpiry,
    emergencyName: form.emergencyName.trim(),
    emergencyContact: form.emergencyContact,
  });

  const persistCrew = async (role: CrewRole) => {
    setProcessing(true);
    const label = ROLE_LABELS[role].toLowerCase();
    try {
      if (editingCrew) {
        const saved = await updateCrewMember(role, editingCrew.id, crewInput());
        setCrew((current) => current.map((member) => (member.role === role && member.id === saved.id ? saved : member)));
        setToast({ type: "success", message: `${ROLE_LABELS[role]} updated successfully.` });
      } else {
        const saved = await createCrewMember(role, crewInput());
        setCrew((current) => [saved, ...current]);
        setToast({ type: "success", message: `${saved.fullName} was added as a ${label}${saved.empId ? ` (${saved.empId})` : ""}. They can now be assigned to bookings.` });
      }
      finishSave();
    } catch (error) {
      console.error(`Failed to save ${label}`, error);
      setToast({ type: "error", message: errorMessage(error, `Unable to save the ${label}.`) });
      setFormOpen(true);
    } finally {
      setProcessing(false);
    }
  };

  const REQUIRED = "This field is required.";
  const MOBILE = "Enter a 10-digit Philippine mobile number starting with 9.";
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

  /** The fields the current role asks for. */
  const fieldsFor = (role: ManagedRole | ""): FieldKey[] => {
    if (!isCrewRole(role)) return ["role", "name", "email"];
    const common: FieldKey[] = ["role", "name", "email", "contact", "joinDate", "emergencyName", "emergencyContact"];
    return role === "DRIVER" ? [...common, "licenseNo", "licenseExpiry"] : common;
  };

  /** The error for one field, or "" when it is fine. */
  const fieldError = (key: FieldKey): string => {
    const value = String(form[key] ?? "").trim();
    switch (key) {
      case "role":
        return form.role ? "" : REQUIRED;
      case "name":
        if (!value) return REQUIRED;
        if (value.length > 100) return "Use 100 characters or fewer.";
        if (!crewForm && users.some((user) => user.id !== editingUser?.id && normalizeIdentity(user.name) === normalizeIdentity(value))) {
          return "A user with this name already exists.";
        }
        return "";
      case "email":
        if (!value) return REQUIRED;
        if (!EMAIL_PATTERN.test(value)) return "The email address entered is invalid";
        if (value.length > 160) return "Use 160 characters or fewer.";
        if (!crewForm && users.some((user) => user.id !== editingUser?.id && normalizeIdentity(user.email) === normalizeIdentity(value))) {
          return "A user with this email already exists.";
        }
        return "";
      case "contact":
      case "emergencyContact":
        if (!subscriberDigits(value)) return REQUIRED;
        return isValidMobile(value) ? "" : MOBILE;
      case "joinDate":
      case "licenseExpiry":
        if (!value) return REQUIRED;
        return isDate(value) ? "" : "Enter a valid date.";
      case "licenseNo": {
        if (!value) return REQUIRED;
        if (value.length > 50) return "Use 50 characters or fewer.";
        const sameLicense = crew.find(
          (member) => member.role === "DRIVER" && member.id !== editingCrew?.id && normalizeIdentity(member.licenseNo) === normalizeIdentity(value),
        );
        return sameLicense ? `This license number is already used by ${sameLicense.fullName}.` : "";
      }
      case "emergencyName":
        if (!value) return REQUIRED;
        return value.length > 160 ? "Use 160 characters or fewer." : "";
    }
  };

  const errorFor = (key: FieldKey) => (touched.has(key) ? fieldError(key) : "");
  const errorId = (key: FieldKey) => `user-form-${key}-error`;
  const fieldProps = (key: FieldKey) => {
    const error = errorFor(key);
    return { error, errorId: errorId(key) };
  };
  const inputProps = (key: FieldKey) => {
    const error = errorFor(key);
    return {
      className: inputClass(error),
      onBlur: () => touch(key),
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? errorId(key) : undefined,
    };
  };

  const saveUser = (event: FormEvent) => {
    event.preventDefault();
    const keys = fieldsFor(form.role);
    setTouched(new Set(keys));
    if (keys.some((key) => fieldError(key))) return;
    if (editingRow) {
      setFormOpen(false);
      setEditConfirmationOpen(true);
      return;
    }
    if (isCrewRole(form.role)) void persistCrew(form.role);
    else if (form.role) void persistUser(form.name.trim(), form.email.trim(), form.role);
  };

  const confirmEdit = () => {
    if (!form.role) return;
    setEditConfirmationOpen(false);
    if (isCrewRole(form.role)) void persistCrew(form.role);
    else void persistUser(form.name.trim(), form.email.trim(), form.role);
  };

  const toggleStatus = async (user: UserRecord) => {
    const nextStatus = user.status === "Active" ? "Inactive" : "Active";
    try {
      const updated = await updateUserStatus(user.id, nextStatus);
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, ...updated } : item)));
      setToast({ type: "success", message: `User marked ${nextStatus.toLowerCase()}.` });
    } catch (error) {
      console.error("Failed to update user status", error);
      setToast({ type: "error", message: "Unable to update user status." });
    }
  };

  const confirmDeactivation = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    setDeactivateTarget(null);
    void toggleStatus(target);
  };

  const confirmUnlock = async () => {
    if (!unlockTarget) return;
    try {
      const updated = await unlockUser(unlockTarget.id);
      setUsers((current) => current.map((user) => (user.id === updated.id ? { ...user, ...updated } : user)));
      setToast({ type: "success", message: "User account unlocked." });
    } catch (error) {
      console.error("Failed to unlock user", error);
      setToast({ type: "error", message: "Unable to unlock the user." });
    } finally {
      setUnlockTarget(null);
    }
  };

  const confirmPasswordReset = async () => {
    if (!resetPasswordTarget) return;
    const target = resetPasswordTarget;
    try {
      const updated = await resetUserPassword(target.id);
      setUsers((current) => current.map((user) => (user.id === target.id ? { ...user, ...updated } : user)));
      setToast({ type: "success", message: `Password reset successfully for ${target.name}.` });
    } catch (error) {
      console.error("Failed to reset user password", error);
      setToast({ type: "error", message: "Unable to reset the user's password." });
    } finally {
      setResetPasswordTarget(null);
    }
  };

  const confirmCrewDelete = async () => {
    if (!deleteCrewTarget) return;
    const target = deleteCrewTarget;
    setDeleteCrewTarget(null);
    try {
      await deleteCrewMember(target.role, target.id);
      setCrew((current) => current.filter((member) => !(member.role === target.role && member.id === target.id)));
      setToast({ type: "success", message: `${target.fullName} was removed.` });
    } catch (error) {
      console.error("Failed to delete crew member", error);
      setToast({ type: "error", message: errorMessage(error, `Unable to remove ${target.fullName}.`) });
    }
  };

  const menuItems = (row: ManagedRow) => {
    if (row.kind === "crew") {
      return [
        { label: "Edit", icon: Edit2, onClick: () => openEdit(row) },
        { label: "Delete", icon: Trash2, onClick: () => { setOpenMenuId(null); setDeleteCrewTarget(row.crew); } },
      ];
    }
    const user = row.user;
    return [
      { label: "Edit", icon: Edit2, onClick: () => openEdit(row) },
      { label: "Reset Password", icon: KeyRound, onClick: () => { setOpenMenuId(null); setResetPasswordTarget(user); } },
      {
        label: user.status === "Active" ? "Deactivate" : "Activate",
        icon: UserRoundCheck,
        onClick: () => {
          setOpenMenuId(null);
          if (user.status === "Active") setDeactivateTarget(user);
          else void toggleStatus(user);
        },
      },
      ...(user.isLocked ? [{ label: "Unlock", icon: Unlock, onClick: () => { setOpenMenuId(null); setUnlockTarget(user); } }] : []),
    ];
  };

  // Accounts and crew are different records, so an edit can only switch roles within its own kind.
  const roleOptions: ManagedRole[] = editingCrew ? [editingCrew.role] : editingUser ? ACCOUNT_ROLES : [...ACCOUNT_ROLES, ...CREW_ROLES];
  const formTitle = editingRow ? `Edit ${editingCrew ? ROLE_LABELS[editingCrew.role] : "User"}` : form.role === "DRIVER" ? "Add Driver" : form.role === "HELPER" ? "Add Helper" : "Create User";
  const submitLabel = editingRow ? "Save Changes" : form.role === "DRIVER" ? "Add Driver" : form.role === "HELPER" ? "Add Helper" : "Create User";

  return (
    <div className="space-y-6">
      <div className="fixed right-6 top-6 z-[80] w-[340px] max-w-[calc(100vw-2rem)]">
        {toast && <ToastNotification type={toast.type} message={toast.message} />}
      </div>

      <PageHeader
        icon={Users}
        title="USER MANAGEMENT"
        subtitle="Manage system users, drivers, helpers, roles, and account access"
        spacing="standard"
        action={
          <ActionButton onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add User
          </ActionButton>
        }
      />

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            className="w-full sm:max-w-md"
            value={search}
            placeholder="Search users, drivers, helpers..."
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />        </div>

        <DataTable
          data={visibleRows}
          getRowKey={(row) => row.key}
          minWidth="760px"
          emptyMessage={loading ? "Loading users..." : "No users found."}
          columns={[
            {
              key: "user",
              header: "User",
              width: "30%",
              render: (row) => (
                <div>
                  <p className="font-semibold">{row.name}</p>
                  {(row.kind === "account" ? row.user.email : row.crew.email) ? (
                    <p className="text-xs text-[#70747c]">{row.kind === "account" ? row.user.email : row.crew.email}</p>
                  ) : null}
                </div>
              ),
            },
            { key: "role", header: "Role", width: "18%", render: (row) => ROLE_LABELS[row.role] },
            {
              key: "status",
              header: "Status",
              width: "18%",
              render: (row) => (
                <StatusBadge status={row.kind === "account" ? (row.user.isLocked ? "Locked" : row.user.status) : row.crew.status} />
              ),
            },
            {
              key: "updatedAt",
              header: "Last Updated",
              width: "24%",
              render: (row) => {
                const updatedAt = row.kind === "account" ? row.user.updatedAt : row.crew.updatedAt;
                return updatedAt ? new Date(updatedAt).toLocaleString() : "Not available";
              },
            },
            {
              key: "actions",
              header: "Actions",
              width: "10%",
              align: "center",
              render: (row) => (
                <ActionMenu
                  open={openMenuId === row.key}
                  onToggle={(event) => {
                    event.stopPropagation();
                    setOpenMenuId((current) => (current === row.key ? null : row.key));
                  }}
                  items={menuItems(row)}
                />
              ),
            },
          ]}
        />

        <Pagination
          page={activePage}
          totalPages={totalPages}
          totalItems={filteredRows.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
            className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-xl bg-white shadow-[0_24px_70px_rgba(15,23,42,0.28)] ${crewForm ? "max-w-2xl" : "max-w-lg"}`}
          >
            <div className="px-6 pt-6">
              <h2 id="user-form-title" className="text-lg font-extrabold uppercase tracking-wide text-[#141827]">
                {formTitle}
              </h2>
              <div className="mt-4 h-px bg-[#dde3eb]" />
            </div>
            <form id="user-management-form" className="flex min-h-0 flex-1 flex-col" onSubmit={saveUser} noValidate>
              <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-4">
                <div className={`grid gap-4 ${crewForm ? "sm:grid-cols-2" : ""}`}>
                  <Field label="Role" {...fieldProps("role")}>
                    <FormSelect
                      value={form.role}
                      disabled={Boolean(editingCrew)}
                      placeholder="Select or type a role"
                      onChange={(value) => { setField("role", value as ManagedRole); touch("role"); }}
                      onBlur={() => touch("role")}
                      error={errorFor("role")}
                      describedBy={errorFor("role") ? errorId("role") : undefined}
                      options={roleOptions.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                    />
                  </Field>
                  <Field label={crewForm ? "Full name" : "Name"} {...fieldProps("name")}>
                    <input value={form.name} onChange={(event) => setField("name", event.target.value)} {...inputProps("name")} />
                  </Field>
                  <Field label="Email" {...fieldProps("email")}>
                    <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} {...inputProps("email")} />
                  </Field>
                  {crewForm ? (
                    <Field label="Contact number" {...fieldProps("contact")}>
                      <PhoneInput label="Contact number" value={form.contact} onChange={(value) => setField("contact", value)} onBlur={() => touch("contact")} {...fieldProps("contact")} />
                    </Field>
                  ) : null}
                </div>

                {crewForm ? (
                  <>
                    <CrewSection title="Work details">
                      <Field label="Status">
                        <FormSelect value={form.status} onChange={(value) => setField("status", value as CrewStatus)} options={CREW_STATUS_OPTIONS.map((status) => ({ value: status, label: status }))} />
                      </Field>
                      <Field label="Join date" {...fieldProps("joinDate")}>
                        <input type="date" value={form.joinDate} onChange={(event) => setField("joinDate", event.target.value)} {...inputProps("joinDate")} />
                      </Field>
                    </CrewSection>

                    {form.role === "DRIVER" ? (
                      <CrewSection title="License">
                        <Field label="License number" {...fieldProps("licenseNo")}>
                          <input value={form.licenseNo} onChange={(event) => setField("licenseNo", event.target.value)} {...inputProps("licenseNo")} />
                        </Field>
                        <Field label="License type">
                          <FormSelect value={form.licenseType} onChange={(value) => setField("licenseType", value)} options={LICENSE_TYPES.map((type) => ({ value: type, label: type }))} />
                        </Field>
                        <Field label="License expiry" {...fieldProps("licenseExpiry")}>
                          <input type="date" value={form.licenseExpiry} onChange={(event) => setField("licenseExpiry", event.target.value)} {...inputProps("licenseExpiry")} />
                        </Field>
                      </CrewSection>
                    ) : null}

                    <CrewSection title="Emergency contact">
                      <Field label="Contact name" {...fieldProps("emergencyName")}>
                        <input value={form.emergencyName} onChange={(event) => setField("emergencyName", event.target.value)} {...inputProps("emergencyName")} />
                      </Field>
                      <Field label="Contact number" {...fieldProps("emergencyContact")}>
                        <PhoneInput label="Emergency contact number" value={form.emergencyContact} onChange={(value) => setField("emergencyContact", value)} onBlur={() => touch("emergencyContact")} {...fieldProps("emergencyContact")} />
                      </Field>
                    </CrewSection>

                  </>
                ) : !editingRow ? (
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-input-bg)] px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)]">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setField("isActive", event.target.checked)}
                      className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand-primary)]"
                    />
                    Active user
                  </label>
                ) : null}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#dde3eb] px-6 py-4">
                <ActionButton variant="secondary" onClick={closeForm} disabled={processing}>
                  Cancel
                </ActionButton>
                <ActionButton type="submit" disabled={processing}>
                  {processing ? "Saving..." : submitLabel}
                </ActionButton>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmationModal
        isOpen={editConfirmationOpen}
        title={editingCrew ? `Confirm ${ROLE_LABELS[editingCrew.role]} Changes` : "Confirm User Changes"}
        message={editingRow ? `Save changes to ${editingRow.name}${editingCrew ? "" : "'s account"}?` : ""}
        confirmLabel="Save Changes"
        onConfirm={confirmEdit}
        onCancel={() => {
          setEditConfirmationOpen(false);
          setFormOpen(true);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(deactivateTarget)}
        title="Deactivate User"
        message={deactivateTarget ? `Are you sure you want to deactivate ${deactivateTarget.name}'s account?` : ""}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={confirmDeactivation}
        onCancel={() => setDeactivateTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteCrewTarget)}
        title={deleteCrewTarget ? `Delete ${ROLE_LABELS[deleteCrewTarget.role]}` : "Delete"}
        message={
          deleteCrewTarget
            ? `Are you sure you want to remove ${deleteCrewTarget.fullName}${deleteCrewTarget.empId ? ` (${deleteCrewTarget.empId})` : ""}? They will no longer be available for assignment.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => void confirmCrewDelete()}
        onCancel={() => setDeleteCrewTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(unlockTarget)}
        title="Unlock User"
        message={unlockTarget ? `Unlock ${unlockTarget.name}'s account?` : ""}
        confirmLabel="Unlock"
        onConfirm={() => void confirmUnlock()}
        onCancel={() => setUnlockTarget(null)}
      />

      <ConfirmationModal
        isOpen={Boolean(resetPasswordTarget)}
        title="Reset Password"
        message={
          resetPasswordTarget
            ? `Are you sure you want to reset the password for ${resetPasswordTarget.name} to the system default (Password123!)? They will be required to change it on their next login.`
            : ""
        }
        confirmLabel="Reset Password"
        variant="danger"
        onConfirm={() => void confirmPasswordReset()}
        onCancel={() => setResetPasswordTarget(null)}
      />
    </div>
  );
}
