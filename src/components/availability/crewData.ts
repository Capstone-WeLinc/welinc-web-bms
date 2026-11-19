import { api } from '../../lib/api';
import type { CrewMember, CrewRole, CrewStatus } from '../../lib/api/crewService';

/**
 * The server stores a date as midnight in Manila (16:00 UTC the day before), so a timestamp is read
 * back as its Manila calendar day. Reading the UTC day instead would move the date back on every save.
 */
export const manilaDay = (value: unknown) => {
  const text = value == null ? '' : String(value);
  if (!text.includes('T')) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
};
const str = (value: unknown) => (value == null ? '' : String(value));
const toStatus = (value: unknown): CrewStatus => (value === 'On Duty' || value === 'On Leave' ? value : 'Available');

/** Loads the crew list straight from the API so the dates keep their Manila calendar day. */
export async function loadCrew(role: CrewRole): Promise<CrewMember[]> {
  const { data } = await api.get<Record<string, unknown>[]>(role === 'DRIVER' ? '/bms/config/drivers' : '/bms/config/helpers');
  return (data ?? []).map(raw => ({
    id: str(raw.id),
    role,
    empId: str(raw.empId),
    fullName: str(raw.fullName ?? raw.name),
    email: str(raw.email),
    contact: str(raw.contact),
    status: toStatus(raw.status ?? raw.crewStatus),
    joinDate: manilaDay(raw.joinDate),
    licenseNo: str(raw.licenseNo ?? raw.licenseNumber),
    licenseType: str(raw.licenseType) || 'Professional',
    licenseExpiry: manilaDay(raw.licenseExpiry),
    emergencyName: str(raw.emergencyName),
    emergencyContact: str(raw.emergencyContact),
    updatedAt: raw.updatedAt ? str(raw.updatedAt) : null,
  }));
}
