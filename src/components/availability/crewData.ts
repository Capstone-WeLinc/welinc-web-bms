import { api } from '../../lib/api';
import { normalizeCrew, type CrewMember, type CrewRole } from '../../lib/api/crewService';

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

/** Loads the crew list straight from the API so the dates keep their Manila calendar day. */
export async function loadCrew(role: CrewRole): Promise<CrewMember[]> {
  const { data } = await api.get<Record<string, unknown>[]>(role === 'DRIVER' ? '/bms/config/drivers' : '/bms/config/helpers');
  return (data ?? []).map(raw => normalizeCrew(raw, role, manilaDay));
}
