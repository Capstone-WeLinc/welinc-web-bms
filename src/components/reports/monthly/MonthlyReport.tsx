import { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, PhilippinePeso, TrendingUp, Truck } from 'lucide-react';
import KPICard from '../../shared/KpiCard';
import TablePagination from '../../ui/TablePagination';
import { tableCellClasses, tableClasses, tableHeadClasses, tableHeaderCellClasses, tableRowClasses } from '../../ui/StandardTable';
import {
  MONTHLY_COLORS, PAYMENT_COLORS, STATUS_COLORS, formatPeso, formatPesoCompact, isInProgress, monthName, monthTickInterval,
  segments, serviceSlices, statusLabel, trendAriaLabel, trendRows,
  type MonthPoint,
} from './monthlyReport.logic';
import '../operational/operationalReport.css';
import './monthlyReport.css';

export type MonthlyRange = 6 | 12 | 24;

export interface MonthlyReportProps {
  months: MonthPoint[];
  /** Today in Asia/Manila, YYYY-MM-DD; decides which month is still in progress. */
  today: string;
  salesUnavailable: boolean;
  /** Non-cancelled bookings whose service date is today or earlier. */
  totalTrips: number;
  /** Non-cancelled bookings later in the window (the rest of this month); not counted as trips. */
  upcomingTrips: number;
  /** Bookings with a verified payment (net of refunds) in the window. */
  paidTrips: number;
  /** Verified revenue ÷ paid trips. */
  avgRevenuePerPaidTrip: number;
  serviceDistribution: { name: string; value: number }[];
  paymentDistribution: { name: string; value: number }[];
  statusDistribution: { name: string; value: number }[];
  range: MonthlyRange;
  onRangeChange: (range: MonthlyRange) => void;
}

/** Monthly Report: revenue and trips per month, what was booked, how it was paid, and where bookings stand. */
export default function MonthlyReport(props: MonthlyReportProps) {
  const { months, today, salesUnavailable, totalTrips, upcomingTrips, paidTrips, avgRevenuePerPaidTrip, range, onRangeChange } = props;
  const latest = months[months.length - 1] ?? null;
  const previous = months.length > 1 ? months[months.length - 2] : null;
  const rangeRevenue = months.reduce((sum, point) => sum + point.revenue, 0);
  const latestInProgress = latest ? isInProgress(latest, today) : false;
  const rangeLabel = latest ? `${monthName(months[0])} to ${monthName(latest)}` : 'No months in range';
  const unavailable = 'Unavailable';

  return (
    <div className="opr" data-testid="monthly-report">
      <div className="mr-head">
        <Switch<MonthlyRange>
          label="Report range"
          value={range}
          options={[{ value: 6, label: '6M' }, { value: 12, label: '12M' }, { value: 24, label: '24M' }]}
          onChange={onRangeChange}
        />
      </div>

      {/* Same KPI card component and grid as the Admin dashboard. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="monthly-kpis">
        <KPICard
          variant="dashboard-compact"
          label={latest ? `Revenue, ${monthName(latest)}${latestInProgress ? ' so far' : ''}` : 'Revenue this month'}
          value={salesUnavailable ? unavailable : formatPeso(latest?.revenue ?? 0)}
          description={salesUnavailable ? 'Verified sales data unavailable' : previous ? `${monthName(previous)}: ${formatPeso(previous.revenue)}` : 'No earlier month to compare'}
          icon={PhilippinePeso}
          iconColor="#10b981"
        />
        <KPICard
          variant="dashboard-compact"
          label={`Revenue, last ${range} months`}
          value={salesUnavailable ? unavailable : formatPeso(rangeRevenue)}
          description={rangeLabel}
          icon={BarChart3}
          iconColor="#3b82f6"
        />
        <KPICard
          variant="dashboard-compact"
          label="Trips"
          value={String(totalTrips)}
          description={upcomingTrips > 0 ? `Up to today · ${upcomingTrips} more booked this month` : `Up to today, last ${range} months`}
          icon={Truck}
          iconColor="#a855f7"
        />
        <KPICard
          variant="dashboard-compact"
          label="Average per paid trip"
          value={salesUnavailable ? unavailable : paidTrips === 0 ? 'No paid trips' : formatPeso(avgRevenuePerPaidTrip)}
          description={salesUnavailable ? 'Verified sales data unavailable' : `Verified revenue ÷ ${paidTrips} paid ${paidTrips === 1 ? 'trip' : 'trips'}`}
          icon={TrendingUp}
          iconColor="#f59e0b"
        />
      </div>

      <div className="mr-row">
        <div className="mr-row-inner mr-row-inner--trend">
          <TrendCard months={months} today={today} salesUnavailable={salesUnavailable} />
          <BookingStatusCard distribution={props.statusDistribution} />
        </div>
      </div>

      <div className="mr-row">
        <div className="mr-row-inner mr-row-inner--split">
          <ServiceTypeCard distribution={props.serviceDistribution} />
          <PaymentCard distribution={props.paymentDistribution} salesUnavailable={salesUnavailable} />
        </div>
      </div>

      <MonthTable months={months} today={today} salesUnavailable={salesUnavailable} totals={{ paidTrips, avgRevenuePerPaidTrip }} />
    </div>
  );
}

function Switch<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="mr-switch" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>
      ))}
    </div>
  );
}

function TrendCard({ months, today, salesUnavailable }: { months: MonthPoint[]; today: string; salesUnavailable: boolean }) {
  const [metric, setMetric] = useState<'revenue' | 'trips'>('trips');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = wrapRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const rows = trendRows(months, metric, today);
  const revenueBlocked = metric === 'revenue' && salesUnavailable;
  const format = (value: number) => (metric === 'revenue' ? formatPesoCompact(value) : String(value));

  return (
    <section className="opr-card opr-chart-card" aria-labelledby="mr-trend-title" data-testid="monthly-trend-card">
      <div className="mr-card-head">
        <div>
          <h3 id="mr-trend-title" className="opr-card-title">Monthly trend</h3>
          <p className="opr-card-subtitle">{metric === 'revenue' ? 'Verified revenue by payment date' : 'Non-cancelled bookings by service date'}</p>
          <ul className="opr-legend" style={{ margin: '10px 0 0' }} data-testid="trend-legend">
            <li><span className="opr-dot" style={{ background: MONTHLY_COLORS.navy }} aria-hidden="true" />Full month</li>
            <li><span className="opr-dot" style={{ background: MONTHLY_COLORS.inProgress }} aria-hidden="true" />Month in progress</li>
          </ul>
        </div>
        <Switch<'revenue' | 'trips'> label="Trend measure" value={metric} options={[{ value: 'revenue', label: 'Revenue' }, { value: 'trips', label: 'Trips' }]} onChange={setMetric} />
      </div>
      <div ref={wrapRef} style={{ marginTop: 16 }}>
        {revenueBlocked ? (
          <div className="opr-empty"><p className="opr-empty-title">Verified sales data is unavailable</p><p className="opr-empty-text">Revenue will show here once sales records load.</p></div>
        ) : rows.length === 0 ? (
          <div className="opr-empty"><p className="opr-empty-title">No months in the selected range</p></div>
        ) : (
          <div role="img" aria-label={trendAriaLabel(months, metric, today)} data-months={rows.length}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart accessibilityLayer={false} data={rows} margin={{ top: 22, right: 8, left: metric === 'revenue' ? 8 : -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e9f2" vertical={false} />
                <XAxis dataKey="label" interval={monthTickInterval(width - 60, rows.length)} tick={{ fontSize: 13, fill: '#334155' }} tickLine={false} axisLine={{ stroke: '#e6e9f2' }} tickMargin={8} />
                <YAxis allowDecimals={false} width={metric === 'revenue' ? 64 : 40} tick={{ fontSize: 13, fill: '#334155' }} tickLine={false} axisLine={false} tickFormatter={(value: number) => format(value)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false}>
                  {rows.map((row) => <Cell key={row.label} fill={row.inProgress ? MONTHLY_COLORS.inProgress : MONTHLY_COLORS.navy} />)}
                  <LabelList dataKey="value" position="top" fontSize={12} fontWeight={600} fill="#0f1352" formatter={(value: number) => (value > 0 ? format(value) : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}

function BookingStatusCard({ distribution }: { distribution: { name: string; value: number }[] }) {
  const parts = segments(distribution, STATUS_COLORS);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <section className="opr-card opr-chart-card" aria-labelledby="mr-status-title" data-testid="booking-status-card">
      <h3 id="mr-status-title" className="opr-card-title">Booking status</h3>
      {total === 0 ? (
        <div className="opr-empty"><p className="opr-empty-title">No bookings in this range</p><p className="opr-empty-text">Booking status counts will show here.</p></div>
      ) : (
        // Same donut as Service type: ring of the statuses, total bookings in the middle, every status listed with its count.
        <div className="mr-donut">
          <div
            className="mr-donut-chart"
            role="img"
            aria-label={`Booking status donut chart, ${total} bookings: ${parts.map((part) => `${statusLabel(part.name)} ${part.value} (${part.percent}%)`).join(', ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie data={parts.filter((part) => part.value > 0)} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {parts.filter((part) => part.value > 0).map((part) => <Cell key={part.name} fill={part.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value, name) => [`${value} ${value === 1 ? 'booking' : 'bookings'}`, statusLabel(String(name))]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mr-donut-center" aria-hidden="true">
              <span className="mr-donut-value">{total}</span>
              <span className="mr-donut-name">{total === 1 ? 'booking' : 'bookings'}</span>
            </div>
          </div>
          <ul className="mr-donut-legend mr-donut-legend--two-col" data-testid="status-legend">
            {parts.map((part) => (
              <li key={part.name}>
                <span className="opr-dot" style={{ background: part.color }} aria-hidden="true" />
                <span className="mr-donut-label">{statusLabel(part.name)}</span>
                <span className={`mr-value${part.value === 0 ? ' mr-zero' : ''}`}>{part.value} <span>({part.percent}%)</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ServiceTypeCard({ distribution }: { distribution: { name: string; value: number }[] }) {
  const [includeUnmapped, setIncludeUnmapped] = useState(false);
  const { slices, top, unmappedTrips, unmappedServices } = serviceSlices(distribution, includeUnmapped);
  const subtitle = includeUnmapped
    ? 'All services by trips, including unmapped'
    : unmappedTrips > 0
      ? `Main services by trips · ${unmappedTrips} ${unmappedTrips === 1 ? 'trip' : 'trips'} in ${unmappedServices} other ${unmappedServices === 1 ? 'service' : 'services'} not shown`
      : 'Main services by trips';
  return (
    <section className="opr-card opr-chart-card" aria-labelledby="mr-service-title" data-testid="service-type-card">
      <div className="mr-card-head">
        <div>
          <h3 id="mr-service-title" className="opr-card-title">Service type</h3>
          <p className="opr-card-subtitle">{subtitle}</p>
        </div>
        {/* Same control as the AI Demand Forecast's Service Share. */}
        <label className="mr-check">
          <input type="checkbox" checked={includeUnmapped} disabled={unmappedTrips === 0} onChange={(event) => setIncludeUnmapped(event.target.checked)} />
          Include unmapped
        </label>
      </div>
      {slices.length === 0 ? (
        <div className="opr-empty">
          <p className="opr-empty-title">{unmappedTrips > 0 ? 'No trips for the main services' : 'No trips in this range'}</p>
          <p className="opr-empty-text">{unmappedTrips > 0 ? 'Tick Include unmapped to see the other services.' : 'Services will show here once bookings are made.'}</p>
        </div>
      ) : (
        // Same donut as the AI Demand Forecast's Service Share: ring, top share in the middle, legend beside it.
        <div className="mr-donut">
          <div
            className="mr-donut-chart"
            role="img"
            aria-label={`Service type donut chart: ${slices.map((slice) => `${slice.name} ${slice.trips} ${slice.trips === 1 ? 'trip' : 'trips'}, ${slice.percent}%`).join('; ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer={false}>
                <Pie data={slices} dataKey="trips" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                  {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value, name) => [`${value} trips`, name]} />
              </PieChart>
            </ResponsiveContainer>
            {top && (
              <div className="mr-donut-center" aria-hidden="true">
                <span className="mr-donut-value">{top.percent}%</span>
                <span className="mr-donut-name">{top.name}</span>
              </div>
            )}
          </div>
          <ul className="mr-donut-legend">
            {slices.map((slice) => (
              <li key={slice.name}>
                <span className="opr-dot" style={{ background: slice.color }} aria-hidden="true" />
                <span className={`mr-donut-label${slice.other ? ' mr-service-name--other' : ''}`} title={slice.name}>{slice.name}</span>
                <span className="mr-value">{slice.trips} <span>({slice.percent}%)</span></span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PaymentCard({ distribution, salesUnavailable }: { distribution: { name: string; value: number }[]; salesUnavailable: boolean }) {
  const parts = segments([...distribution].sort((a, b) => b.value - a.value), PAYMENT_COLORS);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <section className="opr-card opr-chart-card" aria-labelledby="mr-payment-title" data-testid="payment-card">
      <h3 id="mr-payment-title" className="opr-card-title">Payment method</h3>
      <p className="opr-card-subtitle">Verified collections by method</p>
      {salesUnavailable ? (
        <div className="opr-empty"><p className="opr-empty-title">Payment data is unavailable</p><p className="opr-empty-text">Verified sales records couldn’t be loaded.</p></div>
      ) : total === 0 ? (
        <div className="opr-empty"><p className="opr-empty-title">No verified payments in this range</p><p className="opr-empty-text">Collections will show here once they’re verified.</p></div>
      ) : (
        <>
          <p className="mr-total">{formatPeso(total)}</p>
          <p className="mr-total-label">Total collected</p>
          <div className="mr-stack" role="img" aria-label={`Payment methods: ${parts.map((part) => `${part.name} ${formatPeso(part.value)}, ${part.percent}%`).join('; ')}`}>
            {parts.filter((part) => part.width > 0).map((part) => <span key={part.name} style={{ width: `${part.width}%`, background: part.color }} />)}
          </div>
          <ul className="mr-rows">
            {parts.map((part) => (
              <li key={part.name}>
                <span className="opr-dot" style={{ background: part.color }} aria-hidden="true" />
                {part.name}
                <span className="mr-value">{formatPeso(part.value)} <span>· {part.percent}%</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MonthTable({ months, today, salesUnavailable, totals }: { months: MonthPoint[]; today: string; salesUnavailable: boolean; totals: { paidTrips: number; avgRevenuePerPaidTrip: number } }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const rows = months.map((point, index) => {
    const prior = index > 0 ? months[index - 1] : null;
    return {
      key: `${point.year}-${point.month}`,
      label: monthName(point),
      trips: point.trips,
      revenue: point.revenue,
      paidTrips: point.paidTrips,
      average: point.paidTrips > 0 ? point.revenue / point.paidTrips : 0,
      change: prior && prior.revenue > 0 ? ((point.revenue - prior.revenue) / prior.revenue) * 100 : null,
      inProgress: isInProgress(point, today),
    };
  }).reverse();
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const trips = months.reduce((sum, point) => sum + point.trips, 0);
  // A booking paid across two months is one paid trip in the total, so the total is not a sum of the month rows.
  const { paidTrips, avgRevenuePerPaidTrip } = totals;
  const revenue = months.reduce((sum, point) => sum + point.revenue, 0);
  const money = (value: number) => (salesUnavailable ? '—' : formatPeso(value));
  const dim = (zero: boolean) => (zero ? 'text-slate-500' : '');

  return (
    <section className="opr-card mr-table-card" aria-labelledby="mr-table-title" data-testid="month-table">
      <div className="mr-table-head">
        <h3 id="mr-table-title" className="opr-card-title">Month-by-month</h3>
        <p className="opr-card-subtitle">Exact trips and revenue for each month in the range, newest first</p>
      </div>
      <div className="overflow-x-auto">
        <table className={`${tableClasses} min-w-[640px] table-auto`}>
          <thead className={tableHeadClasses}>
            <tr>{['Month', 'Trips', 'Revenue', 'Paid trips', 'Avg per paid trip', 'Vs prior month'].map((heading) => <th key={heading} scope="col" className={`${tableHeaderCellClasses} whitespace-nowrap ${heading === 'Month' ? '' : 'text-right'}`}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-600">No months in the selected range.</td></tr>
            ) : paged.map((row) => (
              <tr key={row.key} className={tableRowClasses}>
                <td className={`${tableCellClasses} whitespace-nowrap font-semibold text-[#0f1352]`}>{row.label}</td>
                <td className={`${tableCellClasses} text-right tabular-nums ${dim(row.trips === 0)}`}>{row.trips}</td>
                <td className={`${tableCellClasses} whitespace-nowrap text-right tabular-nums ${dim(row.revenue === 0)}`}>{money(row.revenue)}</td>
                <td className={`${tableCellClasses} text-right tabular-nums ${dim(row.paidTrips === 0)}`}>{salesUnavailable ? '—' : row.paidTrips}</td>
                <td className={`${tableCellClasses} whitespace-nowrap text-right tabular-nums ${dim(row.average === 0)}`}>{money(row.average)}</td>
                <td className={`${tableCellClasses} whitespace-nowrap text-right tabular-nums`}>
                  {row.inProgress ? <span className="mr-pill">In progress</span>
                    : salesUnavailable || row.change === null ? <span className="text-slate-500">—</span>
                      : <span className={`font-semibold ${row.change >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{row.change >= 0 ? '▲' : '▼'} {Math.abs(row.change).toFixed(1)}%</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50">
                <td className={`${tableCellClasses} font-bold text-[#0f1352]`}>Total</td>
                <td className={`${tableCellClasses} text-right font-bold tabular-nums`}>{trips}</td>
                <td className={`${tableCellClasses} whitespace-nowrap text-right font-bold tabular-nums text-[#1a1f6e]`}>{money(revenue)}</td>
                <td className={`${tableCellClasses} text-right font-bold tabular-nums`}>{salesUnavailable ? '—' : paidTrips}</td>
                <td className={`${tableCellClasses} whitespace-nowrap text-right font-bold tabular-nums`}>{money(avgRevenuePerPaidTrip)}</td>
                <td className={tableCellClasses} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <TablePagination
        page={safePage}
        totalPages={totalPages}
        totalItems={rows.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </section>
  );
}
