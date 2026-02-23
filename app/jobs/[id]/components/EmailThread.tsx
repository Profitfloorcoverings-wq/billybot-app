"use client";

import { useMemo, useState } from "react";

import { sanitizeEmailHtml } from "@/lib/email/sanitizeEmailHtml";

import { formatTimestamp } from "./helpers";
import type { JobPageData } from "./types";

type Direction = "all" | "inbound" | "outbound";

function stripHtml(value?: string | null) {
  if (!value) return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function EmailThread({ emailThread }: { emailThread: JobPageData["emailThread"] }) {
  const [direction, setDirection] = useState<Direction>("all");
  const [onlyWithAttachments, setOnlyWithAttachments] = useState(false);

  const filtered = useMemo(() => {
    return emailThread.filter((email) => {
      if (direction !== "all" && email.direction !== direction) return false;
      if (
        onlyWithAttachments &&
        (!Array.isArray(email.attachments) || email.attachments.length === 0)
      ) {
        return false;
      }
      return true;
    });
  }, [direction, emailThread, onlyWithAttachments]);

  if (!emailThread.length) {
    return <div className="empty-state">No emails yet in this thread.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Filter bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
        {(["all", "inbound", "outbound"] as Direction[]).map((option) => (
          <button
            key={option}
            type="button"
            className={direction === option ? "btn btn-primary" : "btn btn-secondary"}
            style={{ padding: "8px 16px", fontSize: "13px" }}
            onClick={() => setDirection(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
        <button
          type="button"
          className={onlyWithAttachments ? "btn btn-primary" : "btn btn-secondary"}
          style={{ padding: "8px 16px", fontSize: "13px" }}
          onClick={() => setOnlyWithAttachments((value) => !value)}
        >
          With attachments
        </button>
        <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px" }}>
          {filtered.length} of {emailThread.length}
        </span>
      </div>

      {filtered.map((email) => (
        <EmailCard key={email.id} email={email} />
      ))}
    </div>
  );
}

function EmailCard({ email }: { email: JobPageData["emailThread"][number] }) {
  const [expanded, setExpanded] = useState(false);

  const sanitized = sanitizeEmailHtml(email.body_html);
  const fallbackText = email.body_text?.trim() || stripHtml(email.body_html) || "No email body available.";
  const shouldRenderHtml = Boolean(sanitized && !sanitized.toLowerCase().includes("<script"));

  const isInbound = email.direction === "inbound";

  return (
    <article style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(148,163,184,0.1)",
      borderLeft: isInbound ? "3px solid rgba(56,189,248,0.4)" : "3px solid rgba(249,115,22,0.4)",
      borderRadius: "14px",
      padding: "16px 18px",
    }}>
      {/* Email header */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span style={{
          fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", letterSpacing: "0.04em",
          background: isInbound ? "rgba(56,189,248,0.12)" : "rgba(249,115,22,0.12)",
          color: isInbound ? "#38bdf8" : "#fb923c",
          border: `1px solid ${isInbound ? "rgba(56,189,248,0.25)" : "rgba(249,115,22,0.25)"}`,
        }}>
          {email.direction ?? "unknown"}
        </span>
        <span style={{ fontSize: "12px", color: "#64748b" }}>{formatTimestamp(email.received_at)}</span>
        {email.status && (
          <span style={{ fontSize: "12px", color: "#475569" }}>Status: {email.status}</span>
        )}
        {email.queue_status && email.queue_status !== "processed" && (
          <span style={{ fontSize: "12px", color: "#475569" }}>Queue: {email.queue_status}</span>
        )}
        {Array.isArray(email.attachments) && email.attachments.length > 0 && (
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>📎 {email.attachments.length} attachment{email.attachments.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {/* Email meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
        <p style={{ fontSize: "13px", color: "#e2e8f0", margin: 0 }}>
          <span style={{ color: "#64748b", marginRight: "4px" }}>From:</span>
          {email.from_email || "—"}
        </p>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
          <span style={{ color: "#64748b", marginRight: "4px" }}>To:</span>
          {email.to_emails?.join(", ") || "—"}
        </p>
        {email.cc_emails?.length ? (
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
            <span style={{ color: "#64748b", marginRight: "4px" }}>Cc:</span>
            {email.cc_emails.join(", ")}
          </p>
        ) : null}
        <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>
          <span style={{ color: "#64748b", fontWeight: 400, marginRight: "4px" }}>Subject:</span>
          {email.subject || "(No subject)"}
        </p>
      </div>

      {/* Error banner */}
      {(email.last_error || email.error) ? (
        <div style={{
          marginBottom: "12px",
          padding: "8px 12px",
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.2)",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#f87171",
        }}>
          {email.last_error || email.error}
        </div>
      ) : null}

      {/* Body */}
      <div style={{
        overflow: "hidden",
        borderRadius: "10px",
        border: "1px solid rgba(148,163,184,0.08)",
        padding: "12px 14px",
        maxHeight: expanded ? "none" : "176px",
        background: "rgba(255,255,255,0.02)",
        position: "relative",
      }}>
        {shouldRenderHtml ? (
          <div
            className="chat-md"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        ) : (
          <p style={{ fontSize: "14px", color: "#cbd5e1", whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>
            {fallbackText}
          </p>
        )}
        {!expanded && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "48px",
            background: "linear-gradient(to bottom, transparent, rgba(13,19,33,0.9))",
            pointerEvents: "none",
          }} />
        )}
      </div>
      <button
        type="button"
        style={{ marginTop: "8px", fontSize: "13px", color: "#38bdf8", background: "none", border: "none", cursor: "pointer", padding: "0" }}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show less ↑" : "Show more ↓"}
      </button>
    </article>
  );
}
