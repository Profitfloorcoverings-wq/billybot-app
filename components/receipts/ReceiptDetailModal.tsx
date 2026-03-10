"use client";

import { createPortal } from "react-dom";
import { STATUS_STYLES, CATEGORY_STYLES } from "@/lib/receipts/constants";

type Receipt = {
  id: string;
  supplier_name: string | null;
  description: string | null;
  amount_net: number | null;
  amount_vat: number | null;
  amount_total: number | null;
  currency: string;
  receipt_date: string | null;
  category: string;
  file_name: string | null;
  ai_extracted: Record<string, unknown> | null;
  status: string;
  signed_url?: string | null;
};

type Props = {
  receipt: Receipt;
  canApprove: boolean;
  syncing: string | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(148,163,184,0.1)",
      borderRadius: "12px",
      padding: "16px 18px",
    }}>
      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "10px" }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export default function ReceiptDetailModal({ receipt, canApprove, syncing, onClose, onApprove, onSync, onDelete }: Props) {
  const statusStyle = STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending;
  const catStyle = CATEGORY_STYLES[receipt.category] ?? CATEGORY_STYLES.other;
  const currency = receipt.currency === "GBP" ? "\u00A3" : receipt.currency;

  const items = receipt.ai_extracted?.items;
  const hasLineItems = Array.isArray(items) && items.length > 0;

  const modal = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.75)", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-sheet" style={{ maxWidth: "720px", width: "100%", maxHeight: "90vh", overflow: "auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "20px" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3, margin: "0 0 8px" }}>
              {receipt.supplier_name || receipt.file_name || "Receipt"}
            </h2>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <span style={{
                fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.color,
              }}>
                {statusStyle.label}
              </span>
              <span style={{
                fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                background: catStyle.bg, border: `1px solid ${catStyle.border}`, color: catStyle.color,
              }}>
                {catStyle.label}
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close" aria-label="Close">×</button>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Left — image */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {receipt.signed_url ? (
              <a href={receipt.signed_url} target="_blank" rel="noopener noreferrer" style={{ display: "block" }}>
                <img
                  src={receipt.signed_url}
                  alt={receipt.file_name ?? "Receipt"}
                  style={{
                    width: "100%", maxHeight: "450px", objectFit: "contain",
                    borderRadius: "10px", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(148,163,184,0.1)", cursor: "zoom-in",
                  }}
                />
              </a>
            ) : (
              <div style={{
                width: "100%", height: "200px", borderRadius: "10px",
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px",
              }}>
                🧾
              </div>
            )}
          </div>

          {/* Right — details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

            {/* Info */}
            <Section label="Details">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {receipt.supplier_name ? (
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Supplier</span>
                    <p style={{ fontSize: "14px", color: "#e2e8f0", margin: "2px 0 0", fontWeight: 600 }}>{receipt.supplier_name}</p>
                  </div>
                ) : null}
                {receipt.receipt_date ? (
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Date</span>
                    <p style={{ fontSize: "14px", color: "#e2e8f0", margin: "2px 0 0" }}>
                      {new Date(receipt.receipt_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                ) : null}
                {receipt.description ? (
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Description</span>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: "2px 0 0" }}>{receipt.description}</p>
                  </div>
                ) : null}
                {receipt.ai_extracted?.payment_method ? (
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Payment Method</span>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: "2px 0 0" }}>{String(receipt.ai_extracted.payment_method)}</p>
                  </div>
                ) : null}
              </div>
            </Section>

            {/* Line items or key-value extracted data */}
            {receipt.ai_extracted ? (
              <Section label="AI Extracted">
                {hasLineItems ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.12)" }}>
                          <th style={{ textAlign: "left", padding: "4px 6px", color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Item</th>
                          <th style={{ textAlign: "right", padding: "4px 6px", color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Qty</th>
                          <th style={{ textAlign: "right", padding: "4px 6px", color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Unit</th>
                          <th style={{ textAlign: "right", padding: "4px 6px", color: "#64748b", fontWeight: 700, fontSize: "10px", textTransform: "uppercase" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(items as Array<Record<string, unknown>>).map((item, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                            <td style={{ padding: "6px", color: "#e2e8f0" }}>{String(item.description ?? item.name ?? "")}</td>
                            <td style={{ padding: "6px", color: "#94a3b8", textAlign: "right" }}>{item.qty != null ? String(item.qty) : item.quantity != null ? String(item.quantity) : ""}</td>
                            <td style={{ padding: "6px", color: "#94a3b8", textAlign: "right" }}>{item.unit_price != null ? `${currency}${Number(item.unit_price).toFixed(2)}` : ""}</td>
                            <td style={{ padding: "6px", color: "#e2e8f0", textAlign: "right", fontWeight: 600 }}>{item.total != null ? `${currency}${Number(item.total).toFixed(2)}` : item.line_total != null ? `${currency}${Number(item.line_total).toFixed(2)}` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "6px" }}>
                    {Object.entries(receipt.ai_extracted)
                      .filter(([key]) => key !== "items")
                      .map(([key, value]) => (
                        <div key={key}>
                          <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>{key.replace(/_/g, " ")}</span>
                          <p style={{ fontSize: "13px", color: "#e2e8f0", margin: "2px 0 0" }}>{String(value)}</p>
                        </div>
                      ))}
                  </div>
                )}
              </Section>
            ) : null}

            {/* Totals */}
            <Section label="Totals">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {receipt.amount_net != null ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>Net</span>
                    <span style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 600 }}>{currency}{receipt.amount_net.toFixed(2)}</span>
                  </div>
                ) : null}
                {receipt.amount_vat != null ? (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>VAT</span>
                    <span style={{ fontSize: "13px", color: "#e2e8f0", fontWeight: 600 }}>{currency}{receipt.amount_vat.toFixed(2)}</span>
                  </div>
                ) : null}
                {receipt.amount_total != null ? (
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(148,163,184,0.1)", paddingTop: "6px", marginTop: "2px" }}>
                    <span style={{ fontSize: "14px", color: "#f1f5f9", fontWeight: 700 }}>Total</span>
                    <span style={{ fontSize: "14px", color: "#f1f5f9", fontWeight: 700 }}>{currency}{receipt.amount_total.toFixed(2)}</span>
                  </div>
                ) : null}
              </div>
            </Section>
          </div>
        </div>

        {/* Action bar */}
        <div className="form-actions" style={{ marginTop: "24px" }}>
          {canApprove && receipt.status === "extracted" ? (
            <button
              type="button"
              onClick={() => onApprove(receipt.id)}
              className="btn"
              style={{ flex: 1, background: "#34d399", color: "#0f172a", fontWeight: 700, border: "none" }}
            >
              Approve
            </button>
          ) : null}
          {canApprove && receipt.status === "approved" ? (
            <button
              type="button"
              onClick={() => onSync(receipt.id)}
              disabled={syncing === receipt.id}
              className="btn"
              style={{
                flex: 1,
                background: syncing === receipt.id ? "rgba(139,92,246,0.2)" : "#a78bfa",
                color: syncing === receipt.id ? "#94a3b8" : "#0f172a",
                fontWeight: 700, border: "none",
                cursor: syncing === receipt.id ? "not-allowed" : "pointer",
              }}
            >
              {syncing === receipt.id ? "Syncing..." : "Sync to Accounting"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this receipt? This cannot be undone.")) {
                onDelete(receipt.id);
              }
            }}
            className="btn"
            style={{ flex: 1, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
          >
            Delete
          </button>
        </div>

        {/* Responsive: stack columns on narrow screens */}
        <style>{`
          @media (max-width: 600px) {
            .modal-sheet > div:nth-child(2) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
