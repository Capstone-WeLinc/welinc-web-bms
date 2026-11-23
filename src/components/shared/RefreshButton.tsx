import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

/** The dashboard header's Refresh button, as on the VMMS dashboard: reloads now and spins until done. */
export default function RefreshButton({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void refresh()}
      disabled={refreshing}
      aria-busy={refreshing}
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:border-[#1a1f6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f6e]/30 disabled:cursor-wait dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <RefreshCw size={16} aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
      Refresh
    </button>
  );
}
