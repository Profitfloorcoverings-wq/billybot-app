"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { formatTimestamp, humanizeStatus } from "./helpers";
import type { JobPageData } from "./types";

const STATUS_OPTIONS = [
  "new",
  "quoting",
  "waiting_customer",
  "booked",
  "in_progress",
  "completed",
  "lost",
];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" },
  quoting: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  waiting_customer: { bg: "rgba(168,85,247,0.12)", text: "#c084fc", border: "rgba(168,85,247,0.25)" },
  booked: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  in_progress: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  completed: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.12)" },
  lost: { bg: "rgba(248,113,113,0.1)", text: "#f87171", border: "rgba(248,113,113,0.2)" },
};

export default function SidebarCards({ data }: { data: JobPageData }) {
  const { job, customer, latestEmail } = data;
  const [status, setStatus] = useState(job.status || "new");
  const [customerReply, setCustomerReply] = useState(Boolean(job.customer_reply));
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const missingInfo = useMemo(() => {
    const list: string[] = [];
    if (!job.customer_phone) list.push("Customer phone");
    if (!job.site_address) list.push("Site address");
    if (!job.postcode) list.push("Postcode");
    const details = (job.job_details || "").toLowerCase();
    if (!/\d+(\.\d+)?\s?m/.test(details) || details.includes("not provided")) {
      list.push("Measurements");
    }
    return list;
  }, [job.customer_phone, job.job_details, job.postcode, job.site_address]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  }

  function updateJob(patch: Partial<{ status: string; customer_reply: boolean }>) {
    startTransition(async () => {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) { showToast("Update failed"); return; }
      showToast("Saved");
    });
  }

  const currentStatusColor = STATUS_COLORS[status] ?? { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.1)" };
  const customerName = customer?.customer_name || job.customer_name || "Unknown";
  const customerEmail = customer?.email || job.customer_email;
  const customerPhone = customer?.phone || job.customer_phone;
  const customerMobile = customer?.mobile;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* Status control */}
      <section className="card" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Job Status</p>
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "3px 8px",
              borderRadius: "999px", fontSize: "10px", fontWeight: 700,
              background: currentStatusColor.bg, color: currentStatusColor.text, border: `1px solid ${currentStatusColor.border}`,
            }}>
              {humanizeStatus(status)}
            </span>
          </div>

          <select
            value={status}
            onChange={(e) => {
              const next = e.target.value;
              setStatus(next);
              updateJob({ status: next });
            }}
            disabled={isPending}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: "10px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.18)",
              color: "#f1f5f9", fontSize: "13px", outline: "none", cursor: "pointer",
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{humanizeStatus(option)}</option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={customerReply}
              onChange={(e) => {
                const next = e.target.checked;
                setCustomerReply(next);
                updateJob({ customer_reply: next });
              }}
              disabled={isPending}
              style={{ width: "15px", height: "15px", accentColor: "#38bdf8", cursor: "pointer" }}
            />
            <span style={{ fontSize: "13px", color: "#e2e8f0" }}>Customer replied</span>
          </label>
        </div>
      </section>

      {/* Customer */}
      <section className="card" style={{ padding: "16px 18px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>Customer</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{customerName}</p>
          {customerEmail && (
            <a href={`mailto:${customerEmail}`} style={{ fontSize: "13px", color: "#38bdf8", textDecoration: "none" }}>
              {customerEmail}
            </a>
          )}
          {!customerEmail && <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No email</p>}
          {customerPhone && (
            <a href={`tel:${customerPhone}`} style={{ fontSize: "13px", color: "#94a3b8", textDecoration: "none" }}>
              📞 {customerPhone}
            </a>
          )}
          {customerMobile && (
            <a href={`tel:${customerMobile}`} style={{ fontSize: "13px", color: "#94a3b8", textDecoration: "none" }}>
              📱 {customerMobile}
            </a>
          )}
          {!customerPhone && !customerMobile && (
            <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No phone on record</p>
          )}
          {customer?.id && (
            <Link
              href={`/customers/${customer.id}`}
              style={{ fontSize: "13px", color: "#38bdf8", marginTop: "2px" }}
            >
              Open customer profile →
            </Link>
          )}
        </div>
      </section>

      {/* Site */}
      <section className="card" style={{ padding: "16px 18px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>Site</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {job.site_address ? (
            <p style={{ fontSize: "14px", color: "#e2e8f0", margin: 0 }}>{job.site_address}</p>
          ) : (
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No site address</p>
          )}
          {job.postcode && (
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>🏠 {job.postcode}</p>
          )}
          {(job.site_address || job.postcode) && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent([job.site_address, job.postcode].filter(Boolean).join(", "))}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "12px", color: "#38bdf8", marginTop: "4px" }}
            >
              Open in Maps →
            </a>
          )}
          {job.provider && (
            <p style={{ fontSize: "12px", color: "#475569", margin: 0, marginTop: "4px" }}>
              Provider: {job.provider}
            </p>
          )}
        </div>
      </section>

      {/* Missing info */}
      <section className="card" style={{ padding: "16px 18px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>Checklist</p>
        {missingInfo.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#34d399", margin: 0 }}>✓ All key details present</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {missingInfo.map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>{item} missing</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Processing health */}
      <section className="card" style={{ padding: "16px 18px" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "8px" }}>Processing</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            Queue: {latestEmail?.queue_status || "—"} · Status: {latestEmail?.status || "—"}
          </p>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            Attempts: {latestEmail?.attempts ?? 0} · Processed: {formatTimestamp(latestEmail?.processed_at)}
          </p>
          {(latestEmail?.queue_status === "error" || latestEmail?.status === "error") && (
            <p style={{ fontSize: "12px", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "8px", padding: "8px 10px", marginTop: "4px" }}>
              {latestEmail?.last_error || latestEmail?.error || "Unknown processing error"}
            </p>
          )}
        </div>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
