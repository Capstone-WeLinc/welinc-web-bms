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

const AREAS_RAW: Record<AreaKey, AreaData> = {
  NCR: {
    cities: [
      'Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig',
      'Mandaluyong', 'Parañaque', 'Caloocan', 'Marikina', 'Pasay',
      'Las Piñas', 'Malabon', 'Muntinlupa', 'Navotas', 'Pateros',
      'San Juan', 'Valenzuela',
    ],
    barangaysByCity: {
      Manila: ['Binondo', 'Ermita', 'Intramuros', 'Malate', 'Paco', 'Pandacan', 'Quiapo', 'Sampaloc', 'Santa Cruz'],
      'Quezon City': ['Batasan Hills', 'Commonwealth', 'Diliman', 'Fairview', 'Novaliches', 'Project 4', 'Tandang Sora', 'UP Campus'],
      Makati: ['Ayala Alabang', 'Bangkal', 'Bel-Air', 'Legazpi Village', 'Palanan', 'Poblacion', 'Rockwell', 'San Lorenzo'],
      Pasig: ['Bagong Ilog', 'Bambang', 'Caniogan', 'Ortigas Center', 'Palatiw', 'Pasig Proper', 'Pinagbuhatan', 'Pineda', 'Rosario', 'San Antonio', 'San Miguel', 'Ugong'],
      Taguig: ['BGC', 'Fort Bonifacio', 'Hagonoy', 'Ligid-Tipas', 'Lower Bicutan', 'Post Proper Northside', 'Post Proper Southside', 'Signal Village', 'Tuktukan', 'Upper Bicutan', 'Western Bicutan'],
      Mandaluyong: ['Addition Hills', 'Barangka', 'Buayang Bato', 'Hagdan Bato', 'Highway Hills', 'Plainview', 'Wack-Wack', 'Vergara'],
      Parañaque: ['BF Homes', 'Don Bosco', 'Don Galo', 'La Huerta', 'Marcelo Green', 'Merville', 'San Dionisio', 'Sucat', 'Sun Valley'],
      Caloocan: ['Bagumbong', 'Deparo', 'Grace Park', 'Kaunlaran', 'Maypajo', 'Monumento', 'Pangarap Village', 'Sangandaan', 'Tala'],
      Marikina: ['Concepcion Uno', 'Fortune', 'Jesus dela Peña', 'Nangka', 'Parang', 'San Roque', 'Santa Elena', 'Tumana'],
      Pasay: ['Baclaran', 'Balabag', 'Don Galo', 'Maricaban', 'Malibay', 'NAIA Complex', 'Paco', 'San Jose', 'Tramo'],
      'Las Piñas': ['Almanza Uno', 'Almanza Dos', 'BF Homes', 'Casablanca', 'Daniel Fajardo', 'Don Bosco', 'Gatchalian', 'IPIL', 'Las Piñas (Pob.)', 'Manuyo Uno', 'Manuyo Dos', 'Marcelo Green', 'Pamplona Uno', 'Pamplona Dos', 'Pamplona Tres', 'Pilar Village', 'Pulang Lupa Uno', 'Pulang Lupa Dos', 'Talon Uno', 'Talon Dos', 'Talon Tres', 'Talon Cuatro', 'Talon Singko', 'Zapote'],
      Malabon: ['Baritan', 'Bayuyo', 'Bayan-Bayanan', 'Carmen', 'Concepcion', 'Dampalit', 'Estrella', 'Fatima', 'Maysilo', 'Muzon', 'San Agustin', 'San Bartolome', 'San Jose', 'Santa Barbara', 'Santa Elena', 'Santa Rita', 'Santiago North', 'Santiago South', 'Siniloan', 'Tañong', 'Tinajeros'],
      Muntinlupa: ['Alabang', 'Bayanan', 'Buli', 'Poblacion', 'Putatan', 'Sucat', 'Talon', 'Tuntungin-Putho', 'Tunasan'],
      Navotas: ['Bagumbayan North', 'Bagumbayan South', 'Bangkulasi', 'Daanghari', 'Navotas East', 'Navotas West', 'NBBS Dagat-dagatan', 'NBBS Kaunlaran', 'NBBS Proper', 'North Bay Boulevard North', 'San Jose (Poblacion)', 'San Rafael Village', 'San Roque', 'Sipac-Almacen', 'Tangos North', 'Tangos South', 'Tanza 1', 'Tanza 2'],
      Pateros: ['Aguho', 'Cacaw', 'La Paz', 'Malabon', 'Poblacion', 'San Jose', 'San Roque', 'Santa Cruz', 'Santa Mesa', 'Tagumpay'],
      'San Juan': ['Bagumbayan', 'Corazon de Jesus', 'Greenhills', 'Little Baguio', 'Olympia', 'Pinaglabanan', 'Progreso', 'Riverbanks', 'Salapan', 'San Jose', 'Santa Lucia', 'West Crame'],
      Valenzuela: ['Arkong Bato', 'Balangkas-Caloong', 'Bignay', 'Canumay East', 'Canumay West', 'Dalandanan', 'Gen. T. de Leon', 'Gasak', 'Karuhatan', 'Lawang Bato', 'Malinta', 'Mapulang Lupa', 'Marulas', 'Maysan', 'North Bay Boulevard South (NBBS) Kaunlaran', 'Parada', 'Paso de Blas', 'Polo', 'Punturin', 'Rincon', 'Ugong', 'Veinte Reales', 'Wawang Pulo'],
    },
  },
  Bulacan: {
    cities: ['Malolos', 'Meycauayan', 'Bocaue', 'San Jose del Monte', 'Marilao', 'Obando'],
    barangaysByCity: {
      Malolos: ['Anilao', 'Babatnin', 'Bagna', 'Balite', 'Bangkal', 'Caingin', 'Dakila', 'Guinhawa'],
      Meycauayan: ['Bahay Pare', 'Bancal', 'Banga', 'Camalig', 'Gasak', 'Langka', 'Lawa', 'Pantoc'],
      Bocaue: ['Bagumbayan', 'Batia', 'Bundukan', 'Bunlo', 'Canda', 'Capihan', 'Lolomboy', 'Poblacion'],
      'San Jose del Monte': ['Assumption', 'Bagong Buhay', 'Citrus', 'Dulong Bayan', 'Fatima', 'Francisco Homes', 'Gaya-Gaya', 'Muzon'],
      Marilao: ['Abangan Norte', 'Abangan Sur', 'Bagbaguin', 'Balasing', 'Banga', 'Buracruz', 'Ibayo', 'Patubig'],
      Obando: ['Binuangan', 'Catanghalan', 'Hulo', 'Lawa', 'Lingap', 'Paco', 'Paliwas', 'Poblacion'],
    },
  },
  Cavite: {
    cities: ['Bacoor', 'Imus', 'Dasmariñas', 'General Trias', 'Kawit', 'Tagaytay'],
    barangaysByCity: {
      Bacoor: ['Aniban', 'Banalo', 'Bayanan', 'Campo Santo', 'Digman', 'Dulong Bayan', 'Habay', 'Ligas'],
      Imus: ['Alapan I-A', 'Alapan II-A', 'Anabu I-A', 'Bayan Luma I', 'Bucandala I', 'Malagasang I-A', 'Palico I', 'Tanzang Luma I'],
      Dasmariñas: ['Burol I', 'Burol II', 'Burol III', 'Meher Village', 'Paliparan I', 'Paliparan II', 'Sabang', 'Zone I'],
      'General Trias': ['Alingaro', 'Arnaldo', 'Bacao I', 'Bacao II', 'Biclatan', 'Buenavista I', 'Corregidor', 'Poblacion'],
      Kawit: ['Batong Dalig', 'Binakayan-Aplaya', 'Binakayan-Kanluran', 'Gahak', 'Magdalo', 'Malagasang', 'Putol', 'Tabon'],
      Tagaytay: ['Asisan', 'Bagong Tubig', 'Calabuso', 'Francisco', 'Guinhawa Norte', 'Iruhin Central', 'Maitim II Central', 'Silang Junction Norte'],
    },
  },
  Laguna: {
    cities: ['San Pedro', 'Biñan', 'Santa Rosa', 'Calamba', 'Cabuyao'],
    barangaysByCity: {
      'San Pedro': ['Bagong Silang', 'Calendola', 'Chrysanthemum', 'Cuyab', 'Estrella', 'Landayan', 'Langgam', 'Laram'],
      Biñan: ['Biñan Poblacion', 'Butong', 'Canlalay', 'Casile', 'De La Paz', 'Ganado', 'Langkiwa', 'Loma'],
      'Santa Rosa': ['Aplaya', 'Balibago', 'Caingin', 'Dila', 'Dita', 'Don Jose', 'Ibaba', 'Kanluran'],
      Calamba: ['Bagong Kalsada', 'Barandal', 'Batino', 'Burol', 'Canlubang', 'Kay-anlog', 'Laguerta', 'Looc'],
      Cabuyao: ['Baclaran', 'Banay-Banay', 'Banlic', 'Bigaa', 'Butong', 'Casile', 'Diezmo', 'Gulod'],
    },
  },
  Rizal: {
    cities: ['Cainta', 'Taytay', 'Antipolo', 'Angono'],
    barangaysByCity: {
      Cainta: ['Brgy. A', 'Brgy. B', 'Brgy. C', 'Brgy. D', 'Karangalan Village', 'San Andres', 'San Isidro', 'Santa Rosa'],
      Taytay: ['Dolores', 'Muzon', 'San Isidro', 'San Juan', 'Santa Ana'],
      Antipolo: ['Bagong Nayon', 'Beverly Hills', 'Calawis', 'Cupang', 'Dalig', 'Dela Paz', 'Inarawan', 'Mambugan'],
      Angono: ['Bagumbayan', 'Kalayaan', 'Mambog', 'Maybancal', 'Poblacion Blg. 1', 'Poblacion Blg. 2', 'San Isidro', 'San Pedro'],
    },
  },
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