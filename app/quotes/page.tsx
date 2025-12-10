"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const QUOTES_LAST_VIEWED_KEY = "quotes_last_viewed_at";

type Quote = {
  id: string | number;
  quote_reference?: string | null;
  pdf_url?: string | null;
  client_id?: string | null;
  created_at?: string | null;
  status?: string | null;
  customer_name?: string | null;
  job_ref?: string | null;
};

type QuotesResponse = {
  quotes?: Quote[];
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLastViewed, setInitialLastViewed] = useState<string | null>(null);

  useEffect(() => {
    setInitialLastViewed(localStorage.getItem(QUOTES_LAST_VIEWED_KEY));
  }, []);

  useEffect(() => {
    async function loadQuotes() {
      try {
        setError(null);
        const res = await fetch("/api/quotes", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load quotes (${res.status})`);
        }

        const data = (await res.json()) as QuotesResponse;
        const list = Array.isArray(data.quotes) ? data.quotes : [];
        setQuotes(list);

        const latest = list[0]?.created_at;
        if (latest) {
          localStorage.setItem(QUOTES_LAST_VIEWED_KEY, latest);
        }
      } catch (err) {
        console.error("Quotes load error", err);
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load quotes"
        );
      } finally {
        setLoading(false);
      }
    }

    loadQuotes();
  }, []);

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const unseenCutoff = useMemo(() => {
    if (!initialLastViewed) return null;
    const time = Date.parse(initialLastViewed);
    return Number.isNaN(time) ? null : time;
  }, [initialLastViewed]);

  const hasQuotes = quotes.length > 0;

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Quotes</h1>
          <p className="section-subtitle">
            Review, track, and open every quote in one place.
          </p>
        </div>
        <div className="tag">Live feed</div>
      </div>

      <div className="stack gap-4">
        {loading && <div className="empty-state">Loading your quotes…</div>}

        {error && !loading && <div className="empty-state">{error}</div>}

        {!loading && !error && !hasQuotes && (
          <div className="empty-state stack items-center">
            <h3 className="section-title">No quotes yet</h3>
            <p className="section-subtitle">Your quotes will appear here once created.</p>
          </div>
        )}

        {!loading && !error && hasQuotes && (
          <div className="stack gap-4">
            {quotes.map((quote) => {
              const isNew = unseenCutoff
                ? !!quote.created_at && Date.parse(quote.created_at) > unseenCutoff
                : true;

              const customerName = quote.customer_name?.trim() || "Unknown customer";
              const jobRef = quote.job_ref?.trim() || "Pending job reference";
              const createdDate = formatDate(quote.created_at) || "Date unavailable";
              const quoteLabel = quote.quote_reference || `Quote ${quote.id}`;

              return (
                <div key={quote.id} className="card quote-card">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="stack gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span className="tag">{quoteLabel}</span>
                        {isNew ? <span className="tag">New</span> : null}
                      </div>

                      <div className="stack gap-1">
                        <p className="text-lg font-semibold leading-tight text-white">{customerName}</p>
                        <p className="text-sm text-[var(--muted)]">Job: {jobRef}</p>
                      </div>

                      <p className="text-xs text-[var(--muted)]">Created {createdDate}</p>
                    </div>

                    <div className="flex flex-col gap-3 md:ml-auto md:flex-row md:items-center">
                      <div className="flex items-center justify-end gap-2">
                        <span className="status-pill">{quote.status || "Pending"}</span>
                      </div>

                      <Link
                        href={quote.pdf_url ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                      >
                        Open PDF
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
