"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { DiaryEntry, EntryType } from "@/types/diary";

type TeamMemberOption = {
  id: string;
  member_id: string;
  role: string;
  name?: string | null;
};

type Props = {
  entry: DiaryEntry | null;
  onClose: () => void;
  onSaved: (entry: DiaryEntry) => void;
};

function formatDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultStart(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return formatDatetimeLocal(d.toISOString());
}

function defaultEnd(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 9);
  return formatDatetimeLocal(d.toISOString());
}

export default function DiaryEntryModal({ entry, onClose, onSaved }: Props) {
  const isEdit = !!entry;

  const [title, setTitle] = useState(entry?.title ?? "");
  const [entryType, setEntryType] = useState<EntryType>(entry?.entry_type ?? "fitting");
  const [startDatetime, setStartDatetime] = useState(
    entry ? formatDatetimeLocal(entry.start_datetime) : defaultStart()
  );
  const [endDatetime, setEndDatetime] = useState(
    entry ? formatDatetimeLocal(entry.end_datetime) : defaultEnd()
  );
  const [customerName, setCustomerName] = useState(entry?.customer_name ?? "");
  const [customerEmail, setCustomerEmail] = useState(entry?.customer_email ?? "");
  const [customerPhone, setCustomerPhone] = useState(entry?.customer_phone ?? "");
  const [jobAddress, setJobAddress] = useState(entry?.job_address ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [selectedFitterIds, setSelectedFitterIds] = useState<string[]>(
    entry?.fitters?.map((f) => f.team_member_id) ?? []
  );

  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/diary/team", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { members?: TeamMemberOption[] }) => setTeamMembers(d.members ?? []))
      .catch(() => {});
  }, []);

  const toggleFitter = useCallback((id: string) => {
    setSelectedFitterIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError("Title is required."); return; }
    if (!startDatetime || !endDatetime) { setError("Start and end times are required."); return; }
    if (new Date(startDatetime) >= new Date(endDatetime)) { setError("End time must be after start time."); return; }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        entry_type: entryType,
        status: "confirmed",
        start_datetime: new Date(startDatetime).toISOString(),
        end_datetime: new Date(endDatetime).toISOString(),
        customer_name: customerName.trim() || null,
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        job_address: jobAddress.trim() || null,
        notes: notes.trim() || null,
        fitter_ids: selectedFitterIds,
      };

      const res = isEdit
        ? await fetch(`/api/diary/entries/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/diary/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

      const data = (await res.json()) as { success?: boolean; entry?: DiaryEntry; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to save entry.");
        return;
      }
      if (data.entry) onSaved(data.entry);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.75)", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-sheet">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isEdit ? "Edit diary entry" : "New diary entry"}</h2>
            <p className="modal-subtitle">{isEdit ? "Update the details below" : "Fill in the details to add to your diary"}</p>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">

          {/* Title + Type */}
          <div className="form-row">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label" htmlFor="de-title">Job title</label>
              <input id="de-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Fitting — Smith Kitchen" className="chat-input" required />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="de-type">Entry type</label>
              <select id="de-type" value={entryType} onChange={(e) => setEntryType(e.target.value as EntryType)} className="chat-input">
                <option value="fitting">Fitting</option>
                <option value="prep">Prep</option>
                <option value="survey">Survey</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="de-customer">Customer name</label>
              <input id="de-customer" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith" className="chat-input" />
            </div>
          </div>

          {/* Dates */}
          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="de-start">Start date & time</label>
              <input id="de-start" type="datetime-local" value={startDatetime} onChange={(e) => setStartDatetime(e.target.value)}
                className="chat-input" required />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="de-end">End date & time</label>
              <input id="de-end" type="datetime-local" value={endDatetime} onChange={(e) => setEndDatetime(e.target.value)}
                className="chat-input" required />
            </div>
          </div>

          <div className="form-divider" />

          {/* Customer details */}
          <div className="form-field">
            <label className="form-label" htmlFor="de-address">Job address</label>
            <input id="de-address" type="text" value={jobAddress} onChange={(e) => setJobAddress(e.target.value)}
              placeholder="14 Acacia Avenue, Manchester" className="chat-input" />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="de-phone">Customer phone</label>
              <input id="de-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="07700 900123" className="chat-input" />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="de-email">Customer email</label>
              <input id="de-email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com" className="chat-input" />
            </div>
          </div>

          {/* Fitters */}
          {teamMembers.length > 0 ? (
            <>
              <div className="form-divider" />
              <div className="form-field">
                <label className="form-label">Assign fitters</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" }}>
                  {teamMembers.map((tm) => {
                    const selected = selectedFitterIds.includes(tm.id);
                    return (
                      <button key={tm.id} type="button" onClick={() => toggleFitter(tm.id)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "999px",
                          fontSize: "13px",
                          fontWeight: selected ? 700 : 500,
                          border: selected ? "1px solid #38bdf8" : "1px solid rgba(148,163,184,0.2)",
                          background: selected ? "rgba(56,189,248,0.15)" : "rgba(255,255,255,0.04)",
                          color: selected ? "#38bdf8" : "#94a3b8",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {tm.name ?? tm.member_id}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {/* Notes */}
          <div className="form-field">
            <label className="form-label" htmlFor="de-notes">Notes</label>
            <textarea id="de-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes for the team…" rows={3}
              className="chat-input" style={{ resize: "vertical", minHeight: "80px" }} />
          </div>

          {error ? (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", borderRadius: "8px", padding: "10px 14px", margin: 0 }}>{error}</p>
          ) : null}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add to diary"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
