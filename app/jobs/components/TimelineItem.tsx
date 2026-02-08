import { formatRelativeTime, formatTimestamp } from "@/app/jobs/utils";

type TimelineItemProps = {
  icon: string;
  title: string;
  subtitle?: string | null;
  timestamp?: string | null;
  preview?: string | null;
  children?: React.ReactNode;
};

export default function TimelineItem({
  icon,
  title,
  subtitle,
  timestamp,
  preview,
  children,
}: TimelineItemProps) {
  const relative = formatRelativeTime(timestamp ?? null);
  const fullTimestamp = formatTimestamp(timestamp ?? null);

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.7)] p-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg">
            {icon}
          </div>
          <div className="stack gap-1">
            <p className="text-sm font-semibold text-white">{title}</p>
            {subtitle ? (
              <p className="text-xs text-[var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <span className="text-xs text-[var(--muted)]" title={fullTimestamp}>
          {relative}
        </span>
      </div>

      {preview ? (
        <p className="mt-3 text-sm text-[var(--muted)] line-clamp-2">{preview}</p>
      ) : null}

      {children ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--accent2)]">
            View details
          </summary>
          <div className="mt-3 text-sm text-[var(--muted)] whitespace-pre-wrap">
            {children}
          </div>
        </details>
      ) : null}
    </article>
  );
}
