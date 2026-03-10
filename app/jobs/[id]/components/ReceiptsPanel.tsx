"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { ReceiptRecord } from "@/lib/jobs/getJobBundle";

const CATEGORIES = ["materials", "labour", "equipment", "fuel", "other"] as const;

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

type Receipt = ReceiptRecord & { signed_url?: string | null };

export default function ReceiptsPanel({ jobId }: { jobId: string }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>("materials");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = useCallback(async () => {
    try {
      const res = await fetch(`/api/receipts?job_id=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts ?? []);
      }
    } catch (err) {
      console.error("Failed to load receipts:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`receipts-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "receipts", filter: `job_id=eq.${jobId}` },
        () => void loadReceipts()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId, loadReceipts]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("job_id", jobId);
      formData.append("category", category);
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }
      const res = await fetch("/api/receipts", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setReceipts((prev) => [...(data.receipts ?? []), ...prev]);
      }
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(receiptId: string) {
    setDeleting(receiptId);
    try {
      const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
      if (res.ok) setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleApprove(receiptId: string) {
    try {
      const res = await fetch(`/api/receipts/${receiptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.ok) {
        setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, status: "approved" } : r));
      }
    } catch (err) {
      console.error("Approve error:", err);
    }
  }

  async function handleSync(receiptId: string) {
    setSyncing(receiptId);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/sync`, { method: "POST" });
      if (res.ok) {
        setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, status: "synced" } : r));
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(null);
    }
  }

  function startEdit(receipt: Receipt) {
    setEditingId(receipt.id);
    setEditValues({
      supplier_name: receipt.supplier_name ?? "",
      amount_net: receipt.amount_net?.toString() ?? "",
      amount_vat: receipt.amount_vat?.toString() ?? "",
      amount_total: receipt.amount_total?.toString() ?? "",
      receipt_date: receipt.receipt_date ?? "",
      category: receipt.category,
      description: receipt.description ?? "",
    });
  }

  async function handleSaveEdit(receiptId: string) {
    try {
      const res = await fetch(`/api/receipts/${receiptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_name: editValues.supplier_name || null,
          description: editValues.description || null,
          amount_net: editValues.amount_net ? parseFloat(editValues.amount_net) : null,
          amount_vat: editValues.amount_vat ? parseFloat(editValues.amount_vat) : null,
          amount_total: editValues.amount_total ? parseFloat(editValues.amount_total) : null,
          receipt_date: editValues.receipt_date || null,
          category: editValues.category,
        }),
      });
      if (res.ok) {
        const { receipt } = await res.json();
        setReceipts((prev) => prev.map((r) => r.id === receiptId ? { ...r, ...receipt } : r));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  }

  if (loading) {
    return <p style={{ fontSize: "14px", color: "#64748b" }}>Loading receipts...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Upload bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: "12px", padding: "12px 16px",
      }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: "8px", padding: "7px 12px", fontSize: "13px", color: "#e2e8f0",
            cursor: "pointer",
          }}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat} style={{ background: "#1e293b" }}>
              {cat[0].toUpperCase() + cat.slice(1)}
            </option>
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

      {/* Receipt list */}
      {receipts.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#64748b" }}>No receipts yet. Upload a receipt image to get started.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {receipts.map((receipt) => {
            const statusStyle = STATUS_STYLES[receipt.status] ?? STATUS_STYLES.pending;
            const catStyle = CATEGORY_STYLES[receipt.category] ?? CATEGORY_STYLES.other;
            const isExpanded = expandedId === receipt.id;
            const isEditing = editingId === receipt.id;

            return (
              <article
                key={receipt.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: "14px",
                  overflow: "hidden",
                }}
              >
                {/* Main row */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                >
                  {/* Thumbnail */}
                  {receipt.signed_url ? (
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "8px", overflow: "hidden",
                      flexShrink: 0, background: "rgba(255,255,255,0.05)",
                    }}>
                      <img
                        src={receipt.signed_url}
                        alt={receipt.file_name ?? "Receipt"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "8px", flexShrink: 0,
                      background: "rgba(255,255,255,0.05)", display: "flex",
                      alignItems: "center", justifyContent: "center", fontSize: "20px",
                    }}>
                      🧾
                    </div>
                  )}

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {receipt.supplier_name || receipt.file_name || "Unknown receipt"}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {receipt.amount_total != null ? (
                        <span style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0" }}>
                          {receipt.currency === "GBP" ? "\u00A3" : receipt.currency}{receipt.amount_total.toFixed(2)}
                        </span>
                      ) : null}
                      {receipt.receipt_date ? (
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {new Date(receipt.receipt_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                      background: catStyle.bg, border: `1px solid ${catStyle.border}`, color: catStyle.color,
                    }}>
                      {catStyle.label}
                    </span>
                    <span style={{
                      fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                      background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.color,
                    }}>
                      {statusStyle.label}
                    </span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded ? (
                  <div style={{
                    padding: "0 16px 14px",
                    borderTop: "1px solid rgba(148,163,184,0.08)",
                    paddingTop: "14px",
                  }}>
                    {isEditing ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Supplier</label>
                            <input
                              value={editValues.supplier_name ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, supplier_name: e.target.value }))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</label>
                            <input
                              type="date"
                              value={editValues.receipt_date ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, receipt_date: e.target.value }))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editValues.amount_net ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, amount_net: e.target.value }))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>VAT</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editValues.amount_vat ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, amount_vat: e.target.value }))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editValues.amount_total ?? ""}
                              onChange={(e) => setEditValues((v) => ({ ...v, amount_total: e.target.value }))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Category</label>
                            <select
                              value={editValues.category ?? "materials"}
                              onChange={(e) => setEditValues((v) => ({ ...v, category: e.target.value }))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                            >
                              {CATEGORIES.map((cat) => (
                                <option key={cat} value={cat} style={{ background: "#1e293b" }}>{cat[0].toUpperCase() + cat.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
                          <input
                            value={editValues.description ?? ""}
                            onChange={(e) => setEditValues((v) => ({ ...v, description: e.target.value }))}
                            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "8px", padding: "7px 10px", fontSize: "13px", color: "#e2e8f0", marginTop: "4px" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => void handleSaveEdit(receipt.id)}
                            style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "#34d399", color: "#0f172a", border: "none", cursor: "pointer" }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "rgba(148,163,184,0.15)", color: "#94a3b8", border: "none", cursor: "pointer" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {/* AI extracted data */}
                        {receipt.ai_extracted ? (
                          <div style={{
                            background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.12)",
                            borderRadius: "10px", padding: "12px 14px",
                          }}>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
                              AI Extracted
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" }}>
                              {Object.entries(receipt.ai_extracted).map(([key, value]) => (
                                <div key={key}>
                                  <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase" }}>{key.replace(/_/g, " ")}</span>
                                  <p style={{ fontSize: "13px", color: "#e2e8f0", margin: "2px 0 0" }}>{String(value)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Summary row */}
                        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: "#94a3b8" }}>
                          {receipt.description ? <span>{receipt.description}</span> : null}
                          {receipt.amount_net != null ? <span>Net: {"\u00A3"}{receipt.amount_net.toFixed(2)}</span> : null}
                          {receipt.amount_vat != null ? <span>VAT: {"\u00A3"}{receipt.amount_vat.toFixed(2)}</span> : null}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => startEdit(receipt)}
                            style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, background: "rgba(148,163,184,0.12)", color: "#94a3b8", border: "none", cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          {receipt.status === "extracted" ? (
                            <button
                              type="button"
                              onClick={() => void handleApprove(receipt.id)}
                              style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700, background: "#34d399", color: "#0f172a", border: "none", cursor: "pointer" }}
                            >
                              Approve
                            </button>
                          ) : null}
                          {receipt.status === "approved" ? (
                            <button
                              type="button"
                              onClick={() => void handleSync(receipt.id)}
                              disabled={syncing === receipt.id}
                              style={{
                                padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                                background: syncing === receipt.id ? "rgba(139,92,246,0.2)" : "#a78bfa",
                                color: syncing === receipt.id ? "#94a3b8" : "#0f172a",
                                border: "none", cursor: syncing === receipt.id ? "not-allowed" : "pointer",
                              }}
                            >
                              {syncing === receipt.id ? "Syncing..." : "Sync to Accounting"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleDelete(receipt.id)}
                            disabled={deleting === receipt.id}
                            style={{
                              padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                              background: "rgba(239,68,68,0.12)", color: "#f87171",
                              border: "none", cursor: deleting === receipt.id ? "not-allowed" : "pointer",
                              marginLeft: "auto",
                            }}
                          >
                            {deleting === receipt.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
