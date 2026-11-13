import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { ChevronRight, CircleCheck, ClipboardList, Package, RotateCcw, Truck, type LucideIcon } from 'lucide-react';
import { api } from '../../../lib/api';
import KPICard from '../../shared/KpiCard';
import {
  CHART_COLORS, chartRows, closedJobsAriaLabel, formatRange, integerTicks, monthTickInterval, performanceCards, resourceAriaLabel,
  resourceRows, topVehicles, vehicleBarWidth,
  type CardIcon, type OperationalReportData, type ResourcesSnapshotData,
} from './operationalReport.logic';
import './operationalReport.css';

type Load<T> ={ status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T };

const ICONS: Record<CardIcon, LucideIcon> = { clipboard: ClipboardList, truck: Truck, check: CircleCheck, package: Package };

export interface OperationalReportProps {
  /** Filters come from the shared report filter bar on the Reports page. */
  from: string;
  to: string;
  service: string;
  vehicleId: string;
  /** Lets the page export and save exactly what is on screen. */
  onDataChange?: (data: { report: OperationalReportData | null; snapshot: ResourcesSnapshotData | null }) => void;
}

/**
 * Operational Report. Answers: are bookings getting a vehicle, how did jobs end,
 * is work spread across the fleet, and is there capacity right now.
 * Admin-only and read-only; the route guard lives in App.tsx.
 */
export default function OperationalReport(props: OperationalReportProps) {
  const { from, to, service, vehicleId, onDataChange } = props;
  const [report, setReport] = useState<Load<OperationalReportData>>({ status: 'loading' });
  const [snapshot, setSnapshot] = useState<Load<ResourcesSnapshotData>>({ status: 'loading' });
  const [reportAttempt, setReportAttempt] = useState(0);
  const [snapshotAttempt, setSnapshotAttempt] = useState(0);
  const reportRequest = useRef(0);

  useEffect(() => {
    const id = ++reportRequest.current;
    setReport({ status: 'loading' });
    api.get<OperationalReportData>('/reports/operational', { params: { from, to, serviceId: service, vehicleId } })
      .then((response) => { if (id === reportRequest.current) setReport({ status: 'ready', data: response.data }); })
      .catch(() => { if (id === reportRequest.current) setReport({ status: 'error' }); });
  }, [from, to, service, vehicleId, reportAttempt]);

  // Today's snapshot: no dates or filters, so it only loads on open and on retry.
  useEffect(() => {
    let active = true;
    setSnapshot({ status: 'loading' });
    api.get<ResourcesSnapshotData>('/reports/resources-snapshot')
      .then((response) => { if (active) setSnapshot({ status: 'ready', data: response.data }); })
      .catch(() => { if (active) setSnapshot({ status: 'error' }); });
    return () => { active = false; };
  }, [snapshotAttempt]);

  const reportData = report.status === 'ready' ? report.data : null;
  const snapshotData = snapshot.status === 'ready' ? snapshot.data : null;
  useEffect(() => { onDataChange?.({ report: reportData, snapshot: snapshotData }); }, [reportData, snapshotData, onDataChange]);

  const retryReport = () => setReportAttempt((n) => n + 1);

  return (
    <div className="opr" data-testid="operational-report">
      {/* KPI cards: same component, variant and grid as the Admin dashboard KPIs. */}
      <section aria-label="Performance this period">
        {report.status === 'error' ? (
          <ErrorPanel message="The figures for this period couldn’t be loaded." onRetry={retryReport} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="performance-cards">
            {report.status === 'loading'
              ? Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)
              : performanceCards(report.data.totals).map((card) => (
                <div key={card.key} className="min-w-0" data-card={card.key}>
                  <KPICard
                    variant="dashboard-compact"
                    label={card.label}
                    value={card.value}
                    icon={ICONS[card.icon]}
                    iconColor={card.tint}
                    description={<span className={card.captionTone === 'amber' ? 'text-amber-700' : undefined}>{card.caption}</span>}
                  />
                </div>
              ))}
          </div>
        )}
      </section>

      <div className="opr-pair">
        <div className="opr-pair-inner">
          <ClosedJobsCard state={report} from={from} to={to} onRetry={retryReport} />
          <JobsPerVehicleCard state={report} from={from} to={to} onRetry={retryReport} />
        </div>
      </div>

      <ResourcesCard state={snapshot} onRetry={() => setSnapshotAttempt((n) => n + 1)} />
    </div>
  );
}

function ClosedJobsCard({ state, from, to, onRetry }: { state: Load<OperationalReportData>; from: string; to: string; onRetry: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [state.status]);

  const rows = state.status === 'ready' ? chartRows(state.data.monthly) : [];
  const ticks = integerTicks(Math.max(0, ...rows.map((row) => row.completed + row.cancelled)));

  return (
    <section className="opr-card opr-chart-card" aria-labelledby="opr-closed-title" data-testid="closed-jobs-card">
      <h3 id="opr-closed-title" className="opr-card-title">Completed vs cancelled jobs</h3>
      <p className="opr-card-subtitle">Closed jobs per month</p>
      <ul className="opr-legend">
        <li><span className="opr-dot" style={{ background: CHART_COLORS.completed }} aria-hidden="true" />Completed</li>
        <li><span className="opr-dot" style={{ background: CHART_COLORS.cancelled }} aria-hidden="true" />Cancelled</li>
      </ul>
      {state.status === 'loading' && <div className="opr-skeleton" style={{ height: 220 }} aria-label="Loading chart" role="status" />}
      {state.status === 'error' && <ErrorPanel message="This chart couldn’t be loaded." onRetry={onRetry} />}
      {state.status === 'ready' && (
        <div ref={wrapRef} role="img" aria-label={closedJobsAriaLabel(state.data.monthly, from, to)} data-months={rows.length}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart accessibilityLayer={false} data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6e9f2" vertical={false} />
              <XAxis dataKey="label" interval={monthTickInterval(width - 40, rows.length)} tick={{ fontSize: 13, fill: '#334155' }} tickLine={false} axisLine={{ stroke: '#e6e9f2' }} />
              <YAxis allowDecimals={false} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tick={{ fontSize: 13, fill: '#334155' }} tickLine={false} axisLine={false} width={40} />
              <Bar dataKey="completed" name="Completed" stackId="closed" fill={CHART_COLORS.completed} maxBarSize={28} isAnimationActive={false} />
              <Bar dataKey="cancelled" name="Cancelled" stackId="closed" fill={CHART_COLORS.cancelled} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function JobsPerVehicleCard({ state, from, to, onRetry }: { state: Load<OperationalReportData>; from: string; to: string; onRetry: () => void }) {
  const rows = state.status === 'ready' ? topVehicles(state.data.jobsPerVehicle) : [];
  const busiest = rows[0]?.jobs ?? 0;
  return (
    <section className="opr-card opr-chart-card" aria-labelledby="opr-vehicles-title" data-testid="jobs-per-vehicle-card">
      <h3 id="opr-vehicles-title" className="opr-card-title">Jobs per vehicle</h3>
      <p className="opr-card-subtitle">Confirmed assignments in this period</p>
      {state.status === 'loading' && (
        <div role="status" aria-label="Loading vehicles" style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="opr-skeleton" style={{ height: 14 }} />)}
        </div>
      )}
      {state.status === 'error' && <div style={{ marginTop: 14 }}><ErrorPanel message="This list couldn’t be loaded." onRetry={onRetry} /></div>}
      {state.status === 'ready' && rows.length === 0 && (
        <div className="opr-empty" data-testid="vehicles-empty">
          <p className="opr-empty-title">No vehicles assigned yet</p>
          <p className="opr-empty-text">Confirmed assignments for {formatRange(from, to)} will show up here.</p>
        </div>
      )}
      {rows.length > 0 && (
        <ol className="opr-vehicles" aria-label="Vehicles ranked by confirmed jobs">
          {rows.map((row) => (
            <li key={row.vehicleId} className="opr-vehicle">
              <span className="opr-vehicle-name" title={row.alias ? `${row.plate} (${row.alias})` : row.plate}>
                {row.plate}{row.alias && <span className="opr-vehicle-alias"> {row.alias}</span>}
              </span>
              <span className="opr-vehicle-track" aria-hidden="true">
                <span className="opr-vehicle-bar" style={{ display: 'block', width: `${vehicleBarWidth(row.jobs, busiest)}%` }} />
              </span>
              <span className="opr-vehicle-count">{row.jobs}<span className="opr-sr-only"> {row.jobs === 1 ? 'job' : 'jobs'}</span></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ResourcesCard({ state, onRetry }: { state: Load<ResourcesSnapshotData>; onRetry: () => void }) {
  return (
    <section className="opr-card opr-resources" aria-labelledby="opr-resources-title" data-testid="resources-card">
      <div className="opr-resources-head">
        <div>
          <h3 id="opr-resources-title" className="opr-card-title">Resources right now</h3>
          <p className="opr-card-subtitle">Today’s snapshot, not affected by the date range</p>
        </div>
        <Link to="/admin/vehicle-availability" className="opr-link">View details <ChevronRight size={15} aria-hidden="true" /></Link>
      </div>
      {state.status === 'loading' && (
        <div role="status" aria-label="Loading resources">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="opr-resource">
              <div className="opr-skeleton" style={{ height: 16, width: 120, marginBottom: 10 }} />
              <div className="opr-skeleton" style={{ height: 12 }} />
            </div>
          ))}
        </div>
      )}
      {state.status === 'error' && <div style={{ marginTop: 16 }}><ErrorPanel message="Today’s fleet and roster couldn’t be loaded." onRetry={onRetry} /></div>}
      {state.status === 'ready' && resourceRows(state.data).map((row) => (
        <div key={row.key} className="opr-resource" data-resource={row.key}>
          <div className="opr-resource-head">
            <h4 className="opr-resource-name">{row.name}</h4>
            <span className="opr-resource-total">{row.totalLabel}</span>
          </div>
          <div className="opr-track" role="img" aria-label={resourceAriaLabel(row)}>
            {row.segments.filter((segment) => segment.width > 0).map((segment) => (
              <span key={segment.key} style={{ width: `${segment.width}%`, background: segment.color }} />
            ))}
          </div>
          <ul className="opr-legend">
            {row.segments.map((segment) => (
              <li key={segment.key}><span className="opr-dot" style={{ background: segment.color }} aria-hidden="true" />{segment.label} <span className="opr-legend-count">{segment.count}</span></li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Placeholder shaped like the dashboard-compact KPICard. */
function KpiSkeleton() {
  return (
    <div className="flex min-h-[96px] w-full min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" role="status" aria-label="Loading">
      <span className="opr-skeleton h-12 w-12 shrink-0 rounded-full" />
      <div className="grid flex-1 gap-2">
        <span className="opr-skeleton h-3 w-3/5" />
        <span className="opr-skeleton h-6 w-1/3" />
        <span className="opr-skeleton h-2.5 w-2/3" />
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="opr-error" role="alert">
      <p>{message}</p>
      <button type="button" className="opr-button" onClick={onRetry}><RotateCcw size={14} aria-hidden="true" /> Try again</button>
    </div>
  );
}
