"use client";

import { useEffect, useMemo, useState } from "react";

const QUOTES_LAST_VIEWED_KEY = "quotes_last_viewed_at";

type Quote = {
  id: string | number;
  quote_reference?: string | null;
  pdf_url?: string | null;
  client_id?: string | null;
  created_at?: string | null;
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

  return (
    <div className="quotes-page">
      <header className="quotes-header">
        <div>
          <p className="quotes-kicker">Documents</p>
          <h1 className="quotes-title">Quotes</h1>
          <p className="quotes-subtitle">Review, track, and open every quote in one place.</p>
        </div>
        <div className="quotes-badge">Live feed</div>
      </header>

      <section className="quotes-grid">
        {loading && <div className="quotes-empty">Loading your quotes…</div>}
        {error && !loading && <div className="quotes-error">{error}</div>}
        {!loading && !error && quotes.length === 0 && (
          <div className="quotes-empty">No quotes yet. They’ll appear here automatically.</div>
        )}

        {!loading && !error &&
          quotes.map((quote) => {
            const isNew = unseenCutoff
              ? !!quote.created_at && Date.parse(quote.created_at) > unseenCutoff
              : true;

            return (
              <article key={quote.id} className="quote-card">
                <div className="quote-card-top">
                  <div>
                    <div className="quote-label">Quote</div>
                    <h2 className="quote-ref">{quote.quote_reference || "Pending ref"}</h2>
                    <p className="quote-meta">{formatDate(quote.created_at)}</p>
                  </div>
                  {isNew ? <span className="quote-pill">New</span> : null}
                </div>

                <p className="quote-note">
                  Ready to download and share with your customer. Stored under the profile
                  linked to this conversation.
                </p>

                <div className="quote-actions">
                  <a
                    href={quote.pdf_url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="quote-link"
                  >
                    Open PDF
                  </a>
                  <span className="quote-client">Client ID: {quote.client_id ?? "Unknown"}</span>
                </div>
              </article>
            );
          })}
      </section>
    </div>
  );
}
