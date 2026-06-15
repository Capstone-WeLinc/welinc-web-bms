interface StatusBadgeProps {
  status: string;
  size?: 'default' | 'xs';
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot?: string; label?: string }> = {
  // Booking statuses
  'For Plotting':     { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  'Confirmed':        { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'Scheduled':        { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  'Completed':        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Cancelled':        { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500' },
  'Discrepancy':      { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  // Job Order statuses
  'Pending':          { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
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
  'Assigned':         { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'In Progress':      { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  // Payment
  'Paid':             { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Partial':          { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  // Arrival
  'On Time':          { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Delayed':          { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     dot: 'bg-red-500' },
  // User
  'Active':           { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Inactive':         { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  // Daily Sales
  'Submitted':        { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Draft':            { bg: 'bg-slate-100 dark:bg-slate-800',    text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
};

export default function StatusBadge({ status, size = 'default' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  const padding = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 ${padding} font-medium rounded-full ${cfg.bg} ${cfg.text} whitespace-nowrap`}>
      {cfg.dot && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />}
      {cfg.label ?? status}
    </span>
  );
}