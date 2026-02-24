"use client";

import Link from "next/link";
import { useState } from "react";

import { formatRelativeTime, humanizeStatus, shortId } from "./helpers";
import type { JobPageData } from "./types";

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" },
  awaiting_info: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  quoting: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  quoted: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  waiting_customer: { bg: "rgba(168,85,247,0.12)", text: "#c084fc", border: "rgba(168,85,247,0.25)" },
  booked: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  in_progress: { bg: "rgba(249,115,22,0.12)", text: "#fb923c", border: "rgba(249,115,22,0.25)" },
  approved: { bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" },
  completed: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.12)" },
  lost: { bg: "rgba(248,113,113,0.1)", text: "#f87171", border: "rgba(248,113,113,0.2)" },
};

export default function JobHeader({ job, quotesCount }: { job: JobPageData["job"]; quotesCount: number }) {
  const [copied, setCopied] = useState(false);

  async function copyJobId() {
    await navigator.clipboard.writeText(job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const normalized = (job.status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const s = STATUS_STYLES[normalized] ?? { bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.6)", border: "rgba(255,255,255,0.1)" };

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 20,
      background: "rgba(13,21,39,0.97)",
      backdropFilter: "blur(14px)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px",
      padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <Link href="/jobs" style={{ fontSize: "13px", color: "#475569", display: "inline-flex", alignItems: "center", gap: "4px", textDecoration: "none" }}>
            ← Jobs
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#f1f5f9", margin: 0, lineHeight: 1.2 }}>
              {job.title?.trim() || `Job ${shortId(job.id)}`}
            </h1>
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "4px 10px",
              borderRadius: "999px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em",
              background: s.bg, color: s.text, border: `1px solid ${s.border}`,
            }}>
              {humanizeStatus(job.status)}
            </span>
          </div>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            {job.customer_name || "Unknown customer"} · Last activity {formatRelativeTime(job.last_activity_at)}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", paddingTop: "4px" }}>
          <Link
            href={`/quotes/new?jobId=${job.id}`}
            className="btn btn-primary"
            style={{ padding: "10px 16px", fontSize: "13px" }}
          >
            {quotesCount ? "Create quote" : "Create first quote"}
          </Link>
          <Link
            href={job.conversation_id ? `/chat?conversation_id=${job.conversation_id}` : "#"}
            className="btn btn-secondary"
            style={{
              padding: "10px 16px", fontSize: "13px",
              ...(job.conversation_id ? {} : { pointerEvents: "none", opacity: 0.5 }),
            }}
          >
            View conversation
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "10px 16px", fontSize: "13px" }}
            onClick={copyJobId}
          >
            Copy ID
          </button>
        </div>
      </div>
      {copied && (
        <div className="toast" style={{ marginTop: "10px", display: "inline-flex" }}>
          Copied ✓
        </div>
      )}
    </div>
  );
}
