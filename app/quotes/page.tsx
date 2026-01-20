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

  const unseenCutoff = useMemo(() => {
    if (!initialLastViewed) return null;
    const time = Date.parse(initialLastViewed);
    return Number.isNaN(time) ? null : time;
  }, [initialLastViewed]);

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
          <div className="card stack gap-4">
            <div className="stack md:row md:items-end md:justify-between gap-3">
              <div className="stack flex-1">
                <p className="section-subtitle">Search</p>
                <input
                  className="input-fluid"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by quote ID, customer, job, or date"
                />
              </div>
              <p className="text-xs text-[var(--muted)] md:text-right">
                {hasFilteredQuotes ? `${filteredQuotes.length} showing` : "0 showing"}
              </p>
            </div>

            {hasFilteredQuotes ? (
              <div
                className="table-card max-h-[calc(100vh-360px)] overflow-y-auto"
                style={{ scrollbarGutter: "stable" }}
              >
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead className="sticky top-0 z-10 bg-[var(--card)]">
                      <tr>
                        <th>Quote</th>
                        <th>Customer</th>
                        <th>Job</th>
                        <th>Created</th>
                        <th className="sticky-cell text-right" aria-label="Quote actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((quote) => {
                        const isNew = unseenCutoff
                          ? !!quote.created_at && Date.parse(quote.created_at) > unseenCutoff
                          : true;
                        const customerName =
                          quote.customer_name?.trim() || "Unknown customer";
                        const jobRef = quote.job_ref?.trim() || "No job description";
                        const createdDate = formatDate(quote.created_at) || "Date unavailable";
                        const quoteLabel = quote.quote_reference || `Quote ${quote.id}`;

                        return (
                          <tr key={quote.id}>
                            <td>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                                <span className="tag font-mono text-[10px]">
                                  {quoteLabel}
                                </span>
                                {isNew ? <span className="tag">New</span> : null}
                              </div>
                            </td>
                            <td>
                              <p className="text-[15px] font-semibold text-white">
                                {customerName}
                              </p>
                            </td>
                            <td>
                              <span
                                className="text-sm text-[var(--muted)] truncate block max-w-[260px]"
                                title={jobRef}
                              >
                                {jobRef}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-[var(--muted)]">
                                {createdDate}
                              </span>
                            </td>
                            <td className="sticky-cell">
                              <div className="flex items-center justify-end">
                                <Link
                                  href={quote.pdf_url ?? "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-primary btn-small rounded-full px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,23,42,0.92)]"
                                >
                                  Open quote
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
