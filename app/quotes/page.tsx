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
  const [search, setSearch] = useState("");

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

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    const query = search.toLowerCase();

    return quotes.filter((quote) => {
      const idLabel = (quote.quote_reference || `Quote ${quote.id || ""}`)
        .toString()
        .toLowerCase();
      const customer = quote.customer_name?.toLowerCase() || "";
      const job = quote.job_ref?.toLowerCase() || "";
      const rawDate = quote.created_at?.toLowerCase() || "";
      const formattedDate = formatDate(quote.created_at).toLowerCase();

      return [idLabel, customer, job, rawDate, formattedDate].some((value) =>
        value.includes(query)
      );
    });
  }, [quotes, search]);

  const hasQuotes = quotes.length > 0;
  const hasFilteredQuotes = filteredQuotes.length > 0;

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
            <div className="card stack">
              <div className="stack md:row md:items-center md:justify-between">
                <div className="stack">
                  <p className="section-subtitle">Search</p>
                  <input
                    className="input-fluid"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by quote ID, customer, job, or date"
                  />
                </div>

                <div className="tag">
                  {hasFilteredQuotes ? `${filteredQuotes.length} showing` : "0 showing"}
                </div>
              </div>
            </div>

            {hasFilteredQuotes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredQuotes.map((quote) => {
                  const isNew = unseenCutoff
                    ? !!quote.created_at && Date.parse(quote.created_at) > unseenCutoff
                    : true;

                  const customerName = quote.customer_name?.trim() || "Unknown customer";
                  const jobRef = quote.job_ref?.trim() || "No job description";
                  const createdDate = formatDate(quote.created_at) || "Date unavailable";
                  const quoteLabel = quote.quote_reference || `Quote ${quote.id}`;

                  return (
                    <article
                      key={quote.id}
                      className="quote-card flex flex-col"
                    >
                      <header className="flex items-center justify-between mb-1">
                        <span className="tag text-xs">Q-{quoteLabel}</span>
                        {isNew && <span className="tag text-xs">New</span>}
                      </header>

                      <div className="flex-1 flex flex-col gap-1">
                        <p className="font-semibold text-base text-white">{customerName}</p>
                        <p className="text-sm text-[var(--muted)]">{jobRef}</p>
                        <p className="text-xs text-[var(--muted)]">Created {createdDate}</p>
                      </div>

                      <footer className="pt-2">
                        <Link
                          href={quote.pdf_url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary w-full text-center"
                        >
                          Open PDF
                        </Link>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">No quotes match your search.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
