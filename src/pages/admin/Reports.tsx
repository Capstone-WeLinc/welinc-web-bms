import PageHeader from '../../components/pageheader/Pageheader';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState, useRef } from 'react';
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
import { toast } from 'sonner';
import { DayPicker, type DateRange } from 'react-day-picker';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Area,
  AreaChart,
} from 'recharts';
import {
  CalendarDays,
  CheckCircle,
  PhilippinePeso,
  FileText,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Truck,
  Save,
  PieChart as PieChartIcon,
  Sparkles,
  Users,
  Timer,
  Package,
  TruckIcon,
  BarChart3,
  ChevronDown,
  ChevronRight,
  UserRound,
  UsersRound,
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

interface ForecastResponse {
  predictedBookings: number;
  confidence: number | null;
  forecastData: { label: string; date?: string; forecast: number }[];
  historicalData: { date: string; count: number }[];
  serviceDemand: { service: string; historical: number; forecast: number }[];
  averageVehiclesPerBooking: number | null;
  averageDriversPerBooking: number | null;
  averageHelpersPerBooking: number | null;
  expectedPeakDemand: { date: string; bookings: number } | null;
  accuracy: { historicalBookingsUsed: number; mae: number | null; mape: number | null };
  recommendations: string[];
  summaryText: string;
  explanation: string;
}

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

const FORECAST_LIMITED_DATA_THRESHOLD = 30;
const FORECAST_CONFIDENCE_LOW_THRESHOLD = 50;
const FORECAST_CONFIDENCE_HIGH_THRESHOLD = 75;

const COLORS = ['#1a1f6e', '#d4a72c', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const PHP_CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const PHP_COMPACT_CURRENCY_FORMATTER = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 2 });

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

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

function formatPesoCompact(n: number) {
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
  const [dailyChartDays, setDailyChartDays] = useState<7 | 30 | 90>(7);
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
  const [forecastHorizon, setForecastHorizon] = useState<'7days' | '30days' | '90days'>('30days');
  const [reportType, setReportType] = useState<'daily' | 'operational' | 'monthly' | 'forecast'>('daily');
  const [activeSection, setActiveSection] = useState<'daily' | 'operational' | 'monthly' | 'forecast'>('daily');

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [savingReport, setSavingReport] = useState(false);

  const [, setSavedReports] = useState<SavedReport[]>([]);
  const [, setSavedReportsLoading] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);
  const dataLoadInFlight = useRef(false);
  const dataHasLoaded = useRef(false);
  const autoSavedReportKeys = useRef(new Set<string>());
  const autoSavedForecastKeys = useRef(new Set<string>());
  const forecastRequestId = useRef(0);
  const forecastInputsKey = JSON.stringify([dateFrom, dateTo, selectedService, selectedVehicleId, forecastHorizon]);
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
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(toDateInputValue(start));
      setDateTo(toDateInputValue(end));
      setMonthlyRange(12);
    }
    previousReportType.current = reportType;
  }, [reportType]);

  useEffect(() => {
    if (previousForecastInputsKey.current === forecastInputsKey) return;
    previousForecastInputsKey.current = forecastInputsKey;
    forecastRequestId.current += 1;
    setForecast(null);
    setForecastError(null);
    setForecastLoading(false);
  }, [forecastInputsKey]);

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
            predictedBookings: forecast.predictedBookings,
            forecastConfidence: forecast.confidence,
            historicalBookingsUsed: forecast.accuracy.historicalBookingsUsed,
            mae: forecast.accuracy.mae,
            mape: forecast.accuracy.mape,
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
          vehicleStatus,
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

  async function loadForecast() {
    const requestId = ++forecastRequestId.current;
    setForecastLoading(true);
    setForecast(null);
    setForecastError(null);
    try {
      const res = await api.post<ForecastResponse>('/reports/forecast', {
        startDate: dateFrom,
        endDate: dateTo,
        serviceType: selectedService,
        garage,
        vehicleId: selectedVehicleId,
        forecastHorizon,
      });
      if (requestId === forecastRequestId.current) setForecast(res.data);
    } catch (error) {
      if (requestId !== forecastRequestId.current) return;
      const message = (error as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      setForecastError(
        Array.isArray(message)
          ? message.join(', ')
          : message || 'No AI forecast is available right now.',
      );
    } finally {
      if (requestId === forecastRequestId.current) setForecastLoading(false);
    }
  }

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

  const forecastChartData = useMemo(() => {
    if (!forecast) return [];
    return forecast.forecastData.map((p) => ({
      label: p.label,
      forecast: p.forecast,
    }));
  }, [forecast]);

  // Daily report computations
  const dailyBookingSummary = useMemo(() => {
    const reportDay = getManilaDateInputValue();
    const buckets: { label: string; date: string; count: number }[] = [];
    const end = new Date(`${reportDay}T00:00:00`);
    if (Number.isNaN(end.getTime())) return [];
    const start = new Date(end);
    start.setDate(end.getDate() - dailyChartDays + 1);
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const labelDate = new Date(`${dateStr}T00:00:00`);
      buckets.push({
        label: labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date: dateStr,
        count: 0,
      });
    }
    const chartStartKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const chartEndKey = reportDay;
    const serviceAndVehicleBookings = bookings.filter((b) =>
      normalizeBookingStatus(b.status) !== 'Cancelled' &&
      (selectedService === 'All' || b.service === selectedService) &&
      (selectedVehicleId === 'All' || vehicleByBooking.get(b.id) === selectedVehicleId));
    serviceAndVehicleBookings.forEach((b) => {
      const bookingDate = b.createdAt ? getManilaDateInputValue(new Date(b.createdAt)) : undefined;
      if (!bookingDate || bookingDate < chartStartKey || bookingDate > chartEndKey) return;
      const bucket = buckets.find((bk) => bk.date === bookingDate);
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [bookings, dailyChartDays, selectedService, selectedVehicleId, vehicleByBooking]);

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

  const recentBookings = useMemo(() => {
    const todayReceivedDate = getManilaDateInputValue();
    return bookings
      .filter((booking) => booking.createdAt
        && !Number.isNaN(new Date(booking.createdAt).getTime())
        && getManilaDateInputValue(new Date(booking.createdAt)) === todayReceivedDate
        && (selectedService === 'All' || booking.service === selectedService)
        && (selectedVehicleId === 'All' || vehicleByBooking.get(booking.id) === selectedVehicleId))
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }, [bookings, selectedService, selectedVehicleId, vehicleByBooking]);

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

  const activeJobOrders = useMemo(() => ({
    count: filteredJobOrders.length,
    pendingDistribution: filteredJobOrders.filter((item) => String(item.status || '').trim().toLowerCase() === 'pending').length,
  }), [filteredJobOrders]);

  const crewOnDuty = useMemo(() => {
    const onDutyDrivers = drivers.filter((d) =>
      (d.crewStatus || d.crew_status || d.status || '').trim().toLowerCase() === 'on duty'
    ).length;
    const onDutyHelpers = helpers.filter((helper) => helper.status.trim().toLowerCase() === 'on duty').length;
    return { drivers: onDutyDrivers, helpers: onDutyHelpers };
  }, [drivers, helpers]);

  const crewSummary = useMemo(() => {
    const assignedDrivers = new Set(filteredAssignments.flatMap((assignment) => assignment.driverId ? [assignment.driverId] : []));
    const assignedHelpers = new Set(filteredAssignments.flatMap((assignment) => assignment.helperIds || []));
    return {
      availableDrivers: drivers.filter((driver) => driver.status.trim().toLowerCase() === 'available').length,
      availableHelpers: helpers.filter((helper) => helper.status.trim().toLowerCase() === 'available').length,
      assignedCrew: assignedDrivers.size + assignedHelpers.size,
    };
  }, [drivers, helpers, filteredAssignments]);

  const onTimeArrival = useMemo(() => {
    let onTime = 0;
    let delayed = 0;
    let unmeasurable = 0;
    const bookingRefs = new Set(filteredBookings.flatMap((booking) => [booking.id, booking.bookingId, booking.bookingNo].filter((key): key is string => Boolean(key))));
    filteredPostServiceRecords.forEach((record) => {
      const booking = bookingsByReference.get(record.bookingId || '') || bookingsByReference.get(record.bookingNo || '');
      if (!booking || !bookingRefs.has(booking.id)) return;
      const actual = timeToMinutes(record.arrivalTime);
      const scheduled = timeToMinutes(booking.preferredTime);
      if (actual === null || scheduled === null) { unmeasurable += 1; return; }
      if (actual <= scheduled) onTime += 1;
      else delayed += 1;
    });
    const measured = onTime + delayed;
    return {
      rate: measured ? Math.round((onTime / measured) * 100) : null,
      onTime, delayed, measured, unmeasurable,
      unavailable: postServiceLoadError || bookingLoadError,
    };
  }, [filteredPostServiceRecords, postServiceLoadError, bookingLoadError, bookingsByReference, filteredBookings]);

  const operationalFleetUtilization = useMemo(() => {
    const eligible = filteredBookings.filter((booking) => normalizeBookingStatus(booking.status) !== 'Cancelled');
    const assigned = new Set(filteredAssignments.map((assignment) => assignment.bookingUuid)).size;
    return {
      rate: assignmentLoadError || bookingLoadError ? null : eligible.length ? Math.round((assigned / eligible.length) * 100) : 0,
      assigned,
      total: bookingLoadError ? null : eligible.length,
      unavailable: assignmentLoadError || bookingLoadError,
    };
  }, [filteredBookings, filteredAssignments, assignmentLoadError, bookingLoadError]);

  const completedVsCancelled = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
    const months: { monthKey: string; label: string; completed: number; cancelled: number }[] = [];
    const cursor = new Date(start);
    cursor.setDate(1);
    while (cursor <= end) {
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const label = cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      months.push({ monthKey, label, completed: 0, cancelled: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const completedIds = new Set<string>();
    filteredPostServiceRecords.forEach((record) => {
      const booking = bookingsByReference.get(record.bookingId || '') || bookingsByReference.get(record.bookingNo || '');
      if (!booking || completedIds.has(booking.id)) return;
      const monthKey = (record.date || booking.date || '').slice(0, 7);
      const month = months.find((entry) => entry.monthKey === monthKey);
      if (month) {
        month.completed += 1;
        completedIds.add(booking.id);
      }
    });
    filteredBookings.forEach((b) => {
      const key = b.date?.slice(0, 7);
      const month = months.find((m) => m.monthKey === key);
      if (month) {
        const status = normalizeBookingStatus(b.status);
        if (status === 'Cancelled') month.cancelled += 1;
      }
    });
    return months;
  }, [filteredBookings, filteredPostServiceRecords, bookingsByReference, dateFrom, dateTo]);

  const vehicleStatus = useMemo(() => {
    const map = new Map<string, number>();
    const displayMap: Record<string, string> = {
      AVAILABLE: 'Available',
      'In Transit': 'Assigned',
      UNDER_MAINTENANCE: 'Under Maintenance',
      UNDER_REPAIR: 'Under Repair',
    };
    const reportVehicles = selectedVehicleId === 'All' ? vehicles : vehicles.filter((vehicle) => vehicle.id === selectedVehicleId);
    reportVehicles.forEach((v) => {
      const backendStatus = v.status;
      let display = displayMap[backendStatus] || backendStatus || 'Unknown';
      if (backendStatus === 'AVAILABLE' && v.isAssigned) display = 'Assigned';
      map.set(display, (map.get(display) || 0) + 1);
    });
    const knownStatuses = ['Available', 'Assigned', 'Unassigned', 'Under Maintenance', 'Under Repair']
      .map((name) => ({ name, value: map.get(name) || 0 }));
    const otherStatuses = Array.from(map.entries())
      .filter(([name]) => name !== 'Unassigned' && !knownStatuses.some((status) => status.name === name))
      .map(([name, value]) => ({ name, value }));
    return [...knownStatuses.filter((status) => status.name !== 'Unassigned'), ...otherStatuses];
  }, [vehicles, selectedVehicleId]);

  const operationalSnapshot = useMemo(() => ({
    bookingCount: bookingLoadError ? null : filteredBookings.length,
    confirmedVehicleAssignments: operationalFleetUtilization.assigned,
    eligibleBookings: operationalFleetUtilization.total,
    confirmedVehicleAssignmentRate: operationalFleetUtilization.rate,
    activeJobOrders: activeJobOrders.count,
    pendingJobOrders: activeJobOrders.pendingDistribution,
    completedBookings: bookingLoadError || postServiceLoadError ? null : completedVsCancelled.reduce((sum, month) => sum + month.completed, 0),
    cancelledBookings: bookingLoadError ? null : completedVsCancelled.reduce((sum, month) => sum + month.cancelled, 0),
    measuredOnTimeArrivals: onTimeArrival.measured,
    onTimeArrivals: onTimeArrival.onTime,
    delayedArrivals: onTimeArrival.delayed,
    onTimeArrivalRate: onTimeArrival.rate,
    currentOnDutyDrivers: crewLoadError ? null : crewOnDuty.drivers,
    currentOnDutyHelpers: crewLoadError ? null : crewOnDuty.helpers,
    dispatchDataAvailable: !assignmentLoadError && !jobOrderLoadError,
    postServiceDataAvailable: !postServiceLoadError,
    crewDataAvailable: !crewLoadError,
    bookingDataAvailable: !bookingLoadError,
    vehicleDataAvailable: !vehicleLoadError,
  }), [filteredBookings.length, operationalFleetUtilization, activeJobOrders, completedVsCancelled, onTimeArrival, crewLoadError, crewOnDuty, assignmentLoadError, jobOrderLoadError, postServiceLoadError, bookingLoadError, vehicleLoadError]);

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

  const ytdSalesRecords = useMemo(() => {
    if (!dateTo) return [] as DailySalesRecord[];
    const yearStart = `${dateTo.slice(0, 4)}-01-01`;
    const bookingKeys = new Set(monthlyEligibleBookings.flatMap((booking) =>
      [booking.id, booking.bookingId, booking.bookingNo].filter((key): key is string => Boolean(key))
    ));
    return dailySalesRecords.filter((record) => {
      const recordDate = String(record.date || '').slice(0, 10);
      const linked = [record.bookingId, record.bookingNo].some((key) => key && bookingKeys.has(key));
      return linked && recordDate >= yearStart && recordDate <= dateTo;
    });
  }, [dailySalesRecords, monthlyEligibleBookings, dateTo]);

  const monthlyData = useMemo(() => {
    if (!dateFrom || !dateTo) return { months: [], latestMonth: null, previousMonth: null };
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return { months: [], latestMonth: null, previousMonth: null };

    const months: { label: string; year: number; month: number; revenue: number; trips: number }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      months.push({
        label: cursor.toLocaleString('en-US', { month: 'short' }),
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
        revenue: 0,
        trips: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    monthlySalesRecords.forEach((record) => {
      const recordDate = String(record.date || '').slice(0, 10);
      const rd = new Date(`${recordDate}T00:00:00`);
      if (Number.isNaN(rd.getTime())) return;
      const month = months.find((m) => m.year === rd.getFullYear() && m.month === rd.getMonth());
      if (month) month.revenue += toNumber(record.totalDailySales);
    });

    filteredBookings.forEach((b) => {
      if (normalizeBookingStatus(b.status) === 'Cancelled') return;
      const bd = b.date ? new Date(`${b.date.slice(0, 10)}T00:00:00`) : null;
      if (!bd || Number.isNaN(bd.getTime())) return;
      const month = months.find((m) => m.year === bd.getFullYear() && m.month === bd.getMonth());
      if (month) {
        month.trips += 1;
      }
    });

    const latestMonth = months[months.length - 1] || null;
    const previousMonth = months.length > 1 ? months[months.length - 2] : null;
    return { months, latestMonth, previousMonth };
  }, [filteredBookings, monthlySalesRecords, dateFrom, dateTo]);

  const monthlyKpis = useMemo(() => {
    const totalRevenue = monthlySalesRecords.reduce((sum, record) => sum + toNumber(record.totalDailySales), 0);
    const totalTrips = filteredBookings.filter((booking) => normalizeBookingStatus(booking.status) !== 'Cancelled').length;
    const avgRevenuePerTrip = totalTrips > 0 ? totalRevenue / totalTrips : 0;
    const { latestMonth, previousMonth } = monthlyData;
    const monthlyRevenue = latestMonth?.revenue || 0;
    const previousMonthlyRevenue = previousMonth?.revenue || 0;
    const monthlyRevenueChange = previousMonthlyRevenue > 0
      ? ((monthlyRevenue - previousMonthlyRevenue) / previousMonthlyRevenue) * 100
      : 0;
    const latestAverage = latestMonth && latestMonth.trips > 0 ? latestMonth.revenue / latestMonth.trips : 0;
    const previousAverage = previousMonth && previousMonth.trips > 0 ? previousMonth.revenue / previousMonth.trips : 0;
    const avgChange = previousAverage > 0
      ? ((latestAverage - previousAverage) / previousAverage) * 100
      : 0;

    const ytdRevenue = ytdSalesRecords.reduce((sum, record) => sum + toNumber(record.totalDailySales), 0);

    return {
      monthlyRevenue,
      monthlyRevenueChange,
      ytdRevenue,
      totalTrips,
      avgRevenuePerTrip,
      avgChange,
    };
  }, [filteredBookings, monthlyData, monthlySalesRecords, ytdSalesRecords]);

  const monthlyServiceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredBookings.forEach((b) => {
      if (normalizeBookingStatus(b.status) === 'Cancelled') return;
      const key = b.service || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredBookings]);

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

  const recommendedResources = useMemo(() => {
    if (!forecast) return { trucks: 0, drivers: 0, helpers: 0 };
    const predicted = forecast.predictedBookings || 0;
    const avgTripsPerTruck = 30;
    const avgTripsPerDriver = 20;
    const avgTripsPerHelper = 15;
    return {
      trucks: Math.ceil(predicted / avgTripsPerTruck),
      drivers: Math.ceil(predicted / avgTripsPerDriver),
      helpers: Math.ceil(predicted / avgTripsPerHelper),
    };
  }, [forecast]);

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

  const forecastAutoSaveKey = useMemo(() => forecast ? JSON.stringify({
    dateFrom,
    dateTo,
    forecastHorizon,
    forecast,
  }) : null, [dateFrom, dateTo, forecastHorizon, forecast]);

  useEffect(() => {
    if (loading || autoSavedReportKeys.current.has(reportAutoSaveKey)) return;

    const timeout = window.setTimeout(() => {
      void autoSaveCurrentReport(reportAutoSaveKey);
    }, 500);
    return () => window.clearTimeout(timeout);
    // The key represents every report input and output that must be persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reportAutoSaveKey]);

  useEffect(() => {
    if (!forecastAutoSaveKey || forecastLoading || autoSavedForecastKeys.current.has(forecastAutoSaveKey)) return;

    const timeout = window.setTimeout(() => {
      void autoSaveForecast(forecastAutoSaveKey);
    }, 500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastAutoSaveKey, forecastLoading]);

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
          vehicleStatus,
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

  async function autoSaveForecast(key: string) {
    if (!forecast || forecast.confidence === null || autoSavedForecastKeys.current.has(key)) return;
    autoSavedForecastKeys.current.add(key);
    try {
      await api.post('/reports/forecast/save', {
        forecastHorizon,
        periodStart: dateFrom,
        periodEnd: dateTo,
        serviceType: selectedService === 'All' ? null : selectedService,
        garage: garage === 'All' ? null : garage,
        predictedBookings: forecast.predictedBookings,
        confidence: forecast.confidence,
        forecastData: forecast.forecastData,
        recommendations: forecast.recommendations,
        summaryText: forecast.summaryText,
      });
      await loadSavedReports();
    } catch {
      autoSavedForecastKeys.current.delete(key);
      toast.error('Automatic MySQL forecast save failed');
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
      const chartTotal = dailyBookingSummary.reduce((sum, day) => sum + day.count, 0);
      const recentTotal = recentBookings.reduce((sum, booking) => sum + toNumber(booking.amount), 0);
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
            kind: 'table', title: 'Bookings received by day', note: `Non-cancelled bookings, last ${dailyChartDays} days`,
            columns: [{ header: 'Date', key: 'date', width: 22 }, { header: 'Bookings received', key: 'count', format: 'number', width: 20 }],
            rows: dailyBookingSummary.map((day) => ({ date: dateLabel(day.date, true), count: day.count })),
            totals: { count: chartTotal },
          },
          {
            kind: 'table', title: 'Recent bookings', note: 'Bookings received today', emptyText: 'No bookings received today.',
            columns: [
              { header: 'Booking no.', key: 'bookingNo', width: 22 }, { header: 'Client', key: 'client', width: 28 }, { header: 'Service', key: 'service', width: 24 },
              { header: 'Service date', key: 'date', width: 16 }, { header: 'Status', key: 'status', width: 18 }, { header: 'Amount', key: 'amount', format: 'peso', width: 16 },
            ],
            rows: recentBookings.map((booking) => ({
              bookingNo: booking.bookingNo ?? '-', client: booking.client, service: booking.service, date: booking.date,
              status: booking.status === 'Scheduled' ? 'Assigned' : booking.status, amount: toNumber(booking.amount),
            })),
            totals: { amount: recentTotal },
          },
        ],
      };
    }

    if (activeSection === 'operational') {
      const completed = completedVsCancelled.reduce((sum, month) => sum + month.completed, 0);
      const cancelled = completedVsCancelled.reduce((sum, month) => sum + month.cancelled, 0);
      const completionUnavailable = bookingLoadError || postServiceLoadError;
      const vehicleJobs = [...fleetUtilization].sort((a, b) => b.assignedJobs - a.assignedJobs);
      const totalVehicleJobs = vehicleJobs.reduce((sum, vehicle) => sum + vehicle.assignedJobs, 0);
      const totalVehicles = vehicleStatus.reduce((sum, item) => sum + item.value, 0);
      const crewRows = [
        { crew: 'Drivers', roster: drivers.length, available: crewSummary.availableDrivers, onDuty: crewOnDuty.drivers },
        { crew: 'Helpers', roster: helpers.length, available: crewSummary.availableHelpers, onDuty: crewOnDuty.helpers },
      ].map((row) => ({ ...row, unavailable: Math.max(0, row.roster - row.available - row.onDuty) }));
      const unassigned = operationalFleetUtilization.total === null ? null : Math.max(0, operationalFleetUtilization.total - operationalFleetUtilization.assigned);
      return {
        ...base,
        reportName: 'Operational Report',
        fileStem: 'operational-report',
        period: `${dateLabel(dateFrom)} to ${dateLabel(dateTo)}`,
        sections: [
          {
            kind: 'metrics', title: 'Performance this period', items: [
              { label: 'Bookings with a vehicle', value: operationalFleetUtilization.unavailable ? null : operationalFleetUtilization.rate ?? 0, format: 'percent', note: `${operationalFleetUtilization.assigned} of ${operationalFleetUtilization.total ?? 0} bookings` },
              { label: 'Bookings still unassigned', value: operationalFleetUtilization.unavailable ? null : unassigned, format: 'number' },
              { label: 'On-time arrival', value: onTimeArrival.unavailable ? null : onTimeArrival.rate, format: 'percent', note: `${onTimeArrival.onTime} on time, ${onTimeArrival.delayed} delayed, ${onTimeArrival.unmeasurable} without both times` },
              { label: 'Completed services', value: completionUnavailable ? null : completed, format: 'number' },
              { label: 'Cancelled bookings', value: completionUnavailable ? null : cancelled, format: 'number' },
              { label: 'Cancellation rate', value: completionUnavailable || completed + cancelled === 0 ? null : share(cancelled, completed + cancelled), format: 'percent' },
              { label: 'Job orders', value: jobOrderLoadError ? null : activeJobOrders.count, format: 'number' },
              { label: 'Pending distribution', value: jobOrderLoadError ? null : activeJobOrders.pendingDistribution, format: 'number' },
            ],
          },
          {
            kind: 'table', title: 'Completed vs cancelled', note: 'Closed jobs per month',
            columns: [{ header: 'Month', key: 'month', width: 16 }, { header: 'Completed', key: 'completed', format: 'number' }, { header: 'Cancelled', key: 'cancelled', format: 'number' }, { header: 'Cancellation rate', key: 'rate', format: 'percent', width: 18 }],
            rows: completionUnavailable ? [] : completedVsCancelled.map((month) => ({ month: month.label, completed: month.completed, cancelled: month.cancelled, rate: month.completed + month.cancelled > 0 ? share(month.cancelled, month.completed + month.cancelled) : null })),
            totals: { completed, cancelled, rate: completed + cancelled > 0 ? share(cancelled, completed + cancelled) : null },
            emptyText: completionUnavailable ? 'Booking or post-service records are unavailable.' : undefined,
          },
          {
            kind: 'table', title: 'Jobs per vehicle', note: 'Confirmed assignments in this period', emptyText: operationalFleetUtilization.unavailable ? 'Booking or dispatch records are unavailable.' : 'No vehicles assigned in this period.',
            columns: [{ header: 'Rank', key: 'rank', format: 'number', width: 8 }, { header: 'Vehicle', key: 'vehicle', width: 26 }, { header: 'Jobs', key: 'jobs', format: 'number' }, { header: 'Share of jobs', key: 'share', format: 'percent' }],
            rows: operationalFleetUtilization.unavailable ? [] : vehicleJobs.map((vehicle, index) => ({ rank: index + 1, vehicle: vehicle.name, jobs: vehicle.assignedJobs, share: share(vehicle.assignedJobs, totalVehicleJobs) })),
            totals: { jobs: totalVehicleJobs, share: totalVehicleJobs > 0 ? 100 : 0 },
          },
          {
            kind: 'table', title: 'Vehicle status', note: 'Current fleet status', emptyText: vehicleLoadError ? 'Vehicle records are unavailable.' : undefined,
            columns: [{ header: 'Status', key: 'status', width: 24 }, { header: 'Vehicles', key: 'count', format: 'number' }, { header: 'Share of fleet', key: 'share', format: 'percent' }],
            rows: vehicleLoadError ? [] : vehicleStatus.map((item) => ({ status: item.name, count: item.value, share: share(item.value, totalVehicles) })),
            totals: { count: totalVehicles, share: totalVehicles > 0 ? 100 : 0 },
          },
          {
            kind: 'table', title: 'Crew availability', note: assignmentLoadError ? 'Current roster status' : `Current roster status. ${crewSummary.assignedCrew} crew members were on confirmed assignments in this period.`,
            emptyText: crewLoadError ? 'Driver and helper records are unavailable.' : undefined,
            columns: [{ header: 'Crew', key: 'crew', width: 16 }, { header: 'On roster', key: 'roster', format: 'number' }, { header: 'Available', key: 'available', format: 'number' }, { header: 'On duty', key: 'onDuty', format: 'number' }, { header: 'Unavailable', key: 'unavailable', format: 'number' }],
            rows: crewLoadError ? [] : crewRows,
            totals: {
              roster: crewRows.reduce((sum, row) => sum + row.roster, 0), available: crewRows.reduce((sum, row) => sum + row.available, 0),
              onDuty: crewRows.reduce((sum, row) => sum + row.onDuty, 0), unavailable: crewRows.reduce((sum, row) => sum + row.unavailable, 0),
            },
          },
        ],
      };
    }

    if (activeSection === 'monthly') {
      const months = monthlyData.months;
      const latest = monthlyData.latestMonth;
      const previous = monthlyData.previousMonth;
      const previousAverage = previous && previous.trips > 0 ? previous.revenue / previous.trips : 0;
      const changeNote = (change: number, previousValue: number) => (previous && previousValue > 0 ? `${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(1)}% vs ${previous.label} ${previous.year}` : 'No previous month to compare');
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
              { label: `Revenue${latest ? `, ${latest.label} ${latest.year}` : ''}`, value: dailySalesLoadError ? null : monthlyKpis.monthlyRevenue, format: 'peso', note: changeNote(monthlyKpis.monthlyRevenueChange, previous?.revenue ?? 0) },
              { label: 'Year-to-date revenue', value: dailySalesLoadError ? null : monthlyKpis.ytdRevenue, format: 'peso', note: `January to ${latest ? `${latest.label} ${latest.year}` : 'date'}` },
              { label: 'Trips', value: monthlyKpis.totalTrips, format: 'number', note: 'Non-cancelled bookings in the period' },
              { label: 'Average revenue per trip', value: dailySalesLoadError ? null : monthlyKpis.avgRevenuePerTrip, format: 'peso', note: changeNote(monthlyKpis.avgChange, previousAverage) },
            ],
          },
          {
            kind: 'table', title: 'Month-by-month', note: 'Newest month first',
            columns: [{ header: 'Month', key: 'month', width: 16 }, { header: 'Trips', key: 'trips', format: 'number' }, { header: 'Revenue', key: 'revenue', format: 'peso', width: 18 }, { header: 'Avg per trip', key: 'average', format: 'peso', width: 18 }, { header: 'Revenue vs prior month', key: 'change', format: 'percent', width: 22 }],
            rows: months.map((month, index) => {
              const prior = index > 0 ? months[index - 1] : null;
              return {
                month: `${month.label} ${month.year}`, trips: month.trips,
                revenue: dailySalesLoadError ? null : month.revenue,
                average: dailySalesLoadError ? null : month.trips > 0 ? month.revenue / month.trips : 0,
                change: dailySalesLoadError || !prior || prior.revenue <= 0 ? null : Number((((month.revenue - prior.revenue) / prior.revenue) * 100).toFixed(1)),
              };
            }).reverse(),
            totals: { trips: rangeTrips, revenue: dailySalesLoadError ? null : rangeRevenue, average: dailySalesLoadError ? null : rangeTrips > 0 ? rangeRevenue / rangeTrips : 0, change: '' },
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

    // AI demand forecast
    if (!forecast) {
      toast.error('Generate a forecast before exporting it.');
      return null;
    }
    const horizonDays = forecastHorizon === '7days' ? 7 : forecastHorizon === '90days' ? 90 : 30;
    const hasHistory = forecast.accuracy.historicalBookingsUsed > 0;
    const peak = forecast.expectedPeakDemand;
    const isAvailable = (resource: { status?: string; isActive?: boolean; isAssigned?: boolean }) => resource.status?.toLowerCase() === 'available' && resource.isActive !== false && resource.isAssigned !== true;
    const needed = (perBooking: number | null) => (peak && perBooking !== null ? Math.ceil(peak.bookings * perBooking) : null);
    const capacity = [
      { resource: 'Trucks', available: vehicles.filter(isAvailable).length, needed: needed(forecast.averageVehiclesPerBooking) },
      { resource: 'Drivers', available: drivers.filter((driver) => isAvailable(driver as unknown as { status?: string })).length, needed: needed(forecast.averageDriversPerBooking) },
      { resource: 'Helpers', available: helpers.filter(isAvailable).length, needed: needed(forecast.averageHelpersPerBooking) },
    ].map((row) => ({ ...row, shortage: row.needed === null ? null : Math.max(0, row.needed - row.available) }));
    const forecastDays = forecast.forecastData.slice(0, horizonDays);
    return {
      ...base,
      reportName: 'AI Demand Forecast',
      fileStem: 'ai-demand-forecast',
      period: `Next ${horizonDays} days`,
      sections: [
        {
          kind: 'metrics', title: 'Forecast summary', items: [
            { label: 'Predicted bookings', value: hasHistory ? forecast.predictedBookings : null, format: 'decimal', note: `Next ${horizonDays} days` },
            { label: 'Average per day', value: hasHistory ? Number((forecast.predictedBookings / horizonDays).toFixed(1)) : null, format: 'decimal' },
            { label: 'Busiest day', value: peak ? peak.bookings : null, format: 'decimal', note: peak ? `Bookings expected on ${dateLabel(peak.date, true)}` : undefined },
            { label: 'Forecast confidence', value: forecast.confidence === null ? null : Math.round(forecast.confidence), format: 'percent' },
            { label: 'Bookings used to learn from', value: forecast.accuracy.historicalBookingsUsed, format: 'number' },
            { label: 'Average daily error', value: forecast.accuracy.mae, format: 'decimal', note: 'Bookings it usually misses by' },
            { label: 'Average error %', value: forecast.accuracy.mape, format: 'percent' },
          ],
        },
        ...(forecast.summaryText ? [{ kind: 'list' as const, title: 'Summary', items: [forecast.summaryText] }] : []),
        { kind: 'list', title: 'AI recommendations', items: forecast.recommendations, emptyText: 'No recommendations for this forecast.' },
        {
          kind: 'table', title: 'Capacity on the busiest day', note: peak ? `Available now vs. needed on ${dateLabel(peak.date)}` : 'Available now vs. needed on the busiest day',
          columns: [{ header: 'Resource', key: 'resource', width: 16 }, { header: 'Available now', key: 'available', format: 'number' }, { header: 'Needed', key: 'needed', format: 'number' }, { header: 'Shortage', key: 'shortage', format: 'number' }],
          rows: capacity,
        },
        {
          kind: 'table', title: 'Demand by service', note: `Expected bookings, next ${horizonDays} days`,
          columns: [{ header: 'Service', key: 'service', width: 26 }, { header: 'Past bookings', key: 'historical', format: 'number' }, { header: 'Expected bookings', key: 'forecast', format: 'decimal', width: 20 }],
          rows: forecast.serviceDemand.map((item) => ({ service: item.service, historical: item.historical, forecast: item.forecast })),
          totals: { historical: forecast.serviceDemand.reduce((sum, item) => sum + item.historical, 0), forecast: Number(forecast.serviceDemand.reduce((sum, item) => sum + item.forecast, 0).toFixed(1)) },
        },
        {
          kind: 'table', title: 'Daily forecast', note: 'Expected bookings for each day',
          columns: [{ header: 'Date', key: 'date', width: 22 }, { header: 'Expected bookings', key: 'forecast', format: 'decimal', width: 20 }],
          rows: forecastDays.map((point) => ({ date: point.date ? dateLabel(point.date, true) : point.label, forecast: point.forecast })),
          totals: { forecast: Number(forecastDays.reduce((sum, point) => sum + point.forecast, 0).toFixed(1)) },
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

  return (
    <div className="space-y-6" ref={reportRef}>
      <PageHeader
        icon={BarChart3}
        title="REPORTS"
        subtitle={<>Analyze bookings, revenue, operational performance, and <span className="font-medium text-[#d4a72c]">AI demand forecasts</span>.</>}
        subtitleClassName="mt-1 text-sm text-slate-500"
        action={<div className="flex flex-wrap items-center gap-2">
          <button
            onClick={saveCurrentReport}
            disabled={savingReport || (reportType === 'forecast' && !forecast)}
            className="inline-flex h-10 w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30 disabled:opacity-50"
          >
            <Save size={16} aria-hidden="true" /> {savingReport ? 'Saving...' : 'Save report'}
          </button>
          <details className="group relative">
            <summary className="inline-flex h-10 w-fit shrink-0 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30">
              <Download size={16} aria-hidden="true" /> Export <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="absolute right-0 z-30 mt-2 min-w-36 overflow-hidden rounded-xl border border-slate-200/70 bg-white p-1 shadow-md">
              <button type="button" onClick={exportPDF} className="inline-flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 text-left text-sm text-slate-700 transition-colors hover:bg-[#e0ac22] hover:text-[#172033] focus-visible:bg-[#e0ac22] focus-visible:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30"><FileText size={15} aria-hidden="true" /> PDF</button>
              <button type="button" onClick={exportExcel} className="inline-flex h-10 w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 text-left text-sm text-slate-700 transition-colors hover:bg-[#e0ac22] hover:text-[#172033] focus-visible:bg-[#e0ac22] focus-visible:text-[#172033] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30"><FileSpreadsheet size={15} aria-hidden="true" /> Excel</button>
            </div>
          </details>
        </div>}
      />

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

      {/* Filters: the date control matches what the open tab actually uses */}
      <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:shadow-md">
        <div className="flex flex-wrap items-end gap-3 lg:flex-nowrap">
          <div className="min-w-[200px] flex-[1.6] lg:min-w-0">
            {activeSection === 'daily' ? <>
              <p className="mb-1.5 block text-sm font-medium text-slate-900">Report date</p>
              <ReadOnlyFilter>Today · {formatFilterDate(getManilaDateInputValue(), true)}</ReadOnlyFilter>
            </> : activeSection === 'monthly' ? <>
              <p className="mb-1.5 block text-sm font-medium text-slate-900">Period</p>
              <ReadOnlyFilter>{formatFilterMonth(dateFrom)} to {formatFilterMonth(dateTo)} · set with 6M, 12M or 24M below</ReadOnlyFilter>
            </> : <>
              <label id="reports-date-range-label" htmlFor="reports-date-range" className="mb-1.5 block text-sm font-medium text-slate-900">{activeSection === 'forecast' ? 'Booking history to learn from' : 'Date range'}</label>
              <DateRangeField id="reports-date-range" start={dateFrom} end={dateTo} onChangeStart={setDateFrom} onChangeEnd={setDateTo} presets={RANGE_PRESETS.map((preset) => ({ ...preset, range: getPresetRange(preset.id) }))} />
            </>}
          </div>
          <div className="min-w-[140px] flex-1 lg:min-w-0">
            <label htmlFor="reports-service" className="mb-1.5 block text-sm font-medium text-slate-900">Services</label>
            <ReportSelect
              id="reports-service"
              value={selectedService}
              onChange={setSelectedService}
              options={[{ value: 'All', label: 'All' }, ...REPORT_SERVICES.map((service) => ({ value: service, label: service }))]}
            />
          </div>
          <div className="min-w-[140px] flex-1 lg:min-w-0">
            <label htmlFor="reports-vehicle" className="mb-1.5 block text-sm font-medium text-slate-900">Vehicle</label>
            <ReportSelect
              id="reports-vehicle"
              value={selectedVehicleId}
              onChange={setSelectedVehicleId}
              options={[{ value: 'All', label: 'All' }, ...vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.plateNumber || vehicle.alias || vehicle.model || 'Vehicle' }))]}
            />
          </div>
          {appliedFilterCount > 0 && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button type="button" onClick={resetFilters} className="inline-flex h-10 w-fit shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30">Reset</button>
            </div>
          )}
        </div>
      </div>

      {activeSection === 'daily' ? (
        <DailyReportLayout
          dailyKpis={dailyKpis}
          dailyBookingSummary={dailyBookingSummary}
          paymentTracking={paymentTracking}
          dailySalesLoadError={dailySalesLoadError}
          bookingLoadError={bookingLoadError}
          dateTo={getManilaDateInputValue()}
          recentBookings={recentBookings}
          dailyChartDays={dailyChartDays}
          onDailyChartDaysChange={setDailyChartDays}
        />
      ) : activeSection === 'operational' ? (
        <OperationalReportLayout
          fleetUtilization={operationalFleetUtilization}
          jobsPerVehicle={fleetUtilization}
          onTimeArrival={onTimeArrival}
          activeJobOrders={activeJobOrders}
          crewOnDuty={crewOnDuty}
          crewSummary={crewSummary}
          crewTotals={{ drivers: drivers.length, helpers: helpers.length }}
          bookingLoadError={bookingLoadError}
          assignmentLoadError={assignmentLoadError}
          jobOrderLoadError={jobOrderLoadError}
          postServiceLoadError={postServiceLoadError}
          crewLoadError={crewLoadError}
          vehicleLoadError={vehicleLoadError}
          completedVsCancelled={completedVsCancelled}
          vehicleStatus={vehicleStatus}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      ) : (
        <>
          {activeSection === 'forecast' ? <DemandForecastDashboard
            forecast={forecast}
            loading={forecastLoading}
            error={forecastError}
            onGenerate={() => { void loadForecast(); }}
            horizon={forecastHorizon}
            onHorizonChange={setForecastHorizon}
            vehicles={vehicles}
            drivers={drivers}
            helpers={helpers}
          /> : <MonthlyReportLayout
            monthlyKpis={monthlyKpis}
            salesUnavailable={dailySalesLoadError}
            monthlyData={monthlyData}
            monthlyServiceDistribution={monthlyServiceDistribution}
            monthlyPaymentDistribution={monthlyPaymentDistribution}
            monthlyStatusDistribution={monthlyStatusDistribution}
            monthlyRange={monthlyRange}
            onMonthlyRangeChange={(range) => {
              setMonthlyRange(range);
              if (dateTo) {
                const end = new Date(`${dateTo}T00:00:00`);
                if (!Number.isNaN(end.getTime())) {
                  setDateFrom(toDateInputValue(new Date(end.getFullYear(), end.getMonth() - range + 1, 1)));
                }
              }
            }}
            forecast={forecast}
            forecastLoading={forecastLoading}
            forecastError={forecastError}
            forecastChartData={forecastChartData}
            recommendedResources={recommendedResources}
            historicalBookingCount={filteredBookings.length}
          />
          }
        </>
      )}
    </div>
  );
}
function MonthlyReportLayout({
  monthlyKpis,
  salesUnavailable,
  monthlyData,
  monthlyServiceDistribution,
  monthlyPaymentDistribution,
  monthlyStatusDistribution,
  monthlyRange,
  onMonthlyRangeChange,
  forecast,
  forecastLoading,
  forecastError,
  forecastChartData,
  recommendedResources,
  historicalBookingCount,
  forecastOnly = false,
}: {
  monthlyKpis: {
    monthlyRevenue: number;
    monthlyRevenueChange: number;
    ytdRevenue: number;
    totalTrips: number;
    avgRevenuePerTrip: number;
    avgChange: number;
  };
  salesUnavailable: boolean;
  monthlyData: {
    months: { label: string; year: number; month: number; revenue: number; trips: number }[];
    latestMonth: { label: string; year: number; revenue: number; trips: number } | null;
    previousMonth: { label: string; year: number; revenue: number; trips: number } | null;
  };
  monthlyServiceDistribution: { name: string; value: number }[];
  monthlyPaymentDistribution: { name: string; value: number }[];
  monthlyStatusDistribution: { name: string; value: number }[];
  monthlyRange: 6 | 12 | 24;
  onMonthlyRangeChange: (range: 6 | 12 | 24) => void;
  forecast: ForecastResponse | null;
  forecastLoading: boolean;
  forecastError: string | null;
  forecastChartData: { label: string; forecast: number }[];
  recommendedResources: { trucks: number; drivers: number; helpers: number };
  historicalBookingCount: number;
  forecastOnly?: boolean;
}) {
  const statusColors: Record<string, string> = {
    'For Plotting': '#f59e0b',
    'For Verification': '#3b82f6',
    Assigned: '#6366f1',
    Rescheduled: '#06b6d4',
    Completed: '#10b981',
    Cancelled: '#ef4444',
  };

  const serviceColors: Record<string, string> = {
    'Lipat Bahay': '#22c55e',
    'Office Pull Out': '#3b82f6',
    'Corporate Delivery': '#f59e0b',
    'Unit to Unit Transfer': '#a855f7',
    'Warehouse Move': '#ef4444',
  };

  const paymentColors: Record<string, string> = {
    GCash: '#3b82f6',
    BDO: '#22c55e',
    Xendit: '#8b5cf6',
    'Bank Transfer': '#22c55e',
    COD: '#f59e0b',
    'Credit Card': '#ef4444',
    Cash: '#64748b',
  };

  const latestLabel = monthlyData.latestMonth ? `${monthlyData.latestMonth.label} ${monthlyData.latestMonth.year}` : '';
  const previousAverage = monthlyData.previousMonth && monthlyData.previousMonth.trips > 0 ? monthlyData.previousMonth.revenue / monthlyData.previousMonth.trips : 0;
  const muted = (isZero: boolean) => (isZero ? 'text-slate-400' : undefined);
  /** "▲ 12.3% vs Sep", coloured, or a plain note when there is no earlier month to compare with. */
  const changeNote = (change: number, previousValue: number | undefined) => {
    if (!monthlyData.previousMonth || !previousValue) return 'No previous month to compare';
    return <><span className={change >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}>{change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%</span> vs {monthlyData.previousMonth.label}</>;
  };
  const [monthPage, setMonthPage] = useState(1);
  const [monthPageSize, setMonthPageSize] = useState(8);
  const monthRows = monthlyData.months.map((month, index) => {
    const previous = index > 0 ? monthlyData.months[index - 1] : null;
    return {
      key: `${month.year}-${month.month}`,
      label: `${month.label} ${month.year}`,
      trips: month.trips,
      revenue: month.revenue,
      average: month.trips > 0 ? month.revenue / month.trips : 0,
      change: previous && previous.revenue > 0 ? ((month.revenue - previous.revenue) / previous.revenue) * 100 : null,
    };
  }).reverse();
  // Same pagination as the other tables; the Total row still covers every month in the range.
  const monthTotalPages = Math.max(1, Math.ceil(monthRows.length / monthPageSize));
  const safeMonthPage = Math.min(monthPage, monthTotalPages);
  const pagedMonthRows = monthRows.slice((safeMonthPage - 1) * monthPageSize, safeMonthPage * monthPageSize);
  const rangeTrips = monthlyData.months.reduce((sum, month) => sum + month.trips, 0);
  const rangeRevenue = monthlyData.months.reduce((sum, month) => sum + month.revenue, 0);
  const hasLimitedForecastData = historicalBookingCount < FORECAST_LIMITED_DATA_THRESHOLD;
  const hasForecastHistory = historicalBookingCount > 0;
  const forecastChange = forecast && hasForecastHistory ? Math.round(forecast.predictedBookings * 0.18) : 0;
  const forecastConfidence = Math.max(0, Math.min(100, forecast?.confidence ?? 0));
  const confidenceLevel = forecastConfidence < FORECAST_CONFIDENCE_LOW_THRESHOLD
    ? { label: 'Low', classes: 'bg-amber-50 text-amber-700' }
    : forecastConfidence <= FORECAST_CONFIDENCE_HIGH_THRESHOLD
      ? { label: 'Medium', classes: 'bg-blue-50 text-blue-700' }
      : { label: 'High', classes: 'bg-emerald-50 text-emerald-700' };

  return (
    <div className="space-y-6">
      {!forecastOnly && <>
      {/* Monthly performance: one range control for the whole tab */}
      <section aria-labelledby="monthly-kpi-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="monthly-kpi-heading" className="text-sm font-semibold text-slate-900">Monthly performance</h3>
          </div>
          <MonthlyRangeSelector value={monthlyRange} onChange={onMonthlyRangeChange} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            variant="dashboard-compact"
            label={`Revenue${latestLabel ? `, ${latestLabel}` : ''}`}
            value={salesUnavailable ? 'Unavailable' : formatPesoCompact(monthlyKpis.monthlyRevenue)}
            description={salesUnavailable ? 'Verified sales data unavailable' : changeNote(monthlyKpis.monthlyRevenueChange, monthlyData.previousMonth?.revenue)}
            icon={PhilippinePeso}
            iconColor="#059669"
            valueClassName={muted(salesUnavailable || monthlyKpis.monthlyRevenue === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Year-to-date revenue"
            value={salesUnavailable ? 'Unavailable' : formatPesoCompact(monthlyKpis.ytdRevenue)}
            description={salesUnavailable ? 'Verified sales data unavailable' : `Jan to ${latestLabel || 'date'}`}
            icon={BarChart3}
            iconColor="#3b82f6"
            valueClassName={muted(salesUnavailable || monthlyKpis.ytdRevenue === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Trips"
            value={String(monthlyKpis.totalTrips)}
            description={`Non-cancelled, last ${monthlyRange} months`}
            icon={Truck}
            iconColor="#a855f7"
            valueClassName={muted(monthlyKpis.totalTrips === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Average revenue per trip"
            value={salesUnavailable ? 'Unavailable' : formatPesoCompact(monthlyKpis.avgRevenuePerTrip)}
            description={salesUnavailable ? 'Verified sales data unavailable' : monthlyKpis.totalTrips === 0 ? 'No trips yet' : changeNote(monthlyKpis.avgChange, previousAverage)}
            icon={TrendingUp}
            iconColor="#f59e0b"
            valueClassName={muted(salesUnavailable || monthlyKpis.avgRevenuePerTrip === 0)}
          />
        </div>
      </section>

      {/* Monthly trends */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Revenue trend" subtitle="Verified revenue per month (₱)" className="min-w-0">
          {salesUnavailable ? (
            <div className="flex h-[250px] flex-col items-center justify-center text-center text-slate-400" role="status">
              <TrendingUp size={28} className="mb-3 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-500">Verified sales data is unavailable.</p>
            </div>
          ) : monthlyData.months.length === 0 ? (
            <div className="flex h-[250px] flex-col items-center justify-center text-center text-slate-400">
              <TrendingUp size={28} className="mb-3 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-500">No revenue data in the selected range.</p>
            </div>
          ) : (
            <div role="img" aria-label="Monthly revenue trend chart" className="min-w-0">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData.months.map((m) => ({ label: monthlyRange === 24 ? `${m.label} '${String(m.year).slice(-2)}` : m.label, revenue: m.revenue }))} margin={{ top: 18, right: 14, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={8} tickLine={false} />
                  <YAxis width={70} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v: number) => formatPesoCompact(v)} />
                  <Tooltip formatter={(value: number) => [formatPeso(value), 'Revenue']} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#1a1f6e" strokeWidth={2.5} dot={{ r: 3, fill: '#1a1f6e' }} activeDot={{ r: 5 }}>
                    {monthlyRange <= 12 && <LabelList dataKey="revenue" position="top" fontSize={11} fill="#1a1f6e" formatter={(v: number) => formatPesoCompact(v)} />}
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Trips per month" subtitle="Non-cancelled bookings by service date" className="min-w-0">
          {monthlyData.months.length === 0 ? (
            <div className="flex h-[250px] flex-col items-center justify-center text-center text-slate-400">
              <BarChart3 size={28} className="mb-3 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-500">No trip data in the selected range.</p>
            </div>
          ) : (
            <div role="img" aria-label="Trips per month chart" className="min-w-0">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlyData.months.map((m) => ({ label: monthlyRange === 24 ? `${m.label} '${String(m.year).slice(-2)}` : m.label, trips: m.trips }))} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={8} tickLine={false} />
                  <YAxis width={34} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#f1f4fa' }} formatter={(value: number) => [value, 'Trips']} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="trips" name="Trips" fill="#1a1f6e" radius={[4, 4, 0, 0]} maxBarSize={30}>
                    {monthlyRange <= 12 && <LabelList dataKey="trips" position="top" fontSize={11} fill="#1a1f6e" />}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Distribution cards */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <ChartCard title="Service type" subtitle="Trips by service" className="min-w-0 overflow-hidden">
          <DistributionDonut
            data={monthlyServiceDistribution}
            colors={serviceColors}
            fallbackColor="#3b82f6"
            centerLabel={`${monthlyKpis.totalTrips}`}
            centerSubLabel="trips"
            emptyTitle="No service data yet"
            emptyHint="Bookings will appear here."
            horizontal
            large
          />
        </ChartCard>

        <ChartCard title="Payment method" subtitle="Verified collections by method" className="min-w-0 overflow-hidden">
          <DistributionDonut
            data={salesUnavailable ? [] : monthlyPaymentDistribution}
            colors={paymentColors}
            fallbackColor="#3b82f6"
            centerLabel={formatPesoCompact(monthlyPaymentDistribution.reduce((sum, item) => sum + item.value, 0))}
            centerSubLabel="total collected"
            valueFormatter={(v: number) => formatPesoCompact(v)}
            emptyTitle={salesUnavailable ? 'Payment data unavailable' : 'No payment data yet'}
            emptyHint={salesUnavailable ? 'Unable to load verified sales.' : 'Payments will appear here.'}
            horizontal
            large
          />
        </ChartCard>

        <ChartCard title="Booking status" subtitle="All bookings, including cancelled" className="min-w-0 overflow-hidden">
          <DistributionDonut
            data={monthlyStatusDistribution}
            colors={statusColors}
            fallbackColor="#3b82f6"
            centerLabel={`${monthlyStatusDistribution.reduce((sum, item) => sum + item.value, 0)}`}
            centerSubLabel="bookings"
            showCounts
            emptyTitle="No booking status data yet"
            emptyHint="Booking status counts will show here."
            horizontal
            large
          />
        </ChartCard>
      </div>

      {/* Exact figures per month, newest first */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Month-by-month</h3>
          <p className="mt-0.5 text-sm text-slate-500">Exact trips and revenue for each month in the range</p>
        </div>
        <div className="overflow-x-auto">
          <table className={`${tableClasses} min-w-[640px] table-auto`}>
            <thead className={tableHeadClasses}>
              <tr>{['Month', 'Trips', 'Revenue', 'Avg per trip', 'Revenue vs prior month'].map((heading) => <th key={heading} scope="col" className={`${tableHeaderCellClasses} whitespace-nowrap ${heading === 'Month' ? '' : 'text-right'}`}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {monthRows.length === 0 ? (
                <tr><td colSpan={5} className="border-b border-[#dde4ef] px-4 py-8 text-center text-sm text-[#70747c]">No months in the selected range.</td></tr>
              ) : pagedMonthRows.map((row) => (
                <tr key={row.key} className={tableRowClasses}>
                  <td className={`${tableCellClasses} whitespace-nowrap font-semibold`}>{row.label}</td>
                  <td className={`${tableCellClasses} text-right tabular-nums ${row.trips === 0 ? 'text-slate-400' : ''}`}>{row.trips}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right tabular-nums ${row.revenue === 0 ? 'text-slate-400' : ''}`}>{salesUnavailable ? '—' : formatPeso(row.revenue)}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right tabular-nums ${row.average === 0 ? 'text-slate-400' : ''}`}>{salesUnavailable ? '—' : formatPeso(row.average)}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right tabular-nums`}>{salesUnavailable || row.change === null ? <span className="text-slate-400">—</span> : <span className={row.change >= 0 ? 'text-emerald-600' : 'text-red-600'}>{row.change >= 0 ? '▲' : '▼'} {Math.abs(row.change).toFixed(1)}%</span>}</td>
                </tr>
              ))}
            </tbody>
            {monthRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50">
                  <td className={`${tableCellClasses} font-semibold`}>Total</td>
                  <td className={`${tableCellClasses} text-right font-semibold tabular-nums`}>{rangeTrips}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right font-semibold tabular-nums text-[#1a1f6e]`}>{salesUnavailable ? '—' : formatPeso(rangeRevenue)}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right font-semibold tabular-nums`}>{salesUnavailable ? '—' : formatPeso(rangeTrips > 0 ? rangeRevenue / rangeTrips : 0)}</td>
                  <td className={tableCellClasses} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <TablePagination
          page={safeMonthPage}
          totalPages={monthTotalPages}
          totalItems={monthRows.length}
          pageSize={monthPageSize}
          onPageChange={setMonthPage}
          onPageSizeChange={(size) => { setMonthPageSize(size); setMonthPage(1); }}
        />
      </section>

      </>}

      {forecastOnly && <>
      {/* AI Demand Forecast Section */}
      <div id="ai-demand-forecast-section" className="scroll-mt-6 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm transition hover:shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Sparkles size={17} className="text-violet-500" aria-hidden="true" /> AI demand forecast</h3>
              {hasLimitedForecastData && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Limited data</span>}
            </div>
            <p className="text-sm text-slate-500 mt-0.5">Forecasted booking demand for next month</p>
            <div className="mt-4">
              <p className={`text-3xl font-bold ${forecastChange === 0 ? 'text-slate-400' : 'text-[#8b5cf6]'}`}>{forecastChange === 0 ? 'No change' : `+${forecastChange}%`}</p>
              <p className="text-sm text-slate-500 mt-1">vs {monthlyData.latestMonth?.label || 'current month'} {monthlyData.latestMonth?.year || ''}</p>
            </div>
            <div className="mt-4">
              {hasForecastHistory && forecast && forecastChartData.length > 0 ? (
                <div className="h-40" role="img" aria-label="AI demand forecast trend for the next four weeks">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastChartData}>
                    <defs>
                      <linearGradient id="monthlyForecastGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 12, color: '#64748b' }} />
                    <Area type="monotone" dataKey="forecast" stroke="#8b5cf6" fill="url(#monthlyForecastGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              ) : !hasForecastHistory ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 pt-4 text-center" role="img" aria-label="Not enough booking history to chart a forecast trend">
                  <p className="flex h-24 items-center justify-center text-sm text-slate-400">{forecastLoading ? 'Generating forecastÃ¢â‚¬Â¦' : 'Not enough history to chart a trend'}</p>
                  <div className="grid grid-cols-4 border-t border-slate-200 py-2 text-sm font-medium text-slate-400">
                    {['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'].map((label) => <span key={label}>{label}</span>)}
                  </div>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
                  {forecastLoading ? 'Generating forecastÃ¢â‚¬Â¦' : forecastError || 'No forecast available.'}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Recommended resources</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TruckIcon size={18} className="text-slate-500" />
                  <span className="text-sm text-slate-700">Trucks</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${recommendedResources.trucks === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{recommendedResources.trucks}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-slate-500" />
                  <span className="text-sm text-slate-700">Drivers</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${recommendedResources.drivers === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{recommendedResources.drivers}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-slate-500" />
                  <span className="text-sm text-slate-700">Helpers</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${recommendedResources.helpers === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{recommendedResources.helpers}</span>
              </div>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">Confidence</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${confidenceLevel.classes}`}>{confidenceLevel.label}</span>
                  <span className={`text-xl font-bold tabular-nums ${forecastConfidence === 0 ? 'text-slate-400' : 'text-amber-700'}`}>{forecastConfidence}%</span>
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Forecast confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={forecastConfidence}>
                <div className="h-full rounded-full bg-amber-600 transition-all" style={{ width: `${forecastConfidence}%` }} />
              </div>
              <p className="mt-2 text-sm text-slate-500">Based on {historicalBookingCount} bookings</p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900"><Sparkles size={17} className="text-violet-500" aria-hidden="true" /> AI recommendations</h3>
            {hasLimitedForecastData && (
              <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
                Rough estimates only. Add more booking history for better results.
              </div>
            )}
            <div className="space-y-3">
              {(forecast?.recommendations || []).length > 0 ? (
                forecast?.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                    <CheckCircle size={18} className="text-[#22c55e] flex-shrink-0 mt-0.5" />
                    <span>{formatForecastRecommendation(rec)}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-start gap-2 text-sm leading-relaxed text-slate-500">
                  <PieChartIcon size={18} className="flex-shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
                  <span>No AI recommendations are available.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}

function ReportSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  const focusOption = (index: number) => {
    const nextIndex = (index + options.length) % options.length;
    optionRefs.current[nextIndex]?.focus();
  };

  const openAt = (index: number) => {
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(index));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openAt(selectedIndex);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={`flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 ${open ? 'ring-1 ring-slate-200' : ''}`}
      >
        <span className="truncate">{selectedOption?.label ?? value}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180 text-[#a16207]' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 top-full z-40 mt-2 max-h-60 w-full min-w-full max-w-[calc(100vw-2rem)] overflow-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10"
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={-1}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(index + 1); }
                  else if (event.key === 'ArrowUp') { event.preventDefault(); focusOption(index - 1); }
                  else if (event.key === 'Home') { event.preventDefault(); focusOption(0); }
                  else if (event.key === 'End') { event.preventDefault(); focusOption(options.length - 1); }
                  else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-[#e8b800] focus-visible:text-slate-900 active:bg-[#e8b800] active:text-slate-900 ${selected ? 'font-semibold text-slate-800' : 'text-slate-700'} hover:bg-[#e8b800] hover:text-slate-900`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DistributionDonut({
  data,
  colors,
  fallbackColor,
  centerLabel,
  centerSubLabel,
  valueFormatter,
  showCounts,
  emptyTitle,
  emptyHint,
  horizontal = false,
  large = false,
}: {
  data: { name: string; value: number }[];
  colors: Record<string, string>;
  fallbackColor: string;
  centerLabel: string;
  centerSubLabel: string;
  valueFormatter?: (v: number) => string;
  showCounts?: boolean;
  emptyTitle: string;
  emptyHint: string;
  horizontal?: boolean;
  large?: boolean;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const displayedCenterLabel = centerSubLabel === 'total collected' && centerLabel.length > 10
    ? PHP_COMPACT_CURRENCY_FORMATTER.format(toNumber(centerLabel))
    : centerLabel;
  if (total === 0 && !showCounts) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center" role="status">
        <PieChartIcon size={26} className="mb-2 text-slate-300" aria-hidden="true" />
        <p className="text-base font-semibold text-slate-600">{emptyTitle}</p>
        <p className="mt-1 max-w-[220px] text-sm text-slate-400">{emptyHint}</p>
      </div>
    );
  }
  const circumference = 2 * Math.PI * 44;
  let accumulated = 0;
  return (
    <div className={`${horizontal && large ? 'flex min-h-[190px] min-w-0 items-center gap-6 overflow-hidden' : `flex items-center gap-3 ${horizontal ? 'flex-col sm:flex-row sm:justify-between' : 'flex-col gap-4'}`}`}>
      <div className={`relative shrink-0 ${large ? 'h-40 w-40' : horizontal ? 'h-32 w-32' : 'h-36 w-36'}`} role="img" aria-label={`${displayedCenterLabel} ${centerSubLabel}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="44" fill="none" stroke="#eef0f6" strokeWidth="11" />
          {total > 0 && data.map((entry, i) => {
            const segmentLength = (entry.value / total) * circumference;
            const dashOffset = -accumulated;
            accumulated += segmentLength;
            return (
              <circle
                key={entry.name}
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={colors[entry.name] || COLORS[i % COLORS.length] || fallbackColor}
                strokeWidth="11"
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 50 50)"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="max-w-[110px] text-center">
            <span className="block break-words text-[17px] font-semibold leading-tight tabular-nums text-slate-900">{displayedCenterLabel}</span>
            <span className="block text-xs text-slate-500">{centerSubLabel}</span>
          </div>
        </div>
      </div>
      <div className={`${horizontal && large ? 'min-w-0 flex-1 space-y-2' : `w-full space-y-2 ${horizontal ? 'min-w-0 flex-1' : 'max-w-sm'}`}`}>
        {data.map((entry, i) => {
          const pct = total > 0 ? (entry.value / total) * 100 : 0;
          const color = colors[entry.name] || COLORS[i % COLORS.length] || fallbackColor;
          return (
            <div key={entry.name} title={`${entry.name}: ${valueFormatter ? valueFormatter(entry.value) : entry.value}${showCounts ? '' : ` (${pct.toFixed(1)}%)`}`} className={horizontal && large ? 'flex min-w-0 items-center gap-3 text-sm' : 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-sm'}>
              <span className={`h-2.5 w-2.5 shrink-0 ${horizontal && large ? 'rounded-sm' : 'rounded-full'}`} style={{ backgroundColor: color }} />
              <span className={`text-slate-700 ${horizontal && large ? 'min-w-0 flex-1 truncate' : 'truncate'}`}>{entry.name}</span>
              {!showCounts && <span className="shrink-0 text-right font-semibold tabular-nums text-slate-700">{pct.toFixed(0)}%</span>}
              <span className={`${horizontal && large ? 'shrink-0 whitespace-nowrap font-semibold text-slate-900' : showCounts ? 'min-w-8 text-sm font-semibold text-slate-700' : 'min-w-[62px] text-sm text-slate-400'} text-right tabular-nums`}>{showCounts ? entry.value : valueFormatter ? valueFormatter(entry.value) : `(${entry.value})`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatForecastRecommendation(recommendation: string): string {
  return recommendation
    .replace(/historical booking\(s\)/gi, 'historical bookings')
    .replace(/booking\(s\)/gi, 'bookings')
    .replace(/~(\d+) daily assignments?/gi, (_match, count: string) => `about ${count} daily assignment${count === '1' ? '' : 's'}`)
    .replace(/"your core"|your core/gi, 'your top service');
}

function OperationalReportLayout({
  fleetUtilization,
  jobsPerVehicle,
  onTimeArrival,
  activeJobOrders,
  crewOnDuty,
  crewSummary,
  crewTotals,
  bookingLoadError,
  assignmentLoadError,
  jobOrderLoadError,
  postServiceLoadError,
  crewLoadError,
  vehicleLoadError,
  completedVsCancelled,
  vehicleStatus,
  dateFrom,
  dateTo,
}: {
  fleetUtilization: { rate: number | null; assigned: number; total: number | null; unavailable: boolean };
  /** Confirmed assignments per vehicle in the period; vehicles with none are not listed. */
  jobsPerVehicle: { name: string; assignedJobs: number }[];
  onTimeArrival: { rate: number | null; onTime: number; delayed: number; measured: number; unmeasurable: number; unavailable: boolean };
  activeJobOrders: { count: number; pendingDistribution: number };
  crewOnDuty: { drivers: number; helpers: number };
  crewSummary: { availableDrivers: number; availableHelpers: number; assignedCrew: number };
  /** Everyone on each roster, whatever their status. */
  crewTotals: { drivers: number; helpers: number };
  bookingLoadError: boolean;
  assignmentLoadError: boolean;
  jobOrderLoadError: boolean;
  postServiceLoadError: boolean;
  crewLoadError: boolean;
  vehicleLoadError: boolean;
  completedVsCancelled: { label: string; completed: number; cancelled: number }[];
  vehicleStatus: { name: string; value: number }[];
  dateFrom: string;
  dateTo: string;
}) {
  const statusColors: Record<string, string> = {
    Available: '#22c55e',
    Assigned: '#3b82f6',
    'Under Maintenance': '#a855f7',
    'Under Repair': '#ef4444',
  };

  const completedCount = completedVsCancelled.reduce((sum, month) => sum + month.completed, 0);
  const cancelledCount = completedVsCancelled.reduce((sum, month) => sum + month.cancelled, 0);
  const closedJobsCount = completedCount + cancelledCount;
  const cancellationRate = closedJobsCount > 0 ? Math.round((cancelledCount / closedJobsCount) * 100) : null;
  const completionDataUnavailable = bookingLoadError || postServiceLoadError;
  const hasClosedJobs = closedJobsCount > 0 && !completionDataUnavailable;
  const unassignedBookings = fleetUtilization.total === null ? null : Math.max(0, fleetUtilization.total - fleetUtilization.assigned);
  const formatRangeDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };
  const muted = (isEmpty: boolean) => (isEmpty ? 'text-slate-400' : undefined);
  const VEHICLE_ROWS = 6;
  const rankedVehicles = [...jobsPerVehicle].sort((a, b) => b.assignedJobs - a.assignedJobs);
  const topVehicleJobs = rankedVehicles[0]?.assignedJobs ?? 0;
  const fleetSize = vehicleLoadError ? null : vehicleStatus.reduce((sum, item) => sum + item.value, 0);
  const idleVehicles = fleetSize === null ? null : Math.max(0, fleetSize - rankedVehicles.length);
  const totalVehicleJobs = rankedVehicles.reduce((sum, vehicle) => sum + vehicle.assignedJobs, 0);
  const averageVehicleJobs = rankedVehicles.length > 0 ? Number((totalVehicleJobs / rankedVehicles.length).toFixed(1)) : 0;
  const viewLink = (to: string, label: string) => (
    <Link to={to} aria-label={label} className="inline-flex h-9 w-fit shrink-0 items-center gap-1 whitespace-nowrap px-1 text-sm font-semibold text-[#8a6d00] hover:text-[#6e5700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6d00]/30">
      View details <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
  const crewRows = [
    { label: 'Drivers', icon: UserRound, color: '#3b82f6', available: crewSummary.availableDrivers, onDuty: crewOnDuty.drivers, total: crewTotals.drivers },
    { label: 'Helpers', icon: UsersRound, color: '#a855f7', available: crewSummary.availableHelpers, onDuty: crewOnDuty.helpers, total: crewTotals.helpers },
  ];

  return (
    <div className="space-y-6">
      {/* How the selected period went */}
      <section aria-labelledby="operational-kpi-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h3 id="operational-kpi-heading" className="text-sm font-semibold text-slate-900">Performance this period</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            variant="dashboard-compact"
            label="Bookings with a vehicle"
            value={fleetUtilization.unavailable ? 'Unavailable' : `${fleetUtilization.rate ?? 0}%`}
            description={fleetUtilization.unavailable ? 'Booking or dispatch data unavailable' : `${fleetUtilization.assigned} of ${fleetUtilization.total ?? 0} · ${unassignedBookings ?? 0} still unassigned`}
            icon={TruckIcon}
            iconColor="#3b82f6"
            valueClassName={muted(fleetUtilization.unavailable || fleetUtilization.total === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="On-time arrival"
            value={onTimeArrival.unavailable ? 'Unavailable' : onTimeArrival.rate === null ? 'No data' : `${onTimeArrival.rate}%`}
            description={onTimeArrival.unavailable ? 'Booking or post-service data unavailable' : `${onTimeArrival.onTime} on time · ${onTimeArrival.delayed} delayed`}
            icon={Timer}
            iconColor="#22c55e"
            valueClassName={muted(onTimeArrival.unavailable || onTimeArrival.rate === null)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Completed services"
            value={completionDataUnavailable ? 'Unavailable' : String(completedCount)}
            description={completionDataUnavailable ? 'Booking or post-service data unavailable' : `${cancelledCount} cancelled · ${cancellationRate === null ? 'no' : `${cancellationRate}%`} cancellation rate`}
            icon={CheckCircle}
            iconColor="#10b981"
            valueClassName={muted(completionDataUnavailable || completedCount === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Job orders"
            value={jobOrderLoadError ? 'Unavailable' : String(activeJobOrders.count)}
            description={jobOrderLoadError ? 'Job order data unavailable' : activeJobOrders.pendingDistribution > 0 ? `${activeJobOrders.pendingDistribution} pending distribution` : 'All distributed'}
            icon={Package}
            iconColor="#a855f7"
            valueClassName={!jobOrderLoadError && activeJobOrders.pendingDistribution > 0 ? undefined : muted(jobOrderLoadError || activeJobOrders.count === 0)}
          />
        </div>
      </section>

      {/* How jobs closed, and which vehicles carried them */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
      <ChartCard
        title="Completed vs cancelled jobs"
        className="h-full min-w-0"
        subtitle={completionDataUnavailable ? 'Booking or post-service records are unavailable' : hasClosedJobs ? 'Closed jobs per month' : 'Nothing closed in the selected period'}
        rightAction={(
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><span className="h-2 w-2 rounded-full bg-[#16a34a]" aria-hidden="true" />Completed</span>
            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><span className="h-2 w-2 rounded-full bg-[#ef4444]" aria-hidden="true" />Cancelled</span>
            {viewLink('/admin/post-service', 'View completed services')}
          </div>
        )}
      >
        {!hasClosedJobs ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 pt-5 text-center">
            <div className="flex min-h-[88px] flex-col items-center justify-center">
              <BarChart3 size={24} className="mb-2 text-slate-300" aria-hidden="true" />
              <p className="text-base font-semibold text-slate-600">{completionDataUnavailable ? 'Booking or post-service records are unavailable' : 'No completed or cancelled jobs yet'}</p>
              <p className="mt-1 text-sm text-slate-400">Closed jobs for {formatRangeDate(dateFrom)} to {formatRangeDate(dateTo)} will show up here.</p>
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-slate-300/70 py-2 text-sm font-medium text-slate-400">
              {completedVsCancelled.map((month, index) => <span key={`${month.label}-${index}`} className="whitespace-nowrap">{month.label}</span>)}
            </div>
          </div>
        ) : (
          <div role="img" aria-label={`${completedCount} completed and ${cancelledCount} cancelled jobs from ${formatRangeDate(dateFrom)} to ${formatRangeDate(dateTo)}`}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={completedVsCancelled} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} width={34} />
                <Tooltip cursor={{ fill: '#f1f4fa' }} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="completed" name="Completed" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="cancelled" name="Cancelled" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Jobs per vehicle"
        subtitle="Confirmed assignments in this period"
        className="h-full min-w-0"
        rightAction={viewLink('/admin/scheduling', 'View scheduling')}
      >
        {fleetUtilization.unavailable ? (
          <p role="alert" className="text-sm text-red-700">Booking or dispatch records could not be loaded, so jobs per vehicle are unavailable.</p>
        ) : rankedVehicles.length === 0 ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 text-center">
            <TruckIcon size={24} className="mb-2 text-slate-300" aria-hidden="true" />
            <p className="text-base font-semibold text-slate-600">No vehicles assigned yet</p>
            <p className="mt-1 text-sm text-slate-400">Confirmed assignments for {formatRangeDate(dateFrom)} to {formatRangeDate(dateTo)} will show up here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary strip: how much of the fleet was used, and how much work it carried */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-medium text-slate-500">Vehicles used</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#0b0f4a]">{rankedVehicles.length}{fleetSize !== null && <span className="text-sm font-medium text-slate-400"> / {fleetSize}</span>}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-medium text-slate-500">Total jobs</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#0b0f4a]">{totalVehicleJobs}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-medium text-slate-500">Avg per vehicle</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-[#0b0f4a]">{averageVehicleJobs}</p>
              </div>
            </div>

            {/* Ranked vehicles, busiest first */}
            <ol className="space-y-2.5">
              {rankedVehicles.slice(0, VEHICLE_ROWS).map((vehicle, index) => {
                const share = totalVehicleJobs > 0 ? Math.round((vehicle.assignedJobs / totalVehicleJobs) * 100) : 0;
                return (
                  <li key={vehicle.name} className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${index === 0 ? 'bg-[#e8b800] text-[#0b0f4a]' : 'bg-slate-100 text-slate-500'}`} aria-label={`Rank ${index + 1}`}>{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium text-slate-800" title={vehicle.name}>{vehicle.name}</span>
                        <span className="shrink-0 text-sm tabular-nums"><span className="font-semibold text-[#0b0f4a]">{vehicle.assignedJobs}</span><span className="text-slate-400"> {vehicle.assignedJobs === 1 ? 'job' : 'jobs'} · {share}%</span></span>
                      </div>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[#eef0f6]" aria-hidden="true">
                        <span className="block h-full rounded-full bg-[#1a1f6e]" style={{ width: `${topVehicleJobs > 0 ? (vehicle.assignedJobs / topVehicleJobs) * 100 : 0}%` }} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {rankedVehicles.length > VEHICLE_ROWS && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">+{rankedVehicles.length - VEHICLE_ROWS} more {rankedVehicles.length - VEHICLE_ROWS === 1 ? 'vehicle' : 'vehicles'}</span>}
              {idleVehicles === null
                ? <span className="text-slate-500">Fleet records are unavailable, so idle vehicles cannot be counted.</span>
                : idleVehicles > 0
                  ? <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">{idleVehicles} {idleVehicles === 1 ? 'vehicle' : 'vehicles'} idle this period</span>
                  : <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">Every vehicle had a job</span>}
            </div>
          </div>
        )}
      </ChartCard>
      </div>

      {/* What is available right now */}
      <section aria-labelledby="operational-resources-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h3 id="operational-resources-heading" className="text-sm font-semibold text-slate-900">Resources right now</h3>
          <p className="text-xs text-slate-500">Current fleet and roster status</p>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
          <StatusBreakdownCard
            title="Vehicle status"
            unavailable={vehicleLoadError}
            rightAction={viewLink('/admin/vehicle-availability', 'View vehicle availability')}
            total={vehicleLoadError ? 0 : vehicleStatus.reduce((sum, item) => sum + item.value, 0)}
            centerLabel="vehicles"
            items={vehicleStatus.map((entry, i) => ({
              label: entry.name,
              color: statusColors[entry.name] || COLORS[i % COLORS.length],
              value: entry.value,
            }))}
          />

          <ChartCard title="Crew availability" subtitle="Drivers and helpers by roster status" className="h-full min-w-0" rightAction={viewLink('/admin/vehicle-availability', 'View drivers and helpers')}>
            {crewLoadError ? (
              <p role="alert" className="text-sm text-red-700">Driver and helper records could not be loaded.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {crewRows.map(({ label, icon: Icon, color, available, onDuty, total }) => {
                    const unavailable = Math.max(0, total - available - onDuty);
                    const width = (count: number) => (total > 0 ? `${(count / total) * 100}%` : '0%');
                    return (
                      <div key={label} className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}18`, color }}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                            <span className="text-sm font-semibold text-slate-900">{label}</span>
                          </span>
                          <span className="text-xs text-slate-500">{total} on roster</span>
                        </div>
                        <p className="mt-3 flex items-baseline gap-1.5">
                          <span className={`text-[26px] font-bold leading-none tabular-nums ${available === 0 ? 'text-slate-400' : 'text-[#0b0f4a]'}`}>{available}</span>
                          <span className="text-sm text-slate-500">available now</span>
                        </p>
                        <div role="img" aria-label={`${label}: ${available} available, ${onDuty} on duty, ${unavailable} unavailable`} className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[#eef0f6]">
                          <span className="h-full bg-emerald-500" style={{ width: width(available) }} />
                          <span className="h-full bg-blue-500" style={{ width: width(onDuty) }} />
                          <span className="h-full bg-slate-300" style={{ width: width(unavailable) }} />
                        </div>
                        <dl className="mt-2.5 grid grid-cols-3 gap-1 text-xs">
                          <div><dt className="flex items-center gap-1 text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />Available</dt><dd className="font-semibold tabular-nums text-slate-800">{available}</dd></div>
                          <div><dt className="flex items-center gap-1 text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />On duty</dt><dd className="font-semibold tabular-nums text-slate-800">{onDuty}</dd></div>
                          <div><dt className="flex items-center gap-1 text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />Unavailable</dt><dd className="font-semibold tabular-nums text-slate-800">{unavailable}</dd></div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {assignmentLoadError
                    ? 'Assignment records are unavailable, so crew on assignments in this period cannot be counted.'
                    : <><span className="font-semibold text-[#0b0f4a]">{crewSummary.assignedCrew}</span> crew {crewSummary.assignedCrew === 1 ? 'member was' : 'members were'} on confirmed assignments in this period. Unavailable covers leave and other non-working statuses.</>}
                </p>
              </div>
            )}
          </ChartCard>
        </div>
      </section>
    </div>
  );
}

function DailyReportLayout({
  dailyKpis, dailyBookingSummary, paymentTracking, dailySalesLoadError, bookingLoadError, dateTo, recentBookings, dailyChartDays, onDailyChartDaysChange,
}: {
  dailyKpis: {
    totalSales: number; bookingsToday: number; pendingPlotting: number; codCollected: number;
    onlinePayments: number; pendingCollections: number; completedJobs: number; cancelledJobs: number;
  };
  dailyBookingSummary: { label: string; date: string; count: number }[];
  paymentTracking: { cash: number; bdo: number; gcash: number; xendit: number; sales: number; collected: number; outstanding: number };
  dailySalesLoadError: boolean;
  bookingLoadError: boolean;
  dateTo: string;
  recentBookings: Booking[];
  dailyChartDays: 7 | 30 | 90;
  onDailyChartDaysChange: (value: 7 | 30 | 90) => void;
}) {
  const [recentBookingsPage, setRecentBookingsPage] = useState(1);
  const [recentBookingsPageSize, setRecentBookingsPageSize] = useState(8);
  const dailyKpisUnavailable = dailySalesLoadError || bookingLoadError;
  // The payment card is the one place money is broken down, by the channels the sales records actually keep.
  const methodRows = [
    { label: 'Cash', amount: paymentTracking.cash, color: '#f59e0b' },
    { label: 'BDO', amount: paymentTracking.bdo, color: '#1d4ed8' },
    { label: 'GCash', amount: paymentTracking.gcash, color: '#0ea5e9' },
    { label: 'Xendit', amount: paymentTracking.xendit, color: '#8b5cf6' },
  ];
  const paymentTotal = paymentTracking.sales;
  const hasPaymentActivity = paymentTracking.sales > 0 || paymentTracking.collected > 0;
  const paymentStatus = paymentTracking.outstanding <= 0
    ? { label: 'Fully collected', className: 'border-emerald-300 bg-emerald-50 text-emerald-700' }
    : paymentTracking.collected > 0
      ? { label: 'Partially collected', className: 'border-amber-300 bg-amber-50 text-amber-700' }
      : { label: 'Pending collection', className: 'border-slate-300 bg-slate-50 text-slate-600' };
  const dateRangeLabel = `${dailyChartDays}-day period ending ${dateTo}`;
  const recentBookingsTotalPages = Math.max(1, Math.ceil(recentBookings.length / recentBookingsPageSize));
  const safeRecentBookingsPage = Math.min(recentBookingsPage, recentBookingsTotalPages);
  const paginatedRecentBookings = recentBookings.slice(
    (safeRecentBookingsPage - 1) * recentBookingsPageSize,
    safeRecentBookingsPage * recentBookingsPageSize,
  );
  const muted = (isZero: boolean) => (isZero ? 'text-slate-400' : undefined);

  return (
    <div className="space-y-6">
      <section aria-labelledby="daily-kpi-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h3 id="daily-kpi-heading" className="text-sm font-semibold text-slate-900">Today at a glance</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            variant="dashboard-compact"
            label="Today's sales"
            value={bookingLoadError ? 'Unavailable' : formatPeso(dailyKpis.totalSales)}
            description={bookingLoadError ? 'Booking data unavailable' : 'Active booking value'}
            icon={PhilippinePeso}
            iconColor="#059669"
            valueClassName={muted(!bookingLoadError && dailyKpis.totalSales === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Bookings today"
            value={bookingLoadError ? 'Unavailable' : String(dailyKpis.bookingsToday)}
            description={bookingLoadError ? 'Booking data unavailable' : dailyKpis.cancelledJobs > 0 ? `${dailyKpis.cancelledJobs} cancelled today` : 'None cancelled today'}
            icon={CalendarDays}
            iconColor="#1a1f6e"
            valueClassName={muted(!bookingLoadError && dailyKpis.bookingsToday === 0)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Awaiting assignment"
            value={bookingLoadError ? 'Unavailable' : String(dailyKpis.pendingPlotting)}
            description={bookingLoadError ? 'Booking data unavailable' : dailyKpis.pendingPlotting > 0 ? 'For Plotting, no truck or team yet' : "All of today's bookings are assigned"}
            icon={Truck}
            iconColor="#d97706"
            valueClassName={!bookingLoadError && dailyKpis.pendingPlotting > 0 ? 'text-amber-600' : muted(!bookingLoadError)}
          />
          <KPICard
            variant="dashboard-compact"
            label="Completed jobs"
            value={dailyKpisUnavailable ? 'Unavailable' : String(dailyKpis.completedJobs)}
            description={dailyKpisUnavailable ? 'Booking or sales data unavailable' : 'Completed or in today’s sales report'}
            icon={CheckCircle}
            iconColor="#10b981"
            valueClassName={muted(!dailyKpisUnavailable && dailyKpis.completedJobs === 0)}
          />
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
        <ChartCard title="Daily booking summary" subtitle="Non-cancelled bookings received by day" className="min-w-0" rightAction={<div className="flex shrink-0 rounded-full border border-slate-200 bg-slate-50 p-1" aria-label="Booking chart date range">{([7, 30, 90] as const).map((days) => <button key={days} type="button" aria-pressed={dailyChartDays === days} onClick={() => onDailyChartDaysChange(days)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${dailyChartDays === days ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600'}`}>{days} days</button>)}</div>}>
          <div className="min-w-0" role="img" aria-label={`Non-cancelled bookings received per day for the last ${dailyChartDays} days through ${dateTo}`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyBookingSummary} margin={{ top: 12, right: 8, left: -12, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={14} angle={-35} textAnchor="end" height={55} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} domain={[0, 'dataMax + 1']} width={34} />
                <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? new Date(`${payload[0].payload.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''} formatter={(value: number) => [value, 'Bookings received']} contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" name="Bookings received" fill="#1a1f6e" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
            {dailyBookingSummary.every((day) => day.count === 0) && <p className="-mt-5 text-center text-xs text-slate-500">No bookings received in this period ({dateRangeLabel}).</p>}
          </div>
        </ChartCard>

        <ChartCard
          title="Payment tracking"
          subtitle="Today's bookings · verified collections to date"
          className="h-full min-w-0"
          rightAction={!dailySalesLoadError && hasPaymentActivity ? <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${paymentStatus.className}`}>{paymentStatus.label}</span> : undefined}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Sales</p><p className="mt-1 text-lg font-bold tabular-nums text-[#0b0f4a]">{bookingLoadError ? 'Unavailable' : formatPeso(paymentTracking.sales)}</p><p className="mt-0.5 text-xs text-slate-500">Active booking value</p></div>
              <div className="rounded-xl bg-emerald-50/70 p-3"><p className="text-xs font-medium text-emerald-800">Collected</p><p className="mt-1 text-lg font-bold tabular-nums text-emerald-900">{dailySalesLoadError ? 'Unavailable' : formatPeso(paymentTracking.collected)}</p><p className="mt-0.5 text-xs text-emerald-800">Verified, net of refunds</p></div>
              <div className="rounded-xl bg-amber-50/80 p-3"><p className="text-xs font-medium text-amber-800">Outstanding</p><p className="mt-1 text-lg font-bold tabular-nums text-amber-900">{dailySalesLoadError ? 'Unavailable' : formatPeso(paymentTracking.outstanding)}</p><p className="mt-0.5 text-xs text-amber-800">Sales less collected</p></div>
            </div>
            {!dailySalesLoadError && <>
              <div role="img" aria-label={`Today's collected payments ${formatPeso(paymentTracking.collected)} and outstanding balance ${formatPeso(paymentTracking.outstanding)}`} className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#eef0f6]">
                <span className="h-full bg-emerald-500" style={{ width: paymentTotal > 0 ? `${(paymentTracking.collected / paymentTotal) * 100}%` : '0%' }} />
                <span className="h-full bg-amber-400" style={{ width: paymentTotal > 0 ? `${(paymentTracking.outstanding / paymentTotal) * 100}%` : '0%' }} />
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Collected by method</p>
                <div className="space-y-2">
                  {methodRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />{row.label}</span>
                      <span className="inline-flex items-center gap-4"><span className={'font-semibold tabular-nums ' + (row.amount === 0 ? 'text-slate-400' : 'text-slate-700')}>{formatPeso(row.amount)}</span><span className="w-10 text-right text-xs tabular-nums text-slate-500">{paymentTracking.collected > 0 ? `${Math.round((row.amount / paymentTracking.collected) * 100)}%` : '0%'}</span></span>
                    </div>
                  ))}
                </div>
              </div>
              {!hasPaymentActivity && <p className="text-sm text-slate-400">No sales or verified payments recorded today.</p>}
            </>}
            {dailySalesLoadError && <p role="alert" className="text-sm text-red-700">Verified payment records could not be loaded, so collected and outstanding totals are unavailable.</p>}
          </div>
        </ChartCard>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent bookings</h3>
            <p className="mt-0.5 text-sm text-slate-500">Bookings received today</p>
          </div>
          <Link to="/admin/booking" className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30">View all</Link>
        </div>
        <div className="overflow-x-auto">
          <table className={`${tableClasses} min-w-[760px] table-auto`}>
            <thead className={tableHeadClasses}>
              <tr>{['Booking No.', 'Client', 'Service', 'Date', 'Status', 'Amount'].map((heading) => <th key={heading} scope="col" className={`${tableHeaderCellClasses} whitespace-nowrap ${heading === 'Amount' ? 'text-right' : ''}`}>{heading}</th>)}</tr>
            </thead>
            <tbody>
              {paginatedRecentBookings.map((booking) => (
                <tr key={booking.id} className={tableRowClasses}>
                  <td className={`${tableCellClasses} whitespace-nowrap font-semibold`}>{booking.bookingNo ?? '-'}</td>
                  <td className={`${tableCellClasses} leading-snug`}>{booking.client}</td>
                  <td className={`${tableCellClasses} leading-snug`}>{booking.service}</td>
                  <td className={`${tableCellClasses} whitespace-nowrap`}>{booking.date}</td>
                  <td className={tableCellClasses}><StatusBadge status={booking.status === 'Scheduled' ? 'Assigned' : booking.status} size="xs" variant="outline" /></td>
                  <td className={`${tableCellClasses} whitespace-nowrap text-right font-semibold tabular-nums`}>{formatPeso(toNumber(booking.amount))}</td>
                </tr>
              ))}
              {recentBookings.length === 0 && (
                <tr><td colSpan={6} className="border-b border-[#dde4ef] px-4 py-8 text-center text-sm text-[#70747c]">
                  No bookings received today. New bookings will appear here.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={safeRecentBookingsPage}
          totalPages={recentBookingsTotalPages}
          totalItems={recentBookings.length}
          pageSize={recentBookingsPageSize}
          onPageChange={setRecentBookingsPage}
          onPageSizeChange={(size) => { setRecentBookingsPageSize(size); setRecentBookingsPage(1); }}
        />
      </section>
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

function StatusBreakdownCard({
  title,
  total,
  centerLabel,
  items,
  rightAction,
  unavailable = false,
}: {
  title: string;
  total: number;
  centerLabel: string;
  items: { label: string; color: string; value: number }[];
  rightAction?: React.ReactNode;
  unavailable?: boolean;
}) {
  const circumference = 2 * Math.PI * 48;
  let offset = 0;
  const isJobOrderStatusCard = title === 'Job order status';

  return (
    <ChartCard title={title} className={isJobOrderStatusCard ? 'flex h-full flex-col min-h-[300px]' : 'min-h-[300px]'} rightAction={rightAction}>
      <div className="flex min-h-[190px] flex-1 items-center justify-center gap-10">
        <div className="relative h-40 w-40 shrink-0" role="img" aria-label={`${title}: ${total} ${centerLabel}`}>
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="64" cy="64" r="48" fill="none" stroke="#e2e8f0" strokeWidth="12" />
            {total > 0 && items.map((item) => {
              const segment = (item.value / total) * circumference;
              const circle = (
                <circle
                  key={item.label}
                  cx="64"
                  cy="64"
                  r="48"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="12"
                  strokeDasharray={`${segment} ${circumference - segment}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += segment;
              return circle;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-slate-900">{unavailable ? '—' : total}</span>
            <span className="text-sm text-slate-500">{unavailable ? 'unavailable' : centerLabel}</span>
          </div>
        </div>
        <div className="w-64 shrink-0 space-y-3">
          {items.map((item) => isJobOrderStatusCard ? (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="truncate text-slate-700">{item.label}</span>
              </span>
              <span className="w-8 text-right font-semibold tabular-nums text-slate-900">{unavailable ? '—' : item.value}</span>
            </div>
          ) : (
            <div key={item.label} className="flex items-center gap-2.5 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-700">{item.label}</span>
              <span className="w-8 text-right font-semibold tabular-nums text-slate-900">{unavailable ? '—' : item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

function MonthlyRangeSelector({ value, onChange }: { value: 6 | 12 | 24; onChange: (range: 6 | 12 | 24) => void }) {
  return (
    <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Monthly report range">
      {([6, 12, 24] as const).map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
          className={`min-w-10 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${value === range ? 'bg-[#1a1f6e] text-white shadow-sm' : 'text-slate-600'}`}
        >
          {range}M
        </button>
      ))}
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
function ReadOnlyFilter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-10 items-center gap-2.5 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
      <CalendarDays size={16} className="shrink-0 text-[#1a1f6e]" aria-hidden="true" />
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
    <div className="relative">
      <div className="relative">
        <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1a1f6e]" aria-hidden="true" />
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
          className="h-10 w-full cursor-pointer truncate rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30"
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

