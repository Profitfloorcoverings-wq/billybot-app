export const CATEGORIES = ["materials", "labour", "equipment", "fuel", "other"] as const;
export const STATUSES = ["pending", "extracted", "approved", "synced", "error"] as const;

export const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", color: "#fbbf24", label: "Pending" },
  extracted: { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)", color: "#38bdf8", label: "Extracted" },
  approved: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#34d399", label: "Approved" },
  synced: { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.25)", color: "#a78bfa", label: "Synced" },
  error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", color: "#f87171", label: "Error" },
};

export const CATEGORY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  materials: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", color: "#fb923c", label: "Materials" },
  labour: { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)", color: "#38bdf8", label: "Labour" },
  equipment: { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.25)", color: "#a78bfa", label: "Equipment" },
  fuel: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", color: "#fbbf24", label: "Fuel" },
  other: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)", color: "#94a3b8", label: "Other" },
};
