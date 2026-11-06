export interface PreferredTruckRate {
  id: string;
  truckTypeId: string;
  locationCode: string;
  name: string;
  dimensions: string;
  inclusions: string;
  rate: number;
  imageUrl: string | null;
  isActive: boolean;
}

export type TruckRateView = 'loading' | 'error' | 'empty' | 'options';

export interface TruckRateContext {
  truckTypeId: string;
  locationCode: string;
}

export function filterTruckRates(rates: PreferredTruckRate[], truckTypeId: string, locationCode: string) {
  return rates.filter(rate => rate.isActive && rate.truckTypeId === truckTypeId && rate.locationCode === locationCode);
}

export function truckContextChanged(previous: TruckRateContext, next: TruckRateContext) {
  return previous.truckTypeId !== next.truckTypeId || previous.locationCode !== next.locationCode;
}

export function hasPreferredTruckSelection(
  selection: PreferredTruckRate | null,
  truckTypeId: string,
  locationCode: string,
  isUnitToUnit: boolean,
) {
  return isUnitToUnit || (!!selection && selection.isActive && selection.truckTypeId === truckTypeId && selection.locationCode === locationCode);
}

// A truck picked before switching to Unit to Unit Transfer stays in the draft, so it must not be charged.
export function preferredTruckCharge(selection: PreferredTruckRate | null, isUnitToUnit: boolean) {
  return isUnitToUnit || !selection ? 0 : Number(selection.rate);
}

export function truckRateView(
  rates: PreferredTruckRate[],
  truckTypeId: string,
  locationCode: string,
  loading: boolean,
  error: boolean,
): TruckRateView {
  if (loading) return 'loading';
  if (error) return 'error';
  return filterTruckRates(rates, truckTypeId, locationCode).length > 0
    ? 'options'
    : 'empty';
}

// Temporary NC seed mirrors the fallback rows supplied in the request. Replace
// these in the booking-service migration when the complete approved rate card is available.
export const TEMPORARY_NC_TRUCK_RATES: PreferredTruckRate[] = [
  { id: '5a1d9b42-11aa-4b10-8a10-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'NC', name: 'NC: 6W 14 FT. W/ Lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper/s, Insurance as per T&C', rate: 6990, imageUrl: '/images/truck-rates/nc-6w-14ft.jpg', isActive: true },
  { id: '5a1d9b42-11aa-4b10-8a10-000000000002', truckTypeId: '6W 14ft. with Lifter', locationCode: 'NC', name: 'NC: 6W 14 FT. W/ Lifter (2 Helpers) (PM)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helpers, Insurance as per T&C', rate: 6291, imageUrl: '/images/truck-rates/nc-6w-14ft.jpg', isActive: true },
  { id: '5a1d9b42-11aa-4b10-8a10-000000000003', truckTypeId: '10ft. Closed Van', locationCode: 'NC', name: 'NC: 10FT. Closed Van (2 Helpers)', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper/s, Insurance as per T&C', rate: 6490, imageUrl: '/images/truck-rates/nc-10ft-closed-van.jpg', isActive: true },
  { id: '5a1d9b42-11aa-4b10-8a10-000000000004', truckTypeId: '10ft. Closed Van', locationCode: 'NC', name: 'NC: 10FT. Closed Van (2 Helpers) (PM)', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper/s, Insurance as per T&C', rate: 5841, imageUrl: '/images/truck-rates/nc-10ft-closed-van-pm.jpg', isActive: true },
  { id: '5a1d9b42-11aa-4b10-8a10-000000000005', truckTypeId: '4W L300 FB Van', locationCode: 'NC', name: 'NC: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper, Insurance as per T&C', rate: 3990, imageUrl: '/images/truck-rates/nc-4w-l300.jpg', isActive: true },
  { id: '5a1d9b42-11aa-4b10-8a10-000000000006', truckTypeId: '4W L300 FB Van', locationCode: 'NC', name: 'NC: 4W L300 FB Van (PM)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper, Insurance as per T&C', rate: 3591, imageUrl: '/images/truck-rates/nc-4w-l300.jpg', isActive: true },
];

// Temporary N1 seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_N1_TRUCK_RATES: PreferredTruckRate[] = [
  { id: '6b2ea053-22bb-4c21-9b21-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'N1', name: 'N1: 6W 14FT. Truck w/ Lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8490, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: '6b2ea053-22bb-4c21-9b21-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'N1', name: 'N1: 10FT Closed Van (2 Helpers)', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper/s, Insurance as per T&C', rate: 7990, imageUrl: '/images/truck-rates/n1-10ft-closed-van.jpg', isActive: true },
  { id: '6b2ea053-22bb-4c21-9b21-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'N1', name: 'N1: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 4990, imageUrl: '/images/truck-rates/n1-4w-l300.jpg', isActive: true },
  { id: '6b2ea053-22bb-4c21-9b21-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'N1', name: 'N1: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 6480, imageUrl: '/images/truck-rates/n1-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary N2 rate seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_N2_TRUCK_RATES: PreferredTruckRate[] = [
  { id: '7c3fb164-33cc-4d32-ac32-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'N2', name: 'N2: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8990, imageUrl: '/images/truck-rates/n2-6w-14ft.jpg', isActive: true },
  { id: '7c3fb164-33cc-4d32-ac32-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'N2', name: 'N2: 10FT. Closed Van (2 Helpers)', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper/s, Insurance as per T&C', rate: 8490, imageUrl: '/images/truck-rates/n2-10ft-closed-van.jpg', isActive: true },
  { id: '7c3fb164-33cc-4d32-ac32-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'N2', name: 'N2: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 5990, imageUrl: '/images/truck-rates/n2-4w-l300.jpg', isActive: true },
  { id: '7c3fb164-33cc-4d32-ac32-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'N2', name: 'N2: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 7480, imageUrl: '/images/truck-rates/n2-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary S1 rate seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_S1_TRUCK_RATES: PreferredTruckRate[] = [
  { id: '8d4ac275-44dd-4e43-bd43-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'S1', name: 'S1: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8490, imageUrl: '/images/truck-rates/s1-6w-14ft.jpg', isActive: true },
  { id: '8d4ac275-44dd-4e43-bd43-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'S1', name: 'S1: 10FT. Closed Van (2 Helpers)', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 7990, imageUrl: '/images/truck-rates/s1-10ft-closed-van.jpg', isActive: true },
  { id: '8d4ac275-44dd-4e43-bd43-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'S1', name: 'S1: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 4990, imageUrl: '/images/truck-rates/s1-4w-l300.jpg', isActive: true },
  { id: '8d4ac275-44dd-4e43-bd43-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'S1', name: 'S1: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 6480, imageUrl: '/images/truck-rates/s1-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary S2 rate seed mirrors the options and prices shown in the supplied reference.
export const TEMPORARY_S2_TRUCK_RATES: PreferredTruckRate[] = [
  { id: '9e5bd386-55ee-4f54-ce54-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'S2', name: 'S2: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8990, imageUrl: '/images/truck-rates/s2-6w-14ft.jpg', isActive: true },
  { id: '9e5bd386-55ee-4f54-ce54-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'S2', name: 'S2: 10FT. Closed Van (2 Helpers)', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8490, imageUrl: '/images/truck-rates/s2-10ft-closed-van.jpg', isActive: true },
  { id: '9e5bd386-55ee-4f54-ce54-000000000003', truckTypeId: '10ft. Closed Van', locationCode: 'S2', name: 'S2 (WD): 10FT. Truck with 2 Helpers', dimensions: '10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper/s, Insurance as per T&C', rate: 7990, imageUrl: '/images/truck-rates/s2-wd-10ft-truck.jpg', isActive: true },
  { id: '9e5bd386-55ee-4f54-ce54-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'S2', name: 'S2: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 5990, imageUrl: '/images/truck-rates/s2-4w-l300.jpg', isActive: true },
  { id: '9e5bd386-55ee-4f54-ce54-000000000005', truckTypeId: '4W L300 FB Van', locationCode: 'S2', name: 'S2: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 7480, imageUrl: '/images/truck-rates/s2-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary L1 rate seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_L1_TRUCK_RATES: PreferredTruckRate[] = [
  { id: 'af6ce497-66ff-4065-df65-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'L1', name: 'L1: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8490, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: 'af6ce497-66ff-4065-df65-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'L1', name: 'L1: 6W 10 ft. Closed Van (2 Helpers)', dimensions: '6W - 10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 7990, imageUrl: '/images/truck-rates/s1-10ft-closed-van.jpg', isActive: true },
  { id: 'af6ce497-66ff-4065-df65-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'L1', name: 'L1: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 4990, imageUrl: '/images/truck-rates/s2-4w-l300.jpg', isActive: true },
  { id: 'af6ce497-66ff-4065-df65-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'L1', name: 'L1: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 6480, imageUrl: '/images/truck-rates/s2-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary L2 rate seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_L2_TRUCK_RATES: PreferredTruckRate[] = [
  { id: 'b07df5a8-7700-4176-e076-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'L2', name: 'L2: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8990, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: 'b07df5a8-7700-4176-e076-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'L2', name: 'L2: 6W 10 ft. Closed Van (2 Helpers)', dimensions: '6W - 10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 8490, imageUrl: '/images/truck-rates/s1-10ft-closed-van.jpg', isActive: true },
  { id: 'b07df5a8-7700-4176-e076-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'L2', name: 'L2: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 5990, imageUrl: '/images/truck-rates/s2-4w-l300.jpg', isActive: true },
  { id: 'b07df5a8-7700-4176-e076-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'L2', name: 'L2: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 7480, imageUrl: '/images/truck-rates/s2-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary R1 rate seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_R1_TRUCK_RATES: PreferredTruckRate[] = [
  { id: 'c18e06b9-8811-4287-f187-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'R1', name: 'R1: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 7490, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: 'c18e06b9-8811-4287-f187-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'R1', name: 'R1: 6W 10 ft. Closed Van (2 Helpers)', dimensions: '6W - 10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 6990, imageUrl: '/images/truck-rates/s1-10ft-closed-van.jpg', isActive: true },
  { id: 'c18e06b9-8811-4287-f187-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'R1', name: 'R1: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 4790, imageUrl: '/images/truck-rates/s2-4w-l300.jpg', isActive: true },
  { id: 'c18e06b9-8811-4287-f187-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'R1', name: 'R1: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 6280, imageUrl: '/images/truck-rates/s2-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary R2 rate seed mirrors the options and prices shown in the supplied references.
export const TEMPORARY_R2_TRUCK_RATES: PreferredTruckRate[] = [
  { id: 'd29017ca-9922-4398-a298-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'R2', name: 'R2: 6W 14FT. Truck w/ lifter (2 Helpers)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 7990, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: 'd29017ca-9922-4398-a298-000000000002', truckTypeId: '10ft. Closed Van', locationCode: 'R2', name: 'R2: 6W 10 ft. Closed Van (2 Helpers)', dimensions: '6W - 10 x 6 x 6 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helpers, Insurance as per T&C', rate: 7490, imageUrl: '/images/truck-rates/s1-10ft-closed-van.jpg', isActive: true },
  { id: 'd29017ca-9922-4398-a298-000000000003', truckTypeId: '4W L300 FB Van', locationCode: 'R2', name: 'R2: 4W L300 FB Van', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 5290, imageUrl: '/images/truck-rates/s2-4w-l300.jpg', isActive: true },
  { id: 'd29017ca-9922-4398-a298-000000000004', truckTypeId: '4W L300 FB Van', locationCode: 'R2', name: 'R2: 4W L300 FB Van (2 HELPERS)', dimensions: '4W - 7\'5" x 4 x 4 FT. (L x H x W)', inclusions: 'Gas, Toll fee, Driver, Helper, Insurance as per T&C', rate: 6780, imageUrl: '/images/truck-rates/s2-4w-l300-2-helpers.jpg', isActive: true },
];

// Temporary NN rate seed mirrors the options and prices shown in the supplied reference.
export const TEMPORARY_NN_TRUCK_RATES: PreferredTruckRate[] = [
  { id: 'e3a128db-aa33-44a9-b3a9-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'NN', name: 'NN: 14FT. Truck w/ Lifter (1 HELPER)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper, Insurance as per T&C', rate: 5990, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: 'e3a128db-aa33-44a9-b3a9-000000000002', truckTypeId: '6W 14ft. with Lifter', locationCode: 'NN', name: 'NN: 14FT. Truck w/ Lifter (2 HELPERS)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helpers, Insurance as per T&C', rate: 6980, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
];

// Temporary SS rate seed mirrors the options and prices shown in the supplied reference.
export const TEMPORARY_SS_TRUCK_RATES: PreferredTruckRate[] = [
  { id: 'f4b239ec-bb44-45ba-c4ba-000000000001', truckTypeId: '6W 14ft. with Lifter', locationCode: 'SS', name: 'SS: 6W 14FT. Truck w/ lifter', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper/s, Insurance as per T&C', rate: 5990, imageUrl: '/images/truck-rates/n1-6w-14ft.jpg', isActive: true },
  { id: 'f4b239ec-bb44-45ba-c4ba-000000000002', truckTypeId: '6W 14ft. with Lifter', locationCode: 'SS', name: 'SS: 6W 14FT w/ lifter (2 HELPERS)', dimensions: '6W - 14 x 7 x 6 FT. (L x H x W)', inclusions: 'Gas, Driver, Helper, Insurance as per T&C', rate: 6980, imageUrl: '/images/truck-rates/nc-6w-14ft.jpg', isActive: true },
];
