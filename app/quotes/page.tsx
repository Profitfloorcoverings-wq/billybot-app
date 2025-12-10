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

      <div className="card stack">
        {loading && <div className="empty-state">Loading your quotes…</div>}

        {error && !loading && <div className="empty-state">{error}</div>}

        {!loading && !error && !hasQuotes && (
          <div className="empty-state stack items-center">
            <h3 className="section-title">No quotes yet</h3>
            <p className="section-subtitle">Your quotes will appear here once created.</p>
          </div>
        )}

        {!loading && !error && hasQuotes && (
          <div className="table-card">
            <div className="hidden md:grid grid-cols-[1.2fr_1fr_1fr_auto] bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              <span>Quote</span>
              <span>Date</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            {quotes.map((quote) => {
              const isNew = unseenCutoff
                ? !!quote.created_at && Date.parse(quote.created_at) > unseenCutoff
                : true;

              return (
                <div
                  key={quote.id}
                  className="list-row md:grid md:grid-cols-[1.2fr_1fr_1fr_auto] w-full"
                >
                  <div className="stack gap-1">
                    <p className="text-[15px] font-semibold text-white">
                      {quote.quote_reference || "Pending reference"}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {quote.customer_name || "Unknown customer"}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {quote.job_ref || "No job reference"}
                    </p>
                    <p className="text-sm text-[var(--muted)] md:hidden">{formatDate(quote.created_at)}</p>
                  </div>

                  <p className="text-sm text-[var(--muted)] hidden md:block">
                    {formatDate(quote.created_at)}
                  </p>

                  <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <span className="status-pill">{quote.status || "Pending"}</span>
                    {isNew ? <span className="tag">New</span> : null}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={quote.pdf_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                    >
                      Open PDF
                    </Link>
                    <span className="text-[var(--muted)]">→</span>
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
