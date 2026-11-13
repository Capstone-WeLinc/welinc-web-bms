import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Gauge, Lightbulb, ShieldCheck, Target } from 'lucide-react';
import type { AiInsightsResponse, ForecastDashboard } from './types';
import { LegendDot, Panel, StatCard } from './shared';
import { ACTUAL_COLOR, FORECAST_COLOR, axisTick, formatRange, gridStroke, num, pct, tooltipStyle } from './format';

export default function DemandForecastTab({ data, ai, aiLoading }: { data: ForecastDashboard; ai: AiInsightsResponse | null; aiLoading: boolean }) {
  const demand = data.demand!;
  const backtest = data.evaluation.backtest;
  const change = demand.previousPeriod.changePct;

  const trend = demand.weekly.map((week) => ({
    label: `${formatRange(week.start, week.end)}${week.days < 7 ? ` (${week.days}d)` : ''}`,
    actual: week.actual, forecast: week.forecast,
  }));
  const firstForecastLabel = trend.find((point) => point.forecast !== null && point.actual === null)?.label;

  const peakLabel = demand.peakWeek ? formatRange(demand.peakWeek.start, demand.peakWeek.end) : demand.peakPattern ? `${demand.peakPattern.weekday}s` : 'N/A';
  const peakNote = demand.peakWeek
    ? `~${num(demand.peakWeek.bookings)} bookings · ${pct(demand.peakWeek.sharePct)} of period`
    : demand.peakPattern ? `~${num(demand.peakPattern.bookings)} each · weeks are even` : 'No peak in the forecast';

  const trendLabel = change === null ? 'N/A' : change >= 10 ? 'Increasing' : change <= -10 ? 'Decreasing' : 'Stable';

  // The AI's own reading when it is available; otherwise the first rule-based insight.
  const aiReady = ai?.status === 'ok' && ai.insights;
  const insightText = aiReady
    ? (ai!.insights!.summary || ai!.insights!.keyInsights[0]?.detail || '')
    : (data.systemInsights.keyInsights[0]?.detail ?? demand.summary);

  return <div className="space-y-5">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Forecasted Bookings" value={num(demand.totalForecast)} icon={CalendarDays} accent="#3159c8"
        description={change === null ? 'No previous period to compare' : <span className={change >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{change >= 0 ? '▲' : '▼'} {pct(Math.abs(change))} vs. previous {demand.previousPeriod.days} days</span>} />
      <StatCard label="Expected Demand" value={demand.demandLevel?.level ?? 'N/A'} icon={Gauge} accent="#6d28d9" muted={!demand.demandLevel}
        description={demand.demandLevel ? 'Compared to historical data' : 'Too few bookings to classify'} />
      <StatCard label="Peak Demand Period" value={peakLabel} icon={Target} accent="#d4a72c" description={peakNote} />
      <StatCard label="Forecast Reliability" icon={ShieldCheck} accent="#059669" muted={!backtest.available}
        value={backtest.available ? (backtest.mape !== null ? `${num(backtest.mape)}% MAPE` : `±${num(backtest.mae)}/day`) : 'Not measured'}
        description={backtest.available ? 'Based on backtesting' : 'Needs more booking history'} />
    </div>

    <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-3">
      <Panel title="Historical vs. Forecasted Bookings" className="xl:col-span-2"
        action={<div className="flex gap-4"><LegendDot color={ACTUAL_COLOR} label="Actual" /><LegendDot color={FORECAST_COLOR} label="Forecast" dashed /></div>}>
        {/* Grows to the Forecast Summary's height (min 300px); absolute inner box avoids a resize loop. */}
        <div className="relative min-h-[300px] w-full min-w-0 flex-1">
          <div className="absolute inset-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 16, right: 16, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [num(Number(value)), name]} />
              {firstForecastLabel && <ReferenceLine x={firstForecastLabel} stroke="#94a3b8" strokeDasharray="2 4" />}
              <Line type="monotone" dataKey="actual" name="Actual bookings" stroke={ACTUAL_COLOR} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="forecast" name="Forecast" stroke={FORECAST_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      <Panel title="Forecast Summary">
        <dl className="divide-y divide-slate-100 text-sm">
          <Row label="Total Forecasted Bookings" value={num(demand.totalForecast)} />
          <Row label={`vs. Previous ${demand.previousPeriod.days} Days`} value={change === null ? 'N/A' : pct(change, true)} />
          <Row label="Most Active Service" value={data.services.mostDemanded ?? 'N/A'} />
          <Row label="Expected Demand Trend" value={trendLabel} />
        </dl>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Lightbulb size={16} className="text-[#d4a72c]" aria-hidden="true" />{aiReady || aiLoading ? 'AI Insight' : 'Insight'}</p>
          {aiLoading && !aiReady
            ? <div className="mt-2 space-y-1.5" aria-hidden="true"><div className="h-2.5 w-full animate-pulse rounded bg-amber-100" /><div className="h-2.5 w-2/3 animate-pulse rounded bg-amber-100" /></div>
            : <ul className="mt-2 space-y-1.5">
              {splitSentences(insightText).map((sentence, index) => <li key={index} className="flex gap-2 text-xs leading-5 text-slate-700">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#d4a72c]" aria-hidden="true" />
                <span>{emphasizeNumbers(sentence)}</span>
              </li>)}
            </ul>}
        </div>
      </Panel>
    </div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  // Value on the left, label on the right. flex-row-reverse keeps <dt> before <dd> for screen readers.
  return <div className="flex flex-row-reverse items-center justify-between gap-3 py-3">
    <dt className="text-right text-slate-600">{label}</dt>
    <dd className="text-left text-slate-900">{value}</dd>
  </div>;
}

/** One sentence per point. Splits after ". ", "! " or "? " before a capital, so decimals like "2.8" stay intact. */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((part) => part.trim()).filter(Boolean);
}

/** Bold the figures (counts, decimals, percentages) so the key numbers stand out. */
function emphasizeNumbers(sentence: string): React.ReactNode[] {
  // Years ("2026") are context, not figures, so they stay plain.
  return sentence.split(/(\d[\d,]*(?:\.\d+)?%?)/).map((part, index) => (index % 2 === 1 && !/^20\d\d$/.test(part)
    ? <strong key={index} className="font-semibold text-[#0b0f4a]">{part}</strong>
    : part));
}
