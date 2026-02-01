type ProviderBadgeProps = {
  provider?: string | null;
};

const PROVIDER_STYLES: Record<string, string> = {
  google: "bg-blue-500/15 text-blue-200 border border-blue-500/30",
  microsoft: "bg-purple-500/15 text-purple-200 border border-purple-500/30",
};

export default function ProviderBadge({ provider }: ProviderBadgeProps) {
  const normalized = provider?.toLowerCase() ?? "";
  const label = normalized ? normalized[0].toUpperCase() + normalized.slice(1) : "Unknown";
  const className = PROVIDER_STYLES[normalized] ?? "bg-white/5 text-white/60 border border-white/10";

  return <span className={`status-pill ${className}`}>{label}</span>;
}
