import * as React from "react";

function cn(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "danger";

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants: Record<BadgeVariant, string> = {
      default: "bg-blue-500/15 text-blue-200 border border-blue-500/30",
      secondary: "bg-white/5 text-white border border-white/10",
      outline: "bg-transparent text-white border border-white/20",
      success: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
      warning: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
      danger: "bg-rose-500/15 text-rose-200 border border-rose-500/30",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
