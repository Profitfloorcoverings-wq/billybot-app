const RELATIVE_TIME_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

export function formatRelativeTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const unit =
    RELATIVE_TIME_UNITS.find((entry) => absSeconds >= entry.seconds) ??
    RELATIVE_TIME_UNITS[RELATIVE_TIME_UNITS.length - 1];

  return formatter.format(Math.round(diffSeconds / unit.seconds), unit.unit);
}

export function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function normalizeStatus(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "";
}

export function humanizeStatus(value?: string | null) {
  const normalized = normalizeStatus(value);
  if (!normalized) return "Unknown";

  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function stripHtml(value?: string | null) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export const JOB_SELECT =
  "id, created_at, customer_name, customer_email, customer_phone, title, status, last_activity_at, provider, provider_thread_id, provider_message_id, site_address, postcode, job_details, conversation_id, client_id, profile_id, metadata, job_thread_id, outbound_email_subject, outbound_email_body, email_event_id, customer_reply, job_sheet_url, job_sheet_ref";
