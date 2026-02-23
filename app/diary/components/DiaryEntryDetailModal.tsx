"use client";

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

export default function DiaryEntryDetailModal({ entry, onClose, onEdit }: Props) {
  const colour = entryTypeColours[entry.entry_type] ?? "#64748b";
  const label = entryTypeLabels[entry.entry_type] ?? entry.entry_type;
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
              {/* Type badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: colour, flexShrink: 0 }} />
                <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: colour }}>
                  {label}
                </span>
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3, margin: 0 }}>
                {entry.title}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="modal-close" aria-label="Close">×</button>
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

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

        </div>

        {/* Actions */}
        <div className="form-actions" style={{ marginTop: "24px" }}>
          {entry.job_id ? (
            <a href={`/jobs/${entry.job_id}`} className="btn btn-secondary" style={{ flex: 1, textAlign: "center" }}>
              View Job
            </a>
          ) : null}
          <button type="button" onClick={onEdit} className="btn btn-primary" style={{ flex: 1 }}>
            Edit entry
          </button>
        </div>

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
