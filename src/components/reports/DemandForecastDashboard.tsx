import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, LineChart, Lightbulb, Loader2, Sparkles, Truck, Users } from 'lucide-react';
import type { AiInsightsResponse, ForecastDashboard, ForecastHorizon, ForecastTabId } from './forecast/types';
import { EmptyState } from './forecast/shared';
import { horizonOptions } from './forecast/format';
import DemandForecastTab from './forecast/DemandForecastTab';
import ServiceDemandTab from './forecast/ServiceDemandTab';
import ResourcePlanningTab from './forecast/ResourcePlanningTab';
import AiInsightsTab from './forecast/AiInsightsTab';
import PeriodPicker from './forecast/PeriodPicker';

const TABS: { id: ForecastTabId; label: string; icon: typeof LineChart }[] = [
  { id: 'demand', label: 'Demand Forecast', icon: LineChart },
  { id: 'services', label: 'Service Demand', icon: Truck },
  { id: 'resources', label: 'Resource Planning', icon: Users },
  { id: 'insights', label: 'AI Insights', icon: Lightbulb },
];

/**
 * AI Demand Forecasting module: four sub-tabs over one forecast. Nothing runs
 * until the Admin clicks "Generate Forecast"; the result is shared by every tab,
 * so switching tabs never refetches or resets the selected period.
 */
export default function DemandForecastDashboard({
  forecast, loading, error, onRefresh, horizon, onHorizonChange,
  ai, aiLoading, aiError, onLoadAi, actions,
}: {
  /** Page-level buttons (Save report, Export) shown at the right of the module header. */
  actions?: React.ReactNode;
  forecast: ForecastDashboard | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  horizon: ForecastHorizon;
  onHorizonChange: (horizon: ForecastHorizon) => void;
  ai: AiInsightsResponse | null;
  aiLoading: boolean;
  aiError: string | null;
  onLoadAi: (force?: boolean) => void;
}) {
  const [tab, setTab] = useState<ForecastTabId>('demand');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // The AI interpretation is loaded once per forecast; the Forecast Summary and AI Insights tabs both use it.
  useEffect(() => {
    if (forecast?.demand && !ai && !aiLoading && !aiError) onLoadAi();
  }, [forecast, ai, aiLoading, aiError, onLoadAi]);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const next = TABS[(index + offset + TABS.length) % TABS.length];
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const options = horizonOptions();

  return <section className="space-y-6" aria-label="AI demand forecasting">
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_-16px_rgba(26,31,110,0.25)]">
      {/* Module header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#d4a72c]/15 text-[#d4a72c]"><Sparkles size={26} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold leading-8 text-[#0b0f4a]">AI Demand Forecasting</h2>
            <p className="text-sm text-slate-600">Predict future demand and plan your resources ahead.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Before the first run the period is chosen on the start card instead. */}
          {forecast && <PeriodPicker value={horizon} options={options} onChange={onHorizonChange} disabled={loading} />}
          {actions}
        </div>
      </div>

      {/* Sub-tabs */}
      <div role="tablist" aria-label="AI demand forecasting views" className="grid grid-cols-2 gap-1 p-2 sm:flex sm:flex-wrap">
        {TABS.map((item, index) => {
          const active = tab === item.id;
          return <button key={item.id} ref={(node) => { tabRefs.current[item.id] = node; }} type="button" role="tab" id={`forecast-tab-${item.id}`}
            aria-selected={active} aria-controls={`forecast-panel-${item.id}`} tabIndex={active ? 0 : -1}
            onClick={() => setTab(item.id)} onKeyDown={(event) => onTabKey(event, index)}
            className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b0f4a]/30 sm:justify-start ${active ? 'text-[#1a1f6e]' : 'text-slate-600'}`}>
            <item.icon size={17} aria-hidden="true" className={active ? 'text-[#d4a72c]' : 'text-[#3159c8]'} />{item.label}
            {active && <span className="absolute inset-x-4 -bottom-0.5 h-[3px] rounded-full bg-[#d4a72c]" aria-hidden="true" />}
          </button>;
        })}
      </div>

    </div>

    <div role="tabpanel" id={`forecast-panel-${tab}`} aria-labelledby={`forecast-tab-${tab}`}>
      {error && !loading && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <span className="flex items-center gap-2"><AlertTriangle size={16} aria-hidden="true" />{error}</span>
        <button type="button" onClick={onRefresh} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Try again</button>
      </div>}
      {!forecast
        ? <StartCard horizon={horizon} options={options} onHorizonChange={onHorizonChange} onGenerate={onRefresh} loading={loading} />
        : !forecast.demand
          ? <EmptyState height="min-h-[260px]" text={<>No forecast is available: {forecast.method.fallbackReason ?? 'there are no bookings in the selected history.'} Widen the date range or clear the service and vehicle filters.</>} />
          : tab === 'demand' ? <DemandForecastTab data={forecast} ai={ai} aiLoading={aiLoading} />
            : tab === 'services' ? <ServiceDemandTab data={forecast} />
              : tab === 'resources' ? <ResourcePlanningTab data={forecast} />
                : <AiInsightsTab data={forecast} ai={ai} loading={aiLoading} />}
    </div>
  </section>;
}

/**
 * Shown until a forecast has been generated: the forecast never runs on its own,
 * the Admin picks a period here and starts it. Changing the period later clears
 * the result and brings this card back.
 */
function StartCard({ horizon, options, onHorizonChange, onGenerate, loading }: {
  horizon: ForecastHorizon;
  options: { id: ForecastHorizon; label: string }[];
  onHorizonChange: (horizon: ForecastHorizon) => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  return <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white px-5 py-10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(26,31,110,0.12)]">
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#d4a72c]/15 text-[#d4a72c]">
        <Sparkles size={30} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-slate-900">Ready to forecast demand</h3>
      <p className="mt-1 text-sm text-slate-500">Pick a forecast period, then generate the AI demand forecast.</p>
      <div className="mt-6 flex w-full flex-col items-stretch gap-3">
        <PeriodPicker value={horizon} options={options} onChange={onHorizonChange} disabled={loading} fullWidth />
        <button type="button" onClick={onGenerate} disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1a1f6e] px-5 text-sm font-semibold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
          {loading ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Sparkles size={17} className="text-[#d4a72c]" aria-hidden="true" />}
          {loading ? 'Generating forecast…' : 'Generate Forecast'}
        </button>
      </div>
    </div>
  </div>;
}
