"use client";

import { useMemo, useState } from "react";

import AttachmentsGallery from "./AttachmentsGallery";
import EmailThread from "./EmailThread";
import { formatRelativeTime, formatTimestamp, humanizeStatus } from "./helpers";
import QuotesPanel from "./QuotesPanel";
import type { JobPageData } from "./types";

const TABS = ["overview", "emails", "attachments", "quotes", "updates"] as const;

type Tab = (typeof TABS)[number];

function parseSummary(details?: string | null) {
  const value = details?.trim() || "";
  if (!value) return { paragraphs: [] as string[], pairs: [] as Array<[string, string]> };

  const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const pairs: Array<[string, string]> = [];
  const paragraphs: string[] = [];

  for (const line of lines) {
    const keyValueMatch = line.match(/^([^:]{2,40}):\s*(.+)$/);
    if (keyValueMatch) {
      pairs.push([keyValueMatch[1], keyValueMatch[2]]);
    } else {
      paragraphs.push(line);
    }
  }

  return { pairs, paragraphs };
}

function nextStep(job: JobPageData["job"]) {
  if (!job.customer_phone) return "Capture a confirmed customer phone number.";
  if (!job.site_address) return "Confirm the job site address before quoting.";
  if (!job.provider_thread_id) return "Connect the inbound email to a provider thread.";
  if (!job.customer_reply) return "Follow up with the customer for confirmation.";
  return "Create or update the quote and move the job to booked.";
}

export default function JobTabs({ data }: { data: JobPageData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const summary = useMemo(() => parseSummary(data.job.job_details), [data.job.job_details]);

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!data.job.customer_phone) list.push("Phone");
    if (!data.job.site_address) list.push("Site address");
    if (!/\d+(\.\d+)?\s?m/.test((data.job.job_details || "").toLowerCase())) list.push("Measurements");
    return list;
  }, [data.job.customer_phone, data.job.job_details, data.job.site_address]);

  return (
    <div className="stack gap-4">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
        {TABS.map((name) => (
          <button
            type="button"
            key={name}
            className={`btn h-9 px-4 ${tab === name ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab(name)}
          >
            {name[0].toUpperCase() + name.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="stack gap-4">
          <section className="card">
            <h3 className="text-base font-semibold text-white">Next step</h3>
            <p className="mt-1 text-sm">{nextStep(data.job)}</p>
          </section>
          <section className="metric-grid">
            <div className="metric"><p className="metric-label">Status</p><p className="metric-value text-base">{humanizeStatus(data.job.status)}</p></div>
            <div className="metric"><p className="metric-label">Quotes</p><p className="metric-value text-base">{data.quotes.length}</p></div>
            <div className="metric"><p className="metric-label">Last email</p><p className="metric-value text-base">{formatRelativeTime(data.latestEmail?.received_at)}</p></div>
            <div className="metric"><p className="metric-label">Customer replied</p><p className="metric-value text-base">{data.job.customer_reply ? "Yes" : "No"}</p></div>
            <div className="metric"><p className="metric-label">Provider</p><p className="metric-value text-base">{data.job.provider || "—"}</p></div>
          </section>
          <section className="card stack gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">Job summary</h3>
              <p className="text-sm text-[var(--muted)]">Structured details extracted from job notes.</p>
            </div>
            {summary.pairs.length ? (
              <dl className="grid gap-2 sm:grid-cols-2">
                {summary.pairs.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <dt className="text-xs uppercase tracking-wide text-[var(--muted)]">{key}</dt>
                    <dd className="text-sm text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {summary.paragraphs.length ? (
              <div className="space-y-2">
                {summary.paragraphs.map((line, index) => <p key={`${line}-${index}`} className="text-sm text-slate-100">{line}</p>)}
              </div>
            ) : null}
            {!summary.paragraphs.length && !summary.pairs.length ? <p className="text-sm">No job summary captured yet.</p> : null}
            {missing.length ? <p className="text-sm text-amber-200">Missing info: {missing.join(", ")}.</p> : null}
          </section>
          <section className="card stack gap-2">
            <h3 className="text-base font-semibold text-white">Customer & site</h3>
            <p className="text-sm text-slate-200">{data.job.customer_name || "Unknown customer"} · {data.job.customer_email || "No email"}</p>
            <p className="text-sm text-[var(--muted)]">{data.job.site_address || "No site address"} {data.job.postcode ? `(${data.job.postcode})` : ""}</p>
          </section>
        </div>
      ) : null}

      {tab === "emails" ? <EmailThread emailThread={data.emailThread} /> : null}
      {tab === "attachments" ? <AttachmentsGallery attachments={data.attachments} /> : null}
      {tab === "quotes" ? <QuotesPanel quotes={data.quotes} jobId={data.job.id} /> : null}
      {tab === "updates" ? (
        <div className="stack gap-4">
          <section className="card stack gap-3">
            <h3 className="text-base font-semibold text-white">Metadata</h3>
            {data.job.metadata && Object.keys(data.job.metadata).length ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.job.metadata).map(([key, value]) => (
                  <span key={key} className="tag">{key}: {typeof value === "string" ? value : JSON.stringify(value)}</span>
                ))}
              </div>
            ) : <p className="text-sm">No metadata available.</p>}
          </section>
          <section className="card stack gap-2">
            <h3 className="text-base font-semibold text-white">Outbound draft</h3>
            <p className="text-sm text-slate-100">{data.job.outbound_email_subject || "No subject"}</p>
            <p className="whitespace-pre-wrap text-sm text-[var(--muted)]">{data.job.outbound_email_body || "No draft body yet."}</p>
          </section>
          <section className="card stack gap-2">
            <h3 className="text-base font-semibold text-white">Recent changes</h3>
            <ul className="ml-4 list-disc text-sm text-[var(--muted)]">
              <li>Job created {formatTimestamp(data.job.created_at)}</li>
              <li>Last activity {formatTimestamp(data.job.last_activity_at)}</li>
              <li>Customer replied: {data.job.customer_reply ? "Yes" : "No"}</li>
              <li>Latest email route: {String((data.latestEmail?.meta as { recommended_route?: string } | null)?.recommended_route || "—")}</li>
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
