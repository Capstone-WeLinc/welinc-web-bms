import { TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const cn = (...classes: (string | undefined | null | false)[]): string => {
  return classes.filter(Boolean).join(' ');
};

interface KPICardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export default function KPICard({
  label,
  value,
  icon: Icon = TrendingUp,
  iconBg,
  iconColor = '#1a1f6e',
  trend,
  trendUp,
  className,
}: KPICardProps) {
  // Support passing iconColor as a hex/named color OR a Tailwind class
  const isHexColor = iconColor.startsWith('#') || iconColor.startsWith('rgb');
  const iconBgStyle = isHexColor ? { backgroundColor: iconColor + '18' } : undefined;
  const iconStyle = isHexColor ? { color: iconColor } : undefined;
  const iconBgClass = iconBg || (isHexColor ? '' : 'bg-slate-100 dark:bg-slate-700');
  const iconColorClass = isHexColor ? '' : iconColor;

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-slate-100 dark:border-gray-800 p-5 flex items-start justify-between',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium mt-0.5',
              trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
            )}
          >
            {trend}
          </span>
        )}
      </div>
      <div
        className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', iconBgClass)}
        style={iconBgStyle}
      >
        <Icon className={cn('w-5 h-5', iconColorClass)} style={iconStyle} />
      </div>
    </div>
  );
}