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

export default function SidebarCards({ data }: { data: JobPageData }) {
  const { job, customer, latestEmail } = data;
  const [status, setStatus] = useState(job.status || "new");
  const [customerReply, setCustomerReply] = useState(Boolean(job.customer_reply));
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const missingInfo = useMemo(() => {
    const list: string[] = [];
    if (!job.customer_phone) list.push("Customer phone missing");
    if (!job.site_address) list.push("Site address missing");
    if (!job.postcode) list.push("Postcode missing");
    const details = (job.job_details || "").toLowerCase();
    if (!/\d+(\.\d+)?\s?m/.test(details) || details.includes("not provided")) {
      list.push("Measurements missing");
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

      if (!response.ok) {
        showToast("Update failed");
        return;
      }
      showToast("Job updated");
    });
  }

  return (
    <div className="stack gap-4">
      <section className="card stack gap-3">
        <h3 className="text-base font-semibold text-white">Customer</h3>
        <p className="text-sm text-slate-200">{customer?.customer_name || job.customer_name || "Unknown"}</p>
        <p className="text-sm text-[var(--muted)]">{customer?.email || job.customer_email || "No email"}</p>
        <p className="text-sm text-[var(--muted)]">{customer?.mobile || customer?.phone || job.customer_phone || "No phone"}</p>
        {customer?.id ? <Link href={`/customers/${customer.id}`} className="text-sm text-blue-300">Open customer →</Link> : null}
      </section>

      <section className="card stack gap-2">
        <h3 className="text-base font-semibold text-white">Site</h3>
        <p className="text-sm text-slate-200">{job.site_address || "No site address"}</p>
        <p className="text-sm text-[var(--muted)]">{job.postcode || "No postcode"}</p>
        <p className="text-xs text-[var(--muted)]">Provider: {job.provider || "—"}</p>
        <p className="text-xs break-anywhere text-[var(--muted)]">Thread ID: {job.provider_thread_id || "—"}</p>
      </section>

      <section className="card stack gap-3">
        <h3 className="text-base font-semibold text-white">Status</h3>
        <label className="text-xs text-[var(--muted)]">Job status</label>
        <select
          className="rounded-xl border border-white/15 bg-slate-900 p-2 text-sm"
          value={status}
          onChange={(event) => {
            const next = event.target.value;
            setStatus(next);
            updateJob({ status: next });
          }}
          disabled={isPending}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{humanizeStatus(option)}</option>
          ))}
        </select>

        <label className="row text-sm text-slate-200">
          <input
            type="checkbox"
            checked={customerReply}
            onChange={(event) => {
              const next = event.target.checked;
              setCustomerReply(next);
              updateJob({ customer_reply: next });
            }}
            disabled={isPending}
          />
          Customer replied
        </label>
      </section>

      <section className="card stack gap-2">
        <h3 className="text-base font-semibold text-white">Processing health</h3>
        <p className="text-xs text-[var(--muted)]">Queue: {latestEmail?.queue_status || "—"} · Status: {latestEmail?.status || "—"}</p>
        <p className="text-xs text-[var(--muted)]">Attempts: {latestEmail?.attempts ?? 0}</p>
        <p className="text-xs text-[var(--muted)]">Processed: {formatTimestamp(latestEmail?.processed_at)}</p>
        {(latestEmail?.queue_status === "error" || latestEmail?.status === "error") ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">{latestEmail?.last_error || latestEmail?.error || "Unknown processing error"}</p>
        ) : null}
      </section>

      <section className="card stack gap-2">
        <h3 className="text-base font-semibold text-white">Key missing info</h3>
        {missingInfo.length ? (
          <ul className="ml-4 list-disc text-sm text-[var(--muted)]">
            {missingInfo.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-emerald-200">All key details are present.</p>
        )}
      </section>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
