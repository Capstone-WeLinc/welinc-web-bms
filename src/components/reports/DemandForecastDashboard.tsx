import { useMemo, type ReactNode } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, BarChart3, CalendarDays, CheckCircle2, CircleHelp, RefreshCw,
  ShieldCheck, TrendingUp, Truck, Users, WandSparkles,
} from 'lucide-react';
import KPICard from '../shared/KpiCard';

type Horizon = '7days' | '30days' | '90days';
type ForecastResult = {
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
};
type Resource = { id: string; status: string; isActive?: boolean; isAssigned?: boolean };

const HORIZONS: { id: Horizon; label: string; days: number }[] = [
  { id: '7days', label: '7 days', days: 7 },
  { id: '30days', label: '30 days', days: 30 },
  { id: '90days', label: '90 days', days: 90 },
];
const LIMITED_HISTORY_DAYS = 14;
const numberFormat = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 });
const tooltipStyle = { borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' };

function formatDate(value?: string | null, withWeekday = false) {
  if (!value) return 'N/A';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-PH', { ...(withWeekday ? { weekday: 'short' as const } : {}), month: 'short', day: 'numeric', year: 'numeric' });
}

/** Same card frame and title style as the other Reports tabs. */
function Panel({ title, subtitle, action, className = '', children }: { title: string; subtitle?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <article className={`min-w-0 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm ${className}`}>
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </article>;
}

export default function DemandForecastDashboard({
  forecast, loading, error, onGenerate, horizon, onHorizonChange, vehicles, drivers, helpers,
}: {
  forecast: ForecastResult | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  horizon: Horizon;
  onHorizonChange: (horizon: Horizon) => void;
  vehicles: Resource[];
  drivers: Resource[];
  helpers: Resource[];
}) {
  const selectedHorizon = HORIZONS.find((item) => item.id === horizon) ?? HORIZONS[1];
  const hasHistory = Boolean(forecast && forecast.accuracy.historicalBookingsUsed > 0);
  const limitedHistory = Boolean(forecast && hasHistory && forecast.accuracy.historicalBookingsUsed < LIMITED_HISTORY_DAYS);

  const trend = useMemo(() => {
    if (!forecast || !hasHistory) return [];
    const historical = forecast.historicalData.slice(-selectedHorizon.days);
    const projected = forecast.forecastData.slice(0, selectedHorizon.days);
    return [
      ...historical.map((point) => ({ date: point.date, historical: point.count as number | null, forecast: null as number | null })),
      ...projected.map((point) => ({ date: point.date ?? point.label, historical: null as number | null, forecast: point.forecast })),
    ];
  }, [forecast, hasHistory, selectedHorizon.days]);

  const capacity = useMemo(() => {
    const isAvailable = (resource: Resource) => resource.status?.toLowerCase() === 'available' && resource.isActive !== false && resource.isAssigned !== true;
    const peakBookings = forecast?.expectedPeakDemand?.bookings;
    const needed = (perBooking: number | null | undefined) => (peakBookings === undefined || perBooking === null || perBooking === undefined ? null : Math.ceil(peakBookings * perBooking));
    return [
      { label: 'Trucks', icon: Truck, available: vehicles.filter(isAvailable).length, demand: needed(forecast?.averageVehiclesPerBooking) },
      { label: 'Drivers', icon: Users, available: drivers.filter(isAvailable).length, demand: needed(forecast?.averageDriversPerBooking) },
      { label: 'Helpers', icon: Users, available: helpers.filter(isAvailable).length, demand: needed(forecast?.averageHelpersPerBooking) },
    ].map((resource) => ({ ...resource, shortage: resource.demand === null ? null : Math.max(0, resource.demand - resource.available) }));
  }, [forecast, vehicles, drivers, helpers]);

  const calendarDays = useMemo(() => {
    const points = forecast?.forecastData.slice(0, Math.min(30, selectedHorizon.days)) ?? [];
    const firstDate = points[0]?.date;
    const weekday = firstDate ? new Date(`${firstDate}T00:00:00Z`).getUTCDay() : 0;
    return { padding: Array.from({ length: weekday }), points, max: Math.max(0, ...points.map((point) => point.forecast)) };
  }, [forecast, selectedHorizon.days]);

  const recommendations = useMemo(() => {
    const items = [...(forecast?.recommendations ?? [])];
    capacity.forEach((resource) => {
      if (resource.shortage && resource.shortage > 0) items.unshift(`On the busiest day you may need ${resource.shortage} more ${resource.label.toLowerCase()} than are available now.`);
    });
    return items;
  }, [forecast, capacity]);

  const peak = forecast?.expectedPeakDemand;
  const dailyAverage = forecast && hasHistory && selectedHorizon.days > 0 ? forecast.predictedBookings / selectedHorizon.days : null;
  const shortages = capacity.filter((resource) => (resource.shortage ?? 0) > 0);

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex shrink-0 rounded-full border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Forecast horizon">
        {HORIZONS.map((option) => <button key={option.id} type="button" aria-pressed={horizon === option.id} onClick={() => onHorizonChange(option.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${horizon === option.id ? 'bg-[#030848] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{option.label}</button>)}
      </div>
      <button type="button" onClick={onGenerate} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-[#1a1f6e] shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-wait disabled:opacity-60">
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />{loading ? 'Updating…' : 'Regenerate'}
      </button>
    </div>
  );

  if (!forecast) return <section className="space-y-5" aria-label="AI demand forecast">
    <div className="rounded-2xl border border-slate-200/70 bg-white px-6 py-12 text-center shadow-sm">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-700"><WandSparkles size={22} aria-hidden="true" /></span>
      <h3 className="mt-4 text-lg font-bold text-slate-900">AI demand forecast</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">{loading ? 'Generating a forecast for the selected filters…' : 'Predict upcoming bookings, the busiest days, and whether your trucks and crew can cover them.'}</p>
      {error && <p role="alert" className="mx-auto mt-3 max-w-lg text-sm text-red-700">{error}</p>}
      <button type="button" onClick={onGenerate} disabled={loading} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-[#1a1f6e] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#141a6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
        <WandSparkles size={16} aria-hidden="true" />{loading ? 'Generating forecast…' : 'Generate forecast'}
      </button>
    </div>
  </section>;

  const loadingBox = (height: string) => <div className={`flex ${height} items-center justify-center text-sm text-slate-500`}>Loading forecast…</div>;

  return <section className="space-y-6" aria-label="AI demand forecast">
    {/* Forecast at a glance; the horizon and regenerate controls apply to the whole tab */}
    <section aria-label={`Forecast for the next ${selectedHorizon.days} days`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>{limitedHistory && <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Limited history</span>}</div>
        {controls}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          variant="dashboard-compact"
          label="Predicted bookings"
          value={loading ? '…' : hasHistory ? numberFormat.format(forecast.predictedBookings) : 'N/A'}
          description={hasHistory ? `Next ${selectedHorizon.days} days` : 'No booking history yet'}
          icon={CalendarDays}
          iconColor="#6d28d9"
          valueClassName={!hasHistory ? 'text-slate-400' : undefined}
        />
        <KPICard
          variant="dashboard-compact"
          label="Average per day"
          value={loading ? '…' : dailyAverage === null ? 'N/A' : numberFormat.format(dailyAverage)}
          description="Bookings expected on a typical day"
          icon={TrendingUp}
          iconColor="#1d4ed8"
          valueClassName={dailyAverage === null ? 'text-slate-400' : undefined}
        />
        <KPICard
          variant="dashboard-compact"
          label="Busiest day"
          value={loading ? '…' : peak ? numberFormat.format(peak.bookings) : 'N/A'}
          description={peak ? `Bookings on ${formatDate(peak.date, true)}` : 'No peak day in the forecast'}
          icon={BarChart3}
          iconColor="#1d4ed8"
          valueClassName={!peak ? 'text-slate-400' : undefined}
        />
        <KPICard
          variant="dashboard-compact"
          label="Forecast confidence"
          value={loading ? '…' : forecast.confidence === null ? 'N/A' : `${Math.round(forecast.confidence)}%`}
          description={forecast.accuracy.mae === null ? 'Not enough history to score yet' : `Usually off by about ${numberFormat.format(forecast.accuracy.mae)} a day`}
          icon={ShieldCheck}
          iconColor="#6d28d9"
          valueClassName={forecast.confidence === null ? 'text-slate-400' : undefined}
        />
      </div>
    </section>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

    {/* Demand over time, and which days will be busiest */}
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
      <Panel
        title="Booking demand trend"
        subtitle="Past bookings and the forecast ahead"
        className="xl:col-span-2"
        action={<div className="flex flex-wrap items-center gap-4 text-sm text-slate-600"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />Past</span><span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 border-t-2 border-dashed border-violet-500" aria-hidden="true" />Forecast</span></div>}
      >
        <div className="h-[260px] w-full min-w-0">
          {loading ? loadingBox('h-full') : trend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
            <CartesianGrid stroke="#e5edf7" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value) => formatDate(String(value)).replace(/, \d{4}$/, '')} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} minTickGap={28} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip labelFormatter={(value) => formatDate(String(value), true)} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="historical" name="Past bookings" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls={false} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#8b5cf6" strokeWidth={2.5} strokeDasharray="5 4" dot={false} connectNulls={false} />
          </LineChart></ResponsiveContainer> : <EmptyState text="No booking history is available for these filters." />}
        </div>
      </Panel>

      <Panel title="Busiest days" subtitle={`Forecast demand · next ${calendarDays.points.length || selectedHorizon.days} days`}>
        {loading ? loadingBox('h-[260px]') : calendarDays.points.length ? <>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="py-1">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.padding.map((_, index) => <span key={`pad-${index}`} aria-hidden="true" />)}
            {calendarDays.points.map((point) => {
              const ratio = calendarDays.max ? point.forecast / calendarDays.max : 0;
              const isPeak = peak?.date && point.date === peak.date.slice(0, 10);
              const tone = ratio >= 0.75 ? 'bg-violet-600 text-white' : ratio >= 0.4 ? 'bg-violet-200 text-violet-950' : ratio > 0 ? 'bg-blue-50 text-slate-700' : 'bg-slate-50 text-slate-400';
              return <div key={point.date ?? point.label} title={`${formatDate(point.date, true)}: ${numberFormat.format(point.forecast)} bookings expected`} className={`flex aspect-square min-h-7 items-center justify-center rounded-md text-[11px] font-medium ${tone} ${isPeak ? 'ring-2 ring-violet-900 ring-offset-1' : ''}`}>{point.date?.slice(-2) ?? '—'}</div>;
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>Quiet</span><i className="h-3 w-3 rounded bg-blue-50" /><i className="h-3 w-3 rounded bg-violet-200" /><i className="h-3 w-3 rounded bg-violet-600" /><span>Busy</span>
            {peak && <span className="ml-auto inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded ring-2 ring-violet-900" />Busiest day</span>}
          </div>
        </> : <EmptyState text="No forecast days available." />}
      </Panel>
    </div>

    {/* Can we cover the busiest day, and which services drive demand */}
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
      <Panel
        title="Capacity on the busiest day"
        subtitle={peak ? `Available now vs. needed on ${formatDate(peak.date)}` : 'Available now vs. needed on the busiest day'}
        className="xl:col-span-2"
        action={shortages.length > 0
          ? <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700"><AlertTriangle size={12} aria-hidden="true" />Shortage</span>
          : capacity.some((resource) => resource.shortage !== null) && <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700"><CheckCircle2 size={12} aria-hidden="true" />Covered</span>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {capacity.map((resource) => {
            const fill = resource.demand ? Math.min(100, (resource.available / resource.demand) * 100) : resource.available ? 100 : 0;
            return <div key={resource.label} className="min-w-0 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><resource.icon size={16} className="text-blue-700" aria-hidden="true" />{resource.label}</div>
              <p className="mt-3 flex items-baseline gap-1.5"><span className="text-[26px] font-bold leading-none tabular-nums text-[#0b0f4a]">{numberFormat.format(resource.available)}</span><span className="text-sm text-slate-500">/ {resource.demand === null ? '—' : numberFormat.format(resource.demand)} needed</span></p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${resource.shortage ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${fill}%` }} /></div>
              {resource.shortage === null
                ? <p className="mt-2 text-xs text-slate-500">No assignment history to estimate this yet.</p>
                : resource.shortage > 0
                  ? <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700"><AlertTriangle size={12} aria-hidden="true" />Short by {numberFormat.format(resource.shortage)}</p>
                  : <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={12} aria-hidden="true" />Enough available</p>}
            </div>;
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">Needed = bookings expected on the busiest day × how many trucks and crew a booking has usually used.</p>
      </Panel>

      <Panel title="Demand by service" subtitle={`Expected bookings · next ${selectedHorizon.days} days`}>
        {loading ? loadingBox('h-[220px]') : forecast.serviceDemand.length ? <div className="h-[220px] w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={forecast.serviceDemand} layout="vertical" margin={{ top: 2, right: 14, bottom: 2, left: 2 }}>
          <CartesianGrid stroke="#e5edf7" strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis type="category" dataKey="service" width={118} tick={{ fontSize: 11, fill: '#475569' }} />
          <Tooltip cursor={{ fill: '#f1f4fa' }} formatter={(value) => [numberFormat.format(Number(value)), 'Expected bookings']} contentStyle={tooltipStyle} />
          <Bar dataKey="forecast" name="Expected bookings" fill="#3159c8" radius={[0, 5, 5, 0]} maxBarSize={24} />
        </BarChart></ResponsiveContainer></div> : <EmptyState text="No service demand history for these filters." />}
      </Panel>
    </div>

    {/* What to do about it, and how far to trust it */}
    <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
      <Panel title="AI insights and recommendations" subtitle="Based on the forecast and current capacity" className="xl:col-span-2">
        {forecast.summaryText && <p className="mb-4 rounded-xl bg-blue-50 p-3.5 text-sm leading-6 text-slate-700">{forecast.summaryText}</p>}
        {loading ? <p className="text-sm text-slate-500">Preparing insights…</p> : recommendations.length ? <ul className="space-y-2.5">
          {recommendations.map((recommendation, index) => <li key={`${index}-${recommendation}`} className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
            <CheckCircle2 size={16} className="mt-1 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{recommendation}</span>
          </li>)}
        </ul> : <EmptyState text="Recommendations will appear when forecast data is available." />}
      </Panel>

      <Panel title="How accurate is this?" subtitle="Tested against past bookings">
        <dl className="divide-y divide-slate-100">
          <AccuracyRow label="Bookings used" hint="History the forecast learned from" value={numberFormat.format(forecast.accuracy.historicalBookingsUsed)} />
          <AccuracyRow label="Average daily error" hint="How many bookings it usually misses by" value={forecast.accuracy.mae === null ? 'N/A' : `± ${numberFormat.format(forecast.accuracy.mae)}`} />
          <AccuracyRow label="Average error %" hint="The same error as a percentage" value={forecast.accuracy.mape === null ? 'N/A' : `${numberFormat.format(forecast.accuracy.mape)}%`} />
        </dl>
        {forecast.accuracy.mae === null
          ? <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800"><CircleHelp size={15} className="mt-0.5 shrink-0" aria-hidden="true" />At least {LIMITED_HISTORY_DAYS} days of booking history are needed to measure accuracy.</div>
          : <p className="mt-3 text-xs leading-5 text-slate-500">Measured by forecasting the last seven days and comparing them with what actually happened.</p>}
      </Panel>
    </div>
  </section>;
}

function AccuracyRow({ label, hint, value }: { label: string; hint: string; value: string }) {
  const empty = value === 'N/A';
  return <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
    <div className="min-w-0"><dt className="text-sm font-medium text-slate-800">{label}</dt><p className="text-xs text-slate-500">{hint}</p></div>
    <dd className={`shrink-0 text-lg font-bold tabular-nums ${empty ? 'text-slate-400' : 'text-[#0b0f4a]'}`}>{value}</dd>
  </div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 text-center text-sm text-slate-500">{text}</div>;
}
