import { api } from "../api";
import { PORTAL_URL } from "../session/session";

/**
 * Drivers and helpers are the people who hold that role in Auth (spec bms/0012). Each one shows up
 * here by themselves once they have an account. Name, email and contact number belong to the account
 * and are edited in the portal; BMS keeps only its own dispatch details (status, join date, license,
 * emergency contact).
 */
export type CrewRole = "DRIVER" | "HELPER";
export type CrewStatus = "Available" | "On Duty" | "On Leave";

export const CREW_STATUS_OPTIONS: CrewStatus[] = ["Available", "On Duty", "On Leave"];
export const LICENSE_TYPES = ["Professional", "Non-Professional"] as const;

export type CrewMember = {
  id: string;
  role: CrewRole;
  /** The account in Auth. */
  userId: string;
  fullName: string;
  email: string;
  contact: string;
  status: CrewStatus;
  licenseNo: string;
  licenseType: string;
  licenseExpiry: string;
  emergencyName: string;
  emergencyContact: string;
  updatedAt: string | null;
};

/** The details BMS keeps. Name, email and contact number are not here: they are edited in the portal. */
export type CrewInput = {
  status: CrewStatus;
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

/** Two letters from the name, e.g. "Ramon Dela Cruz" → "RD". BMS stores no initials. */
export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

/** The person's page in the portal, where Admin edits their name, email and contact number. */
export const portalAccountUrl = (userId: string) =>
  `${PORTAL_URL}/admin/people/${encodeURIComponent(userId)}?system=BMS`;

export function normalizeCrew(raw: RawCrew, role: CrewRole, readDay: (value: unknown) => string = day): CrewMember {
  return {
    id: text(raw.id),
    role,
    userId: text(raw.userId),
    fullName: text(raw.fullName ?? raw.name),
    email: text(raw.email),
    contact: text(raw.contact),
    status: toStatus(raw.status ?? raw.crewStatus),
    licenseNo: text(raw.licenseNo ?? raw.licenseNumber),
    licenseType: text(raw.licenseType) || "Professional",
    licenseExpiry: readDay(raw.licenseExpiry),
    emergencyName: text(raw.emergencyName),
    emergencyContact: text(raw.emergencyContact),
    updatedAt: raw.updatedAt ? text(raw.updatedAt) : null,
  };
}

const path = (role: CrewRole) => (role === "DRIVER" ? "/bms/config/drivers" : "/bms/config/helpers");

/** Only the fields each crew type stores are sent; helpers have no license. */
function payload(role: CrewRole, input: CrewInput) {
  const base = {
    status: input.status,
    emergencyName: input.emergencyName,
    emergencyContact: input.emergencyContact,
  };
  return role === "DRIVER"
    ? { ...base, licenseNo: input.licenseNo, licenseType: input.licenseType, licenseExpiry: input.licenseExpiry }
    : base;
}

export async function updateCrewMember(role: CrewRole, id: string, input: CrewInput): Promise<CrewMember> {
  const { data } = await api.patch<RawCrew>(`${path(role)}/${encodeURIComponent(id)}`, payload(role, input));
  return normalizeCrew(data, role);
}
