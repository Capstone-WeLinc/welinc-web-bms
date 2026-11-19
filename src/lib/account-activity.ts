export type EventCatalog = {
  categories: { code: string; label: string }[];
  types: {
    code: string;
    category: string;
    label: string;
    labelAdmin: string;
  }[];
  reasons: { code: string; label: string }[];
};
export type AccountEvent = {
  id: string;
  type: string;
  category: string;
  reason?: string;
  at?: string;
  createdAt?: string;
  user?: { id: string; name: string; email: string };
  address?: string;
  device?: string;
  userAgent?: string;
  country?: string;
  network?: string;
};
export function eventLabel(
  catalog: EventCatalog | undefined,
  event: AccountEvent,
  admin = false,
) {
  const entry = catalog?.types.find((type) => type.code === event.type);
  return (admin ? entry?.labelAdmin : entry?.label) ?? event.type;
}
export function profileActivity(catalog: EventCatalog, events: AccountEvent[]) {
  return events.map((event) => ({
    id: event.id,
    action: eventLabel(catalog, event),
    type: event.type,
    createdAt: event.at ?? event.createdAt ?? "",
    deviceInfo: event.device ?? event.userAgent,
    location: [event.country, event.network].filter(Boolean).join(" · "),
    ipAddress: event.address,
  }));
}
