"use client";

import { useState, useCallback, useEffect, useRef } from "react";

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
  product_ref?: string;
  price_source?: "mid_range" | "supplier" | "manual";
  item_ref_value?: string;
  sales_account_code?: string;
  sales_ledger_account_id?: string;
};

type MidRangeProduct = {
  product_name: string | null;
  category: string | null;
  m2_price: number | null;
  price: number | null;
  uom: string | null;
  item_ref_value: string | null;
  sales_account_code: string | null;
  sales_ledger_account_id: string | null;
};

type Props = {
  conversationId: string;
  messageId?: string;
  initialLines?: LineItem[];
  initialDone?: boolean;
};

const TYPE_OPTIONS: { value: LineItemType; label: string }[] = [
  { value: "labour", label: "Labour" },
  { value: "materials", label: "Materials" },
  { value: "extra", label: "Extra" },
];

const UNIT_OPTIONS: { value: LineItemUnit; label: string }[] = [
  { value: "m2", label: "m\u00b2" },
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

/* ── Product Picker Combobox ── */

function ProductPicker({
  products,
  value,
  onSelect,
}: {
  products: MidRangeProduct[];
  value: string;
  onSelect: (product: MidRangeProduct) => void;
}) {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = products.filter(
    (p) =>
      p.product_name &&
      p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const grouped = new Map<string, MidRangeProduct[]>();
  for (const p of filtered) {
    const cat = p.category ?? "Other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(p);
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        style={INPUT_STYLE}
        type="text"
        placeholder="Search products…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: "240px",
            overflowY: "auto",
            background: "#1a2237",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            marginTop: "2px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {[...grouped.entries()].map(([cat, items]) => (
            <div key={cat}>
              <div
                style={{
                  padding: "4px 10px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#475569",
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {cat}
              </div>
              {items.map((p, i) => (
                <button
                  key={`${p.product_name}-${i}`}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setSearch(p.product_name ?? "");
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "none",
                    border: "none",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(249,115,22,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                  }}
                >
                  <span>{p.product_name}</span>
                  <span style={{ color: "#64748b", fontSize: "11px" }}>
                    {p.m2_price != null
                      ? `£${p.m2_price}/m²`
                      : p.price != null
                        ? `£${p.price}`
                        : ""}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */

export default function QuoteBuilderCard({ conversationId, messageId, initialLines = [], initialDone = false }: Props) {
  const [lines, setLines] = useState<LineItem[]>(
    initialLines.length > 0 ? initialLines : [emptyLine()]
  );
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(initialDone);
  const [error, setError] = useState<string | null>(null);

  // Product picker state
  const [midRangeProducts, setMidRangeProducts] = useState<MidRangeProduct[]>([]);
  const [accountingSystem, setAccountingSystem] = useState<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetch("/api/supplier-prices/mid-range")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.products) {
          setMidRangeProducts(res.products as MidRangeProduct[]);
        }
        if (res?.accounting_system) {
          setAccountingSystem(res.accounting_system as string);
        }
      });
  }, []);

  const hasAccounting =
    accountingSystem === "xero" ||
    accountingSystem === "quickbooks" ||
    accountingSystem === "sage";

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

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const vat = 0; // VAT applied server-side from pricing_settings
  const total = subtotal + vat;

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
      const res = await fetch("/api/quotes/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          lines,
          message_id: messageId ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Failed to generate quote.");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function handleProductSelect(lineId: string, product: MidRangeProduct) {
    const refBySystem =
      accountingSystem === "quickbooks" ? product.item_ref_value
      : accountingSystem === "xero" ? product.sales_account_code
      : accountingSystem === "sage" ? product.sales_ledger_account_id
      : product.item_ref_value ?? product.sales_account_code ?? product.sales_ledger_account_id;

    updateLine(lineId, {
      description: product.product_name ?? "",
      unit_price: product.m2_price ?? product.price ?? 0,
      unit: (product.uom as LineItemUnit) ?? "m2",
      product_ref: refBySystem ?? undefined,
      item_ref_value: product.item_ref_value ?? undefined,
      sales_account_code: product.sales_account_code ?? undefined,
      sales_ledger_account_id: product.sales_ledger_account_id ?? undefined,
      price_source: "mid_range",
    });
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
          <p style={{ margin: 0, fontWeight: 700, color: "#4ade80", fontSize: "14px" }}>Generating your quote…</p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "12px", marginTop: "2px" }}>Billy is building the PDF. It'll appear in chat shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: "min(600px, 100%)",
      borderRadius: "16px",
      border: "1px solid rgba(249,115,22,0.3)",
      background: "rgba(13,21,39,0.97)",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        background: "rgba(249,115,22,0.07)",
        borderRadius: "16px 16px 0 0",
      }}>
        <span style={{ fontSize: "16px" }}>🔧</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: "#f1f5f9", fontSize: "14px" }}>Custom Quote Builder</p>
          <p style={{ margin: 0, color: "#64748b", fontSize: "11px", marginTop: "1px" }}>
            {hasAccounting
              ? "Select products from your price list, then click Generate Quote"
              : "Add line items, then click Generate Quote"}
          </p>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 1fr 64px 72px 80px 28px",
        gap: "6px",
        padding: "8px 12px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        minWidth: "440px",
      }}>
        {["Type", "Description", "Qty", "Unit", "£ / unit", ""].map((h, i) => (
          <span key={i} style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569" }}>
            {h}
          </span>
        ))}
      </div>

      {/* Lines */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px", overflowX: "auto" }}>
        {lines.map((line) => (
          <div
            key={line.id}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 1fr 64px 72px 80px 28px",
              gap: "6px",
              alignItems: "center",
              minWidth: "440px",
            }}
          >
            {/* Type */}
            <select
              style={SELECT_STYLE}
              value={line.type}
              onChange={(e) => updateLine(line.id, { type: e.target.value as LineItemType })}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Description — product picker or free text */}
            {hasAccounting && line.type === "materials" && midRangeProducts.length > 0 ? (
              <ProductPicker
                products={midRangeProducts}
                value={line.description}
                onSelect={(p) => handleProductSelect(line.id, p)}
              />
            ) : (
              <input
                style={INPUT_STYLE}
                type="text"
                placeholder="e.g. Vinyl patch repair"
                value={line.description}
                onChange={(e) => updateLine(line.id, { description: e.target.value })}
              />
            )}

            {/* Qty */}
            <input
              style={{ ...INPUT_STYLE, textAlign: "right" }}
              type="number"
              min={0}
              step={0.1}
              value={line.quantity}
              onChange={(e) => updateLine(line.id, { quantity: parseFloat(e.target.value) || 0 })}
            />

            {/* Unit */}
            <select
              style={SELECT_STYLE}
              value={line.unit}
              onChange={(e) => updateLine(line.id, { unit: e.target.value as LineItemUnit })}
            >
              {UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {/* Unit price */}
            <input
              style={{ ...INPUT_STYLE, textAlign: "right" }}
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={line.unit_price === 0 ? "" : line.unit_price}
              onChange={(e) => updateLine(line.id, { unit_price: parseFloat(e.target.value) || 0, price_source: "manual" })}
            />

            {/* Remove */}
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

      {/* Footer: add + totals + generate */}
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
          onClick={(e) => { e.stopPropagation(); addLine(); }}
          style={{
            background: "none",
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: "8px",
            color: "#64748b",
            fontSize: "13px",
            padding: "7px 14px",
            cursor: "pointer",
            transition: "border-color 0.15s, color 0.15s",
            position: "relative",
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(249,115,22,0.4)";
            (e.currentTarget as HTMLButtonElement).style.color = "#f97316";
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
            <span style={{ fontSize: "12px", color: "#64748b" }}>Subtotal</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", minWidth: "80px", textAlign: "right" }}>
              £{subtotal.toFixed(2)}
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#475569" }}>VAT (applied by Billy)</span>
            <span style={{ fontSize: "12px", color: "#475569", minWidth: "80px", textAlign: "right" }}>—</span>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#f1f5f9" }}>Estimated Total</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: "#f97316", minWidth: "80px", textAlign: "right" }}>
              £{total.toFixed(2)}
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
              ? "linear-gradient(135deg, #f97316, #fb923c)"
              : "rgba(255,255,255,0.06)",
            color: canGenerate ? "#fff" : "#475569",
            fontSize: "14px",
            fontWeight: 800,
            cursor: canGenerate ? "pointer" : "not-allowed",
            boxShadow: canGenerate ? "0 0 18px rgba(249,115,22,0.4)" : "none",
            transition: "opacity 0.15s",
          }}
        >
          {generating ? "Generating…" : "Generate Quote"}
        </button>
      </div>
    </div>
  );
}
