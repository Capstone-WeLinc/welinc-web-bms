import { WORKBOOK_LOCATIONS } from './zip-codes';

export type AreaKey = 'NCR' | 'Bulacan' | 'Cavite' | 'Laguna' | 'Rizal' | 'Pampanga' | 'Batangas';

export interface DeliveryCategoryDef {
  code: string;
  label: string;
  pickupArea: AreaKey;
  deliveryArea: AreaKey;
}

export const DELIVERY_CATEGORY_DEFS: DeliveryCategoryDef[] = [
  { code: 'NC',  label: 'NCR to NCR',                 pickupArea: 'NCR',    deliveryArea: 'NCR' },
  { code: 'NCH', label: 'NCR to NCR + Motorized Helper', pickupArea: 'NCR', deliveryArea: 'NCR' },
  { code: 'N1',  label: 'NCR to Bulacan',              pickupArea: 'NCR',    deliveryArea: 'Bulacan' },
  { code: 'N2',  label: 'NCR to Bulacan',              pickupArea: 'NCR',    deliveryArea: 'Bulacan' },
  { code: 'S1',  label: 'NCR to Cavite',               pickupArea: 'NCR',    deliveryArea: 'Cavite' },
  { code: 'S2',  label: 'NCR to Cavite',               pickupArea: 'NCR',    deliveryArea: 'Cavite' },
  { code: 'L1',  label: 'NCR to Laguna',               pickupArea: 'NCR',    deliveryArea: 'Laguna' },
  { code: 'L2',  label: 'NCR to Laguna',               pickupArea: 'NCR',    deliveryArea: 'Laguna' },
  { code: 'R1',  label: 'NCR to Rizal',                pickupArea: 'NCR',    deliveryArea: 'Rizal' },
  { code: 'R2',  label: 'NCR to Rizal',                pickupArea: 'NCR',    deliveryArea: 'Rizal' },
  { code: 'NN',  label: 'North to North',              pickupArea: 'Pampanga', deliveryArea: 'Bulacan' },
  { code: 'SS',  label: 'South to South',              pickupArea: 'Cavite', deliveryArea: 'Batangas' },
];

// Legacy list kept for backward compat
export const DELIVERY_CATEGORIES = DELIVERY_CATEGORY_DEFS.map(d => `${d.code} – ${d.label}`);

export interface AreaData {
  cities: string[];
  barangaysByCity: Record<string, string[]>;
}

const sortStrings = (items: string[]) =>
  Array.from(new Set(items)).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

const sortAreaData = (area: AreaData): AreaData => ({
  cities: sortStrings(area.cities),
  barangaysByCity: Object.fromEntries(
    Object.entries(area.barangaysByCity).map(([city, barangays]) => [
      city,
      sortStrings(barangays),
    ]),
  ),
});

const sortAreas = (areas: Record<AreaKey, AreaData>): Record<AreaKey, AreaData> =>
  Object.fromEntries(
    Object.entries(areas).map(([key, area]) => [key as AreaKey, sortAreaData(area)]),
  ) as Record<AreaKey, AreaData>;

function workbookArea(areaKey: string): AreaData {
  const cities = WORKBOOK_LOCATIONS[areaKey];
  return {
    cities: Object.keys(cities),
    barangaysByCity: Object.fromEntries(Object.entries(cities).map(([city, barangays]) => [city, Object.keys(barangays)])),
  };
}

const AREAS_RAW: Record<AreaKey, AreaData> = {
  Bulacan: workbookArea('Bulacan'),
  Cavite: workbookArea('Cavite'),
  Laguna: workbookArea('Laguna'),
  Rizal: workbookArea('Rizal'),
  NCR: workbookArea('NCR'),
  Pampanga: {
    cities: ['Angeles', 'San Fernando', 'Mabalacat', 'Porac'],
    barangaysByCity: {
      Angeles: ['Agapito del Rosario', 'Amsic', 'Anunas', 'Balibago', 'Capaya', 'Claro M. Recto', 'Cuayan', 'Lourdes'],
      'San Fernando': ['Alasas', 'Baliti', 'Bulaon', 'Calulut', 'Del Pilar', 'Del Carmen', 'Lara', 'Maimpis'],
      Mabalacat: ['Atlu-Bola', 'Bical', 'Bicolor', 'Bundagul', 'Cacutud', 'Calumpang', 'Camachiles', 'Dau'],
      Porac: ['Babo-Pangulo', 'Babo-Tablang', 'Balubad', 'Calzadang Bayu', 'Camias', 'Cangatba', 'Diaz', 'Dolores'],
    },
  },
  Batangas: {
    cities: ['Batangas City', 'Lipa', 'Tanauan', 'Sto. Tomas'],
    barangaysByCity: {
      'Batangas City': ['Alangilan', 'Balagtas', 'Balete', 'Banaba Center', 'Banaba Kanluran', 'Bolbok', 'Kumba', 'Pallocan Kanluran'],
      Lipa: ['Adya', 'Anilao', 'Antipolo del Norte', 'Antipolo del Sur', 'Bagong Pook', 'Balintawak', 'Banaybanay', 'Bolbok'],
      Tanauan: ['Ambulong', 'Bagbag', 'Bagumbayan', 'Balele', 'Banjo East', 'Bilog-Bilog', 'Boot', 'Cale'],
      'Sto. Tomas': ['Barangay I', 'Barangay II', 'Barangay III', 'Barangay IV', 'Barangay V', 'Mahayahay', 'Poblacion', 'Sto. Niño'],
    },
  },
};

export const AREAS = sortAreas(AREAS_RAW);

export function getPickupArea(code: string): AreaKey {
  return DELIVERY_CATEGORY_DEFS.find(d => d.code === code)?.pickupArea ?? 'NCR';
}

export function getDeliveryArea(code: string): AreaKey {
  return DELIVERY_CATEGORY_DEFS.find(d => d.code === code)?.deliveryArea ?? 'NCR';
}