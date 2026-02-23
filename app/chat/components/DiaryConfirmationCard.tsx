"use client";

import { useState } from "react";
import type { DiaryConfirmationPayload, DiaryEntry } from "@/types/diary";

type Props = {
  messageId: number | string;
  data: DiaryConfirmationPayload & { entry_id?: string };
};

const entryTypeLabel: Record<string, string> = {
  prep: "Prep",
  fitting: "Fitting",
  survey: "Survey",
  other: "Other",
};

const entryTypeBadge: Record<string, string> = {
  prep: "bg-amber-500/20 text-amber-300",
  fitting: "bg-cyan-500/20 text-cyan-300",
  survey: "bg-green-500/20 text-green-300",
  other: "bg-slate-500/20 text-slate-300",
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

  async function handleConfirm() {
    if (!entryId) return;
    setStatus("confirming");
    setError(null);

    try {
      const res = await fetch("/api/diary/entries/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_id: entryId,
          confirmation_data: data,
        }),
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
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.9)] p-4 w-[min(400px,100%)] space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          Diary booking
        </span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${entryTypeBadge[data.entry_type] ?? entryTypeBadge.other}`}
        >
          {entryTypeLabel[data.entry_type] ?? data.entry_type}
        </span>
      </div>

      <div>
        <p className="font-semibold text-[var(--text)]">{data.title}</p>
        {data.customer_name ? (
          <p className="text-sm text-[var(--muted)] mt-0.5">Customer: {data.customer_name}</p>
        ) : null}
      </div>

      <div className="text-sm text-[var(--text)]">
        {formatDateRange(data.start_datetime, data.end_datetime)}
      </div>

      {data.job_address ? (
        <p className="text-sm text-[var(--muted)]">{data.job_address}</p>
      ) : null}

      {data.notes ? (
        <p className="text-xs text-[var(--muted)] italic">{data.notes}</p>
      ) : null}

      {error ? (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-2 py-1">{error}</p>
      ) : null}

      {status === "confirmed" ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
          <span>Booked ✓</span>
        </div>
      ) : status === "cancelled" ? (
        <div className="text-sm text-[var(--muted)]">Booking cancelled.</div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={status === "confirming" || status === "cancelling"}
            className="flex-1 text-sm py-2 px-3 rounded-xl border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] transition disabled:opacity-50"
          >
            {status === "cancelling" ? "Cancelling…" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={status === "confirming" || status === "cancelling" || !entryId}
            className="flex-1 text-sm py-2 px-3 rounded-xl bg-[var(--brand1)] text-[var(--neutral-900)] font-semibold hover:brightness-110 transition disabled:opacity-50"
          >
            {status === "confirming" ? "Confirming…" : "Confirm booking"}
          </button>
        </div>
      )}
    </div>
  );
}
