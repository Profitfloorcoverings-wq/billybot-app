"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const CATEGORIES = ["materials", "labour", "equipment", "fuel", "other"] as const;
const STATUSES = ["pending", "extracted", "approved", "synced", "error"] as const;

const STATUS_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  pending: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", color: "#fbbf24", label: "Pending" },
  extracted: { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)", color: "#38bdf8", label: "Extracted" },
  approved: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.25)", color: "#34d399", label: "Approved" },
  synced: { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.25)", color: "#a78bfa", label: "Synced" },
  error: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)", color: "#f87171", label: "Error" },
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  materials: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.25)", color: "#fb923c", label: "Materials" },
  labour: { bg: "rgba(56,189,248,0.1)", border: "rgba(56,189,248,0.25)", color: "#38bdf8", label: "Labour" },
  equipment: { bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.25)", color: "#a78bfa", label: "Equipment" },
  fuel: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.25)", color: "#fbbf24", label: "Fuel" },
  other: { bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.25)", color: "#94a3b8", label: "Other" },
};

type Receipt = {
  id: string;
  client_id: string;
  job_id: string | null;
  supplier_name: string | null;
  description: string | null;
  amount_net: number | null;
  amount_vat: number | null;
  amount_total: number | null;
  currency: string;
  receipt_date: string | null;
  category: string;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  uploaded_via: string;
  ai_extracted: Record<string, unknown> | null;
  accounting_bill_id: string | null;
  accounting_synced_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
};

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<string>("materials");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts ?? []);
      }
    } catch (err) {
      console.error("Failed to load receipts:", err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("receipts-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "receipts" },
        () => void loadReceipts()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadReceipts]);

  const filtered = filterCategory
    ? receipts.filter((r) => r.category === filterCategory)
    : receipts;

  const totalAmount = filtered.reduce((sum, r) => sum + (r.amount_total ?? 0), 0);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("category", uploadCategory);
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      const res = await fetch("/api/receipts", { method: "POST", body: formData });
      if (res.ok) void loadReceipts();
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(receiptId: string) {
    const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
    if (res.ok) setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
  }

  async function handleApprove(receiptId: string) {
    const res = await fetch(`/api/receipts/${receiptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (res.ok) setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, status: "approved" } : r));
  }

  async function handleSync(receiptId: string) {
    setSyncing(receiptId);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/sync`, { method: "POST" });
      if (res.ok) setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, status: "synced" } : r));
    } finally {
      setSyncing(null);
    }
  }

  async function handleBulkApprove() {
    const ids = Array.from(selected).filter((id) => {
      const r = receipts.find((rec) => rec.id === id);
      return r?.status === "extracted";
    });
    await Promise.all(ids.map((id) => handleApprove(id)));
    setSelected(new Set());
  }

  async function handleBulkSync() {
    const ids = Array.from(selected).filter((id) => {
      const r = receipts.find((rec) => rec.id === id);
      return r?.status === "approved";
    });
    for (const id of ids) {
      await handleSync(id);
    }
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.id)));
    }
  }

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Receipts</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Capture and manage expense receipts. MTD-ready.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {!loading && filtered.length > 0 ? (
              <>
                <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1 }}>{filtered.length}</p>
                  <p style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Receipts</p>
                </div>
                <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" }}>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "#34d399", lineHeight: 1 }}>{"\u00A3"}{totalAmount.toFixed(2)}</p>
                  <p style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Total</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {/* Upload bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: "12px", padding: "12px 16px", marginBottom: "16px",
      }}>
        <select
          value={uploadCategory}
          onChange={(e) => setUploadCategory(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: "8px", padding: "7px 12px", fontSize: "13px", color: "#e2e8f0", cursor: "pointer",
          }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} style={{ background: "#1e293b" }}>{cat[0].toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          style={{ display: "none" }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            padding: "7px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
            background: uploading ? "rgba(249,115,22,0.2)" : "#f97316",
            color: uploading ? "#94a3b8" : "#fff",
            border: "none", cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "Uploading..." : "Upload Receipt"}
        </button>
      </div>

      {/* Filters + bulk actions */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px",
      }}>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: "8px", padding: "7px 12px", fontSize: "13px", color: "#e2e8f0", cursor: "pointer",
          }}
        >
          <option value="" style={{ background: "#1e293b" }}>All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} style={{ background: "#1e293b" }}>{cat[0].toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: "8px", padding: "7px 12px", fontSize: "13px", color: "#e2e8f0", cursor: "pointer",
          }}
        >
          <option value="" style={{ background: "#1e293b" }}>All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s} style={{ background: "#1e293b" }}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {selected.size > 0 ? (
          <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
            <span style={{ fontSize: "12px", color: "#94a3b8", alignSelf: "center" }}>{selected.size} selected</span>
            <button
              type="button"
              onClick={() => void handleBulkApprove()}
              style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "#34d399", color: "#0f172a", border: "none", cursor: "pointer" }}
            >
              Approve Selected
            </button>
            <button
              type="button"
              onClick={() => void handleBulkSync()}
              style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "#a78bfa", color: "#0f172a", border: "none", cursor: "pointer" }}
            >
              Sync Selected
            </button>
          </div>
        ) : null}
      </div>

      {/* Receipt list */}
      {loading ? (
        <p style={{ fontSize: "14px", color: "#64748b" }}>Loading receipts...</p>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: "14px",
        }}>
          <p style={{ fontSize: "32px", marginBottom: "8px" }}>🧾</p>
          <p style={{ fontSize: "15px", color: "#94a3b8", fontWeight: 600 }}>No receipts yet</p>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Upload a receipt image or send one via chat to get started.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "rgba(148,163,184,0.06)", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(148,163,184,0.1)" }}>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: "32px 1fr 100px 100px 100px 80px 80px",
            gap: "12px", padding: "10px 16px", background: "rgba(255,255,255,0.03)",
            fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", alignItems: "center",
          }}>
            <div>
              <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
            </div>
            <div>Receipt</div>
            <div>Amount</div>
            <div>Date</div>
            <div>Category</div>
            <div>Status</div>
            <div style={{ textAlign: "right" }}>Actions</div>
          </div>

          {filtered.map((receipt) => {
            const statusStyle = STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending;
            const catStyle = CATEGORY_STYLES[receipt.category] ?? CATEGORY_STYLES.other;

            return (
              <div
                key={receipt.id}
                style={{
                  display: "grid", gridTemplateColumns: "32px 1fr 100px 100px 100px 80px 80px",
                  gap: "12px", padding: "12px 16px", background: "rgba(255,255,255,0.02)",
                  alignItems: "center", fontSize: "13px",
                }}
              >
                <div>
                  <input type="checkbox" checked={selected.has(receipt.id)} onChange={() => toggleSelect(receipt.id)} style={{ cursor: "pointer" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  {receipt.signed_url ? (
                    <img
                      src={receipt.signed_url}
                      alt=""
                      style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{ width: "32px", height: "32px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                      🧾
                    </div>
                  )}
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {receipt.supplier_name || receipt.file_name || "Unknown"}
                    </p>
                    {receipt.description ? (
                      <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {receipt.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div style={{ fontWeight: 600, color: "#e2e8f0" }}>
                  {receipt.amount_total != null ? `\u00A3${receipt.amount_total.toFixed(2)}` : "\u2014"}
                </div>
                <div style={{ color: "#94a3b8" }}>
                  {receipt.receipt_date
                    ? new Date(receipt.receipt_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                    : "\u2014"}
                </div>
                <div>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                    background: catStyle.bg, border: `1px solid ${catStyle.border}`, color: catStyle.color,
                  }}>
                    {catStyle.label}
                  </span>
                </div>
                <div>
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                    background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.color,
                  }}>
                    {statusStyle.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                  {receipt.status === "extracted" ? (
                    <button
                      type="button"
                      onClick={() => void handleApprove(receipt.id)}
                      title="Approve"
                      style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "#34d399", color: "#0f172a", border: "none", cursor: "pointer" }}
                    >
                      ✓
                    </button>
                  ) : null}
                  {receipt.status === "approved" ? (
                    <button
                      type="button"
                      onClick={() => void handleSync(receipt.id)}
                      disabled={syncing === receipt.id}
                      title="Sync to accounting"
                      style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "#a78bfa", color: "#0f172a", border: "none", cursor: syncing === receipt.id ? "not-allowed" : "pointer" }}
                    >
                      ↗
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDelete(receipt.id)}
                    title="Delete"
                    style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, background: "rgba(239,68,68,0.12)", color: "#f87171", border: "none", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
