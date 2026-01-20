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

  const openPdf = (url?: string | null) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Quotes</h1>
          <p className="section-subtitle">
            Review, track, and open every quote in one place.
          </p>
        </div>
        <span className="btn btn-secondary btn-small">Live feed</span>
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
              <div className="table-card scrollable-table">
                <div className="relative w-full max-h-[70vh] overflow-y-auto">
                  <table className="data-table">
                    <thead className="sticky top-0 z-10 bg-[var(--card)]">
                      <tr>
                        <th className="md:hidden">Quote</th>
                        <th className="hidden md:table-cell">Quote ID</th>
                        <th className="hidden md:table-cell">Customer</th>
                        <th className="hidden md:table-cell">Job / Title</th>
                        <th className="hidden md:table-cell">Created</th>
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
                        const rowClickable = Boolean(quote.pdf_url);

                        return (
                          <tr
                            key={quote.id}
                            className={rowClickable ? "cursor-pointer" : undefined}
                            role={rowClickable ? "link" : undefined}
                            tabIndex={rowClickable ? 0 : -1}
                            onClick={() => openPdf(quote.pdf_url)}
                            onKeyDown={(event) => {
                              if (!rowClickable) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openPdf(quote.pdf_url);
                              }
                            }}
                          >
                            <td className="md:hidden">
                              <div className="stack gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-[15px] font-semibold text-white">
                                    {customerName}
                                  </p>
                                  <span className="tag font-mono text-[10px]">
                                    {quoteLabel}
                                  </span>
                                  {isNew ? <span className="tag">New</span> : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                                  <span
                                    className="truncate max-w-[220px]"
                                    title={jobRef}
                                  >
                                    {jobRef}
                                  </span>
                                  <span>•</span>
                                  <span>{createdDate}</span>
                                </div>
                              </div>
                            </td>

                            <td className="hidden md:table-cell">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="tag font-mono text-[10px]">
                                  {quoteLabel}
                                </span>
                                {isNew ? <span className="tag">New</span> : null}
                              </div>
                            </td>
                            <td className="hidden md:table-cell">
                              <p className="text-[15px] font-semibold text-white">
                                {customerName}
                              </p>
                            </td>
                            <td className="hidden md:table-cell">
                              <span
                                className="text-sm text-[var(--muted)] truncate block max-w-[260px]"
                                title={jobRef}
                              >
                                {jobRef}
                              </span>
                            </td>
                            <td className="hidden md:table-cell">
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
                                  onClick={(event) => event.stopPropagation()}
                                  className="btn btn-secondary btn-small rounded-full px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,23,42,0.92)]"
                                >
                                  Open PDF
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
