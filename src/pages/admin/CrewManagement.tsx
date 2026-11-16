import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
type Crew = {
  id: string;
  empId: string;
  fullName: string;
  status: string;
  email: string;
  contact: string;
  licenseNo?: string;
  licenseType?: string;
  licenseExpiry?: string;
  address?: string;
  joinDate?: string;
  emergencyName?: string;
  emergencyContact?: string;
};
const empty = {
  fullName: "",
  licenseNo: "",
  licenseType: "Professional",
  licenseExpiry: "",
  email: "",
  contact: "",
  status: "Available",
  address: "",
  joinDate: "",
  emergencyName: "",
  emergencyContact: "",
};
export default function CrewManagement() {
  const [kind, setKind] = useState<"drivers" | "helpers">("drivers");
  const [rows, setRows] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get<Crew[]>(`/bms/config/${kind}`);
      setRows(data);
    } catch {
      setError("Crew could not be loaded. Please retry.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setEditing(undefined);
    void load();
  }, [kind]);
  const edit = (row?: Crew) => {
    setForm({
      ...empty,
      ...row,
      licenseExpiry: row?.licenseExpiry?.slice(0, 10) ?? "",
      joinDate: row?.joinDate?.slice(0, 10) ?? "",
    });
    setEditing(row?.id ?? null);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const path = `/bms/config/${kind}`;
      if (editing) await api.patch(`${path}/${editing}`, form);
      else await api.post(path, form);
      setEditing(undefined);
      await load();
      toast.success("Crew profile saved");
    } catch {
      toast.error("Crew profile could not be saved");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (row: Crew) => {
    if (!window.confirm(`Deactivate ${row.fullName}?`)) return;
    try {
      await api.delete(`/bms/config/${kind}/${row.id}`);
      await load();
    } catch {
      toast.error("Crew member could not be deactivated");
    }
  };
  const fields =
    kind === "drivers"
      ? Object.keys(empty)
      : Object.keys(empty).filter(
          (key) => !key.startsWith("license") && key !== "address",
        );
  return (
    <main className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Crew</h1>
          <p className="text-slate-600">
            Manage dispatch profiles. Login accounts are managed in the portal.
          </p>
        </div>
        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-white"
          onClick={() => edit()}
        >
          Add crew member
        </button>
      </header>
      <nav className="flex gap-4" aria-label="Crew type">
        {(["drivers", "helpers"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={value === kind}
            onClick={() => setKind(value)}
            className="rounded border px-4 py-2 capitalize"
          >
            {value}
          </button>
        ))}
      </nav>
      {loading ? (
        <p role="status">Loading crew...</p>
      ) : error ? (
        <div role="alert">
          {error}
          <button onClick={() => void load()}>Retry</button>
        </div>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr>
              {[
                "Employee ID",
                "Name",
                "Status",
                "Email",
                "Contact",
                "Actions",
              ].map((label) => (
                <th className="border-b p-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="p-3">{row.empId}</td>
                <td>{row.fullName}</td>
                <td>{row.status}</td>
                <td>{row.email}</td>
                <td>{row.contact}</td>
                <td>
                  <button onClick={() => edit(row)}>Edit</button>
                  <button
                    className="ml-4 text-red-700"
                    onClick={() => void remove(row)}
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing !== undefined && (
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="crew-edit-title"
          className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/50 p-6"
        >
          <form
            onSubmit={save}
            className="w-full max-w-xl space-y-4 rounded-xl bg-white p-6"
          >
            <h2 id="crew-edit-title" className="text-xl font-semibold">
              {editing ? "Edit" : "Add"} crew member
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((key) => (
                <label key={key} className="text-sm">
                  {key.replace(/([A-Z])/g, " $1")}
                  <input
                    className="mt-1 w-full rounded border p-2"
                    type={
                      key.endsWith("Date") || key === "licenseExpiry"
                        ? "date"
                        : "text"
                    }
                    required={key === "fullName" || key === "licenseNo"}
                    value={form[key as keyof typeof form] ?? ""}
                    onChange={(event) =>
                      setForm((old) => ({ ...old, [key]: event.target.value }))
                    }
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(undefined)}
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded bg-slate-900 px-4 py-2 text-white"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
