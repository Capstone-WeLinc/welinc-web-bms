/** Mirrors welinc-backend-analytics-ai/src/reports/forecasting/forecast.types.ts. */

export type ForecastHorizon = '7days' | '30days' | '90days' | 'nextMonth';
export type ForecastTabId = 'demand' | 'services' | 'resources' | 'insights';
export type ResourceKey = 'trucks' | 'drivers' | 'helpers';
export type Severity = 'high' | 'medium' | 'low';

export interface InsightItem { title: string; detail: string; category: 'demand' | 'service' | 'peak' | 'operations' }
export interface ActionItem { action: string; reason: string; priority: Severity }
export interface RiskItem { risk: string; detail: string; severity: Severity }
export interface InsightSet { summary: string; keyInsights: InsightItem[]; recommendedActions: ActionItem[]; risks: RiskItem[] }

export interface Backtest {
  available: boolean;
  reason?: string;
  method?: string;
  mae: number | null;
  mape: number | null;
  mapeDaysUsed: number;
  zeroActualDays: number;
  trainingDays: number;
  testDays: number;
  testStart: string | null;
  testEnd: string | null;
  totalActual: number;
  totalPredicted: number;
  totalErrorPct: number | null;
  points: { date: string; actual: number; predicted: number }[];
}

export interface ResourceSummary {
  key: ResourceKey;
  label: string;
  perBooking: number;
  peakRequired: number;
  peakDate: string;
  averageRequired: number;
  usableOnPeak: number;
  assignedOnPeak: number;
  rosterTotal: number;
  unavailableNow: number;
  shortage: number;
  shortageDays: number;
  worstShortageDate: string | null;
  utilizationPct: number | null;
}

export interface ForecastDashboard {
  generatedAt: string;
  params: { historyStart: string; historyEnd: string; horizon: ForecastHorizon; forecastStart: string; forecastEnd: string; forecastDays: number; serviceType: string; vehicleId: string };
  method: { name: 'weighted-weekday' | 'historical-average' | 'none'; label: string; description: string; fallbackReason: string | null; halfLifeDays: number };
  dataQuality: { historicalBookings: number; cancelledExcluded: number; trainingStart: string | null; trainingDays: number; trainingBookings: number; limitedHistory: boolean; note: string | null };
  demand: null | {
    totalForecast: number;
    dailyAverage: number;
    alreadyBooked: number;
    previousPeriod: { start: string; end: string; days: number; actual: number; dailyAverage: number; changePct: number | null };
    demandLevel: { level: 'High' | 'Moderate' | 'Low'; ratio: number; historicalDailyAverage: number } | null;
    peakDay: { date: string; bookings: number } | null;
    peakWeek: { start: string; end: string; bookings: number; sharePct: number } | null;
    peakPattern: { weekday: string; bookings: number; dates: string[] } | null;
    daily: { date: string; forecast: number; alreadyBooked: number }[];
    history: { date: string; actual: number }[];
    weekly: { start: string; end: string; days: number; actual: number | null; forecast: number | null }[];
    monthly: { month: string; actual: number | null; forecast: number | null; partial: boolean }[];
    summary: string;
  };
  evaluation: {
    backtest: Backtest;
    savedForecasts: {
      available: boolean; reason?: string; evaluatedCount: number; mae: number | null; mape: number | null;
      records: { id: number; generatedAt: string; horizon: string; targetStart: string; targetEnd: string; predicted: number; actual: number; absError: number; ape: number | null }[];
    };
  };
  services: {
    rows: { service: string; historical: number; previousActual: number; forecast: number; forecastSharePct: number; changePct: number | null; trend: 'up' | 'down' | 'flat' | 'new' | 'none' }[];
    unclassified: { historical: number; forecast: number; sharePct: number; examples: string[] };
    totalHistoricalMapped: number;
    totalForecastMapped: number;
    previousMapped: number;
    growthPct: number | null;
    mostDemanded: string | null;
    leastDemanded: string | null;
  };
  resources: {
    status: 'ok' | 'insufficient-data' | 'no-forecast';
    message: string | null;
    availabilityError: string | null;
    basis: {
      totalBookings: number; knownBookings: number; fromAssignments: number; fromBookingNotes: number;
      totals: Record<ResourceKey, number>; coveragePct: number | null; minimumKnown: number; perBooking: Record<ResourceKey, number> | null;
    };
    resources: ResourceSummary[];
    daily: { date: string; bookings: number; assignedBookings: number; required: Record<ResourceKey, number> | null; usable: Record<ResourceKey, number> | null }[];
    weekly: { start: string; end: string; required: Record<ResourceKey, number> | null; usable: Record<ResourceKey, number> | null }[];
    unavailableVehicles: { plateNumber: string; status: string; reason: string | null; expectedBack: string | null }[];
    maintenanceInWindow: { plateNumber: string; date: string }[];
    crewUnavailable: { drivers: number; helpers: number };
    recommendations: { kind: 'shortage' | 'maintenance' | 'return' | 'coverage'; text: string }[];
  };
  systemInsights: InsightSet;
}

export interface AiInsightsResponse {
  status: 'ok' | 'unavailable' | 'empty';
  model: string | null;
  generatedAt: string;
  insights: InsightSet | null;
  removedUnverified: number;
  message: string | null;
}
