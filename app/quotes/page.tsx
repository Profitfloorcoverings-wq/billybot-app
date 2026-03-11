"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  quote?: string | null;
};

function isBespoke(quoteJson?: string | null): boolean {
  if (!quoteJson) return false;
  try {
    const parsed = JSON.parse(quoteJson) as { type?: string };
    return parsed.type === "bespoke";
  } catch {
    return false;
  }
}

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type QuotesResponse = {
  quotes?: Quote[];
};

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialLastViewed, setInitialLastViewed] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [invoicingQuoteId, setInvoicingQuoteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCreateInvoice(quoteId: string) {
    setInvoicingQuoteId(quoteId);
    try {
      const convRes = await fetch("/api/conversations/latest");
      const convData = convRes.ok ? (await convRes.json()) as { conversation_id?: string } : {};
      const conversationId = convData.conversation_id ?? "";

      if (!conversationId) {
        showToast("No conversation found — go to chat first.");
        return;
      }

      const res = await fetch("/api/invoices/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId, conversation_id: conversationId }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        showToast(data.error ?? "Failed to initiate invoice");
        return;
      }

      router.push(`/chat?conversation_id=${conversationId}`);
    } catch {
      showToast("Failed to initiate invoice");
    } finally {
      setInvoicingQuoteId(null);
    }
  }

  useEffect(() => {
    setInitialLastViewed(localStorage.getItem(QUOTES_LAST_VIEWED_KEY));
  }, []);

  useEffect(() => {
    async function loadQuotes() {
      try {
        setError(null);
        const res = await fetch("/api/quotes", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load quotes (${res.status})`);
        const data = (await res.json()) as QuotesResponse;
        const list = Array.isArray(data.quotes) ? data.quotes : [];
        setQuotes(list);
        const latest = list[0]?.created_at;
        if (latest) localStorage.setItem(QUOTES_LAST_VIEWED_KEY, latest);
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

  const filteredQuotes = useMemo(() => {
    if (!search.trim()) return quotes;
    const query = search.toLowerCase();
    return quotes.filter((quote) => {
      const idLabel = (quote.quote_reference || `Quote ${quote.id || ""}`).toString().toLowerCase();
      const customer = quote.customer_name?.toLowerCase() || "";
      const job = quote.job_ref?.toLowerCase() || "";
      return [idLabel, customer, job].some((v) => v.includes(query));
    });
  }, [quotes, search]);

  const unseenCutoff = useMemo(() => {
    if (!initialLastViewed) return null;
    const time = Date.parse(initialLastViewed);
    return Number.isNaN(time) ? null : time;
  }, [initialLastViewed]);

  const newCount = useMemo(() => {
    if (!unseenCutoff) return 0;
    return quotes.filter((q) => q.created_at && Date.parse(q.created_at) > unseenCutoff).length;
  }, [quotes, unseenCutoff]);

  const bespokeCount = quotes.filter((q) => isBespoke(q.quote)).length;
  const hasQuotes = quotes.length > 0;

  return (
    <div className="page-container">
      {toast && (
        <div className="toast" style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 100 }}>
          {toast}
        </div>
      )}
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Quotes</h1>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
              Review, download, and invoice from every quote BillyBot has generated.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {!loading && hasQuotes && (
              <>
                <StatBadge value={quotes.length} label="Total" color="#38bdf8" />
                {newCount > 0 && <StatBadge value={newCount} label="New" color="#34d399" />}
                {bespokeCount > 0 && <StatBadge value={bespokeCount} label="Bespoke" color="#fb923c" />}
              </>
            )}
            {/* Live feed indicator */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#4ade80" }}>Live</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {loading && (
          <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "48px 24px" }}>
            <div style={{ fontSize: "28px", animation: "pulse-soft 1.5s ease-in-out infinite" }}>📄</div>
            <span style={{ color: "#64748b", fontSize: "14px" }}>Loading quotes…</span>
          </div>
        )}

        {error && !loading && <div className="empty-state" style={{ color: "#fca5a5" }}>{error}</div>}

        {!loading && !error && !hasQuotes && (
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "56px 24px" }}>
            <div style={{ fontSize: "40px", opacity: 0.3 }}>📄</div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>No quotes yet</h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: 0, textAlign: "center", maxWidth: "400px" }}>
              Your quotes will appear here once BillyBot generates them from chat. Ask Billy to create a quote to get started.
            </p>
            <Link href="/chat" className="btn btn-primary" style={{ marginTop: "4px" }}>
              Go to Chat
            </Link>
          </div>
        )}

        {!loading && !error && hasQuotes && (
          <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Search row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#475569", pointerEvents: "none" }}>🔍</span>
                <input
                  className="chat-input"
                  style={{ width: "100%", paddingLeft: "34px" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by reference, customer, or job…"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                  {filteredQuotes.length} of {quotes.length}
                </span>
                {search.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    style={{ fontSize: "12px", color: "#f87171", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {filteredQuotes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 24px" }}>
                <div style={{ fontSize: "24px", opacity: 0.3, marginBottom: "8px" }}>🔍</div>
                <p style={{ color: "#64748b", fontSize: "14px" }}>No quotes match your search.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredQuotes.map((quote) => {
                  const isNew = unseenCutoff
                    ? !!quote.created_at && Date.parse(quote.created_at) > unseenCutoff
                    : true;
                  const customerName = quote.customer_name?.trim() || "Unknown customer";
                  const jobRef = quote.job_ref?.trim() || "";
                  const quoteLabel = quote.quote_reference || `Quote ${quote.id}`;
                  const bespoke = isBespoke(quote.quote);
                  const initials = getInitials(customerName);

                  return (
                    <div
                      key={quote.id}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px",
                        padding: "14px 16px", borderRadius: "12px",
                        background: isNew ? "rgba(56,189,248,0.03)" : "rgba(255,255,255,0.02)",
                        border: isNew ? "1px solid rgba(56,189,248,0.12)" : "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.15s",
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                        background: bespoke ? "rgba(249,115,22,0.1)" : "rgba(56,189,248,0.1)",
                        border: bespoke ? "1px solid rgba(249,115,22,0.2)" : "1px solid rgba(56,189,248,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "14px", fontWeight: 700,
                        color: bespoke ? "#fb923c" : "#38bdf8",
                      }}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "3px" }}>
                          <span style={{
                            fontFamily: "monospace", fontSize: "12px", padding: "2px 8px",
                            borderRadius: "6px", background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(148,163,184,0.12)", color: "#94a3b8",
                          }}>
                            {quoteLabel}
                          </span>
                          {isNew && (
                            <span style={{
                              fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px",
                              background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)",
                              color: "#34d399", textTransform: "uppercase", letterSpacing: "0.06em",
                            }}>
                              New
                            </span>
                          )}
                          {bespoke && (
                            <span style={{
                              fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px",
                              background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)",
                              color: "#fb923c", textTransform: "uppercase", letterSpacing: "0.06em",
                            }}>
                              Bespoke
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>{customerName}</span>
                        {jobRef && (
                          <span style={{ fontSize: "12px", color: "#64748b", display: "block", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "400px" }}>
                            {jobRef}
                          </span>
                        )}
                      </div>

                      {/* Time */}
                      <span style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatRelative(quote.created_at)}
                      </span>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "999px" }}
                          disabled={invoicingQuoteId === String(quote.id)}
                          onClick={() => handleCreateInvoice(String(quote.id))}
                        >
                          {invoicingQuoteId === String(quote.id) ? "Creating…" : "Invoice"}
                        </button>
                        {quote.pdf_url && (
                          <Link
                            href={quote.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-primary"
                            style={{ fontSize: "11px", padding: "5px 12px", borderRadius: "999px" }}
                          >
                            PDF
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: `${color}11`, border: `1px solid ${color}26`,
      borderRadius: "10px", padding: "6px 14px", textAlign: "center" as const,
      minWidth: "56px",
    }}>
      <p style={{ fontSize: "18px", fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}
