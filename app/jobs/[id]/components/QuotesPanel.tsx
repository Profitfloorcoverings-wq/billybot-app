"use client";

import Link from "next/link";

import { formatTimestamp } from "./helpers";
import type { JobPageData } from "./types";

export default function QuotesPanel({ quotes, jobId }: { quotes: JobPageData["quotes"]; jobId: string }) {
  if (!quotes.length) {
    return (
      <div className="empty-state stack items-center">
        <p>No quotes are linked to this job yet.</p>
        <Link href={`/quotes/new?jobId=${jobId}`} className="btn btn-primary">
          Create first quote
        </Link>
      </div>
    );
  }

  return (
    <div className="stack gap-3">
      {quotes.map((quote) => (
        <article key={quote.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">{quote.quote_reference || `Quote ${quote.id.slice(0, 8)}`}</h3>
              <p className="text-xs text-[var(--muted)]">Version {quote.version ?? 1} · {formatTimestamp(quote.created_at)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag">{quote.quote_status || "draft"}</span>
              <span className="tag">Follow-up: {quote.follow_up_status || "none"}</span>
              {quote.possibleMatch ? <span className="tag bg-orange-500/20 text-orange-200">Possible match</span> : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {quote.pdf_url ? (
              <a href={quote.pdf_url} target="_blank" rel="noreferrer" className="btn btn-secondary h-9 px-3 text-xs">
                View PDF
              </a>
            ) : null}
            <button type="button" className="btn btn-secondary h-9 px-3 text-xs" onClick={() => navigator.clipboard.writeText(quote.quote_reference || quote.id)}>
              Copy reference
            </button>
            <Link href={`/quotes/${quote.id}`} className="btn btn-secondary h-9 px-3 text-xs">
              Open quote detail
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
