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
    <div className="stack gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "inbound", "outbound"] as Direction[]).map((option) => (
          <button
            key={option}
            type="button"
            className={`btn h-9 px-3 ${
              direction === option ? "btn-primary" : "btn-secondary"
            }`}
            onClick={() => setDirection(option)}
          >
            {option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
        <button
          type="button"
          className={`btn h-9 px-3 ${
            onlyWithAttachments ? "btn-primary" : "btn-secondary"
          }`}
          onClick={() => setOnlyWithAttachments((value) => !value)}
        >
          With attachments
        </button>
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

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="tag">{email.direction ?? "unknown"}</span>
        <span className="text-xs text-[var(--muted)]">
          {formatTimestamp(email.received_at)}
        </span>
        <span className="text-xs text-[var(--muted)]">Status: {email.status ?? "—"}</span>
        <span className="text-xs text-[var(--muted)]">Queue: {email.queue_status ?? "—"}</span>
      </div>
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-[var(--muted)]">From:</span> {email.from_email || "—"}
        </p>
        <p>
          <span className="text-[var(--muted)]">To:</span> {email.to_emails?.join(", ") || "—"}
        </p>
        <p>
          <span className="text-[var(--muted)]">Cc:</span> {email.cc_emails?.join(", ") || "—"}
        </p>
        <p>
          <span className="text-[var(--muted)]">Subject:</span> {email.subject || "(No subject)"}
        </p>
      </div>
      {email.last_error || email.error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
          {email.last_error || email.error}
        </p>
      ) : null}

      <div
        className={`mt-3 overflow-hidden rounded-xl border border-white/10 p-3 ${
          expanded ? "max-h-none" : "max-h-44"
        }`}
      >
        {shouldRenderHtml ? (
          <div
            className="prose prose-invert max-w-none text-sm"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-slate-200">{fallbackText}</p>
        )}
      </div>
      <button
        type="button"
        className="mt-2 text-sm text-blue-300 hover:text-blue-200"
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? "Show less" : "Show more"}
      </button>
    </article>
  );
}
