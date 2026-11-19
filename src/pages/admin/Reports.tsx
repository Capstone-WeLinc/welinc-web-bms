import PageHeader from '../../components/pageheader/Pageheader';
import ExportMenu from '../../components/ui/ExportMenu';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../lib/api';
import { normalizeBookingStatus } from '../../lib/booking';
import StatusBadge from '../../components/shared/StatusBadge';
import TablePagination from '../../components/ui/TablePagination';
import { exportReportExcel, exportReportPdf, type ReportDocument } from '../../lib/documents/reportExport';
import KPICard from '../../components/shared/KpiCard';
import { tableCellClasses, tableClasses, tableHeadClasses, tableHeaderCellClasses, tableRowClasses } from '../../components/ui/StandardTable';
import { Link } from 'react-router-dom';
import DemandForecastDashboard from '../../components/reports/DemandForecastDashboard';
import OperationalReport from '../../components/reports/operational/OperationalReport';
import MonthlyReport from '../../components/reports/monthly/MonthlyReport';
import { monthlyWindow } from '../../components/reports/monthly/monthlyReport.logic';
import { formatRange as formatOperationalRange, monthLabel, vehiclePercent, type OperationalReportData, type ResourcesSnapshotData } from '../../components/reports/operational/operationalReport.logic';
import type { AiInsightsResponse, ForecastDashboard, ForecastHorizon } from '../../components/reports/forecast/types';
import { formatRange as formatForecastRange, horizonOptions } from '../../components/reports/forecast/format';
import { toast } from 'sonner';
import { DayPicker, type DateRange } from 'react-day-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  CalendarDays,
  CheckCircle,
  PhilippinePeso,
  FileText,
  FileSpreadsheet,
  Truck,
  Save,
  Package,
  BarChart3,
  ChevronDown,
  UsersRound,
  AlertTriangle,
  Wallet,
  Info,
  RotateCcw,
} from 'lucide-react';

interface Booking {
  id: string;
  bookingId?: string;
  bookingNo?: string;
  client: string;
  service: string;
  date: string;
  preferredTime?: string;
  createdAt?: string;
  status: string;
  amount: string | number;
  paymentStatus?: string;
  paymentMethod?: string;
  payment_method?: string;
  garage?: string;
}

interface DailySalesRecord {
  id: string;
  date: string;
  status?: string;
  reportStatus?: string;
  bookingId?: string;
  bookingNo?: string;
  plateNumber?: string;
  cashPayment?: string | number;
  bdoPayment?: string | number;
  gcashPayment?: string | number;
  xenditPayment?: string | number;
  totalDailySales?: string | number;
}

interface DispatchAssignment {
  bookingUuid: string;
  vehicleId: string | null;
  driverId: string | null;
  helperIds: string[];
  serviceDate: string;
  state: string;
  dispatchTime?: string | null;
  updatedAt?: string;
}

interface ReportJobOrder {
  bookingId?: string;
  bookingIdAlias?: string;
  bookingUuid?: string;
  serviceDate?: string;
  status?: string;
  state?: string;
  truck?: string;
  updatedAt?: string;
  vehicle?: { plateNumber?: string; plate?: string };
}

interface PostServiceRecord {
  bookingId?: string;
  bookingNo?: string;
  date?: string;
  status?: string;
  postServiceStatus?: string;
  arrivalTime?: string | null;
  finalizedAt?: string | null;
}

interface Vehicle {
  id: string;
  plateNumber: string;
  alias?: string;
  status: string;
  capacity?: number;
  model?: string;
  isActive?: boolean;
  isAssigned?: boolean;
}

interface HelperResource { id: string; status: string }

interface Driver {
  id: string;
  name: string;
  status: string;
  crewStatus?: string;
  crew_status?: string;
  isActive?: boolean;
}

const REPORT_SERVICES = ['Corporate Delivery', 'Lipat Bahay', 'Office Pull out', 'Unit to Unit Transfer'] as const;

interface SavedReport {
  id: number;
  reportType: string;
  periodKey: string;
  garage: string | null;
  generatedAt: string;
  kpis: Record<string, unknown>;
  series: Record<string, unknown>;
  rawMetrics: Record<string, unknown>;
}

/** Bookings have no end time; the daily "jobs running by hour" chart assumes each job takes this long. */
const DAILY_JOB_HOURS = 4;

const PHP_CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function getManilaDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatPeso(n: number) {
  return PHP_CURRENCY_FORMATTER.format(n);
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (minute > 59) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (period === 'PM' ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 60 + minute;
}

function formatTimeLabel(value: string | null | undefined) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value?.trim() || '—';
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minutes % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

function formatHourLabel(hour: number) {
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${hour % 24 < 12 ? 'AM' : 'PM'}`;
}

function dailyStatusLabel(status: string) {
  return status === 'Scheduled' ? 'Assigned' : status;
}

function getDefaultRange() {
  const end = getManilaDateInputValue();
  const start = new Date(`${end}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 364);
  const startKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  return { start: startKey, end };
}

type RangePreset = 'week' | 'month' | 'lastMonth' | 'quarter' | 'year' | 'last12';
const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'last12', label: 'Last 12 months' },
];

/** Manila-dated ranges for the common report periods; weeks start on Monday. */
function getPresetRange(preset: RangePreset) {
  if (preset === 'last12') return getDefaultRange();
  const today = getManilaDateInputValue();
  const now = new Date(`${today}T12:00:00Z`);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (preset === 'week') {
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    return { start: key(monday), end: today };
  }
  if (preset === 'month') return { start: key(new Date(Date.UTC(year, month, 1, 12))), end: today };
  if (preset === 'lastMonth') return { start: key(new Date(Date.UTC(year, month - 1, 1, 12))), end: key(new Date(Date.UTC(year, month, 0, 12))) };
  if (preset === 'quarter') return { start: key(new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1, 12))), end: today };
  return { start: `${year}-01-01`, end: today };
}

export default function Reports() {
  const { user } = useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobOrders, setJobOrders] = useState<ReportJobOrder[]>([]);
  const [dispatchAssignments, setDispatchAssignments] = useState<DispatchAssignment[]>([]);
  const [postServiceRecords, setPostServiceRecords] = useState<PostServiceRecord[]>([]);
  const [assignmentLoadError, setAssignmentLoadError] = useState(false);
  const [jobOrderLoadError, setJobOrderLoadError] = useState(false);
  const [postServiceLoadError, setPostServiceLoadError] = useState(false);
  const [crewLoadError, setCrewLoadError] = useState(false);
  const [vehicleLoadError, setVehicleLoadError] = useState(false);
  const [dailySalesRecords, setDailySalesRecords] = useState<DailySalesRecord[]>([]);
  const [dailySalesLoadError, setDailySalesLoadError] = useState(false);
  const [bookingLoadError, setBookingLoadError] = useState(false);
  const [monthlyRange, setMonthlyRange] = useState<6 | 12 | 24>(12);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [helpers, setHelpers] = useState<HelperResource[]>([]);
  const [loading, setLoading] = useState(true);

  const { start: defaultStart, end: defaultEnd } = getDefaultRange();
  const [dateFrom, setDateFrom] = useState(defaultStart);
  const [dateTo, setDateTo] = useState(defaultEnd);
  const garage = 'All';
  const [selectedService, setSelectedService] = useState('All');
  const [selectedVehicleId, setSelectedVehicleId] = useState('All');
  const [operationalData, setOperationalData] = useState<{ report: OperationalReportData | null; snapshot: ResourcesSnapshotData | null }>({ report: null, snapshot: null });
  const handleOperationalData = useCallback((data: { report: OperationalReportData | null; snapshot: ResourcesSnapshotData | null }) => setOperationalData(data), []);
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>('30days');
  const [reportType, setReportType] = useState<'daily' | 'operational' | 'monthly' | 'forecast'>('daily');
  const [activeSection, setActiveSection] = useState<'daily' | 'operational' | 'monthly' | 'forecast'>('daily');

  const [forecast, setForecast] = useState<ForecastDashboard | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsightsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiRequestId = useRef(0);
  const [savingReport, setSavingReport] = useState(false);

  const [, setSavedReports] = useState<SavedReport[]>([]);
  const [, setSavedReportsLoading] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const dataLoadInFlight = useRef(false);
  const dataHasLoaded = useRef(false);
  const autoSavedReportKeys = useRef(new Set<string>());
  const forecastRequestId = useRef(0);
  // The forecast tab has no filter bar: it always learns from the last 12 months of all bookings.
  const forecastHistory = getDefaultRange();
  const forecastInputsKey = JSON.stringify([forecastHistory.start, forecastHistory.end, forecastHorizon]);
  const previousForecastInputsKey = useRef(forecastInputsKey);
  const previousReportType = useRef(reportType);

  useEffect(() => {
    void loadData();
    void loadSavedReports();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadData();
    };
    const refreshInterval = window.setInterval(() => void loadData(), 15_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
    // loadData reads no changing component values; this effect owns page refresh lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reportType === 'monthly' && previousReportType.current !== 'monthly') {
      // Exactly 12 calendar months ending with this Manila month (toISOString would shift each day back by one).
      const window = monthlyWindow(12, getManilaDateInputValue());
      setDateFrom(window.start);
      setDateTo(window.end);
      setMonthlyRange(12);
    }
    previousReportType.current = reportType;
  }, [reportType]);

  useEffect(() => {
    if (previousForecastInputsKey.current === forecastInputsKey) return;
    previousForecastInputsKey.current = forecastInputsKey;
    forecastRequestId.current += 1;
    aiRequestId.current += 1;
    setForecast(null);
    setForecastError(null);
    setForecastLoading(false);
    setAiInsights(null);
    setAiError(null);
    setAiLoading(false);
  }, [forecastInputsKey]);

  // The forecast is generated on demand: the Admin clicks "Generate Forecast" (see
  // DemandForecastDashboard). Changing the period clears the old result above, so
  // a new forecast is only run when asked for.

  async function loadData() {
    if (dataLoadInFlight.current) return;
    dataLoadInFlight.current = true;
    if (!dataHasLoaded.current) setLoading(true);
    try {
      const [bookingResult, vehiclesResult, driversResult, helpersResult, assignmentsResult, salesResult, jobOrdersResult, postServiceResult] = await Promise.all([
        api.get<Booking[]>('/booking')
          .then((r) => ({ bookings: r.data ?? [], error: false }))
          .catch(() => ({ bookings: [] as Booking[], error: true })),
        api.get<Vehicle[]>('/bms/config/vehicles').then((r) => ({ rows: r.data ?? [], error: false })).catch(() => ({ rows: [] as Vehicle[], error: true })),
        api.get<Driver[]>('/bms/config/drivers').then((r) => ({ rows: r.data ?? [], error: false })).catch(() => ({ rows: [] as Driver[], error: true })),
        api.get<HelperResource[]>('/bms/config/helpers').then((r) => ({ rows: r.data ?? [], error: false })).catch(() => ({ rows: [] as HelperResource[], error: true })),
        api.get<DispatchAssignment[]>('/dispatch/assignments')
          .then((r) => ({ assignments: r.data ?? [], error: false }))
          .catch(() => ({ assignments: [] as DispatchAssignment[], error: true })),
        api.get<DailySalesRecord[]>('/daily-sales')
          .then((r) => ({ records: r.data ?? [], error: false }))
          .catch(() => ({ records: [], error: true })),
        api.get<ReportJobOrder[]>('/job-order')
          .then((r) => ({ rows: r.data ?? [], error: false }))
          .catch(() => ({ rows: [] as ReportJobOrder[], error: true })),
        api.get<PostServiceRecord[]>('/post-service')
          .then((r) => ({ rows: r.data ?? [], error: false }))
          .catch(() => ({ rows: [] as PostServiceRecord[], error: true })),
      ]);
      setBookings(bookingResult.bookings);
      setBookingLoadError(bookingResult.error);
      setJobOrders(jobOrdersResult.rows);
      setVehicles(vehiclesResult.rows);
      setVehicleLoadError(vehiclesResult.error);
      setDrivers(driversResult.rows);
      setHelpers(helpersResult.rows);
      setDispatchAssignments(assignmentsResult.assignments);
      setAssignmentLoadError(assignmentsResult.error);
      setJobOrderLoadError(jobOrdersResult.error);
      setPostServiceRecords(postServiceResult.rows);
      setPostServiceLoadError(postServiceResult.error);
      setCrewLoadError(driversResult.error || helpersResult.error);
      setDailySalesRecords(salesResult.records);
      setDailySalesLoadError(salesResult.error);
      if (bookingResult.error) toast.error('Unable to load bookings for daily report KPIs');
      if (salesResult.error) toast.error('Unable to load verified collection data for payment tracking');
    } catch {
      toast.error('Failed to load report data');
    } finally {
      dataHasLoaded.current = true;
      setLoading(false);
      dataLoadInFlight.current = false;
    }
  }

  async function loadSavedReports() {
    setSavedReportsLoading(true);
    try {
      const res = await api.get<SavedReport[]>('/reports/saved');
      setSavedReports(res.data ?? []);
    } catch {
      toast.error('Failed to load saved reports');
    } finally {
      setSavedReportsLoading(false);
    }
  }

  async function saveCurrentReport() {
    setSavingReport(true);
    try {
      const periodKey = reportType === 'daily' ? dateFrom : reportType === 'monthly' ? dateFrom.slice(0, 4) : `${dateFrom}:${dateTo}`;
      await api.post('/reports/save', {
        reportType,
        periodKey,
        garage: garage === 'All' ? null : garage,
        kpis: {
          ...(reportType === 'forecast' && forecast ? {
            predictedBookings: forecast.demand?.totalForecast ?? null,
            forecastPeriod: `${forecast.params.forecastStart}:${forecast.params.forecastEnd}`,
            historicalBookingsUsed: forecast.dataQuality.trainingBookings,
            mae: forecast.evaluation.backtest.mae,
            mape: forecast.evaluation.backtest.mape,
          } : {
            totalBookings: kpis.total,
            completedJobs: reportType === 'operational' ? operationalSnapshot.completedBookings : kpis.completed,
            totalRevenue: kpis.revenue,
          }),
        },
        series: {
          bookingAnalytics,
          revenueAnalytics,
          serviceDistribution,
          vehicleAssignmentCounts: fleetUtilization,
          operationalMetrics: operationalSnapshot,
          jobOrderStatusDistribution,
          vehicleStatus: operationalData.snapshot?.vehicles ?? null,
          ...(reportType === 'forecast' && forecast ? { demandForecast: forecast } : {}),
        },
        rawMetrics: {
          dateFrom,
          dateTo,
          service: selectedService,
          vehicleId: selectedVehicleId,
          filteredCount: filteredBookings.length,
          dispatchAssignmentCount: filteredAssignments.length,
          postServiceRecordCount: filteredPostServiceRecords.length,
        },
      });
      toast.success('Report saved to database');
      await loadSavedReports();
    } catch {
      toast.error('Failed to save report');
    } finally {
      setSavingReport(false);
    }
  }

  function forecastRequestBody() {
    return { startDate: forecastHistory.start, endDate: forecastHistory.end, serviceType: 'All', garage, vehicleId: 'All', forecastHorizon };
  }

  /** One request returns the data for all four forecast tabs; the current view stays visible while it refreshes. */
  async function loadForecast() {
    const requestId = ++forecastRequestId.current;
    setForecastLoading(true);
    setForecastError(null);
    try {
      const res = await api.post<ForecastDashboard>('/reports/forecast', forecastRequestBody());
      if (requestId === forecastRequestId.current) {
        setForecast(res.data);
        aiRequestId.current += 1;
        setAiInsights(null);
        setAiError(null);
        setAiLoading(false);
      }
    } catch (error) {
      if (requestId !== forecastRequestId.current) return;
      const message = (error as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setForecastError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'The forecast could not be loaded right now.',
      );
    } finally {
      if (requestId === forecastRequestId.current) setForecastLoading(false);
    }
  }

  /** Asks the LLM to interpret the computed forecast; called when the AI Insights tab is opened. */
  async function loadAiInsights(force = false) {
    const requestId = ++aiRequestId.current;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.post<AiInsightsResponse>('/reports/forecast/insights', { ...forecastRequestBody(), ...(force ? { refreshInsights: true } : {}) });
      if (requestId === aiRequestId.current) setAiInsights(res.data);
    } catch {
      if (requestId === aiRequestId.current) setAiError('The AI interpretation could not be loaded. Rule-based insights from the forecast data are shown instead.');
    } finally {
      if (requestId === aiRequestId.current) setAiLoading(false);
    }
  }

  const loadAiInsightsRef = useRef(loadAiInsights);
  loadAiInsightsRef.current = loadAiInsights;
  const loadAiInsightsCallback = useCallback((force?: boolean) => { void loadAiInsightsRef.current(force); }, []);

  const vehicleByBooking = useMemo(() => {
    const byBooking = new Map<string, string>();
    dispatchAssignments.forEach((assignment) => {
      if (assignment.vehicleId && assignment.state?.toUpperCase() === 'CONFIRMED') {
        byBooking.set(assignment.bookingUuid, assignment.vehicleId);
      }
    });
    return byBooking;
  }, [dispatchAssignments]);

  const bookingsByReference = useMemo(() => {
    const byReference = new Map<string, Booking>();
    bookings.forEach((booking) => [booking.id, booking.bookingId, booking.bookingNo].forEach((key) => {
      if (key) byReference.set(key, booking);
    }));
    return byReference;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const bookingDate = b.date?.slice(0, 10);
      const matchDate = (!dateFrom || bookingDate >= dateFrom) && (!dateTo || bookingDate <= dateTo);
      const matchService = selectedService === 'All' || b.service === selectedService;
      const matchVehicle = selectedVehicleId === 'All' || vehicleByBooking.get(b.id) === selectedVehicleId;
      return matchDate && matchService && matchVehicle;
    });
  }, [bookings, dateFrom, dateTo, selectedService, selectedVehicleId, vehicleByBooking]);
  const filteredBookingIds = useMemo(() => new Set(filteredBookings.map((booking) => booking.id)), [filteredBookings]);
  const filteredPostServiceRecords = useMemo(() => postServiceRecords.filter((record) => {
    const booking = bookingsByReference.get(record.bookingId || '') || bookingsByReference.get(record.bookingNo || '');
    return Boolean(booking && filteredBookingIds.has(booking.id));
  }), [postServiceRecords, bookingsByReference, filteredBookingIds]);

  const kpis = useMemo(() => {
    const total = filteredBookings.length;
    const completed = filteredBookings.filter((b) => b.status === 'Completed').length;
    const revenue = filteredBookings.reduce((sum, b) => sum + toNumber(b.amount), 0);
    return { total, completed, revenue };
  }, [filteredBookings]);

  const bookingAnalytics = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    const dayMs = 86400000;
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const totalDays = Math.min(60, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

    const matchServiceGarage = (b: Booking) =>
      (selectedService === 'All' || b.service === selectedService) &&
      (selectedVehicleId === 'All' || vehicleByBooking.get(b.id) === selectedVehicleId);

    const current = new Map<string, number>();
    const previous = new Map<string, number>();
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      current.set(fmt(d), 0);
      const p = new Date(start);
      p.setDate(start.getDate() - totalDays + i);
      previous.set(fmt(p), 0);
    }
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - totalDays);

    bookings.forEach((b) => {
      if (!matchServiceGarage(b)) return;
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return;
      const key = fmt(d);
      if (current.has(key)) {
        current.set(key, (current.get(key) || 0) + 1);
      } else if (d >= prevStart && d < start && previous.has(key)) {
        previous.set(key, (previous.get(key) || 0) + 1);
      }
    });

    const labels = Array.from(current.keys());
    return labels.map((label) => ({
      label,
      current: current.get(label) || 0,
      previous: previous.get(label) || 0,
    }));
  }, [bookings, dateFrom, dateTo, selectedService, selectedVehicleId]);

  const revenueAnalytics = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    const dayMs = 86400000;
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const totalDays = Math.min(60, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    const buckets: Record<string, number> = {};
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      buckets[fmt(d)] = 0;
    }
    filteredBookings.forEach((b) => {
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return;
      const key = fmt(d);
      if (key in buckets) {
        buckets[key] += toNumber(b.amount);
      }
    });
    return Object.keys(buckets).map((label) => ({ label, revenue: buckets[label] }));
  }, [filteredBookings, dateFrom, dateTo]);

  const serviceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredBookings.forEach((b) => {
      const key = b.service || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredBookings]);

  const fleetUtilization = useMemo(() => {
    const counts = new Map<string, number>();
    dispatchAssignments.filter((assignment) => {
      if (assignment.state?.toUpperCase() !== 'CONFIRMED' || !assignment.vehicleId) return false;
      const booking = bookingsByReference.get(assignment.bookingUuid);
      if (!booking || !filteredBookingIds.has(booking.id)) return false;
      const serviceDate = (assignment.serviceDate || booking?.date || '').slice(0, 10);
      if (dateFrom && serviceDate < dateFrom) return false;
      if (dateTo && serviceDate > dateTo) return false;
      if (selectedService !== 'All' && booking?.service !== selectedService) return false;
      if (selectedVehicleId !== 'All' && assignment.vehicleId !== selectedVehicleId) return false;
      return true;
    })
      .forEach((assignment) => {
        const vehicle = vehicles.find((item) => item.id === assignment.vehicleId);
        const name = vehicle?.alias || vehicle?.plateNumber || 'Unlisted vehicle';
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    return Array.from(counts, ([name, assignedJobs]) => ({ name, assignedJobs }));
  }, [dispatchAssignments, vehicles, bookingsByReference, filteredBookingIds, dateFrom, dateTo, selectedService, selectedVehicleId]);

  // Daily report computations. Everything here is about bookings scheduled for today (Manila).
  const todayBookings = useMemo(() => {
    const todayKey = getManilaDateInputValue();
    return bookings
      .filter((booking) => booking.date?.slice(0, 10) === todayKey
        && (selectedService === 'All' || booking.service === selectedService)
        && (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId))
      .sort((a, b) => (timeToMinutes(a.preferredTime) ?? 24 * 60) - (timeToMinutes(b.preferredTime) ?? 24 * 60));
  }, [bookings, selectedService, selectedVehicleId, vehicleByBooking]);

  const salesByService = useMemo(() => {
    const map = new Map<string, { service: string; amount: number; count: number }>();
    todayBookings.forEach((booking) => {
      if (normalizeBookingStatus(booking.status) === 'Cancelled') return;
      const service = booking.service || 'Other';
      const entry = map.get(service) ?? { service, amount: 0, count: 0 };
      entry.amount += toNumber(booking.amount);
      entry.count += 1;
      map.set(service, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [todayBookings]);

  // Trucks that can take a job today: active and not in the shop.
  const freeTrucks = useMemo(() => vehicles.filter((vehicle) => vehicle.isActive !== false
    && !['UNDER_MAINTENANCE', 'UNDER_REPAIR'].includes(vehicle.status)).length, [vehicles]);
  const freeHelpers = useMemo(() => helpers.filter((helper) => helper.status.trim().toLowerCase() === 'available').length, [helpers]);

  // Bookings carry a start time but no end time, so each job is treated as a
  // DAILY_JOB_HOURS block from its preferred time when counting jobs running at once.
  const jobsByHour = useMemo(() => {
    const blocks = todayBookings.flatMap((booking) => {
      if (normalizeBookingStatus(booking.status) === 'Cancelled') return [];
      const start = timeToMinutes(booking.preferredTime);
      return start === null ? [] : [{ start, end: start + DAILY_JOB_HOURS * 60 }];
    });
    const unscheduled = todayBookings.filter((booking) => normalizeBookingStatus(booking.status) !== 'Cancelled' && timeToMinutes(booking.preferredTime) === null).length;
    if (blocks.length === 0) return { hours: [] as { hour: number; label: string; jobs: number }[], peak: 0, overStart: null as number | null, overEnd: null as number | null, unscheduled };
    const firstHour = Math.min(8, Math.floor(Math.min(...blocks.map((b) => b.start)) / 60));
    const lastHour = Math.min(23, Math.max(18, Math.ceil(Math.max(...blocks.map((b) => b.end)) / 60) - 1));
    const hours = [];
    for (let hour = firstHour; hour <= lastHour; hour += 1) {
      const slotStart = hour * 60;
      const slotEnd = slotStart + 60;
      const jobs = blocks.filter((b) => b.start < slotEnd && b.end > slotStart).length;
      const label = `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'AM' : 'PM'}`;
      hours.push({ hour, label, jobs });
    }
    const over = hours.filter((h) => h.jobs > freeTrucks);
    return {
      hours,
      peak: Math.max(...hours.map((h) => h.jobs)),
      overStart: over.length ? over[0].hour : null,
      overEnd: over.length ? over[over.length - 1].hour + 1 : null,
      unscheduled,
    };
  }, [todayBookings, freeTrucks]);

  const paymentTracking = useMemo(() => {
    const todayKey = getManilaDateInputValue();
    const activeTodayBookings = bookings.filter((booking) => booking.date?.slice(0, 10) === todayKey
      && normalizeBookingStatus(booking.status) !== 'Cancelled'
      && (selectedService === 'All' || booking.service === selectedService)
      && (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId));
    const activeTodayKeys = new Set(activeTodayBookings.flatMap((booking) => [booking.id, booking.bookingId, booking.bookingNo].filter((key): key is string => Boolean(key))));
    const bookingKeys = new Map<string, Booking>();
    bookings.forEach((booking) => [booking.id, booking.bookingId, booking.bookingNo].forEach((key) => {
      if (key) bookingKeys.set(key, booking);
    }));
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    const totals = { cash: 0, bdo: 0, gcash: 0, xendit: 0 };
    dailySalesRecords.forEach((record) => {
      const booking = bookingKeys.get(record.bookingId ?? '') ?? bookingKeys.get(record.bookingNo ?? '');
      if (!booking || !activeTodayKeys.has(booking.id)) return;
      if (selectedService !== 'All' && booking.service !== selectedService) return;
      if (selectedVehicleId !== 'All' && vehicleByBooking.get(booking.id) !== selectedVehicleId && record.plateNumber !== selectedVehicle?.plateNumber) return;
      totals.cash += toNumber(record.cashPayment);
      totals.bdo += toNumber(record.bdoPayment);
      totals.gcash += toNumber(record.gcashPayment);
      totals.xendit += toNumber(record.xenditPayment);
    });
    const sales = activeTodayBookings.reduce((sum, booking) => sum + toNumber(booking.amount), 0);
    const collected = totals.cash + totals.bdo + totals.gcash + totals.xendit;
    return { ...totals, sales, collected, outstanding: Math.max(0, sales - collected) };
  }, [bookings, dailySalesRecords, selectedService, selectedVehicleId, vehicles, vehicleByBooking]);

  const dailyKpis = useMemo(() => {
    const todayKey = getManilaDateInputValue();
    const todayBookings = bookings.filter((booking) => booking.date?.slice(0, 10) === todayKey
      && normalizeBookingStatus(booking.status) !== 'Cancelled'
      && (selectedService === 'All' || booking.service === selectedService)
      && (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId));
    const totalSales = todayBookings.reduce((sum, booking) => sum + toNumber(booking.amount), 0);
    const bookingsToday = todayBookings.length;
    const pendingPlotting = todayBookings.filter((booking) => booking.status === 'For Plotting').length;
    const codCollected = paymentTracking.cash;
    const onlinePayments = paymentTracking.bdo + paymentTracking.gcash + paymentTracking.xendit;
    const pendingCollections = paymentTracking.outstanding;
    const salesBookingKeys = new Set(dailySalesRecords.flatMap((record) => {
      if (String(record.date || '').slice(0, 10) !== todayKey
        || (record.status !== 'Submitted' && record.reportStatus !== 'Submitted')
        || toNumber(record.totalDailySales) <= 0) return [];
      return [record.bookingId, record.bookingNo].filter((key): key is string => Boolean(key));
    }));
    const completedInSalesReport = bookings.filter((booking) => normalizeBookingStatus(booking.status) !== 'Cancelled'
      && (selectedService === 'All' || booking.service === selectedService)
      && (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId)
      && [booking.id, booking.bookingId, booking.bookingNo].some((key) => key && salesBookingKeys.has(key)));
    const completedJobs = new Set([
      ...todayBookings.filter((booking) => normalizeBookingStatus(booking.status) === 'Completed').map((booking) => booking.id),
      ...completedInSalesReport.map((booking) => booking.id),
    ]).size;
    const cancelledJobs = bookings.filter((booking) => booking.date?.slice(0, 10) === todayKey
      && normalizeBookingStatus(booking.status) === 'Cancelled'
      && (selectedService === 'All' || booking.service === selectedService)
      && (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId)).length;
    return {
      totalSales,
      bookingsToday,
      pendingPlotting,
      codCollected,
      onlinePayments,
      pendingCollections,
      completedJobs,
      cancelledJobs,
    };
  }, [bookings, dailySalesRecords, selectedService, selectedVehicleId, paymentTracking, vehicleByBooking]);

  // Operational metrics use the owning dispatch/completion records. A missing
  // source is represented as unavailable rather than as a zero or an estimate.
  const filteredAssignments = useMemo(() => dispatchAssignments.filter((assignment) => {
    if (assignment.state?.toUpperCase() !== 'CONFIRMED') return false;
    const booking = bookingsByReference.get(assignment.bookingUuid);
    if (!booking || !filteredBookingIds.has(booking.id)) return false;
    const serviceDate = (assignment.serviceDate || booking?.date || '').slice(0, 10);
    if (dateFrom && serviceDate < dateFrom) return false;
    if (dateTo && serviceDate > dateTo) return false;
    if (selectedService !== 'All' && booking?.service !== selectedService) return false;
    if (selectedVehicleId !== 'All' && assignment.vehicleId !== selectedVehicleId) return false;
    return true;
  }), [dispatchAssignments, bookingsByReference, filteredBookingIds, dateFrom, dateTo, selectedService, selectedVehicleId]);

  const filteredJobOrders = useMemo(() => jobOrders.filter((jobOrder) => {
    const booking = bookingsByReference.get(jobOrder.bookingUuid || jobOrder.bookingId || jobOrder.bookingIdAlias || '');
    const serviceDate = (jobOrder.serviceDate || booking?.date || '').slice(0, 10);
    if (dateFrom && serviceDate < dateFrom) return false;
    if (dateTo && serviceDate > dateTo) return false;
    if (selectedService !== 'All' && booking?.service !== selectedService) return false;
    if (selectedVehicleId !== 'All') {
      const assignedVehicle = jobOrder.bookingUuid ? vehicleByBooking.get(jobOrder.bookingUuid) : undefined;
      if (assignedVehicle !== selectedVehicleId) return false;
    }
    return ['pending', 'distributed'].includes(String(jobOrder.status || '').trim().toLowerCase());
  }), [jobOrders, bookingsByReference, dateFrom, dateTo, selectedService, selectedVehicleId, vehicleByBooking]);

  const jobOrderStatusDistribution = useMemo(() => {
    const counts = new Map<string, number>([['Pending', 0], ['Distributed', 0]]);
    filteredJobOrders.forEach((jobOrder) => {
      const status = String(jobOrder.status || '').trim().toLowerCase();
      if (status === 'pending') counts.set('Pending', (counts.get('Pending') || 0) + 1);
      if (status === 'distributed') counts.set('Distributed', (counts.get('Distributed') || 0) + 1);
    });
    return Array.from(counts, ([name, value]) => ({ name, value }));
  }, [filteredJobOrders]);


  // Operational Report figures come from GET /reports/operational and /reports/resources-snapshot
  // (see components/reports/operational). This snapshot feeds Save and the automatic save.
  const operationalSnapshot = useMemo(() => {
    const report = operationalData.report;
    const resources = operationalData.snapshot;
    return {
      definitionsSource: 'analytics /reports/operational',
      bookingCount: report?.totals.bookings ?? null,
      includesCancelledInTotal: report?.params?.includesCancelledInTotal ?? null,
      bookingsWithVehicle: report?.totals.withVehicle ?? null,
      bookingsUnassigned: report?.totals.unassigned ?? null,
      bookingsWithVehicleRate: report ? vehiclePercent(report.totals) : null,
      completedBookings: report?.totals.completed ?? null,
      cancelledBookings: report?.totals.cancelled ?? null,
      jobOrders: report?.totals.jobOrders ?? null,
      jobOrdersNotDistributed: report?.totals.jobOrdersNotDistributed ?? null,
      monthly: report?.monthly ?? [],
      jobsPerVehicle: report?.jobsPerVehicle ?? [],
      resourcesSnapshot: resources,
    };
  }, [operationalData]);

  // Monthly report computations. Revenue and payment methods come from verified
  // Daily Sales rows; trip counts continue to come from bookings.
  const monthlyEligibleBookings = useMemo(() => bookings.filter((booking) =>
    (selectedService === 'All' || booking.service === selectedService) &&
    (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId)
  ), [bookings, selectedService, selectedVehicleId, vehicleByBooking]);

  const monthlySalesRecords = useMemo(() => {
    if (!dateFrom || !dateTo) return [] as DailySalesRecord[];
    const bookingKeys = new Set(monthlyEligibleBookings.flatMap((booking) =>
      [booking.id, booking.bookingId, booking.bookingNo].filter((key): key is string => Boolean(key))
    ));
    return dailySalesRecords.filter((record) => {
      const recordDate = String(record.date || '').slice(0, 10);
      const linked = [record.bookingId, record.bookingNo].some((key) => key && bookingKeys.has(key));
      return linked && recordDate >= dateFrom && recordDate <= dateTo;
    });
  }, [dailySalesRecords, monthlyEligibleBookings, dateFrom, dateTo]);

  // Trips are non-cancelled bookings whose service date has arrived (up to today, Manila).
  // Later bookings in the window are counted separately as upcoming, never as trips.
  const monthlyToday = getManilaDateInputValue();
  const monthlyTripBookings = useMemo(() => filteredBookings.filter((booking) =>
    normalizeBookingStatus(booking.status) !== 'Cancelled' && (booking.date || '').slice(0, 10) <= monthlyToday
  ), [filteredBookings, monthlyToday]);
  const monthlyUpcomingTrips = useMemo(() => filteredBookings.filter((booking) =>
    normalizeBookingStatus(booking.status) !== 'Cancelled' && (booking.date || '').slice(0, 10) > monthlyToday
  ).length, [filteredBookings, monthlyToday]);

  /** The booking a verified sales row belongs to, so payments can be counted per booking. */
  const monthlyBookingKeyOf = useMemo(() => {
    const byKey = new Map<string, string>();
    monthlyEligibleBookings.forEach((booking) => [booking.id, booking.bookingId, booking.bookingNo].forEach((key) => { if (key) byKey.set(key, booking.id); }));
    return (record: DailySalesRecord) => byKey.get(record.bookingId ?? '') ?? byKey.get(record.bookingNo ?? '') ?? null;
  }, [monthlyEligibleBookings]);

  /** Bookings whose verified payments (net of refunds) are above zero, among the given sales rows. */
  const countPaidBookings = useCallback((records: DailySalesRecord[]) => {
    const net = new Map<string, number>();
    records.forEach((record) => {
      const key = monthlyBookingKeyOf(record);
      if (key) net.set(key, (net.get(key) ?? 0) + toNumber(record.totalDailySales));
    });
    return [...net.values()].filter((value) => value > 0).length;
  }, [monthlyBookingKeyOf]);

  const monthlyData = useMemo(() => {
    if (!dateFrom || !dateTo) return { months: [], latestMonth: null, previousMonth: null };
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return { months: [], latestMonth: null, previousMonth: null };

    const months: { label: string; year: number; month: number; revenue: number; trips: number; paidTrips: number }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      months.push({
        label: cursor.toLocaleString('en-US', { month: 'short' }),
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
        revenue: 0,
        trips: 0,
        paidTrips: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const monthOf = (day: string) => {
      const date = new Date(`${day.slice(0, 10)}T00:00:00`);
      return Number.isNaN(date.getTime()) ? undefined : months.find((m) => m.year === date.getFullYear() && m.month === date.getMonth());
    };

    const recordsByMonth = new Map<(typeof months)[number], DailySalesRecord[]>();
    monthlySalesRecords.forEach((record) => {
      const month = monthOf(String(record.date || ''));
      if (!month) return;
      month.revenue += toNumber(record.totalDailySales);
      recordsByMonth.set(month, [...(recordsByMonth.get(month) ?? []), record]);
    });
    recordsByMonth.forEach((records, month) => { month.paidTrips = countPaidBookings(records); });

    monthlyTripBookings.forEach((booking) => {
      const month = booking.date ? monthOf(booking.date) : undefined;
      if (month) month.trips += 1;
    });

    const latestMonth = months[months.length - 1] || null;
    const previousMonth = months.length > 1 ? months[months.length - 2] : null;
    return { months, latestMonth, previousMonth };
  }, [monthlyTripBookings, monthlySalesRecords, countPaidBookings, dateFrom, dateTo]);

  const monthlyKpis = useMemo(() => {
    const totalRevenue = monthlySalesRecords.reduce((sum, record) => sum + toNumber(record.totalDailySales), 0);
    const paidTrips = countPaidBookings(monthlySalesRecords);
    return {
      monthlyRevenue: monthlyData.latestMonth?.revenue || 0,
      totalTrips: monthlyTripBookings.length,
      upcomingTrips: monthlyUpcomingTrips,
      paidTrips,
      /** Verified revenue ÷ bookings with a verified payment; trips with no payment yet don't dilute it. */
      avgRevenuePerPaidTrip: paidTrips > 0 ? totalRevenue / paidTrips : 0,
    };
  }, [monthlyData, monthlySalesRecords, monthlyTripBookings, monthlyUpcomingTrips, countPaidBookings]);

  const monthlyServiceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    monthlyTripBookings.forEach((b) => {
      const key = b.service || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [monthlyTripBookings]);

  const monthlyPaymentDistribution = useMemo(() => {
    const map = new Map<string, number>([['Cash', 0], ['BDO', 0], ['GCash', 0], ['Xendit', 0]]);
    monthlySalesRecords.forEach((record) => {
      map.set('Cash', (map.get('Cash') || 0) + toNumber(record.cashPayment));
      map.set('BDO', (map.get('BDO') || 0) + toNumber(record.bdoPayment));
      map.set('GCash', (map.get('GCash') || 0) + toNumber(record.gcashPayment));
      map.set('Xendit', (map.get('Xendit') || 0) + toNumber(record.xenditPayment));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).filter((entry) => entry.value !== 0);
  }, [monthlySalesRecords]);

  const monthlyStatusDistribution = useMemo(() => {
    const labels = ['For Plotting', 'For Verification', 'Assigned', 'Rescheduled', 'Completed', 'Cancelled'];
    const map = new Map(labels.map((label) => [label, 0]));
    filteredBookings.forEach((b) => {
      const status = normalizeBookingStatus(b.status) || 'Unknown';
      map.set(status, (map.get(status) ?? 0) + 1);
    });
    const orderedLabels = [
      ...labels,
      ...Array.from(map.keys()).filter((name) => !labels.includes(name)).sort((a, b) => a.localeCompare(b)),
    ];
    return orderedLabels.map((name) => ({ name, value: map.get(name) || 0 }));
  }, [filteredBookings]);

  const reportAutoSaveKey = useMemo(() => JSON.stringify({
    reportType,
    dateFrom,
    dateTo,
    selectedService,
    selectedVehicleId,
    forecast: reportType === 'forecast' ? forecast : null,
    kpis,
    bookings: filteredBookings.map((booking) => [
      booking.id,
      booking.status,
      booking.amount,
      booking.date,
      booking.garage,
    ]),
    dispatchAssignments: filteredAssignments.map((assignment) => [assignment.bookingUuid, assignment.vehicleId, assignment.driverId, assignment.helperIds, assignment.serviceDate, assignment.state]),
    jobOrders: filteredJobOrders.map((jobOrder) => [jobOrder.bookingUuid, jobOrder.status, jobOrder.serviceDate]),
    postServiceRecords: filteredPostServiceRecords.map((record) => [record.bookingId, record.bookingNo, record.status, record.postServiceStatus, record.arrivalTime, record.finalizedAt]),
    crew: [drivers.map((driver) => [driver.id, driver.status, driver.crewStatus, driver.crew_status]), helpers.map((helper) => [helper.id, helper.status])],
    vehicles: vehicles.map((vehicle) => [vehicle.id, vehicle.status, vehicle.isAssigned]),
    sourceAvailability: [bookingLoadError, assignmentLoadError, jobOrderLoadError, postServiceLoadError, crewLoadError, vehicleLoadError],
  }), [reportType, dateFrom, dateTo, selectedService, selectedVehicleId, forecast, kpis, filteredBookings, filteredAssignments, filteredJobOrders, filteredPostServiceRecords, drivers, helpers, vehicles, bookingLoadError, assignmentLoadError, jobOrderLoadError, postServiceLoadError, crewLoadError, vehicleLoadError]);

  useEffect(() => {
    if (loading || autoSavedReportKeys.current.has(reportAutoSaveKey)) return;

    const timeout = window.setTimeout(() => {
      void autoSaveCurrentReport(reportAutoSaveKey);
    }, 500);
    return () => window.clearTimeout(timeout);
    // The key represents every report input and output that must be persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reportAutoSaveKey]);

  async function autoSaveCurrentReport(key: string) {
    if (autoSavedReportKeys.current.has(key)) return;
    autoSavedReportKeys.current.add(key);
    try {
      await api.post('/reports/save', {
        reportType,
        periodKey: reportType === 'daily' ? dateFrom : reportType === 'monthly' ? dateFrom.slice(0, 4) : `${dateFrom}:${dateTo}`,
        garage: garage === 'All' ? null : garage,
        kpis: {
          totalBookings: kpis.total,
          completedJobs: reportType === 'operational' ? operationalSnapshot.completedBookings : kpis.completed,
          totalRevenue: kpis.revenue,
        },
        series: {
          bookingAnalytics, revenueAnalytics, serviceDistribution,
          vehicleAssignmentCounts: fleetUtilization,
          operationalMetrics: operationalSnapshot,
          jobOrderStatusDistribution,
          vehicleStatus: operationalData.snapshot?.vehicles ?? null,
          ...(reportType === 'forecast' && forecast ? { demandForecast: forecast } : {}),
        },
        rawMetrics: {
          dateFrom, dateTo, service: selectedService, vehicleId: selectedVehicleId,
          filteredCount: filteredBookings.length,
          dispatchAssignmentCount: filteredAssignments.length,
          postServiceRecordCount: filteredPostServiceRecords.length,
          automaticallySaved: true,
        },
      });
      await loadSavedReports();
    } catch {
      autoSavedReportKeys.current.delete(key);
      toast.error('Automatic MySQL report save failed');
    }
  }

  /** Describes exactly what the open tab shows, so the Excel and PDF match the screen. */
  function buildReportDocument(): ReportDocument | null {
    const today = getManilaDateInputValue();
    const dateLabel = (value: string, weekday = false) => {
      const date = new Date(`${value.slice(0, 10)}T00:00:00`);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { ...(weekday ? { weekday: 'short' as const } : {}), month: 'short', day: 'numeric', year: 'numeric' });
    };
    const share = (part: number, whole: number) => (whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0);
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === selectedVehicleId);
    const filters = [
      { label: 'Service', value: selectedService === 'All' ? 'All services' : selectedService },
      { label: 'Vehicle', value: selectedVehicleId === 'All' ? 'All vehicles' : selectedVehicle?.plateNumber || selectedVehicle?.alias || 'Selected vehicle' },
    ];
    const base = { filters, generatedBy: user?.fullName || 'Administrator', generatedAt: new Date() };

    if (activeSection === 'daily') {
      const unavailable = dailySalesLoadError || bookingLoadError;
      const serviceTotal = salesByService.reduce((sum, row) => sum + row.amount, 0);
      const todayTotal = todayBookings.reduce((sum, booking) => sum + (normalizeBookingStatus(booking.status) === 'Cancelled' ? 0 : toNumber(booking.amount)), 0);
      return {
        ...base,
        reportName: 'Daily Report',
        fileStem: 'daily-report',
        period: `Today, ${dateLabel(today, true)}`,
        sections: [
          {
            kind: 'metrics', title: 'Today at a glance', items: [
              { label: "Today's sales", value: bookingLoadError ? null : dailyKpis.totalSales, format: 'peso', note: 'Active booking value' },
              { label: 'Bookings today', value: bookingLoadError ? null : dailyKpis.bookingsToday, format: 'number', note: `${dailyKpis.cancelledJobs} cancelled today` },
              { label: 'Awaiting assignment', value: bookingLoadError ? null : dailyKpis.pendingPlotting, format: 'number', note: 'For Plotting, no truck or team yet' },
              { label: 'Completed jobs', value: unavailable ? null : dailyKpis.completedJobs, format: 'number', note: "Completed or in today's sales report" },
            ],
          },
          {
            kind: 'metrics', title: 'Payment tracking', items: [
              { label: 'Sales', value: bookingLoadError ? null : paymentTracking.sales, format: 'peso', note: "Today's active booking value" },
              { label: 'Collected', value: dailySalesLoadError ? null : paymentTracking.collected, format: 'peso', note: 'Verified, net of refunds' },
              { label: 'Outstanding', value: dailySalesLoadError ? null : paymentTracking.outstanding, format: 'peso', note: 'Sales less collected' },
              { label: 'Collected in cash', value: dailySalesLoadError ? null : paymentTracking.cash, format: 'peso' },
              { label: 'Collected via BDO', value: dailySalesLoadError ? null : paymentTracking.bdo, format: 'peso' },
              { label: 'Collected via GCash', value: dailySalesLoadError ? null : paymentTracking.gcash, format: 'peso' },
              { label: 'Collected via Xendit', value: dailySalesLoadError ? null : paymentTracking.xendit, format: 'peso' },
            ],
          },
          {
            kind: 'table', title: 'Sales by service', note: "Today's non-cancelled bookings", emptyText: 'No sales scheduled today.',
            columns: [{ header: 'Service', key: 'service', width: 26 }, { header: 'Bookings', key: 'count', format: 'number', width: 12 }, { header: 'Sales', key: 'amount', format: 'peso', width: 18 }],
            rows: salesByService.map((row) => ({ service: row.service, count: row.count, amount: row.amount })),
            totals: { count: salesByService.reduce((sum, row) => sum + row.count, 0), amount: serviceTotal },
          },
          {
            kind: 'table', title: 'Jobs running by hour', note: `Each job counted as a ${DAILY_JOB_HOURS}-hour block from its start time; ${freeTrucks} trucks available`, emptyText: 'No timed bookings today.',
            columns: [{ header: 'Hour', key: 'label', width: 12 }, { header: 'Jobs running', key: 'jobs', format: 'number', width: 16 }],
            rows: jobsByHour.hours.map((hour) => ({ label: hour.label, jobs: hour.jobs })),
          },
          {
            kind: 'table', title: "Today's bookings", note: `Scheduled for ${dateLabel(today, true)}`, emptyText: 'No bookings scheduled today.',
            columns: [
              { header: 'Booking no.', key: 'bookingNo', width: 22 }, { header: 'Client', key: 'client', width: 28 }, { header: 'Service', key: 'service', width: 24 },
              { header: 'Time', key: 'time', width: 12 }, { header: 'Status', key: 'status', width: 22 }, { header: 'Amount', key: 'amount', format: 'peso', width: 16 },
            ],
            rows: todayBookings.map((booking) => ({
              bookingNo: booking.bookingNo ?? '-', client: booking.client, service: booking.service, time: formatTimeLabel(booking.preferredTime),
              status: dailyStatusLabel(booking.status), amount: toNumber(booking.amount),
            })),
            totals: { amount: todayTotal },
          },
        ],
      };
    }

    if (activeSection === 'operational') {
      const report = operationalData.report;
      if (!report) {
        toast.error('The report is still loading. Try again in a moment.');
        return null;
      }
      const { totals } = report;
      const resources = operationalData.snapshot;
      return {
        ...base,
        reportName: 'Operational Report',
        fileStem: 'operational-report',
        period: formatOperationalRange(dateFrom, dateTo),
        sections: [
          {
            kind: 'metrics', title: 'Performance this period', items: [
              { label: 'Total bookings', value: totals.bookings, format: 'number', note: report.params?.includesCancelledInTotal === false ? 'Received in this period, excluding cancelled' : 'Received in this period' },
              { label: 'Bookings with a vehicle', value: vehiclePercent(totals), format: 'percent', note: `${totals.unassigned} still unassigned` },
              { label: 'Completed services', value: totals.completed, format: 'number', note: `${totals.cancelled} cancelled` },
              { label: 'Job orders', value: totals.jobOrders, format: 'number', note: totals.jobOrdersNotDistributed > 0 ? `${totals.jobOrdersNotDistributed} not yet distributed` : 'All distributed' },
            ],
          },
          {
            kind: 'table', title: 'Completed vs cancelled jobs', note: 'Closed jobs per month',
            columns: [{ header: 'Month', key: 'month', width: 16 }, { header: 'Completed', key: 'completed', format: 'number' }, { header: 'Cancelled', key: 'cancelled', format: 'number' }],
            rows: report.monthly.map((month) => ({ month: monthLabel(month.month), completed: month.completed, cancelled: month.cancelled })),
            totals: { completed: totals.completed, cancelled: totals.cancelled },
          },
          {
            kind: 'table', title: 'Jobs per vehicle', note: 'Confirmed assignments in this period', emptyText: 'No vehicles assigned in this period.',
            columns: [{ header: 'Rank', key: 'rank', format: 'number', width: 8 }, { header: 'Vehicle', key: 'vehicle', width: 30 }, { header: 'Jobs', key: 'jobs', format: 'number' }],
            rows: report.jobsPerVehicle.map((vehicle, index) => ({ rank: index + 1, vehicle: vehicle.alias ? `${vehicle.plate} (${vehicle.alias})` : vehicle.plate, jobs: vehicle.jobs })),
          },
          resources ? {
            kind: 'table' as const, title: 'Resources right now', note: 'Today’s snapshot, not affected by the date range',
            columns: [{ header: 'Resource', key: 'name', width: 14 }, { header: 'Total', key: 'total', format: 'number' as const }, { header: 'Available', key: 'available', format: 'number' as const }, { header: 'Assigned or on duty', key: 'busy', format: 'number' as const, width: 20 }, { header: 'Under maintenance', key: 'maintenance', format: 'number' as const, width: 20 }, { header: 'Under repair or on leave', key: 'unavailable', format: 'number' as const, width: 24 }],
            rows: [
              { name: 'Vehicles', total: resources.vehicles.total, available: resources.vehicles.available, busy: resources.vehicles.assigned, maintenance: resources.vehicles.underMaintenance, unavailable: resources.vehicles.underRepair },
              { name: 'Drivers', total: resources.drivers.onRoster, available: resources.drivers.available, busy: resources.drivers.onDuty, maintenance: null, unavailable: resources.drivers.onLeave },
              { name: 'Helpers', total: resources.helpers.onRoster, available: resources.helpers.available, busy: resources.helpers.onDuty, maintenance: null, unavailable: resources.helpers.onLeave },
            ],
          } : { kind: 'list' as const, title: 'Resources right now', items: ['Today’s fleet and roster couldn’t be loaded.'] },
        ],
      };
    }

    if (activeSection === 'monthly') {
      const months = monthlyData.months;
      const latest = monthlyData.latestMonth;
      const previous = monthlyData.previousMonth;
      const rangeTrips = months.reduce((sum, month) => sum + month.trips, 0);
      const rangeRevenue = months.reduce((sum, month) => sum + month.revenue, 0);
      const serviceTotal = monthlyServiceDistribution.reduce((sum, item) => sum + item.value, 0);
      const paymentTotal = monthlyPaymentDistribution.reduce((sum, item) => sum + item.value, 0);
      const statusTotal = monthlyStatusDistribution.reduce((sum, item) => sum + item.value, 0);
      return {
        ...base,
        reportName: 'Monthly Report',
        fileStem: 'monthly-report',
        period: months.length ? `${months[0].label} ${months[0].year} to ${months[months.length - 1].label} ${months[months.length - 1].year} (${monthlyRange} months)` : `Last ${monthlyRange} months`,
        sections: [
          {
            kind: 'metrics', title: 'Monthly performance', items: [
              { label: `Revenue${latest ? `, ${latest.label} ${latest.year}` : ''}`, value: dailySalesLoadError ? null : monthlyKpis.monthlyRevenue, format: 'peso', note: previous ? `${previous.label} ${previous.year}: ${formatPeso(previous.revenue)}` : 'No earlier month to compare' },
              { label: `Revenue, last ${monthlyRange} months`, value: dailySalesLoadError ? null : rangeRevenue, format: 'peso', note: months.length ? `${months[0].label} ${months[0].year} to ${months[months.length - 1].label} ${months[months.length - 1].year}` : undefined },
              { label: 'Trips', value: monthlyKpis.totalTrips, format: 'number', note: `Up to today, last ${monthlyRange} months${monthlyKpis.upcomingTrips > 0 ? `; ${monthlyKpis.upcomingTrips} more booked for later this month` : ''}` },
              { label: 'Average per paid trip', value: dailySalesLoadError ? null : monthlyKpis.avgRevenuePerPaidTrip, format: 'peso', note: `Verified revenue ÷ ${monthlyKpis.paidTrips} paid ${monthlyKpis.paidTrips === 1 ? 'trip' : 'trips'}` },
            ],
          },
          {
            kind: 'table', title: 'Month-by-month', note: 'Newest month first',
            columns: [{ header: 'Month', key: 'month', width: 16 }, { header: 'Trips', key: 'trips', format: 'number' }, { header: 'Revenue', key: 'revenue', format: 'peso', width: 18 }, { header: 'Paid trips', key: 'paid', format: 'number' }, { header: 'Avg per paid trip', key: 'average', format: 'peso', width: 20 }, { header: 'Revenue vs prior month', key: 'change', format: 'percent', width: 22 }],
            rows: months.map((month, index) => {
              const prior = index > 0 ? months[index - 1] : null;
              return {
                month: `${month.label} ${month.year}`, trips: month.trips,
                revenue: dailySalesLoadError ? null : month.revenue,
                paid: dailySalesLoadError ? null : month.paidTrips,
                average: dailySalesLoadError ? null : month.paidTrips > 0 ? month.revenue / month.paidTrips : 0,
                change: dailySalesLoadError || !prior || prior.revenue <= 0 ? null : Number((((month.revenue - prior.revenue) / prior.revenue) * 100).toFixed(1)),
              };
            }).reverse(),
            totals: { trips: rangeTrips, revenue: dailySalesLoadError ? null : rangeRevenue, paid: dailySalesLoadError ? null : monthlyKpis.paidTrips, average: dailySalesLoadError ? null : monthlyKpis.avgRevenuePerPaidTrip, change: '' },
          },
          {
            kind: 'table', title: 'Service type', note: 'Trips by service',
            columns: [{ header: 'Service', key: 'name', width: 26 }, { header: 'Trips', key: 'value', format: 'number' }, { header: 'Share', key: 'share', format: 'percent' }],
            rows: [...monthlyServiceDistribution].sort((a, b) => b.value - a.value).map((item) => ({ name: item.name, value: item.value, share: share(item.value, serviceTotal) })),
            totals: { value: serviceTotal, share: serviceTotal > 0 ? 100 : 0 },
          },
          {
            kind: 'table', title: 'Payment method', note: 'Verified collections by method', emptyText: dailySalesLoadError ? 'Verified sales records are unavailable.' : 'No verified payments in this period.',
            columns: [{ header: 'Method', key: 'name', width: 20 }, { header: 'Amount collected', key: 'value', format: 'peso', width: 20 }, { header: 'Share', key: 'share', format: 'percent' }],
            rows: dailySalesLoadError ? [] : [...monthlyPaymentDistribution].sort((a, b) => b.value - a.value).map((item) => ({ name: item.name, value: item.value, share: share(item.value, paymentTotal) })),
            totals: { value: paymentTotal, share: paymentTotal > 0 ? 100 : 0 },
          },
          {
            kind: 'table', title: 'Booking status', note: 'All bookings in the period, including cancelled',
            columns: [{ header: 'Status', key: 'name', width: 22 }, { header: 'Bookings', key: 'value', format: 'number' }, { header: 'Share', key: 'share', format: 'percent' }],
            rows: monthlyStatusDistribution.map((item) => ({ name: item.name, value: item.value, share: share(item.value, statusTotal) })),
            totals: { value: statusTotal, share: statusTotal > 0 ? 100 : 0 },
          },
        ],
      };
    }

    // AI demand forecast: all four tabs in one document
    if (!forecast?.demand) {
      toast.error('Load a forecast before exporting it.');
      return null;
    }
    const demand = forecast.demand;
    const backtest = forecast.evaluation.backtest;
    const plan = forecast.resources;
    const insightSet = aiInsights?.status === 'ok' && aiInsights.insights ? aiInsights.insights : forecast.systemInsights;
    const insightSource = aiInsights?.status === 'ok' && aiInsights.insights ? `AI-generated (${aiInsights.model}), figures checked against the forecast` : 'Rule-based, from the forecast data';
    const periodLabel = horizonOptions().find((option) => option.id === forecastHorizon)?.label ?? forecastHorizon;
    return {
      ...base,
      filters: [{ label: 'Service', value: 'All services' }, { label: 'Vehicle', value: 'All vehicles' }, { label: 'History used', value: `${formatForecastRange(forecast.dataQuality.trainingStart ?? forecastHistory.start, forecast.params.historyEnd)} (${forecast.dataQuality.trainingBookings} bookings)` }, { label: 'Method', value: forecast.method.label }],
      reportName: 'AI Demand Forecast',
      fileStem: 'ai-demand-forecast',
      period: `${periodLabel}: ${dateLabel(forecast.params.forecastStart)} to ${dateLabel(forecast.params.forecastEnd)}`,
      landscape: true,
      sections: [
        {
          kind: 'metrics', title: 'Demand forecast', items: [
            { label: 'Total forecasted bookings', value: demand.totalForecast, format: 'number' },
            { label: 'Average per day', value: demand.dailyAverage, format: 'decimal' },
            { label: `Change per day vs. previous ${demand.previousPeriod.days} days`, value: demand.previousPeriod.changePct === null ? null : Number(demand.previousPeriod.changePct.toFixed(1)), format: 'percent' },
            { label: 'Expected demand', value: demand.demandLevel?.level ?? null },
            { label: 'Peak demand period', value: demand.peakWeek ? `${dateLabel(demand.peakWeek.start)} - ${dateLabel(demand.peakWeek.end)}` : demand.peakPattern ? `${demand.peakPattern.weekday}s (${demand.peakPattern.bookings} each)` : null },
            { label: 'Already booked in period', value: demand.alreadyBooked, format: 'number' },
            { label: 'Backtest MAE (bookings/day)', value: backtest.available ? Number((backtest.mae ?? 0).toFixed(2)) : null, format: 'decimal', note: backtest.available ? `${backtest.testDays} test days` : backtest.reason },
            { label: 'Backtest MAPE', value: backtest.mape === null ? null : Number(backtest.mape.toFixed(1)), format: 'percent' },
          ],
        },
        { kind: 'list', title: 'Forecast summary', items: [demand.summary] },
        {
          kind: 'table', title: 'Service demand', note: 'Bookings mapped to the four service types; unmapped bookings listed separately',
          columns: [{ header: 'Service', key: 'service', width: 26 }, { header: 'History', key: 'historical', format: 'number' }, { header: 'Forecast', key: 'forecast', format: 'decimal' }, { header: 'Share', key: 'share', format: 'percent' }, { header: 'Trend', key: 'trend', width: 14 }],
          rows: [
            ...forecast.services.rows.map((row) => ({ service: row.service, historical: row.historical, forecast: row.forecast, share: Number(row.forecastSharePct.toFixed(1)), trend: row.trend })),
            { service: 'No service type recorded', historical: forecast.services.unclassified.historical, forecast: forecast.services.unclassified.forecast, share: null, trend: '' },
          ],
        },
        plan.status === 'ok' ? {
          kind: 'table' as const, title: 'Resource planning (estimates)', note: plan.availabilityError ?? 'Busiest-day requirement vs. available resources',
          columns: [{ header: 'Resource', key: 'resource', width: 14 }, { header: 'Needed (busiest day)', key: 'needed', format: 'number' as const }, { header: 'Busiest day', key: 'day', width: 18 }, { header: 'Available', key: 'available', format: 'number' as const }, { header: 'Shortage', key: 'shortage', format: 'number' as const }],
          rows: plan.resources.map((r) => ({ resource: r.label, needed: r.peakRequired, day: dateLabel(r.peakDate), available: plan.availabilityError ? null : r.usableOnPeak, shortage: plan.availabilityError ? null : r.shortage })),
        } : { kind: 'list' as const, title: 'Resource planning', items: [plan.message ?? 'Resource requirements are unavailable.'] },
        { kind: 'list', title: 'Resource preparation', items: plan.recommendations.map((item) => item.text), emptyText: 'No preparation needed.' },
        { kind: 'list', title: `Key insights - ${insightSource}`, items: insightSet.keyInsights.map((item) => `${item.title}: ${item.detail}`), emptyText: 'No insights.' },
        { kind: 'list', title: 'Recommended actions', items: insightSet.recommendedActions.map((item) => `[${item.priority}] ${item.action} ${item.reason}`), emptyText: 'No actions.' },
        { kind: 'list', title: 'Potential risks', items: insightSet.risks.map((item) => `[${item.severity}] ${item.risk}: ${item.detail}`), emptyText: 'No significant risks.' },
        {
          kind: 'table', title: 'Daily forecast', note: 'Expected bookings per day (never below bookings already on the calendar)',
          columns: [{ header: 'Date', key: 'date', width: 22 }, { header: 'Forecast', key: 'forecast', format: 'decimal' }, { header: 'Already booked', key: 'booked', format: 'number' }],
          rows: demand.daily.map((day) => ({ date: dateLabel(day.date, true), forecast: day.forecast, booked: day.alreadyBooked })),
          totals: { forecast: demand.totalForecast, booked: demand.alreadyBooked },
        },
      ],
    };
  }

  async function exportPDF() {
    const report = buildReportDocument();
    if (!report) return;
    try {
      await exportReportPdf(report);
    } catch {
      toast.error('Unable to create the PDF report.');
    }
  }

  async function exportExcel() {
    const report = buildReportDocument();
    if (!report) return;
    try {
      await exportReportExcel(report);
    } catch {
      toast.error('Unable to create the Excel report.');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a1f6e]" />
      </div>
    );
  }

  const defaultRange = getDefaultRange();
  const rangeChanged = (activeSection === 'operational' || activeSection === 'forecast') && (dateFrom !== defaultRange.start || dateTo !== defaultRange.end);
  const appliedFilterCount = (selectedService !== 'All' ? 1 : 0) + (selectedVehicleId !== 'All' ? 1 : 0) + (rangeChanged ? 1 : 0);
  // Reset clears the filters but keeps you on the tab you are reading.
  const resetFilters = () => {
    setDateFrom(defaultRange.start);
    setDateTo(defaultRange.end);
    setSelectedService('All');
    setSelectedVehicleId('All');
  };

  // Save and Export sit in the filter row (pill style, aligned with the filters); the
  // forecast tab has no filter row, so there they sit in the AI Demand Forecasting header card.
  const reportActions = (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={saveCurrentReport}
        disabled={savingReport || (reportType === 'forecast' && !forecast)}
        className={`${FILTER_CHIP_CLASSES} gap-2.5 whitespace-nowrap font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/15 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Save size={18} aria-hidden="true" /> {savingReport ? 'Saving...' : 'Save report'}
      </button>
      <ExportMenu variant="primary" options={[{ label: 'PDF', icon: FileText, onSelect: () => { void exportPDF(); } }, { label: 'Excel', icon: FileSpreadsheet, onSelect: () => { void exportExcel(); } }]} />
    </div>
  );

  return (
    <div className="space-y-6" ref={reportRef}>
      <PageHeader
        icon={BarChart3}
        title="REPORTS"
        subtitle={<>Analyze bookings, revenue, operational performance, and <span className="font-medium text-[#d4a72c]">AI demand forecasts</span>.</>}
        subtitleClassName="mt-1 text-sm text-slate-500"
      />

      {/* Filters: the date control matches what the open tab actually uses. The forecast tab has none. */}
      {activeSection !== 'forecast' && (
      <div role="group" aria-label="Report filters" className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
        {activeSection === 'daily' ? (
          <ReadOnlyFilter label="Report date">Today - {formatFilterDate(getManilaDateInputValue(), true)}</ReadOnlyFilter>
        ) : activeSection === 'monthly' ? (
          <ReadOnlyFilter label="Period, set with 6M, 12M or 24M below">{formatFilterMonth(dateFrom)} to {formatFilterMonth(dateTo)}</ReadOnlyFilter>
        ) : (
          <>
            <span id="reports-date-range-label" className="sr-only">Date range</span>
            <DateRangeField id="reports-date-range" start={dateFrom} end={dateTo} onChangeStart={setDateFrom} onChangeEnd={setDateTo} presets={RANGE_PRESETS.map((preset) => ({ ...preset, range: getPresetRange(preset.id) }))} />
          </>
        )}
        <label htmlFor="reports-service" className="sr-only">Services</label>
        <ReportSelect
          id="reports-service"
          icon={Package}
          value={selectedService}
          onChange={setSelectedService}
          options={[{ value: 'All', label: 'All services' }, ...REPORT_SERVICES.map((service) => ({ value: service, label: service }))]}
        />
        <label htmlFor="reports-vehicle" className="sr-only">Vehicle</label>
        <ReportSelect
          id="reports-vehicle"
          icon={Truck}
          value={selectedVehicleId}
          onChange={setSelectedVehicleId}
          options={[{ value: 'All', label: 'All vehicles' }, ...vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.plateNumber || vehicle.alias || vehicle.model || 'Vehicle' }))]}
        />
        {appliedFilterCount > 0 && (
          <button type="button" onClick={resetFilters} title="Clear filters and go back to the default date range" className={`${FILTER_CHIP_CLASSES} shrink-0 gap-2 whitespace-nowrap border-dashed bg-slate-50 text-slate-600 hover:border-slate-400 hover:text-[#0b0f4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/15`}>
            <RotateCcw size={17} aria-hidden="true" /> Reset
          </button>
        )}
        <div className="ml-auto">{reportActions}</div>
      </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Report sections" className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50 p-2">
        {([
          { id: 'daily', label: 'Daily Report' },
          { id: 'operational', label: 'Operational Report' },
          { id: 'monthly', label: 'Monthly Report' },
          { id: 'forecast', label: 'AI Demand Forecast' },
        ] as const).map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={activeSection === section.id ? 'page' : undefined}
            onClick={() => {
              setActiveSection(section.id);
              if (section.id === 'daily' || section.id === 'operational' || section.id === 'monthly') {
                setReportType(section.id);
              } else setReportType('forecast');
            }}
            className={`h-10 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30 ${activeSection === section.id ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-700'}`}
          >
            {section.label}
          </button>
        ))}
      </nav>
      </div>

      {activeSection === 'daily' ? (
        <DailyReportLayout
          dailyKpis={dailyKpis}
          paymentTracking={paymentTracking}
          dailySalesLoadError={dailySalesLoadError}
          bookingLoadError={bookingLoadError}
          vehicleLoadError={vehicleLoadError}
          crewLoadError={crewLoadError}
          reportDate={getManilaDateInputValue()}
          todayBookings={todayBookings}
          salesByService={salesByService}
          jobsByHour={jobsByHour}
          freeTrucks={freeTrucks}
          freeHelpers={freeHelpers}
        />
      ) : activeSection === 'operational' ? (
        <OperationalReport
          from={dateFrom}
          to={dateTo}
          service={selectedService}
          vehicleId={selectedVehicleId}
          onDataChange={handleOperationalData}
        />
      ) : (
        <>
          {activeSection === 'forecast' ? <DemandForecastDashboard
            forecast={forecast}
            loading={forecastLoading}
            error={forecastError}
            onRefresh={() => { void loadForecast(); }}
            horizon={forecastHorizon}
            onHorizonChange={setForecastHorizon}
            ai={aiInsights}
            aiLoading={aiLoading}
            aiError={aiError}
            onLoadAi={loadAiInsightsCallback}
            actions={reportActions}
          /> : <MonthlyReport
            months={monthlyData.months}
            today={getManilaDateInputValue()}
            salesUnavailable={dailySalesLoadError}
            totalTrips={monthlyKpis.totalTrips}
            upcomingTrips={monthlyKpis.upcomingTrips}
            paidTrips={monthlyKpis.paidTrips}
            avgRevenuePerPaidTrip={monthlyKpis.avgRevenuePerPaidTrip}
            serviceDistribution={monthlyServiceDistribution}
            paymentDistribution={monthlyPaymentDistribution}
            statusDistribution={monthlyStatusDistribution}
            range={monthlyRange}
            onRangeChange={(range) => {
              setMonthlyRange(range);
              const window = monthlyWindow(range, getManilaDateInputValue());
              setDateFrom(window.start);
              setDateTo(window.end);
            }}
          />
          }
        </>
      )}
    </div>
  );
}
function ReportSelect({
  id,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  id: string;
  icon?: LucideIcon;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        className={`${FILTER_CHIP_CLASSES} w-fit max-w-full gap-2.5 py-0 focus-within:border-[#1a1f6e] focus-within:ring-2 focus-within:ring-[#1a1f6e]/15 data-[state=open]:border-[#1a1f6e] [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 [&>svg]:text-[#0b0f4a] [&>svg]:opacity-100`}
      >
        {Icon && <span className="flex shrink-0 text-[#0b0f4a]" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>}
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DailyReportLayout({
  dailyKpis, paymentTracking, dailySalesLoadError, bookingLoadError, vehicleLoadError, crewLoadError, reportDate,
  todayBookings, salesByService, jobsByHour, freeTrucks, freeHelpers,
}: {
  dailyKpis: {
    totalSales: number; bookingsToday: number; pendingPlotting: number; codCollected: number;
    onlinePayments: number; pendingCollections: number; completedJobs: number; cancelledJobs: number;
  };
  paymentTracking: { cash: number; bdo: number; gcash: number; xendit: number; sales: number; collected: number; outstanding: number };
  dailySalesLoadError: boolean;
  bookingLoadError: boolean;
  vehicleLoadError: boolean;
  crewLoadError: boolean;
  reportDate: string;
  todayBookings: Booking[];
  salesByService: { service: string; amount: number; count: number }[];
  jobsByHour: { hours: { hour: number; label: string; jobs: number }[]; peak: number; overStart: number | null; overEnd: number | null; unscheduled: number };
  freeTrucks: number;
  freeHelpers: number;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const kpisUnavailable = dailySalesLoadError || bookingLoadError;
  const activeCount = dailyKpis.bookingsToday;
  const collectedShare = paymentTracking.sales > 0 ? Math.min(100, (paymentTracking.collected / paymentTracking.sales) * 100) : 0;
  const reportDateLabel = formatFilterDate(reportDate, true);
  const maxServiceAmount = Math.max(1, ...salesByService.map((row) => row.amount));
  const totalPages = Math.max(1, Math.ceil(todayBookings.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedBookings = todayBookings.slice((safePage - 1) * pageSize, safePage * pageSize);
  const unpaidBookings = todayBookings.filter((booking) => normalizeBookingStatus(booking.status) !== 'Cancelled').length;

  const methodRows = [
    { label: 'Cash', amount: paymentTracking.cash, color: '#f59e0b' },
    { label: 'BDO', amount: paymentTracking.bdo, color: '#1d4ed8' },
    { label: 'GCash', amount: paymentTracking.gcash, color: '#0ea5e9' },
    { label: 'Xendit', amount: paymentTracking.xendit, color: '#8b5cf6' },
  ].filter((row) => row.amount > 0);
  const paymentStatus = paymentTracking.sales > 0 && paymentTracking.outstanding <= 0
    ? { label: 'Fully collected', className: 'border-emerald-300 bg-emerald-50 text-emerald-700' }
    : paymentTracking.collected > 0
      ? { label: 'Partially collected', className: 'border-amber-300 bg-amber-50 text-amber-700' }
      : { label: 'Pending collection', className: 'border-slate-300 bg-slate-50 text-slate-600' };

  // What stands between today's bookings and a finished, paid day.
  const attention: { key: string; tone: 'amber' | 'red' | 'slate'; icon: LucideIcon; title: string; detail: string }[] = [];
  if (!bookingLoadError && dailyKpis.pendingPlotting > 0) {
    attention.push({ key: 'plotting', tone: 'amber', icon: Truck, title: `${dailyKpis.pendingPlotting} ${dailyKpis.pendingPlotting === 1 ? 'booking' : 'bookings'} awaiting assignment`, detail: 'No truck or team yet' });
  }
  if (!bookingLoadError && !vehicleLoadError && jobsByHour.overStart !== null && jobsByHour.overEnd !== null) {
    attention.push({ key: 'trucks', tone: 'red', icon: AlertTriangle, title: `Truck shortage, ${formatHourLabel(jobsByHour.overStart)} to ${formatHourLabel(jobsByHour.overEnd)}`, detail: `Up to ${jobsByHour.peak} jobs at once, ${freeTrucks} ${freeTrucks === 1 ? 'truck' : 'trucks'} available` });
  }
  if (!crewLoadError && freeHelpers === 0 && dailyKpis.pendingPlotting > 0) {
    attention.push({ key: 'helpers', tone: 'red', icon: UsersRound, title: 'No helpers are free', detail: "Bookings that need helpers can't be plotted yet" });
  }
  if (!kpisUnavailable && paymentTracking.outstanding > 0) {
    attention.push({ key: 'collect', tone: 'slate', icon: Wallet, title: `${formatPeso(paymentTracking.outstanding)} not yet collected`, detail: paymentTracking.collected > 0 ? `${formatPeso(paymentTracking.collected)} verified so far` : `${unpaidBookings} ${unpaidBookings === 1 ? 'booking' : 'bookings'} with no verified payment` });
  }
  const toneClasses = {
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-emerald-50 text-emerald-600',
  } as const;

  const chartData = jobsByHour.hours.map((hour) => ({ ...hour, over: hour.jobs > freeTrucks }));
  const jobsSubtitle = jobsByHour.hours.length === 0
    ? 'No timed bookings today'
    : `Peak of ${jobsByHour.peak} at the same time, with ${freeTrucks} ${freeTrucks === 1 ? 'truck' : 'trucks'} available`;

  return (
    <div className="space-y-6">
      <section aria-label="Today at a glance" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard label="Daily Sales" value={bookingLoadError ? 'Unavailable' : formatPeso(dailyKpis.totalSales)} icon={PhilippinePeso} iconColor="#10b981" variant="dashboard-compact" />
        <KPICard label="Awaiting Assignment" value={bookingLoadError ? 'Unavailable' : `${dailyKpis.pendingPlotting} of ${activeCount}`} icon={Truck} iconColor="#d97706" variant="dashboard-compact" />
        <KPICard label="Jobs Completed" value={kpisUnavailable ? 'Unavailable' : `${dailyKpis.completedJobs} of ${activeCount}`} icon={CheckCircle} iconColor="#1a1f6e" variant="dashboard-compact" />
        <KPICard label="Collected" value={kpisUnavailable ? 'Unavailable' : formatPeso(paymentTracking.collected)} icon={Wallet} iconColor="#0ea5e9" variant="dashboard-compact" />
      </section>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <ChartCard title="Sales by service" className="min-w-0">
          {bookingLoadError ? (
            <p role="alert" className="text-sm text-red-700">Booking data could not be loaded.</p>
          ) : salesByService.length === 0 ? (
            <EmptyPanel title="No sales scheduled today" detail="Bookings scheduled for today will be broken down by service here." />
          ) : (
            <ul className="space-y-4">
              {salesByService.map((row) => (
                <li key={row.service} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[#0b0f4a]">{row.service}</p>
                    <p className="text-sm text-slate-600">{row.count} {row.count === 1 ? 'booking' : 'bookings'}</p>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[#eef0f6]" aria-hidden="true">
                    <div className="h-full rounded-full bg-[#1a1f6e]" style={{ width: `${Math.max(4, (row.amount / maxServiceAmount) * 100)}%` }} />
                  </div>
                  <p className="text-right text-[15px] font-semibold tabular-nums text-[#0b0f4a]">{formatPeso(row.amount)}</p>
                </li>
              ))}
              <li className="flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
                <p className="text-[15px] text-slate-600">Total today</p>
                <p className="text-right text-base font-bold tabular-nums text-[#0b0f4a]">{formatPeso(paymentTracking.sales)}</p>
              </li>
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title="Jobs running by hour"
          subtitle={jobsSubtitle}
          className="min-w-0"
          rightAction={!bookingLoadError && chartData.length > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
              title={`Each job is counted as ${DAILY_JOB_HOURS} hours from its start time.${jobsByHour.unscheduled > 0 ? ` ${jobsByHour.unscheduled} without a start time not shown.` : ''}`}
            >
              <Info size={14} aria-hidden="true" />
              {DAILY_JOB_HOURS} hrs per job
              <span className="sr-only">. Each job is counted as {DAILY_JOB_HOURS} hours from its start time.{jobsByHour.unscheduled > 0 ? ` ${jobsByHour.unscheduled} without a start time not shown.` : ''}</span>
            </span>
          ) : undefined}
        >
          {bookingLoadError ? (
            <p role="alert" className="text-sm text-red-700">Booking data could not be loaded.</p>
          ) : chartData.length === 0 ? (
            <EmptyPanel title="Nothing on the clock yet" detail={jobsByHour.unscheduled > 0 ? `${jobsByHour.unscheduled} ${jobsByHour.unscheduled === 1 ? 'booking has' : 'bookings have'} no start time.` : 'Timed bookings for today will show here.'} />
          ) : (
            <>
              {/* Legend sits directly under the "Peak of …" subtitle. */}
              <div className="-mt-1 mb-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#1a1f6e]" aria-hidden="true" />Within available trucks</span>
                <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-red-600" aria-hidden="true" />More jobs than trucks</span>
              </div>
              <div role="img" aria-label={`Jobs running each hour today, peaking at ${jobsByHour.peak}, against ${freeTrucks} available trucks`}>
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={chartData} margin={{ top: 22, right: 12, left: -8, bottom: 4 }}>
                    <CartesianGrid stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={10} tick={{ fontSize: 13, fill: '#334155' }} tickMargin={8} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis allowDecimals={false} domain={[0, Math.max(jobsByHour.peak, freeTrucks) + 1]} tick={{ fontSize: 13, fill: '#334155' }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      formatter={(value: number) => [`${value} ${value === 1 ? 'job' : 'jobs'}`, 'Running']}
                      contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 14, color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    {!vehicleLoadError && <ReferenceLine y={freeTrucks} stroke="#d4a72c" strokeDasharray="5 4" strokeWidth={2} label={{ value: `${freeTrucks} ${freeTrucks === 1 ? 'truck' : 'trucks'}`, position: 'insideTopRight', fill: '#854d0e', fontSize: 13, fontWeight: 600 }} />}
                    <Bar dataKey="jobs" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {chartData.map((entry) => <Cell key={entry.hour} fill={entry.over && !vehicleLoadError ? '#dc2626' : '#1a1f6e'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </ChartCard>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <ChartCard
          title="Needs attention"
          subtitle="What blocks today's jobs and payments"
          className="min-w-0"
          rightAction={!bookingLoadError && dailyKpis.pendingPlotting > 0 ? (
            <Link to="/admin/scheduling" className="inline-flex h-10 items-center rounded-xl bg-[#1a1f6e] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b0f4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30">Plot now</Link>
          ) : undefined}
        >
          {attention.length === 0 ? (
            <EmptyPanel tone="good" title="Nothing blocking today" detail="Every booking is assigned and paid, or there's nothing scheduled." />
          ) : (
            <ul className="space-y-3">
              {attention.map((item) => (
                <li key={item.key} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[item.tone]}`}><item.icon size={18} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0b0f4a]">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard
          title="Collections"
          subtitle="Verified payments for today's bookings"
          className="min-w-0"
          rightAction={!kpisUnavailable && paymentTracking.sales > 0 ? <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${paymentStatus.className}`}>{paymentStatus.label}</span> : undefined}
        >
          {kpisUnavailable ? (
            <p role="alert" className="text-sm text-red-700">Verified payment records could not be loaded, so collected and outstanding totals are unavailable.</p>
          ) : (
            <div className="space-y-4">
              <div role="img" aria-label={`Collected ${formatPeso(paymentTracking.collected)}, outstanding ${formatPeso(paymentTracking.outstanding)}`} className="flex h-3 w-full overflow-hidden rounded-full bg-[#eef0f6]">
                <span className="h-full bg-emerald-500" style={{ width: `${collectedShare}%` }} />
                <span className="h-full bg-amber-400" style={{ width: paymentTracking.sales > 0 ? `${100 - collectedShare}%` : '0%' }} />
              </div>
              <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-2 text-slate-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />Collected <span className="font-semibold tabular-nums">{formatPeso(paymentTracking.collected)}</span></span>
                <span className="inline-flex items-center gap-2 text-slate-700"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true" />Outstanding <span className="font-semibold tabular-nums">{formatPeso(paymentTracking.outstanding)}</span></span>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Collected by method</p>
                {methodRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center">
                    <p className="text-sm font-semibold text-[#0b0f4a]">No payments collected yet</p>
                    <p className="mt-1 text-sm text-slate-600">Cash, BDO, GCash, and Xendit payments will be listed here once verified.</p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {methodRows.map((row) => (
                      <li key={row.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="inline-flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.label}</span>
                        <span className="inline-flex items-center gap-4"><span className="font-semibold tabular-nums text-slate-800">{formatPeso(row.amount)}</span><span className="w-12 text-right text-sm tabular-nums text-slate-600">{Math.round((row.amount / paymentTracking.collected) * 100)}%</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Today's bookings</h3>
            <p className="mt-0.5 text-sm text-slate-500">Scheduled for {reportDateLabel}</p>
          </div>
          <Link to="/admin/booking" className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className={`${tableClasses} min-w-[760px] table-auto`}>
            <thead className={tableHeadClasses}>
              <tr>{['Booking No.', 'Client', 'Service', 'Time', 'Status', 'Amount'].map((heading) => <th key={heading} scope="col" className={`${tableHeaderCellClasses} whitespace-nowrap ${heading === 'Amount' ? 'text-right' : ''}`}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {pagedBookings.map((booking) => (
                <tr key={booking.id} className={tableRowClasses}>
                  <td className={`${tableCellClasses} whitespace-nowrap font-semibold`}>{booking.bookingNo ?? '-'}</td>
                  <td className={`${tableCellClasses} leading-snug`}>{booking.client}</td>
                  <td className={`${tableCellClasses} leading-snug`}>{booking.service}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap tabular-nums`}>{formatTimeLabel(booking.preferredTime)}</td>
                  <td className={tableCellClasses}><StatusBadge status={dailyStatusLabel(booking.status)} size="xs" variant="outline" /></td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right font-semibold tabular-nums ${normalizeBookingStatus(booking.status) === 'Cancelled' ? 'text-slate-400 line-through' : ''}`}>{formatPeso(toNumber(booking.amount))}</td>
                </tr>
              ))}
              {todayBookings.length === 0 && (
                <tr><td colSpan={6} className="border-b border-[#dde4ef] px-4 py-8 text-center text-sm text-[#70747c]">
                  {bookingLoadError ? 'Booking data could not be loaded.' : 'No bookings scheduled today.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={safePage}
          totalPages={totalPages}
          totalItems={todayBookings.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </section>
    </div>
  );
}

function EmptyPanel({ title, detail, tone = 'neutral' }: { title: string; detail: string; tone?: 'neutral' | 'good' }) {
  return (
    <div className={`flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center ${tone === 'good' ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-300'}`}>
      {tone === 'good' && <CheckCircle size={22} className="mb-2 text-emerald-600" aria-hidden="true" />}
      <p className="text-sm font-semibold text-[#0b0f4a]">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, children, className = '', rightAction, icon: Icon }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; rightAction?: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:shadow-md ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={Icon ? 'flex items-center gap-2 text-base font-semibold text-[#0b0f4a]' : 'text-lg font-bold text-slate-900'}>
            {Icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Icon size={17} aria-hidden="true" /></span>}
            {title}
          </h3>
          {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
      {children}
    </div>
  );
}

function formatFilterDate(value: string, withWeekday = false) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { ...(withWeekday ? { weekday: 'short' as const } : {}), month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFilterMonth(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}

/** Looks like the date field, for tabs where the date is fixed or set elsewhere. */
/** Pill-shaped filter chip shared by the Daily, Operational and Monthly report filters. */
const FILTER_CHIP_CLASSES = 'flex h-12 items-center rounded-full border border-slate-200 bg-white px-5 text-[15px] font-medium text-[#0b0f4a] shadow-none transition hover:border-slate-300 hover:bg-slate-50';

function ReadOnlyFilter({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className={`${FILTER_CHIP_CLASSES} max-w-full gap-2.5 hover:bg-white`} title={label}>
      <span className="sr-only">{label}: </span>
      <CalendarDays size={18} className="shrink-0 text-[#0b0f4a]" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function DateRangeField({
  id,
  start,
  end,
  onChangeStart,
  onChangeEnd,
  presets = [],
}: {
  id: string;
  start: string;
  end: string;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
  /** Quick ranges listed beside the calendar. */
  presets?: { id: string; label: string; range: { start: string; end: string } }[];
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const from = start ? new Date(`${start}T00:00:00`) : undefined;
  const to = end ? new Date(`${end}T00:00:00`) : undefined;
  const formatDate = (date: Date) => date.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return (
    <div className="relative max-w-full">
      <div className="relative max-w-full">
        <CalendarDays size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#0b0f4a]" aria-hidden="true" />
        <ChevronDown size={18} className={`pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#0b0f4a] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        <input
          id={id}
          type="text"
          readOnly
          value={from && to ? `${formatDate(from)} to ${formatDate(to)}` : from ? `${formatDate(from)} to Select end date` : 'Select date range'}
          onClick={() => setOpen((current) => { if (!current) setDraftRange(undefined); return !current; })}
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setOpen((current) => !current); } }}
          aria-labelledby="reports-date-range-label"
          aria-haspopup="dialog"
          aria-expanded={open}
          size={Math.max(16, (from && to ? `${formatDate(from)} to ${formatDate(to)}` : 'Select date range').length)}
          className={`${FILTER_CHIP_CLASSES} max-w-full cursor-pointer truncate pl-12 pr-12 outline-none focus-visible:border-[#1a1f6e] focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/15`}
        />
      </div>
      {open && (
        <div role="dialog" aria-label="Choose report date range" className="date-picker-calendar absolute left-0 top-full z-40 mt-2 flex max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-slate-200/70 bg-white p-3 shadow-md sm:flex-row" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
          {presets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-100 pb-3 sm:mb-0 sm:mr-3 sm:w-36 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3" role="group" aria-label="Quick date ranges">
              <p className="hidden px-2 pb-1 text-xs font-medium uppercase tracking-wider text-slate-500 sm:block">Quick ranges</p>
              {presets.map((preset) => {
                const active = preset.range.start === start && preset.range.end === end;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { onChangeStart(preset.range.start); onChangeEnd(preset.range.end); setDraftRange(undefined); setOpen(false); }}
                    className={`whitespace-nowrap rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-colors hover:bg-[#e8b800] hover:text-slate-900 focus-visible:bg-[#e8b800] focus-visible:text-slate-900 ${active ? 'bg-[#030848]/10 font-semibold text-[#0b0f4a]' : 'text-slate-700'}`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
          <div>
          <DayPicker
            mode="range"
            selected={draftRange}
            defaultMonth={from}
            onSelect={(range) => {
              setDraftRange(range);
              if (range?.from && range?.to) {
                onChangeStart(formatInput(range.from));
                onChangeEnd(formatInput(range.to));
                setOpen(false);
              }
            }}
            showOutsideDays
            className="text-sm"
            classNames={{
              months: 'flex', month: 'space-y-3', month_caption: 'flex h-9 items-center justify-center font-semibold text-slate-800',
              nav: 'absolute inset-x-3 top-3 flex justify-between', button_previous: 'rounded-md p-1 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30', button_next: 'rounded-md p-1 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30',
              weekdays: 'flex', weekday: '!bg-transparent !text-[#1a1f6e] w-9 text-center text-sm font-medium', week: 'mt-1 flex', day: 'h-9 w-9 p-0 text-center',
              day_button: 'h-9 w-9 rounded-md text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30',
              selected: '[&>button]:bg-[#030848] [&>button]:text-white', range_start: '[&>button]:rounded-md [&>button]:bg-[#030848] [&>button]:text-white', range_end: '[&>button]:rounded-md [&>button]:bg-[#030848] [&>button]:text-white', range_middle: 'bg-[#030848]/10',
              today: '[&>button]:border [&>button]:border-[#d4a72c]', outside: 'opacity-40',
            }}
          />
          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
            <button type="button" onClick={() => { setDraftRange(undefined); setOpen(false); }} className="inline-flex h-10 w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30">Done</button>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
