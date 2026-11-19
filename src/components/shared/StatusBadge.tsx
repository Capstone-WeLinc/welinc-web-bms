interface StatusBadgeProps {
  status: string;
  size?: 'default' | 'xs';
  variant?: 'default' | 'outline' | 'soft' | 'job-order' | 'job-order-payment' | 'job-order-status';
  showDot?: boolean;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot?: string; label?: string }> = {
  // Booking statuses
  'For Plotting':     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  'Confirmed':        { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'Scheduled':        { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500', label: 'Assigned' },
  'Assigned':         { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  'For Verification': { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  'Rescheduled':      { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-700 dark:text-cyan-400',    dot: 'bg-cyan-500' },
  'Completed':        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Cancelled':        { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500' },
  'Discrepancy':      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  // Job Order statuses
  'Pending':          { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  'Distributed':      { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  // Vehicle statuses
  'Available':        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'In Transit':       { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'On Duty':          { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'Off Duty':         { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  'Under Maintenance':{ bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  'Under Repair':     { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500' },
  'On Leave':         { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  'Deactivated':      { bg: 'bg-gray-100 dark:bg-gray-800',      text: 'text-gray-500 dark:text-gray-400',   dot: 'bg-gray-400' },
  // Schedule statuses
  'Unassigned':       { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  'In Progress':      { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  // Payment
  'Paid':             { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Partial':          { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  // Arrival
  'On Time':          { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Delayed':          { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500' },
  // Post-service statuses
  'Pending Review':   { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  'Finalized':        { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'Issue Reported':   { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500' },
  // User
  'Active':           { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Inactive':         { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  // Daily Sales
  'Submitted':        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Draft':            { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
};

const OUTLINE_STATUS_COLORS: Record<string, string> = {
  'For Plotting': 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-400',
  Confirmed: 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400',
  Scheduled: 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400',
  Assigned: 'border-indigo-400 bg-indigo-50 text-indigo-600 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-400',
  'For Verification': 'border-violet-400 bg-violet-50 text-violet-600 dark:border-violet-400 dark:bg-violet-900/30 dark:text-violet-400',
  Rescheduled: 'border-cyan-400 bg-cyan-50 text-cyan-600 dark:border-cyan-400 dark:bg-cyan-900/30 dark:text-cyan-400',
  Completed: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400',
  Cancelled: 'border-red-400 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-900/30 dark:text-red-400',
  Discrepancy: 'border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-400',
  'Pending Review': 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-400',
  Finalized: 'border-blue-400 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-400',
  'Issue Reported': 'border-red-400 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-900/30 dark:text-red-400',
  Submitted: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400',
  Draft: 'border-slate-400 bg-slate-50 text-slate-600 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300',
  Pending: 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-400',
  Distributed: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400',
  Paid: 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-400 dark:bg-emerald-900/30 dark:text-emerald-400',
  Partial: 'border-amber-400 bg-amber-50 text-amber-600 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-400',
};

const JOB_ORDER_STATUS_COLORS: Record<string, string> = {
  Paid: 'border-green-400 bg-green-100 text-green-600 dark:border-green-400 dark:bg-green-900/30 dark:text-green-400',
  Distributed: 'border-green-400 bg-green-100 text-green-600 dark:border-green-400 dark:bg-green-900/30 dark:text-green-400',
  Assigned: 'border-green-400 bg-green-100 text-green-600 dark:border-green-400 dark:bg-green-900/30 dark:text-green-400',
  Pending: 'border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-400',
  Partial: 'border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-400',
};

const JOB_ORDER_PAYMENT_COLORS: Record<string, string> = {
  Paid: 'border-green-400 bg-green-100 text-green-600 dark:border-green-400 dark:bg-green-900/30 dark:text-green-400',
  Pending: 'border-red-400 bg-red-50 text-red-600 dark:border-red-400 dark:bg-red-900/30 dark:text-red-400',
  Partial: 'border-orange-400 bg-orange-50 text-orange-600 dark:border-orange-400 dark:bg-orange-900/30 dark:text-orange-400',
};

export default function StatusBadge({ status, size = 'default', variant = 'default', showDot = false }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  const padding = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  if (variant === 'outline') {
    const outlineColor = OUTLINE_STATUS_COLORS[status] ?? 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-300';
    return (
      <span className={`inline-flex items-center ${showDot ? 'gap-1.5' : ''} rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${outlineColor}`}>
        {showDot && cfg.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} aria-hidden="true" />}
        {cfg.label ?? status}
      </span>
    );
  }
  if (variant === 'job-order' || variant === 'job-order-status' || variant === 'job-order-payment') {
    const colors = variant === 'job-order-payment' ? JOB_ORDER_PAYMENT_COLORS : JOB_ORDER_STATUS_COLORS;
    const jobOrderColor = colors[status] ?? 'border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300';
    return (
      <span className={`inline-flex items-center justify-center rounded-full border px-3 py-0.5 text-[10px] font-medium uppercase whitespace-nowrap ${jobOrderColor}`}>
        {cfg.label ?? status}
      </span>
    );
  }
  if (variant === 'soft') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full ${padding} font-semibold shadow-sm ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
        {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
        {cfg.label ?? status}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${padding} font-medium rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      {cfg.dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />}
      {cfg.label ?? status}
    </span>
  );
}
