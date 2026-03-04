"use client";

import { useState, useCallback } from "react";

export type LineItemType = "labour" | "materials" | "extra";
export type LineItemUnit = "m2" | "m" | "sheet" | "unit" | "flat";

export type LineItem = {
  id: string;
  type: LineItemType;
  description: string;
  quantity: number;
  unit: LineItemUnit;
  unit_price: number;
  total: number;
};

type InvoiceType = "full" | "deposit";

type Props = {
  conversationId: string;
  initialLines?: LineItem[];
  quoteId?: string;
  quoteReference?: string;
  customerName?: string;
  billingEmail?: string;
  billingAddress?: string;
};

const TYPE_OPTIONS: { value: LineItemType; label: string }[] = [
  { value: "labour", label: "Labour" },
  { value: "materials", label: "Materials" },
  { value: "extra", label: "Extra" },
];

const UNIT_OPTIONS: { value: LineItemUnit; label: string }[] = [
  { value: "m2", label: "m²" },
  { value: "m", label: "m" },
  { value: "sheet", label: "Sheet" },
  { value: "unit", label: "Unit" },
  { value: "flat", label: "Flat" },
];

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function emptyLine(): LineItem {
  return {
    id: genId(),
    type: "labour",
    description: "",
    quantity: 1,
    unit: "m2",
    unit_price: 0,
    total: 0,
  };
}

const SELECT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "13px",
  padding: "6px 8px",
  outline: "none",
  width: "100%",
  cursor: "pointer",
};

const INPUT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#e2e8f0",
  fontSize: "13px",
  padding: "6px 8px",
  outline: "none",
  width: "100%",
};

export default function InvoiceBuilderCard({
  conversationId,
  initialLines = [],
  quoteId,
  customerName,
  billingEmail: initialBillingEmail = "",
  billingAddress: initialBillingAddress = "",
}: Props) {
  const [lines, setLines] = useState<LineItem[]>(
    initialLines.length > 0 ? initialLines : [emptyLine()]
  );
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("full");
  const [depositPct, setDepositPct] = useState<number>(50);
  const [billingEmail, setBillingEmail] = useState(initialBillingEmail);
  const [billingAddress, setBillingAddress] = useState(initialBillingAddress);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateLine = useCallback((id: string, patch: Partial<LineItem>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...patch };
        updated.total = parseFloat((updated.quantity * updated.unit_price).toFixed(2));
        return updated;
      })
    );
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, emptyLine()]);
  }, []);

  const removeLine = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const linesSubtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const depositAmount = invoiceType === "deposit"
    ? parseFloat(((linesSubtotal * depositPct) / 100).toFixed(2))
    : linesSubtotal;

  const canGenerate =
    !generating &&
    !done &&
    lines.length > 0 &&
    lines.some((l) => l.description.trim().length > 0 && l.unit_price > 0);

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/invoices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          quote_id: quoteId,
          lines,
          invoice_type: invoiceType,
          deposit_percentage: invoiceType === "deposit" ? depositPct : null,
          billing_email: billingEmail || undefined,
          billing_address: billingAddress || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Failed to generate invoice.");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  if (done) {
    return (
      <div style={{
        width: "min(560px, 100%)",
        borderRadius: "16px",
        border: "1px solid rgba(34,197,94,0.25)",
        background: "rgba(34,197,94,0.06)",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}>
        <span style={{ fontSize: "22px" }}>✅</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: "#4ade80", fontSize: "14px" }}>Generating your invoice…</p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "12px", marginTop: "2px" }}>Billy is building it now. It'll appear in chat shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: "min(620px, 100%)",
      borderRadius: "16px",
      border: "1px solid rgba(56,189,248,0.3)",
      background: "rgba(13,21,39,0.97)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "rgba(56,189,248,0.07)",
      }}>
        <span style={{ fontSize: "16px" }}>🧾</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: "14px" }}>
            Invoice Builder{customerName ? ` — ${customerName}` : ""}
          </p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "11px", marginTop: "1px" }}>
            Review line items, choose invoice type, then click Generate Invoice
          </p>
        </div>
      </div>

      {/* Invoice type + deposit */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>Invoice Type</span>
          <div style={{ display: "flex", gap: "6px" }}>
            {(["full", "deposit"] as InvoiceType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setInvoiceType(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: invoiceType === t ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(255,255,255,0.1)",
                  background: invoiceType === t ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.04)",
                  color: invoiceType === t ? "#38bdf8" : "#64748b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t === "full" ? "Full Invoice" : "Deposit Invoice"}
              </button>
            ))}
          </div>
        </div>

        {invoiceType === "deposit" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>Deposit %</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                style={{ ...INPUT_STYLE, width: "72px", textAlign: "right" }}
                type="number"
                min={1}
                max={100}
                step={1}
                value={depositPct}
                onChange={(e) => setDepositPct(Math.max(1, Math.min(100, parseInt(e.target.value) || 50)))}
              />
              <span style={{ fontSize: "13px", color: "#64748b" }}>% = <strong style={{ color: "#f97316" }}>£{depositAmount.toFixed(2)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Billing details */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>Billing Email</span>
          <input
            style={INPUT_STYLE}
            type="email"
            placeholder="customer@example.com"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
          />
        </div>
        <div style={{ flex: 2, minWidth: "220px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>Billing Address</span>
          <textarea
            style={{ ...INPUT_STYLE, resize: "none", height: "54px", fontFamily: "inherit" }}
            placeholder="123 Street, City, Postcode"
            value={billingAddress}
            onChange={(e) => setBillingAddress(e.target.value)}
          />
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr 64px 72px 80px 28px",
        gap: "6px",
        padding: "8px 12px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {["Type", "Description", "Qty", "Unit", "£ / unit", ""].map((h, i) => (
          <span key={i} style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>
            {h}
          </span>
        ))}
      </div>

      {/* Lines */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {lines.map((line) => (
          <div
            key={line.id}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 64px 72px 80px 28px",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <select
              style={SELECT_STYLE}
              value={line.type}
              onChange={(e) => updateLine(line.id, { type: e.target.value as LineItemType })}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <input
              style={INPUT_STYLE}
              type="text"
              placeholder="e.g. LVT supply and fit"
              value={line.description}
              onChange={(e) => updateLine(line.id, { description: e.target.value })}
            />

            <input
              style={{ ...INPUT_STYLE, textAlign: "right" }}
              type="number"
              min={0}
              step={0.1}
              value={line.quantity}
              onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
            />

            <select
              style={SELECT_STYLE}
              value={line.unit}
              onChange={(e) => updateLine(line.id, { unit: e.target.value as LineItemUnit })}
            >
              {UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <input
              style={{ ...INPUT_STYLE, textAlign: "right" }}
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={line.unit_price === 0 ? "" : line.unit_price}
              onChange={(e) => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0 })}
            />

            <button
              type="button"
              onClick={() => removeLine(line.id)}
              style={{
                background: "none",
                border: "none",
                color: "#475569",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
                padding: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Remove line"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 12px 14px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
      }}>
        <button
          type="button"
          onClick={addLine}
          style={{
            background: "none",
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: "8px",
            color: "#64748b",
            fontSize: "13px",
            padding: "7px 14px",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(56,189,248,0.4)";
            (e.currentTarget as HTMLButtonElement).style.color = "#38bdf8";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
            (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
          }}
        >
          + Add Line
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Lines subtotal</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", minWidth: "80px", textAlign: "right" }}>
              £{linesSubtotal.toFixed(2)}
            </span>
          </div>
          {invoiceType === "deposit" && (
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Deposit ({depositPct}%)</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#f97316", minWidth: "80px", textAlign: "right" }}>
                £{depositAmount.toFixed(2)}
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#475569" }}>VAT (applied by Billy)</span>
            <span style={{ fontSize: "12px", color: "#475569", minWidth: "80px", textAlign: "right" }}>—</span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>Invoice Amount</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#38bdf8", minWidth: "80px", textAlign: "right" }}>
              £{depositAmount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <p style={{ margin: "0 12px 10px", fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 12px" }}>
          {error}
        </p>
      ) : null}

      <div style={{ padding: "0 12px 14px" }}>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canGenerate}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "none",
            background: canGenerate
              ? "linear-gradient(135deg, #0369a1, #0ea5e9)"
              : "rgba(255,255,255,0.06)",
            color: canGenerate ? "#fff" : "#475569",
            fontSize: "14px",
            fontWeight: 800,
            cursor: canGenerate ? "pointer" : "not-allowed",
            boxShadow: canGenerate ? "0 0 18px rgba(56,189,248,0.4)" : "none",
            transition: "opacity 0.15s",
          }}
        >
          {generating ? "Generating…" : "Generate Invoice"}
        </button>
      </div>
    </div>
  );
}
