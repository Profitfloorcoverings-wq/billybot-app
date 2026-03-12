"use client";

import { useEffect, useMemo, useState } from "react";

import AreasPanel from "./AreasPanel";
import AttachmentsGallery from "./AttachmentsGallery";
import EmailThread from "./EmailThread";
import EstimatorPanel from "./EstimatorPanel";
import JobFilesPanel from "./JobFilesPanel";
import OutboundDraftPanel from "./OutboundDraftPanel";
import ReceiptsPanel from "./ReceiptsPanel";
import { formatRelativeTime, formatTimestamp, humanizeStatus } from "./helpers";
import QuotesPanel from "./QuotesPanel";
import { createClient } from "@/utils/supabase/client";
import type { JobPageData } from "./types";

type RamsSignature = {
  id: string;
  job_id: string;
  document_type: "risk_assessment" | "method_statement";
  signer_name: string;
  signed_at: string | null;
};

const TABS = ["overview", "areas", "estimator", "emails", "attachments", "files", "receipts", "documents", "updates"] as const;

type Tab = (typeof TABS)[number];

type DetailSection = {
  heading: string;
  icon: string;
  fields: Array<[string, string]>;
  notes: string[];
  /** true when every field value signals missing/empty data */
  empty: boolean;
};

/** Known section headings N8N writes into job_details */
const SECTION_ICONS: Record<string, string> = {
  customer: "👤",
  "project overview": "📋",
  "areas / rooms": "📐",
  "areas/rooms": "📐",
  "flooring type requested": "🏠",
  "preparation / subfloor work": "🔧",
  "preparation/subfloor work": "🔧",
  "materials / products": "📦",
  "materials/products": "📦",
  "site details": "📍",
  "special requirements": "⚠️",
};

const EMPTY_SIGNALS = [
  "not mentioned", "not stated", "not provided", "no ", "none", "unknown", "n/a",
];

function isEmptyValue(v: string) {
  const lower = v.toLowerCase().trim();
  return !lower || EMPTY_SIGNALS.some((s) => lower.startsWith(s));
}

function looksLikeHeading(line: string) {
  const lower = line.toLowerCase().replace(/[^a-z /]/g, "").trim();
  return Object.keys(SECTION_ICONS).includes(lower);
}

function parseSummary(details?: string | null): { sections: DetailSection[] } {
  const value = details?.trim() || "";
  if (!value) return { sections: [] };

  const lines = value.split(/\n/).map((l) => l.trimEnd());

  const sections: DetailSection[] = [];
  let current: DetailSection | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Detect section heading (standalone line matching known sections)
    if (looksLikeHeading(trimmed)) {
      const key = trimmed.toLowerCase().replace(/[^a-z /]/g, "").trim();
      current = {
        heading: trimmed,
        icon: SECTION_ICONS[key] || "📄",
        fields: [],
        notes: [],
        empty: false,
      };
      sections.push(current);
      continue;
    }

    // Key: Value pair
    const kvMatch = trimmed.match(/^([^:]{2,50}):\s*(.+)$/);
    if (kvMatch && current) {
      current.fields.push([kvMatch[1].trim(), kvMatch[2].trim()]);
      continue;
    }

    // Strip leading JSON-like noise (braces, brackets, quotes, commas)
    const cleaned = trimmed.replace(/^[{[\]}"',\s]+|[{[\]}"',\s]+$/g, "").trim();
    if (!cleaned) continue;

    // Add as note to current section, or create an ungrouped section
    if (current) {
      current.notes.push(cleaned);
    } else {
      current = { heading: "Summary", icon: "📄", fields: [], notes: [cleaned], empty: false };
      sections.push(current);
    }
  }

  // Mark sections where all data is empty
  for (const section of sections) {
    const allFieldsEmpty = section.fields.length > 0 && section.fields.every(([, v]) => isEmptyValue(v));
    const allNotesEmpty = section.notes.length > 0 && section.notes.every((n) => isEmptyValue(n));
    const hasContent = section.fields.length > 0 || section.notes.length > 0;
    section.empty = hasContent && allFieldsEmpty && (section.notes.length === 0 || allNotesEmpty);
  }

  return { sections };
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
  files: (d) => d.jobFiles?.length || null,
  receipts: (d) => d.receipts?.length || null,
  documents: (d) => (d.quotes.length + (d.job.job_sheet_url ? 1 : 0) + (d.job.quote_url ? 1 : 0) + (d.job.risk_assessment_url ? 1 : 0) + (d.job.method_statement_url ? 1 : 0)) || null,
};

function hasDraft(data: JobPageData) {
  return !!(data.job.outbound_email_subject || data.job.outbound_email_body);
}

export default function JobTabs({ data }: { data: JobPageData }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [signatures, setSignatures] = useState<RamsSignature[]>([]);
  const [sending, setSending] = useState(false);
  const [sendToast, setSendToast] = useState<string | null>(null);
  const { sections } = useMemo(() => parseSummary(data.job.job_details), [data.job.job_details]);

  useEffect(() => {
    if (tab !== "documents") return;
    if (!data.job.risk_assessment_url && !data.job.method_statement_url) return;

    const supabase = createClient();
    void supabase
      .from("rams_signatures")
      .select("id, job_id, document_type, signer_name, signed_at")
      .eq("job_id", data.job.id)
      .order("document_type")
      .order("signer_name")
      .then(({ data: sigs }) => {
        if (sigs) setSignatures(sigs as RamsSignature[]);
      });
  }, [tab, data.job.id, data.job.risk_assessment_url, data.job.method_statement_url]);

  async function handleSendRams() {
    setSending(true);
    try {
      const res = await fetch("/api/rams/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: data.job.id }),
      });
      setSendToast(res.ok ? "RAMS sent to customer ✓" : "Failed to send — check N8N");
    } catch {
      setSendToast("Failed to send");
    } finally {
      setSending(false);
      setTimeout(() => setSendToast(null), 3000);
    }
  }

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
              {name === "emails" && hasDraft(data) ? (
                <span style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: "#fb923c", flexShrink: 0,
                }} />
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

          {/* Job summary — structured sections */}
          {sections.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sections.map((section, si) => (
                <section
                  key={`${section.heading}-${si}`}
                  className="card"
                  style={{
                    padding: "16px 20px",
                    opacity: section.empty ? 0.5 : 1,
                  }}
                >
                  {/* Section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: section.fields.length || section.notes.length ? "12px" : "0" }}>
                    <span style={{ fontSize: "16px" }}>{section.icon}</span>
                    <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                      {section.heading}
                    </h3>
                    {section.empty && (
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "2px 8px",
                        borderRadius: "999px", background: "rgba(251,191,36,0.1)",
                        color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)",
                      }}>
                        NEEDS INFO
                      </span>
                    )}
                  </div>

                  {/* Key-value fields */}
                  {section.fields.length > 0 && (
                    <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px", margin: 0 }}>
                      {section.fields.map(([key, val], fi) => {
                        const missing = isEmptyValue(val);
                        return (
                          <div key={`${key}-${fi}`} style={{
                            background: missing ? "rgba(251,191,36,0.04)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${missing ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.08)"}`,
                            borderRadius: "10px",
                            padding: "8px 12px",
                          }}>
                            <dt style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>
                              {key}
                            </dt>
                            <dd style={{
                              fontSize: "13px",
                              color: missing ? "#fbbf24" : "#e2e8f0",
                              fontWeight: missing ? 500 : 500,
                              fontStyle: missing ? "italic" : "normal",
                              margin: 0,
                            }}>
                              {missing ? "Missing" : val}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}

                  {/* Notes / free text */}
                  {section.notes.length > 0 && (
                    <div style={{ marginTop: section.fields.length > 0 ? "10px" : "0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {section.notes.map((note, ni) => (
                        <p key={`n-${ni}`} style={{ fontSize: "13px", color: "#cbd5e1", margin: 0, lineHeight: 1.5 }}>
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <section className="card" style={{ padding: "18px 20px" }}>
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No job summary captured yet.</p>
            </section>
          )}
        </div>
      ) : null}

      {tab === "emails" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {hasDraft(data) ? (
            <OutboundDraftPanel
              jobId={data.job.id}
              initialSubject={data.job.outbound_email_subject ?? null}
              initialBody={data.job.outbound_email_body ?? null}
            />
          ) : null}
          <EmailThread emailThread={data.emailThread} />
        </div>
      ) : null}
      {tab === "areas" ? <AreasPanel jobId={data.job.id} /> : null}
      {tab === "estimator" ? <EstimatorPanel jobId={data.job.id} /> : null}
      {tab === "attachments" ? <AttachmentsGallery attachments={data.attachments} /> : null}
      {tab === "files" ? <JobFilesPanel jobId={data.job.id} /> : null}
      {tab === "receipts" ? <ReceiptsPanel jobId={data.job.id} /> : null}
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

          {/* Risk Assessment */}
          <section>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Risk Assessment
            </h3>
            {data.job.risk_assessment_url ? (
              <article style={{
                background: "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 100%)",
                border: "1px solid rgba(239,68,68,0.25)",
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
                    background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px",
                  }}>
                    ⚠️
                  </div>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 2px" }}>
                      {data.job.risk_assessment_ref || "Risk Assessment"}
                    </p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                      PDF · Generated by BillyBot
                    </p>
                  </div>
                </div>
                <a
                  href={data.job.risk_assessment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  Open ↗
                </a>
              </article>
            ) : (
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No risk assessment generated yet.</p>
            )}
          </section>

          {/* Method Statement */}
          <section>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Method Statement
            </h3>
            {data.job.method_statement_url ? (
              <article style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.04) 100%)",
                border: "1px solid rgba(34,197,94,0.25)",
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
                    background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px",
                  }}>
                    📝
                  </div>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 2px" }}>
                      {data.job.method_statement_ref || "Method Statement"}
                    </p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                      PDF · Generated by BillyBot
                    </p>
                  </div>
                </div>
                <a
                  href={data.job.method_statement_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  Open ↗
                </a>
              </article>
            ) : (
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No method statement generated yet.</p>
            )}
          </section>

          {/* Signature status + Send button */}
          {(data.job.risk_assessment_url || data.job.method_statement_url) ? (
            <section className="card" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Signatures</p>
                <button
                  type="button"
                  onClick={() => void handleSendRams()}
                  disabled={sending}
                  style={{
                    padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                    background: sending ? "rgba(56,189,248,0.2)" : "#38bdf8",
                    color: sending ? "#64748b" : "#0f172a",
                    border: "none", cursor: sending ? "not-allowed" : "pointer",
                  }}
                >
                  {sending ? "Sending…" : "Send to Customer ↗"}
                </button>
              </div>
              {sendToast ? (
                <p style={{ fontSize: "13px", color: "#34d399", margin: "0 0 10px" }}>{sendToast}</p>
              ) : null}
              {signatures.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No signatures requested yet — N8N will create these when RAMS are generated.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {(["risk_assessment", "method_statement"] as const).map((docType) => {
                    const docSigs = signatures.filter((s) => s.document_type === docType);
                    if (!docSigs.length) return null;
                    const label = docType === "risk_assessment" ? "Risk Assessment" : "Method Statement";
                    return (
                      <div key={docType} style={{ marginBottom: "8px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{label}</p>
                        {docSigs.map((sig) => (
                          <div key={sig.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                            <span style={{ fontSize: "14px" }}>{sig.signed_at ? "✓" : "⏳"}</span>
                            <span style={{ fontSize: "13px", color: sig.signed_at ? "#34d399" : "#94a3b8", flex: 1 }}>{sig.signer_name}</span>
                            {sig.signed_at ? (
                              <span style={{ fontSize: "11px", color: "#475569" }}>
                                {new Date(sig.signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            ) : (
                              <span style={{ fontSize: "11px", color: "#475569" }}>Awaiting</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {/* Latest Quote (from jobs table) */}
          <section>
            <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Latest Quote
            </h3>
            {data.job.quote_url ? (
              <article style={{
                background: "linear-gradient(135deg, rgba(56,189,248,0.1) 0%, rgba(56,189,248,0.04) 100%)",
                border: "1px solid rgba(56,189,248,0.25)",
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
                    background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px",
                  }}>
                    💷
                  </div>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 2px" }}>
                      {data.job.quote_ref || "Quote"}
                    </p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
                      PDF · Generated by BillyBot
                    </p>
                  </div>
                </div>
                <a
                  href={data.job.quote_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ padding: "8px 16px", fontSize: "13px", whiteSpace: "nowrap" }}
                >
                  Open ↗
                </a>
              </article>
            ) : (
              <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No quote generated yet.</p>
            )}
          </section>

          {/* Quote history (from quotes table) */}
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                Quote History
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
