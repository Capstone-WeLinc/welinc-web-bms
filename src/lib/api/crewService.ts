import { api } from "../api";

/** Drivers and helpers are crew records, not sign-in accounts. They are managed from User Management. */
export type CrewRole = "DRIVER" | "HELPER";
export type CrewStatus = "Available" | "On Duty" | "On Leave";

export const CREW_STATUS_OPTIONS: CrewStatus[] = ["Available", "On Duty", "On Leave"];
export const LICENSE_TYPES = ["Professional", "Non-Professional"] as const;

export type CrewMember = {
  id: string;
  role: CrewRole;
  empId: string;
  fullName: string;
  email: string;
  contact: string;
  status: CrewStatus;
  joinDate: string;
  licenseNo: string;
  licenseType: string;
  licenseExpiry: string;
  emergencyName: string;
  emergencyContact: string;
  updatedAt: string | null;
};

export type CrewInput = {
  fullName: string;
  email?: string;
  contact: string;
  status: CrewStatus;
  joinDate: string;
  licenseNo?: string;
  licenseType?: string;
  licenseExpiry?: string;
  emergencyName: string;
  emergencyContact: string;
};

type RawCrew = Record<string, unknown>;

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const day = (value: unknown) => text(value).slice(0, 10);

function toStatus(value: unknown): CrewStatus {
  const status = text(value);
  return status === "On Duty" || status === "On Leave" ? status : "Available";
}

function normalize(raw: RawCrew, role: CrewRole): CrewMember {
  return {
    id: text(raw.id),
    role,
    empId: text(raw.empId),
    fullName: text(raw.fullName ?? raw.name),
    email: text(raw.email),
    contact: text(raw.contact),
    status: toStatus(raw.status ?? raw.crewStatus),
    joinDate: day(raw.joinDate),
    licenseNo: text(raw.licenseNo ?? raw.licenseNumber),
    licenseType: text(raw.licenseType) || "Professional",
    licenseExpiry: day(raw.licenseExpiry),
    emergencyName: text(raw.emergencyName),
    emergencyContact: text(raw.emergencyContact),
    updatedAt: raw.updatedAt ? text(raw.updatedAt) : null,
  };
}

const path = (role: CrewRole) => (role === "DRIVER" ? "/bms/config/drivers" : "/bms/config/helpers");

/** Only the fields each crew type stores are sent; helpers have no license. */
function payload(role: CrewRole, input: CrewInput) {
  const base = {
    fullName: input.fullName,
    email: input.email,
    contact: input.contact,
    status: input.status,
    joinDate: input.joinDate,
    emergencyName: input.emergencyName,
    emergencyContact: input.emergencyContact,
  };
  return role === "DRIVER"
    ? { ...base, licenseNo: input.licenseNo, licenseType: input.licenseType, licenseExpiry: input.licenseExpiry }
    : base;
}

export async function getCrew(role: CrewRole): Promise<CrewMember[]> {
  const { data } = await api.get<RawCrew[]>(path(role));
  return (data ?? []).map((item) => normalize(item, role));
}

export async function createCrewMember(role: CrewRole, input: CrewInput): Promise<CrewMember> {
  const { data } = await api.post<RawCrew>(path(role), payload(role, input));
  return normalize(data, role);
}

export async function updateCrewMember(role: CrewRole, id: string, input: CrewInput): Promise<CrewMember> {
  const { data } = await api.patch<RawCrew>(`${path(role)}/${encodeURIComponent(id)}`, payload(role, input));
  return normalize(data, role);
}

export async function deleteCrewMember(role: CrewRole, id: string): Promise<void> {
  await api.delete(`${path(role)}/${encodeURIComponent(id)}`);
}
