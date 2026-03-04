"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { DiaryEntry, EntryType } from "@/types/diary";

const entryTypeColours: Record<EntryType, string> = {
  prep: "#f59e0b",
  fitting: "#38bdf8",
  survey: "#22c55e",
  other: "#64748b",
};

const entryTypeLabels: Record<EntryType, string> = {
  prep: "Prep",
  fitting: "Fitting",
  survey: "Survey",
  other: "Other",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
  onDelete: (id: string) => void;
  onCancel: (id: string, reason: string) => void;
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(148,163,184,0.1)",
      borderRadius: "12px",
      padding: "16px 18px",
    }}>
      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "10px" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export default function DiaryEntryDetailModal({ entry, onClose, onEdit, onDelete, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const isCancelled = entry.status === "cancelled";
  const colour = isCancelled ? "#475569" : (entryTypeColours[entry.entry_type as EntryType] ?? "#64748b");
  const label = entryTypeLabels[entry.entry_type as EntryType] ?? entry.entry_type;
  const hasCustomer = entry.customer_name || entry.customer_email || entry.customer_phone || entry.job_address;

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.75)", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-sheet" style={{ maxWidth: "480px" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Type badge + cancelled badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colour, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: colour }}>
                    {label}
                  </span>
                </div>
                {isCancelled ? (
                  <span style={{
                    fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: "#f87171", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "6px", padding: "2px 8px",
                  }}>
                    CANCELLED
                  </span>
                ) : null}
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: isCancelled ? "#64748b" : "#f1f5f9", lineHeight: 1.3, margin: 0, textDecoration: isCancelled ? "line-through" : "none" }}>
                {entry.title}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="modal-close" aria-label="Close">×</button>
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

          {/* Cancellation reason — shown when already cancelled */}
          {isCancelled && entry.cancellation_reason ? (
            <Section label="Cancellation Reason">
              <p style={{ fontSize: "14px", color: "#94a3b8", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>
                {entry.cancellation_reason}
              </p>
            </Section>
          ) : null}

          {/* Date & Time */}
          <Section label="Date & Time">
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9" }}>
                {formatDate(entry.start_datetime)}
              </span>
            </div>
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>{formatTime(entry.start_datetime)}</span>
              <span style={{ fontSize: "12px", color: "#475569" }}>→</span>
              <span style={{ fontSize: "14px", color: "#94a3b8" }}>{formatTime(entry.end_datetime)}</span>
            </div>
          </Section>

          {/* Customer */}
          {hasCustomer ? (
            <Section label="Customer">
              {entry.customer_name ? (
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", marginBottom: "8px" }}>{entry.customer_name}</p>
              ) : null}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {entry.customer_phone ? (
                  <a href={`tel:${entry.customer_phone}`} style={{ fontSize: "14px", color: "#38bdf8", textDecoration: "none" }}>
                    📞 {entry.customer_phone}
                  </a>
                ) : null}
                {entry.customer_email ? (
                  <a href={`mailto:${entry.customer_email}`} style={{ fontSize: "14px", color: "#38bdf8", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    ✉ {entry.customer_email}
                  </a>
                ) : null}
                {entry.job_address ? (
                  <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                    📍 {entry.job_address}{entry.postcode ? `, ${entry.postcode}` : ""}
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {/* Fitters */}
          {entry.fitters && entry.fitters.length > 0 ? (
            <Section label={`Fitters (${entry.fitters.length})`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {entry.fitters.map((f) => (
                  <span key={f.id} style={{
                    padding: "5px 12px",
                    borderRadius: "999px",
                    fontSize: "13px",
                    fontWeight: 600,
                    background: "rgba(56,189,248,0.1)",
                    border: "1px solid rgba(56,189,248,0.25)",
                    color: "#38bdf8",
                  }}>
                    {f.name ?? "Unknown"}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Notes */}
          {entry.notes ? (
            <Section label="Notes">
              <p style={{ fontSize: "14px", color: "#94a3b8", whiteSpace: "pre-wrap", lineHeight: 1.6, margin: 0 }}>
                {entry.notes}
              </p>
            </Section>
          ) : null}

          {/* Cancel flow — inline reason input */}
          {cancelling ? (
            <div style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "12px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#f87171", margin: 0 }}>
                Why is this entry being cancelled?
              </p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer cancelled, no access to property…"
                rows={3}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "8px",
                  color: "#f1f5f9",
                  fontSize: "14px",
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (cancelReason.trim()) {
                      onCancel(entry.id, cancelReason.trim());
                    }
                  }}
                  disabled={!cancelReason.trim()}
                  className="btn"
                  style={{
                    flex: 1,
                    background: cancelReason.trim() ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    color: cancelReason.trim() ? "#f87171" : "#64748b",
                    cursor: cancelReason.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  Confirm cancellation
                </button>
                <button
                  type="button"
                  onClick={() => { setCancelling(false); setCancelReason(""); }}
                  style={{ background: "none", border: "none", color: "#64748b", fontSize: "13px", cursor: "pointer", textDecoration: "underline", padding: "0 4px", flexShrink: 0 }}
                >
                  Go back
                </button>
              </div>
            </div>
          ) : null}

        </div>

        {/* Actions */}
        {!isCancelled && !cancelling ? (
          <div className="form-actions" style={{ marginTop: "24px" }}>
            {entry.job_id ? (
              <a href={`/jobs/${entry.job_id}`} className="btn btn-secondary" style={{ flex: 1, textAlign: "center" }}>
                View Job
              </a>
            ) : null}
            <button type="button" onClick={onEdit} className="btn btn-secondary" style={{ flex: 1 }}>
              Edit
            </button>
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className="btn"
              style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              Cancel Entry
            </button>
          </div>
        ) : !isCancelled && cancelling ? null : (
          /* Already cancelled — just close */
          <div className="form-actions" style={{ marginTop: "24px" }}>
            {entry.job_id ? (
              <a href={`/jobs/${entry.job_id}`} className="btn btn-secondary" style={{ flex: 1, textAlign: "center" }}>
                View Job
              </a>
            ) : null}
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Permanently delete this diary entry? This cannot be undone.")) {
                  onDelete(entry.id);
                }
              }}
              className="btn"
              style={{ flex: 1, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
            >
              Delete
            </button>
          </div>
        )}

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
