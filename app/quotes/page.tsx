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
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Quotes</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Review, track, and open every quote in one place.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {!loading && quotes.length > 0 && (
              <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" as const }}>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1 }}>{quotes.length}</p>
                <p style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Total</p>
              </div>
            )}
            {/* Live feed indicator */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 12px", borderRadius: "999px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#4ade80", letterSpacing: "0.04em" }}>Live feed</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {loading && <div className="empty-state">Loading your quotes…</div>}

        {error && !loading && <div className="empty-state" style={{ color: "#fca5a5" }}>{error}</div>}

        {!loading && !error && !hasQuotes && (
          <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>No quotes yet</h3>
            <p style={{ color: "#475569", fontSize: "14px" }}>Your quotes will appear here once created.</p>
          </div>
        )}

        {!loading && !error && hasQuotes && (
          <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Search row */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#475569", marginBottom: "8px" }}>
                  Search
                </p>
                <input
                  className="chat-input"
                  style={{ width: "100%" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by quote ID, customer, job, or date"
                />
              </div>
              <p style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap" as const }}>
                {hasFilteredQuotes ? `${filteredQuotes.length} showing` : "0 showing"}
              </p>
            </div>

            {hasFilteredQuotes ? (
              <div className="table-card">
                <div className="quotes-scrollbox">
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                        <tr>
                          <th>Quote</th>
                          <th>Customer</th>
                          <th>Job</th>
                          <th>Created</th>
                          <th className="sticky-cell" style={{ textAlign: "right" }} aria-label="Quote actions" />
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
                          const createdDate =
                            formatDate(quote.created_at) || "Date unavailable";
                          const quoteLabel = quote.quote_reference || `Quote ${quote.id}`;

                          return (
                            <tr key={quote.id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span style={{
                                    fontFamily: "monospace",
                                    fontSize: "12px",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(148,163,184,0.12)",
                                    color: "#94a3b8",
                                    letterSpacing: "0.02em",
                                  }}>
                                    {quoteLabel}
                                  </span>
                                  {isNew ? (
                                    <span style={{
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      letterSpacing: "0.06em",
                                      padding: "2px 7px",
                                      borderRadius: "999px",
                                      background: "rgba(56,189,248,0.12)",
                                      border: "1px solid rgba(56,189,248,0.25)",
                                      color: "#38bdf8",
                                      textTransform: "uppercase" as const,
                                    }}>
                                      New
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td>
                                <p style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9" }}>
                                  {customerName}
                                </p>
                              </td>
                              <td>
                                <span style={{ fontSize: "13px", color: "#64748b", display: "block", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={jobRef}>
                                  {jobRef}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>
                                  {createdDate}
                                </span>
                              </td>
                              <td className="sticky-cell">
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                  <Link
                                    href={quote.pdf_url ?? "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn btn-primary"
                                    style={{ fontSize: "12px", padding: "6px 16px", borderRadius: "999px" }}
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
