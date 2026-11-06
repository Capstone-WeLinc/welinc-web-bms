import { TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

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
  description?: ReactNode;
  footer?: ReactNode;
  valueClassName?: string;
  variant?: 'default' | 'dashboard' | 'dashboard-compact';
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
  description,
  footer,
  valueClassName,
  variant = 'default',
}: KPICardProps) {
  // Support passing iconColor as a hex/named color OR a Tailwind class
  const isHexColor = iconColor.startsWith('#') || iconColor.startsWith('rgb');
  const iconBgStyle = isHexColor ? { backgroundColor: iconColor + '18' } : undefined;
  const iconStyle = isHexColor ? { color: iconColor } : undefined;
  const iconBgClass = iconBg || (isHexColor ? '' : 'bg-slate-100 dark:bg-slate-700');
  const iconColorClass = isHexColor ? '' : iconColor;

  if (variant === 'dashboard' || variant === 'dashboard-compact') {
    return (
      <div className={cn(`flex min-h-[96px] h-full w-full min-w-0 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md`, className)}>
        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', iconBgClass)} style={iconBgStyle}>
          <Icon className={cn('h-6 w-6', iconColorClass)} style={iconStyle} strokeWidth={2.25} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-5 text-slate-700">{label}</p>
          <p className={cn('mt-1 text-[22px] font-bold leading-tight tabular-nums', valueClassName ?? 'text-[#0b0f4a]')}>{value}</p>
          {description && <div className="mt-1 truncate text-xs text-slate-500">{description}</div>}
          {trend && <span className={cn('mt-1 text-xs', trendUp ? 'text-emerald-600' : 'text-red-500')}>{trend}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'min-w-0 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-100 dark:border-gray-800 p-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {label}
          </span>
          <span className="text-2xl font-semibold text-slate-800 dark:text-slate-100 mt-1 tabular-nums break-words">
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                'text-xs mt-0.5',
                trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              )}
            >
              {trend}
            </span>
          )}
          {description && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</div>}
        </div>
        <div
          className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', iconBgClass)}
          style={iconBgStyle}
        >
          <Icon className={cn('w-5 h-5', iconColorClass)} style={iconStyle} />
        </div>
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  );
}
