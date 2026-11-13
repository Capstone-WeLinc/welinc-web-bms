import { CalendarDays, CheckCircle2, Layers, Lightbulb, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { AiInsightsResponse, ForecastDashboard, InsightItem, InsightSet } from './types';
import { EmptyState, Panel } from './shared';

const CATEGORY_ICON = { demand: TrendingUp, service: Layers, peak: CalendarDays, operations: Users } as const satisfies Record<InsightItem['category'], unknown>;
/** Tag shown beside each insight: what kind of response it calls for. */
/** The icon shares its tag's colour so each row reads as one message. */
const CATEGORY_TAG: Record<InsightItem['category'], { label: string; className: string; iconClassName: string }> = {
  demand: { label: 'Action', className: 'bg-blue-100 text-blue-800', iconClassName: 'bg-blue-100 text-blue-600' },
  operations: { label: 'Action', className: 'bg-blue-100 text-blue-800', iconClassName: 'bg-blue-100 text-blue-600' },
  peak: { label: 'Plan', className: 'bg-violet-100 text-violet-800', iconClassName: 'bg-violet-100 text-violet-600' },
  service: { label: 'Monitor', className: 'bg-amber-100 text-amber-800', iconClassName: 'bg-amber-100 text-amber-600' },
};

export default function AiInsightsTab({ data, ai, loading }: {
  data: ForecastDashboard;
  ai: AiInsightsResponse | null;
  loading: boolean;
}) {
  const demand = data.demand;
  if (!demand || data.dataQuality.trainingBookings === 0) {
    return <EmptyState text="No meaningful insights yet: there is no booking history to forecast from." height="min-h-[260px]" />;
  }
  const set: InsightSet = ai?.status === 'ok' && ai.insights ? ai.insights : data.systemInsights;

  return <div className="space-y-5">
    <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-5">
      {/* A. Key insights */}
      <Panel title="Key Insights" className="xl:col-span-3" action={<Sparkles size={18} className="text-[#d4a72c]" aria-hidden="true" />}>
        {loading ? <ListSkeleton /> : set.keyInsights.length ? <ul className="divide-y divide-slate-100">
          {set.keyInsights.map((item, index) => {
            const Icon = CATEGORY_ICON[item.category] ?? TrendingUp;
            const tag = CATEGORY_TAG[item.category] ?? CATEGORY_TAG.demand;
            return <li key={`${index}-${item.title}`} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tag.iconClassName}`}><Icon size={18} aria-hidden="true" /></span>
              <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700">{item.detail || item.title}</p>
              <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${tag.className}`}>{tag.label}</span>
            </li>;
          })}
        </ul> : <EmptyState height="min-h-[120px]" text="No key insights for this forecast." />}
      </Panel>

      {/* B. Recommended actions */}
      <Panel title="Recommended Actions" className="xl:col-span-2" action={<Lightbulb size={18} className="text-[#d4a72c]" aria-hidden="true" />}>
        {loading ? <ListSkeleton /> : set.recommendedActions.length ? <ul className="space-y-4">
          {set.recommendedActions.map((item, index) => <li key={`${index}-${item.action}`} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 fill-emerald-600 text-white" aria-hidden="true" />{item.action}
          </li>)}
        </ul> : <EmptyState height="min-h-[120px]" text="No actions are needed for this forecast." />}
      </Panel>
    </div>
  </div>;
}

function ListSkeleton() {
  return <div className="space-y-3" aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
}
