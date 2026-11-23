import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  subtitleClassName?: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  spacing?: "reference" | "standard";
}

export default function PageHeader({
  title,
  subtitle,
  subtitleClassName,
  icon: Icon,
  action,
  spacing = "reference",
}: PageHeaderProps) {
  const headerSpacing = spacing === "standard"
    ? "pb-6"
    : "px-5 pb-6";
  const iconAlignment = spacing === "standard" ? "justify-center" : "justify-start";
  const iconWidth = spacing === "standard" ? "w-12" : "w-9";

  return (
    <header className={`mb-8 flex flex-col gap-4 border-b border-[var(--color-divider)] ${headerSpacing} sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex min-w-0 items-center gap-4">
        <div className={`flex h-12 ${iconWidth} shrink-0 items-center ${iconAlignment} text-[var(--color-brand-primary)]`}>
          <Icon size={24} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">
            {title}
          </h1>
          {subtitle && (
            <p className={subtitleClassName
              ? "mt-1 text-sm text-[var(--color-text-secondary)] truncate [&_span]:!font-normal [&_span]:!text-[var(--color-text-secondary)]"
              : "mt-1 text-sm text-[var(--color-text-secondary)] truncate"}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </header>
  );
}
