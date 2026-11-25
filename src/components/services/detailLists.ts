/**
 * What an additional service includes, how it can be paid, and what it excludes (spec bms/0013).
 * The lists come from the Services Offered catalog; Admin edits them there.
 */
export type ServiceDetailLists = {
  inclusions: string[];
  paymentOptions: string[];
  exclusions: string[];
};

export const DETAIL_SECTIONS: Array<{ key: keyof ServiceDetailLists; title: string }> = [
  { key: 'inclusions', title: 'Inclusions' },
  { key: 'paymentOptions', title: 'Payment options' },
  { key: 'exclusions', title: 'Exclusions' },
];

/** Reads the three lists from an API row, so a missing or malformed list shows as empty. */
export function detailLists(raw: Partial<Record<keyof ServiceDetailLists, unknown>>): ServiceDetailLists {
  const list = (value: unknown) => (Array.isArray(value) ? value.map(String).map(line => line.trim()).filter(Boolean) : []);
  return { inclusions: list(raw.inclusions), paymentOptions: list(raw.paymentOptions), exclusions: list(raw.exclusions) };
}

export const hasDetails = (details: ServiceDetailLists) => DETAIL_SECTIONS.some(({ key }) => details[key].length > 0);

/**
 * The two cash cost lines, shared by the wizard and saved bookings. Each names what the fee is for,
 * so Customer Service can tell the booking's fee from a service's.
 */
export const COD_FEE_LABEL = 'Cash on Delivery fee';
export const cashChargeLabel = (serviceName: string) => `Cash payment fee for ${serviceName}`;
