import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "danger" | "warning" | "success";
  icon?: ReactNode;
  size?: "sm" | "md";
}

const variantStyles = {
  primary: "bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]",
  secondary: "bg-slate-100 text-slate-700",
  danger: "bg-[var(--color-brand-danger)]/10 text-[var(--color-brand-danger)]",
  warning: "bg-[var(--color-brand-warning)]/10 text-[var(--color-brand-warning)]",
  success: "bg-[var(--color-brand-success)]/10 text-[var(--color-brand-success)]",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "primary", icon, size = "md", className = "", children, ...props }, ref) => (
    <span
      ref={ref}
      className={`inline-flex items-center gap-2 rounded-full font-medium ${
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1 text-xs"
      } ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </span>
  ),
);

Badge.displayName = "Badge";

export default Badge;
