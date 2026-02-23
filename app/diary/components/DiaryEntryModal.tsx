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

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!startDatetime || !endDatetime) {
      setError("Start and end times are required.");
      return;
    }
    if (new Date(startDatetime) >= new Date(endDatetime)) {
      setError("End time must be after start time.");
      return;
    }

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

      let res: Response;
      if (isEdit) {
        res = await fetch(`/api/diary/entries/${entry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/diary/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = (await res.json()) as { success?: boolean; entry?: DiaryEntry; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to save entry.");
        return;
      }

      if (data.entry) {
        onSaved(data.entry);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title text-base">
            {isEdit ? "Edit diary entry" : "New diary entry"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--text)] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field-group">
            <label className="field-label" htmlFor="de-title">Title</label>
            <input
              id="de-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fitting - Smith Kitchen"
              className="chat-input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="de-type">Type</label>
              <select
                id="de-type"
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as EntryType)}
                className="chat-input w-full"
              >
                <option value="fitting">Fitting</option>
                <option value="prep">Prep</option>
                <option value="survey">Survey</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="de-customer">Customer name</label>
              <input
                id="de-customer"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Smith"
                className="chat-input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="de-start">Start</label>
              <input
                id="de-start"
                type="datetime-local"
                value={startDatetime}
                onChange={(e) => setStartDatetime(e.target.value)}
                className="chat-input w-full"
                required
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="de-end">End</label>
              <input
                id="de-end"
                type="datetime-local"
                value={endDatetime}
                onChange={(e) => setEndDatetime(e.target.value)}
                className="chat-input w-full"
                required
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="de-address">Job address</label>
            <input
              id="de-address"
              type="text"
              value={jobAddress}
              onChange={(e) => setJobAddress(e.target.value)}
              placeholder="14 Acacia Avenue, Manchester"
              className="chat-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="de-email">Customer email</label>
              <input
                id="de-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="john@example.com"
                className="chat-input w-full"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="de-phone">Customer phone</label>
              <input
                id="de-phone"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="07700900123"
                className="chat-input w-full"
              />
            </div>
          </div>

          {teamMembers.length > 0 ? (
            <div className="field-group">
              <label className="field-label">Assign fitters</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {teamMembers.map((tm) => {
                  const selected = selectedFitterIds.includes(tm.id);
                  return (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => toggleFitter(tm.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${
                        selected
                          ? "border-[var(--brand1)] bg-[var(--brand1)] text-[var(--neutral-900)] font-semibold"
                          : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand1)]"
                      }`}
                    >
                      {tm.name ?? tm.member_id}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="field-group">
            <label className="field-label" htmlFor="de-notes">Notes</label>
            <textarea
              id="de-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className="chat-input w-full resize-none"
            />
          </div>

          {error ? (
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
