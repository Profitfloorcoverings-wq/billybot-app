import { humanizeStatus, normalizeStatus } from "@/app/jobs/utils";

type JobStatusBadgeProps = {
  status?: string | null;
};

type BadgeStyle = { bg: string; text: string; border: string };

const STATUS_STYLES: Record<string, BadgeStyle> = {
  new: { bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" },
  awaiting_info: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  quoting: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  quoted: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  waiting_customer: { bg: "rgba(168,85,247,0.12)", text: "#c084fc", border: "rgba(168,85,247,0.25)" },
  booked: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  in_progress: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  approved: { bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" },
  completed: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.12)" },
  lost: { bg: "rgba(248,113,113,0.1)", text: "#f87171", border: "rgba(248,113,113,0.2)" },
  archived: { bg: "rgba(255,255,255,0.03)", text: "rgba(255,255,255,0.4)", border: "rgba(255,255,255,0.07)" },
};

const DEFAULT_STYLE: BadgeStyle = {
  bg: "rgba(255,255,255,0.05)",
  text: "rgba(255,255,255,0.6)",
  border: "rgba(255,255,255,0.1)",
};

export default function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const s = STATUS_STYLES[normalized] ?? DEFAULT_STYLE;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "4px 10px", borderRadius: "999px",
      fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em",
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>
      {humanizeStatus(status)}
    </span>
  );
}
