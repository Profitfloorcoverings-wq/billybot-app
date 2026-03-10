"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { ReceiptRecord } from "@/lib/jobs/getJobBundle";
import { CATEGORIES, STATUS_STYLES, CATEGORY_STYLES } from "@/lib/receipts/constants";
import ReceiptDetailModal from "@/components/receipts/ReceiptDetailModal";

type Receipt = ReceiptRecord & { signed_url?: string | null };

export default function ReceiptsPanel({ jobId }: { jobId: string }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<string>("materials");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [canApprove, setCanApprove] = useState(true);
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("clients").select("user_role").eq("id", user.id).maybeSingle().then(({ data }) => {
        const role = data?.user_role ?? "owner";
        setCanApprove(role === "owner" || role === "manager");
      });
    });
  }, []);

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

            return (
              <article
                key={receipt.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: "14px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
                onClick={() => setDetailReceipt(receipt)}
              >
                {/* Main row */}
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px",
                  }}
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
              </article>
            );
          })}
        </div>
      )}

      {detailReceipt ? (
        <ReceiptDetailModal
          receipt={detailReceipt}
          canApprove={canApprove}
          syncing={syncing}
          onClose={() => setDetailReceipt(null)}
          onApprove={(id) => { void handleApprove(id); setDetailReceipt((prev) => prev ? { ...prev, status: "approved" } : null); }}
          onSync={(id) => void handleSync(id)}
          onDelete={(id) => { void handleDelete(id); setDetailReceipt(null); }}
        />
      ) : null}
    </div>
  );
}
