"use client";

import { createPortal } from "react-dom";
import type { DiaryEntry, EntryType } from "@/types/diary";

const entryTypeColours: Record<EntryType, string> = {
  prep: "#f59e0b",
  fitting: "#38bdf8",
  survey: "#22c55e",
  other: "#64748b",
};

function formatDatetime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  entry: DiaryEntry;
  onClose: () => void;
  onEdit: () => void;
};

export default function DiaryEntryDetailModal({ entry, onClose, onEdit }: Props) {
  const colour = entryTypeColours[entry.entry_type] ?? "#64748b";

  const modal = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        style={{ position: "relative", zIndex: 10000 }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="inline-block w-3 h-3 rounded-sm flex-none mt-0.5"
              style={{ backgroundColor: colour }}
            />
            <div className="min-w-0">
              <h2 className="section-title text-base leading-tight truncate">{entry.title}</h2>
              <span
                className="text-xs font-semibold capitalize mt-0.5 inline-block"
                style={{ color: colour }}
              >
                {entry.entry_type}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none flex-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* Date & time */}
          <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 space-y-1">
            <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wide mb-2">Date & Time</p>
            <p className="text-[var(--text)]">{formatDatetime(entry.start_datetime)}</p>
            <p className="text-[var(--muted)]">
              Until {formatTime(entry.end_datetime)}
            </p>
          </div>

          {/* Customer */}
          {(entry.customer_name || entry.customer_email || entry.customer_phone || entry.job_address) ? (
            <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3 space-y-1">
              <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wide mb-2">Customer</p>
              {entry.customer_name ? <p className="text-[var(--text)] font-medium">{entry.customer_name}</p> : null}
              {entry.customer_phone ? (
                <a href={`tel:${entry.customer_phone}`} className="block text-[var(--brand1)] hover:underline">
                  {entry.customer_phone}
                </a>
              ) : null}
              {entry.customer_email ? (
                <a href={`mailto:${entry.customer_email}`} className="block text-[var(--brand1)] hover:underline truncate">
                  {entry.customer_email}
                </a>
              ) : null}
              {entry.job_address ? (
                <p className="text-[var(--muted)]">{entry.job_address}{entry.postcode ? `, ${entry.postcode}` : ""}</p>
              ) : null}
            </div>
          ) : null}

          {/* Fitters */}
          {entry.fitters && entry.fitters.length > 0 ? (
            <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3">
              <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wide mb-2">
                Fitters ({entry.fitters.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {entry.fitters.map((f) => (
                  <span
                    key={f.id}
                    className="text-xs px-2.5 py-1 rounded-full bg-[rgba(56,189,248,0.12)] text-[var(--brand1)] font-medium"
                  >
                    {f.name ?? "Unknown"}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Notes */}
          {entry.notes ? (
            <div className="bg-[rgba(255,255,255,0.04)] rounded-xl p-3">
              <p className="text-[var(--muted)] text-xs font-semibold uppercase tracking-wide mb-2">Notes</p>
              <p className="text-[var(--text)] whitespace-pre-wrap">{entry.notes}</p>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 mt-6">
          {entry.job_id ? (
            <a
              href={`/jobs/${entry.job_id}`}
              className="btn btn-secondary flex-1 text-center"
            >
              View Job
            </a>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="btn btn-primary flex-1"
          >
            Edit entry
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
