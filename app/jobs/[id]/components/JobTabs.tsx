"use client";

import { useMemo, useState } from "react";

import AttachmentsGallery from "./AttachmentsGallery";
import EmailThread from "./EmailThread";
import { formatRelativeTime, formatTimestamp, humanizeStatus } from "./helpers";
import QuotesPanel from "./QuotesPanel";
import type { JobPageData } from "./types";

const TABS = ["overview", "emails", "attachments", "documents", "updates"] as const;

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

const TAB_COUNTS: Record<string, (data: JobPageData) => number | null> = {
  emails: (d) => d.emailThread.length || null,
  attachments: (d) => d.attachments.length || null,
  documents: (d) => (d.quotes.length + (d.job.job_sheet_url ? 1 : 0)) || null,
};

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
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid rgba(148,163,184,0.1)", paddingBottom: "0", flexWrap: "wrap" }}>
        {TABS.map((name) => {
          const count = TAB_COUNTS[name]?.(data);
          const active = tab === name;
          return (
            <button
              type="button"
              key={name}
              onClick={() => setTab(name)}
              style={{
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: active ? 700 : 500,
                color: active ? "#f1f5f9" : "#64748b",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #38bdf8" : "2px solid transparent",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                marginBottom: "-1px",
                transition: "color 0.15s ease",
              }}
            >
              {name[0].toUpperCase() + name.slice(1)}
              {count ? (
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "1px 6px",
                  borderRadius: "999px", background: "rgba(56,189,248,0.15)",
                  color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)",
                }}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {tab === "overview" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Next step callout */}
          <section style={{
            background: "rgba(56,189,248,0.07)",
            border: "1px solid rgba(56,189,248,0.18)",
            borderRadius: "14px",
            padding: "14px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}>
            <span style={{ fontSize: "18px", flexShrink: 0 }}>→</span>
            <div>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Next step</p>
              <p style={{ fontSize: "14px", color: "#e2e8f0", margin: 0 }}>{nextStep(data.job)}</p>
            </div>
          </section>

          {/* Key metrics */}
          <div className="metric-grid">
            <div className="metric">
              <p className="metric-label">Status</p>
              <p className="metric-value" style={{ fontSize: "15px" }}>{humanizeStatus(data.job.status)}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Quotes</p>
              <p className="metric-value" style={{ fontSize: "15px" }}>{data.quotes.length}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Last email</p>
              <p className="metric-value" style={{ fontSize: "15px" }}>{formatRelativeTime(data.latestEmail?.received_at)}</p>
            </div>
            <div className="metric">
              <p className="metric-label">Customer replied</p>
              <p className="metric-value" style={{ fontSize: "15px", color: data.job.customer_reply ? "#34d399" : "#f87171" }}>
                {data.job.customer_reply ? "Yes" : "No"}
              </p>
            </div>
            <div className="metric">
              <p className="metric-label">Attachments</p>
              <p className="metric-value" style={{ fontSize: "15px" }}>{data.attachments.length}</p>
            </div>
            {data.job.provider ? (
              <div className="metric">
                <p className="metric-label">Provider</p>
                <p className="metric-value" style={{ fontSize: "15px" }}>{data.job.provider}</p>
              </div>
            ) : null}
          </div>

          {/* Missing info warning */}
          {missing.length ? (
            <div style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.2)",
              borderRadius: "12px",
              padding: "12px 16px",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "#fbbf24", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Missing info
              </p>
              <p style={{ fontSize: "13px", color: "#fcd34d", margin: 0 }}>
                {missing.join(" · ")} — update before quoting.
              </p>
            </div>
          ) : null}

          {/* Job summary (key-value pairs from job_details) */}
          <section className="card" style={{ padding: "18px 20px" }}>
            <div style={{ marginBottom: "14px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>Job summary</h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Details extracted from job notes</p>
            </div>
            {summary.pairs.length ? (
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px", margin: 0 }}>
                {summary.pairs.map(([key, value]) => (
                  <div key={key} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148,163,184,0.1)",
                    borderRadius: "10px",
                    padding: "10px 12px",
                  }}>
                    <dt style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                      {key}
                    </dt>
                    <dd style={{ fontSize: "14px", color: "#e2e8f0", margin: 0, fontWeight: 500 }}>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {summary.paragraphs.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: summary.pairs.length ? "14px" : "0" }}>
                {summary.paragraphs.map((line, index) => (
                  <p key={`${line}-${index}`} style={{ fontSize: "14px", color: "#cbd5e1", margin: 0, lineHeight: 1.6 }}>{line}</p>
                ))}
              </div>
            ) : null}
            {!summary.paragraphs.length && !summary.pairs.length ? (
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No job summary captured yet.</p>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "emails" ? <EmailThread emailThread={data.emailThread} /> : null}
      {tab === "attachments" ? <AttachmentsGallery attachments={data.attachments} /> : null}
      {tab === "documents" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* Job Sheet */}
          <section>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Job Sheet
            </h3>
            {data.job.job_sheet_url ? (
              <article style={{
                background: "linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(249,115,22,0.04) 100%)",
                border: "1px solid rgba(249,115,22,0.25)",
                borderRadius: "14px",
                padding: "16px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
                    background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px",
                  }}>
                    📋
                  </div>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 2px" }}>
                      {data.job.job_sheet_ref || "Job Sheet"}
                    </p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                      PDF · Generated by BillyBot
                    </p>
                  </div>
                </div>
                <a
                  href={data.job.job_sheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  Open ↗
                </a>
              </article>
            ) : (
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No job sheet generated yet.</p>
            )}
          </section>

          {/* Quotes */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                Quotes
              </h3>
              <a
                href={`/quotes/new?jobId=${data.job.id}`}
                className="btn btn-primary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                + New quote
              </a>
            </div>
            <QuotesPanel quotes={data.quotes} jobId={data.job.id} />
          </section>

        </div>
      ) : null}

      {/* Updates */}
      {tab === "updates" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Timeline */}
          <section className="card" style={{ padding: "18px 20px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 14px" }}>Timeline</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Job created", value: formatTimestamp(data.job.created_at) },
                { label: "Last activity", value: formatTimestamp(data.job.last_activity_at) },
                { label: "Customer replied", value: data.job.customer_reply ? "Yes" : "No" },
                { label: "Latest route", value: String((data.latestEmail?.meta as { recommended_route?: string } | null)?.recommended_route || "—") },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>{label}</span>
                  <span style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 500, textAlign: "right" }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Outbound draft */}
          {(data.job.outbound_email_subject || data.job.outbound_email_body) ? (
            <section className="card" style={{ padding: "18px 20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 10px" }}>Outbound draft</h3>
              {data.job.outbound_email_subject && (
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: "0 0 8px" }}>
                  Subject: {data.job.outbound_email_subject}
                </p>
              )}
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {data.job.outbound_email_body || "No draft body yet."}
              </p>
            </section>
          ) : null}

          {/* Metadata */}
          {data.job.metadata && Object.keys(data.job.metadata).length ? (
            <section className="card" style={{ padding: "18px 20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 12px" }}>Metadata</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {Object.entries(data.job.metadata).map(([key, value]) => (
                  <span key={key} className="tag">
                    {key}: {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
