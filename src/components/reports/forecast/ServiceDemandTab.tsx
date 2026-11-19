import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, Megaphone, TrendingDown, TrendingUp } from 'lucide-react';
import type { ForecastDashboard } from './types';
import { EmptyState, Panel, StatCard } from './shared';
import { CHART_BOX, SERVICE_COLORS, axisTick, gridStroke, num, pct, tooltipStyle } from './format';

/** Bookings with no recorded service type. */
const UNMAPPED_COLOR = '#94a3b8';

export default function ServiceDemandTab({ data }: { data: ForecastDashboard }) {
  const { services } = data;
  const prevDays = data.demand?.previousPeriod.days ?? 0;
  const most = services.rows.find((row) => row.service === services.mostDemanded);
  const least = services.rows.find((row) => row.service === services.leastDemanded);
  const hasMapped = services.totalHistoricalMapped > 0;
  const tiedWith = (row?: (typeof services.rows)[number]) => (row ? services.rows.filter((other) => other.historical > 0 && Math.abs(other.forecast - row.forecast) < 0.05).map((other) => other.service) : []);
  const mostNames = tiedWith(most);
  const leastNames = least ? tiedWith(least).filter((name) => !mostNames.includes(name)) : [];

  const [includeUnmapped, setIncludeUnmapped] = useState(false);
  const unmapped = services.unclassified;
  // With "Include unmapped", bookings without a service type become their own
  // slice and every share is re-based on the combined total.
  const mappedSlices = services.rows.filter((row) => row.forecast > 0).map((row) => ({ name: row.service, value: row.forecast, share: row.forecastSharePct, color: SERVICE_COLORS[row.service] }));
  const withUnmapped = includeUnmapped && unmapped.forecast > 0 ? [...mappedSlices, { name: 'Unmapped', value: unmapped.forecast, share: 0, color: UNMAPPED_COLOR }] : mappedSlices;
  const sliceTotal = withUnmapped.reduce((sum, row) => sum + row.value, 0);
  const slices = includeUnmapped ? withUnmapped.map((row) => ({ ...row, share: sliceTotal > 0 ? Math.round((row.value / sliceTotal) * 1000) / 10 : 0 })) : mappedSlices;
  const topSlice = slices.reduce<(typeof slices)[number] | null>((best, row) => (!best || row.value > best.value ? row : best), null);

  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard label="Top Service" value={most ? mostNames.join(', ') : 'N/A'} icon={Award} accent="#d4a72c" muted={!most}
        description={most ? `${num(most.forecast)} bookings (~${pct(most.forecastSharePct)} of mapped)` : 'No service history yet'} />
      <StatCard label="Least Demanded" value={least && leastNames.length ? leastNames.join(', ') : 'N/A'} icon={TrendingDown} accent="#64748b" muted={!least || !leastNames.length}
        description={least && leastNames.length ? `${num(least.forecast)} bookings${leastNames.length > 1 ? ' each' : ''} (~${pct(least.forecastSharePct)} of mapped)` : 'Needs two or more services with history'} />
      <StatCard label="Service Demand Trend" value={pct(services.growthPct, true)} icon={TrendingUp} accent="#059669" muted={services.growthPct === null}
        tone={services.growthPct === null ? undefined : services.growthPct >= 0 ? 'positive' : 'negative'}
        description={`vs. previous ${prevDays} days`} />
    </div>

    {!hasMapped ? <EmptyState text="No bookings in the selected history record a service type, so service demand cannot be forecast." /> : (
      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <Panel title="Forecasted Demand per Service">
          <div className={CHART_BOX}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={services.rows} margin={{ top: 22, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="service" tick={axisTick} tickLine={false} interval={0} />
                <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: '#f1f4fa' }} contentStyle={tooltipStyle} formatter={(value) => [num(Number(value)), 'Expected bookings']} />
                <Bar dataKey="forecast" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                  {services.rows.map((row) => <Cell key={row.service} fill={SERVICE_COLORS[row.service]} />)}
                  <LabelList dataKey="forecast" position="top" formatter={(value: unknown) => num(Number(value))} style={{ fontSize: 12, fontWeight: 600, fill: '#0b0f4a' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Service Share"
          action={<label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={includeUnmapped} onChange={(event) => setIncludeUnmapped(event.target.checked)} disabled={unmapped.forecast <= 0} className="h-3.5 w-3.5 accent-[#1a1f6e]" />
            Include unmapped
          </label>}>
          {slices.length ? <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
            <div className="relative h-[200px] w-[200px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                    {slices.map((row) => <Cell key={row.name} fill={row.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${num(Number(value))} bookings`, name]} />
                </PieChart>
              </ResponsiveContainer>
              {topSlice && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-semibold tabular-nums text-slate-900">{pct(topSlice.share)}</span>
                <span className="max-w-[110px] text-sm leading-tight text-slate-500">{topSlice.name}</span>
              </div>}
            </div>
            <ul className="w-full max-w-[240px] space-y-2.5 text-sm">
              {slices.map((row) => <li key={row.name} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-slate-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" /><span className="truncate">{row.name}</span></span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{pct(row.share)}</span>
              </li>)}
            </ul>
          </div> : <EmptyState text="No forecast demand for these services." />}
          {most && <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <Megaphone size={20} className="mt-0.5 shrink-0 text-[#d4a72c]" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Key Takeaway</p>
              <p className="text-xs leading-5 text-slate-700">{mostNames.join(' and ')} {mostNames.length > 1 ? 'are' : 'is'} expected to remain the most in-demand service{mostNames.length > 1 ? 's' : ''} in the forecast period.</p>
            </div>
          </div>}
        </Panel>
      </div>
    )}
  </div>;
}
