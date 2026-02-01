import { humanizeStatus, normalizeStatus } from "@/app/jobs/utils";

type JobStatusBadgeProps = {
  status?: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
  awaiting_info: "bg-amber-500/15 text-amber-200 border border-amber-500/30",
  quoted: "bg-sky-500/15 text-sky-200 border border-sky-500/30",
  approved: "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30",
  completed: "bg-white/10 text-white/70 border border-white/10",
  archived: "bg-white/5 text-white/50 border border-white/10",
};

export default function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const className = STATUS_STYLES[normalized] ?? "bg-white/5 text-white/70 border border-white/10";

  return (
    <span className={`status-pill ${className}`}>{humanizeStatus(status)}</span>
  );
}
