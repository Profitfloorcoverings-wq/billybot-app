"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatTimestamp } from "./helpers";
import type { JobPageData } from "./types";

function isBespoke(quoteJson?: string | null): boolean {
  if (!quoteJson) return false;
  try {
    const parsed = JSON.parse(quoteJson) as { type?: string };
    return parsed.type === "bespoke";
  } catch {
    return false;
  }
}

export default function QuotesPanel({ quotes, jobId }: { quotes: JobPageData["quotes"]; jobId: string }) {
  const router = useRouter();
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
  if (!quotes.length) {
    return (
      <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>No quotes linked to this job yet.</p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {toast && (
        <div className="toast" style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 100 }}>
          {toast}
        </div>
      )}
      {quotes.map((quote) => (
        <article
          key={quote.id}
          style={{
            borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.03)", padding: "16px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                {quote.quote_reference || `Quote ${quote.id.slice(0, 8)}`}
              </h3>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Version {quote.version ?? 1} · {formatTimestamp(quote.created_at)}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "3px 8px",
                borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)",
              }}>
                {quote.quote_status || "draft"}
              </span>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "3px 8px",
                borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                background: "rgba(255,255,255,0.05)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)",
              }}>
                Follow-up: {quote.follow_up_status || "none"}
              </span>
              {quote.possibleMatch && (
                <span style={{
                  display: "inline-flex", alignItems: "center", padding: "3px 8px",
                  borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                  background: "rgba(249,115,22,0.12)", color: "#fb923c", border: "1px solid rgba(249,115,22,0.25)",
                }}>
                  Possible match
                </span>
              )}
              {isBespoke(quote.quote) && (
                <span style={{
                  display: "inline-flex", alignItems: "center", padding: "3px 8px",
                  borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                  background: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.25)",
                }}>
                  Bespoke
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
            {quote.pdf_url && (
              <a
                href={quote.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px" }}
              >
                View PDF
              </a>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
              onClick={() => navigator.clipboard.writeText(quote.quote_reference || quote.id)}
            >
              Copy reference
            </button>
            <Link
              href={`/quotes/${quote.id}`}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Open quote
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: "6px 12px", fontSize: "12px" }}
              disabled={invoicingQuoteId === quote.id}
              onClick={() => handleCreateInvoice(quote.id)}
            >
              {invoicingQuoteId === quote.id ? "Creating…" : "Create Invoice"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
