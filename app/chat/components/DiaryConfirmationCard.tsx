"use client";

import { useState } from "react";
import type { DiaryConfirmationPayload } from "@/types/diary";

type Props = {
  messageId: number | string;
  data: DiaryConfirmationPayload & { entry_id?: string };
};

const ENTRY_TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  prep:    { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)", label: "Prep" },
  fitting: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)", label: "Fitting" },
  survey:  { bg: "rgba(34,197,94,0.12)",  text: "#4ade80", border: "rgba(34,197,94,0.25)",  label: "Survey" },
  other:   { bg: "rgba(100,116,139,0.12)", text: "#94a3b8", border: "rgba(100,116,139,0.25)", label: "Other" },
};

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const startTime = s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr}, ${startTime}–${endTime}`;
}

export default function DiaryConfirmationCard({ data }: Props) {
  const [status, setStatus] = useState<"pending" | "confirming" | "confirmed" | "cancelling" | "cancelled">("pending");
  const [error, setError] = useState<string | null>(null);

  const entryId = data.entry_id;
  const typeStyle = ENTRY_TYPE_STYLES[data.entry_type] ?? ENTRY_TYPE_STYLES.other;
  const busy = status === "confirming" || status === "cancelling";

  async function handleConfirm() {
    if (!entryId) return;
    setStatus("confirming");
    setError(null);

    try {
      const res = await fetch("/api/diary/entries/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_id: entryId, confirmation_data: data }),
      });

      const result = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !result.success) {
        setError(result.error ?? "Failed to confirm booking.");
        setStatus("pending");
        return;
      }

      setStatus("confirmed");
    } catch {
      setError("Network error. Please try again.");
      setStatus("pending");
    }
  }

  async function handleCancel() {
    if (!entryId) return;
    setStatus("cancelling");
    setError(null);

    try {
      const res = await fetch(`/api/diary/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (!res.ok) {
        const result = (await res.json()) as { error?: string };
        setError(result.error ?? "Failed to cancel.");
        setStatus("pending");
        return;
      }

      setStatus("cancelled");
    } catch {
      setError("Network error. Please try again.");
      setStatus("pending");
    }
  }

  return (
    <div style={{
      width: "min(400px, 100%)",
      borderRadius: "16px",
      border: "1px solid rgba(148,163,184,0.12)",
      background: "rgba(13,21,39,0.95)",
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{
          fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.16em", color: "#64748b",
        }}>
          Diary booking
        </span>
        <span style={{
          fontSize: "11px", fontWeight: 700, padding: "3px 8px",
          borderRadius: "999px", letterSpacing: "0.04em",
          background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}`,
        }}>
          {typeStyle.label}
        </span>
      </div>

      {/* Title + customer */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
          {data.title}
        </p>
        {data.customer_name ? (
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            {data.customer_name}
          </p>
        ) : null}
      </div>

      {/* Date/time */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 12px", borderRadius: "10px",
        background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.12)",
      }}>
        <span style={{ fontSize: "16px", flexShrink: 0 }}>📅</span>
        <span style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 500 }}>
          {formatDateRange(data.start_datetime, data.end_datetime)}
        </span>
      </div>

      {/* Address */}
      {data.job_address ? (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <span style={{ fontSize: "14px", flexShrink: 0, marginTop: "1px" }}>📍</span>
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>{data.job_address}</span>
        </div>
      ) : null}

      {/* Notes */}
      {data.notes ? (
        <p style={{ fontSize: "12px", color: "#64748b", margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>
          {data.notes}
        </p>
      ) : null}

      {/* Error */}
      {error ? (
        <p style={{
          fontSize: "13px", color: "#f87171", margin: 0,
          background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "10px", padding: "10px 12px",
        }}>
          {error}
        </p>
      ) : null}

      {/* Actions */}
      {status === "confirmed" ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
          <span style={{ fontSize: "16px" }}>✓</span>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#4ade80" }}>Booked</span>
        </div>
      ) : status === "cancelled" ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.1)" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Booking cancelled.</span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: "13px", padding: "10px 14px", opacity: busy ? 0.5 : 1 }}
          >
            {status === "cancelling" ? "Cancelling…" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !entryId}
            className="btn btn-primary"
            style={{ flex: 1, fontSize: "13px", padding: "10px 14px", opacity: (busy || !entryId) ? 0.5 : 1 }}
          >
            {status === "confirming" ? "Confirming…" : "Confirm booking"}
          </button>
        </div>
      )}
    </div>
  );
}
