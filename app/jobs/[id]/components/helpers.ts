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

export function formatRelativeTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
    { unit: "year", seconds: 31_536_000 },
    { unit: "month", seconds: 2_592_000 },
    { unit: "day", seconds: 86_400 },
    { unit: "hour", seconds: 3_600 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const chosen = UNITS.find((item) => absSeconds >= item.seconds) ?? UNITS[UNITS.length - 1];
  return formatter.format(Math.round(diffSeconds / chosen.seconds), chosen.unit);
}

export function humanizeStatus(value?: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_") ?? "unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatBytes(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  if (value < 1024) return `${value} B`;
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function shortId(id: string) {
  return id.slice(0, 8);
}

export function looksLikeImage(mimeType?: string | null, name?: string) {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name ?? "");
}
