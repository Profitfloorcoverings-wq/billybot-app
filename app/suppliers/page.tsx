"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const EMPTY_OPTION = "__all";

type SupplierPrice = {
  id: number | string;
  created_at: string | null;
  updated_at: string | null;
  client_id: string | null;
  supplier_name: string | null;
  product_name: string | null;
  category: string | null;
  uom: string | null;
  roll_price: number | null;
  cut_price: number | null;
  m2_price: number | null;
  price: number | null;
  price_per_m: number | null;
  price_source: string | null;
  product_id: string | null;
  item_ref_value: string | null;
  width_m: number | null;
  length_m: number | null;
  format: string | null;
};

type SupplierPricesResponse = {
  prices?: SupplierPrice[];
};

type SupplierPriceUpdate = {
  price: string;
  roll_price: string;
  cut_price: string;
  m2_price: string;
  price_per_m: string;
  width_m: string;
  length_m: string;
  format: string;
};

type ViewMode = "table" | "cards";

const normalizeRealtime = (price: SupplierPrice | null) => {
  if (!price) return null;
  const itemRefValue = (price as SupplierPrice & { "ItemRef.value"?: string | null })[
    "ItemRef.value"
  ];
  return {
    ...price,
    item_ref_value: itemRefValue ?? price.item_ref_value ?? null,
  };
};

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `£${Number(value).toFixed(2)}`;
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function getBestPrice(p: SupplierPrice): number | null {
  return p.m2_price ?? p.price ?? p.roll_price ?? p.cut_price ?? p.price_per_m ?? null;
}

export default function SuppliersPricingPage() {
  const [prices, setPrices] = useState<SupplierPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState(EMPTY_OPTION);
  const [categoryFilter, setCategoryFilter] = useState(EMPTY_OPTION);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editValues, setEditValues] = useState<SupplierPriceUpdate | null>(null);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const processingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPrices = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/supplier-prices", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load supplier prices (${res.status})`);
      }

      const data = (await res.json()) as SupplierPricesResponse;
      const list = Array.isArray(data.prices) ? data.prices : [];
      setPrices(list);
    } catch (err) {
      console.error("Supplier prices load error", err);
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to load supplier prices"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data?.user?.id) setProfileId(data.user.id);
      })
      .catch((err) => {
        console.error("Supabase user fetch error", err);
      });
  }, []);

  useEffect(() => {
    if (!profileId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`supplier-prices-${profileId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "supplier_prices",
          filter: `client_id=eq.${profileId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIsProcessing(false);
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current);
              processingTimeoutRef.current = null;
            }
          }

          setPrices((prev) => {
            const next = [...prev];
            const incoming = normalizeRealtime(payload.new as SupplierPrice | null);
            const old = normalizeRealtime(payload.old as SupplierPrice | null);

            if (payload.eventType === "DELETE") {
              return prev.filter((item) => item.id !== old?.id);
            }

            if (!incoming?.id) return prev;

            const index = next.findIndex((item) => item.id === incoming.id);
            if (index === -1) {
              next.unshift(incoming);
              return next;
            }

            next[index] = { ...next[index], ...incoming };
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current);
        processingTimeoutRef.current = null;
      }
    };
  }, [profileId]);

  // ── File handling ──

  const sanitizeValue = (value: string) =>
    value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "");

  const sanitizeFilename = (filename: string) => {
    const trimmed = filename.trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) return sanitizeValue(trimmed);
    const name = sanitizeValue(trimmed.slice(0, lastDot));
    const ext = sanitizeValue(trimmed.slice(lastDot + 1));
    return ext ? `${name}.${ext}` : name;
  };

  const isAllowedFile = (file: File) => {
    const allowedExts = ["pdf", "csv", "xls", "xlsx"];
    const type = file.type?.toLowerCase() ?? "";
    if (
      type === "application/pdf" ||
      type === "text/csv" ||
      type === "application/vnd.ms-excel" ||
      type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      type === "application/csv" ||
      type === "text/plain"
    ) {
      return true;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    return allowedExts.includes(ext);
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;
    setUploadMessage(null);
    setUploadError(null);

    if (!profileId) {
      setUploadError("Unable to determine client ID. Please refresh and try again.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File is too large. Maximum size is 25MB.");
      return;
    }
    if (!isAllowedFile(file)) {
      setUploadError("Unsupported file type. Upload PDF, CSV, XLS, or XLSX.");
      return;
    }

    const originalFilename = sanitizeFilename(file.name);
    const uploadPath = `raw/${profileId}/${crypto.randomUUID()}-${originalFilename}`;
    setIsUploading(true);

    try {
      const supabase = createClient();
      const { error: uploadErr } = await supabase.storage
        .from("price_lists")
        .upload(uploadPath, file, { upsert: false, contentType: file.type || undefined });

      if (uploadErr) throw new Error(uploadErr.message);

      const webhookRes = await fetch(
        "https://tradiebrain.app.n8n.cloud/webhook/v1/suppliers/price-lists/ingest",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: profileId,
            supplier_id: "unknown",
            supplier_name: null,
            file: {
              bucket: "price_lists",
              path: uploadPath,
              mime_type: file.type,
              original_filename: file.name,
            },
          }),
        }
      );

      if (!webhookRes.ok) {
        setUploadError("Upload succeeded but processing failed. Please try again.");
        return;
      }

      setIsProcessing(true);
      setUploadMessage(null);

      if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false);
        processingTimeoutRef.current = null;
      }, 15 * 60 * 1000);
    } catch (err) {
      console.error("Supplier price list upload error", err);
      setUploadError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Upload failed. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ── Inline editing ──

  const startEdit = (price: SupplierPrice) => {
    if (savingId) return;
    setEditingId(price.id);
    setEditValues({
      price: price.price?.toString() ?? "",
      roll_price: price.roll_price?.toString() ?? "",
      cut_price: price.cut_price?.toString() ?? "",
      m2_price: price.m2_price?.toString() ?? "",
      price_per_m: price.price_per_m?.toString() ?? "",
      width_m: price.width_m?.toString() ?? "",
      length_m: price.length_m?.toString() ?? "",
      format: price.format ?? "",
    });
  };

  const cancelEdit = () => {
    if (savingId) return;
    setEditingId(null);
    setEditValues(null);
  };

  const updateField = (field: keyof SupplierPriceUpdate, value: string) => {
    if (!editValues) return;
    setEditValues({ ...editValues, [field]: value });
  };

  const toNumberOrNull = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const n = value.trim();
    if (!n) return null;
    const parsed = Number(n);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const saveEdit = async (price: SupplierPrice) => {
    if (!editValues || savingId) return;
    const normalized = {
      price: toNumberOrNull(editValues.price),
      roll_price: toNumberOrNull(editValues.roll_price),
      cut_price: toNumberOrNull(editValues.cut_price),
      m2_price: toNumberOrNull(editValues.m2_price),
      price_per_m: toNumberOrNull(editValues.price_per_m),
      width_m: toNumberOrNull(editValues.width_m),
      length_m: toNumberOrNull(editValues.length_m),
      format: editValues.format.trim() || null,
    };
    setError(null);
    setSavingId(price.id);
    const previous = prices;
    setPrices((prev) =>
      prev.map((item) =>
        item.id === price.id ? { ...item, ...normalized, updated_at: new Date().toISOString() } : item
      )
    );

    try {
      const res = await fetch(`/api/supplier-prices/${price.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error || `Failed to update (${res.status})`);
      }
      const data = (await res.json()) as { price?: SupplierPrice };
      if (data.price) {
        setPrices((prev) => prev.map((item) => (item.id === price.id ? data.price! : item)));
      }
      setEditingId(null);
      setEditValues(null);
      await loadPrices();
    } catch (err) {
      console.error("Supplier price update error", err);
      setPrices(previous);
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to update supplier price"
      );
    } finally {
      setSavingId(null);
    }
  };

  const deletePrice = async (price: SupplierPrice) => {
    setDeletingId(price.id);
    setError(null);
    const previous = prices;
    setPrices((prev) => prev.filter((item) => item.id !== price.id));

    try {
      const res = await fetch(`/api/supplier-prices/${price.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body?.error || `Failed to delete (${res.status})`);
      }
    } catch (err) {
      console.error("Supplier price delete error", err);
      setPrices(previous);
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to delete supplier price"
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ── Derived data ──

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    prices.forEach((p) => { if (p.supplier_name) names.add(p.supplier_name); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [prices]);

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    prices.forEach((p) => { if (p.category) cats.add(p.category); });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [prices]);

  const supplierSummaries = useMemo(() => {
    const map = new Map<string, { count: number; categories: Set<string>; latest: string | null }>();
    prices.forEach((p) => {
      const name = p.supplier_name || "Unknown";
      const existing = map.get(name);
      if (existing) {
        existing.count++;
        if (p.category) existing.categories.add(p.category);
        if (p.updated_at && (!existing.latest || p.updated_at > existing.latest)) existing.latest = p.updated_at;
      } else {
        const cats = new Set<string>();
        if (p.category) cats.add(p.category);
        map.set(name, { count: 1, categories: cats, latest: p.updated_at });
      }
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, categories: Array.from(data.categories) }))
      .sort((a, b) => b.count - a.count);
  }, [prices]);

  const filteredPrices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prices.filter((price) => {
      if (supplierFilter !== EMPTY_OPTION && price.supplier_name !== supplierFilter) return false;
      if (categoryFilter !== EMPTY_OPTION && price.category !== categoryFilter) return false;
      if (!query) return true;
      return [price.supplier_name, price.product_name, price.category, price.product_id, price.item_ref_value]
        .some((v) => v?.toLowerCase().includes(query));
    });
  }, [prices, search, supplierFilter, categoryFilter]);

  const hasPrices = prices.length > 0;

  // ── Drag and drop ──

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    void handleFileChange(file);
  };

  // ── Render ──

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Supplier Pricing</h1>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
              Upload, search, and manage your supplier price lists.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {!loading && hasPrices && (
              <>
                <StatBadge value={prices.length} label="Products" color="#38bdf8" />
                <StatBadge value={supplierOptions.length} label="Suppliers" color="#a78bfa" />
                <StatBadge value={categoryOptions.length} label="Categories" color="#34d399" />
              </>
            )}
            {/* Live indicator */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "999px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#4ade80" }}>Live</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Upload card with drag-and-drop */}
        <div
          className="card"
          style={{
            padding: "24px",
            border: isDragOver ? "2px dashed #38bdf8" : "1px solid rgba(255,255,255,0.06)",
            background: isDragOver ? "rgba(56,189,248,0.04)" : undefined,
            transition: "all 0.15s",
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px",
              }}>
                📄
              </div>
              <div>
                <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", marginBottom: "3px" }}>Upload a price list</p>
                <p style={{ fontSize: "13px", color: "#64748b" }}>
                  Drag and drop or click to browse. Supports <strong style={{ color: "#94a3b8" }}>PDF, CSV, XLS, XLSX</strong> up to 25MB.
                </p>
              </div>
            </div>
            <div>
              <button
                className="btn btn-primary"
                onClick={() => { setUploadMessage(null); setUploadError(null); fileInputRef.current?.click(); }}
                disabled={isUploading}
                style={{ whiteSpace: "nowrap" }}
              >
                {isUploading ? "Uploading…" : "Browse files"}
              </button>
              <input
                ref={fileInputRef}
                style={{ display: "none" }}
                type="file"
                accept=".pdf,.csv,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  void handleFileChange(file);
                  e.currentTarget.value = "";
                }}
                disabled={isUploading}
              />
            </div>
          </div>
          {isProcessing && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#38bdf8", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: "10px", padding: "10px 14px", marginTop: "14px" }}>
              <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(56,189,248,0.3)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Processing price list… Products will appear below as they&apos;re imported.
            </div>
          )}
          {uploadMessage && !isProcessing && (
            <p style={{ fontSize: "13px", color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "10px 14px", marginTop: "14px", margin: "14px 0 0" }}>
              {uploadMessage}
            </p>
          )}
          {uploadError && (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginTop: "14px", margin: "14px 0 0" }}>
              {uploadError}
            </p>
          )}
        </div>

        {/* Supplier summary cards */}
        {!loading && hasPrices && supplierSummaries.length > 0 && (
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
            {supplierSummaries.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  setSupplierFilter(supplierFilter === s.name ? EMPTY_OPTION : s.name);
                  setCategoryFilter(EMPTY_OPTION);
                }}
                style={{
                  flex: "0 0 auto", minWidth: "160px", padding: "14px 18px",
                  borderRadius: "12px", cursor: "pointer", textAlign: "left",
                  background: supplierFilter === s.name ? "rgba(56,189,248,0.08)" : "rgba(255,255,255,0.02)",
                  border: supplierFilter === s.name ? "1px solid rgba(56,189,248,0.25)" : "1px solid rgba(255,255,255,0.06)",
                  transition: "all 0.15s",
                }}
              >
                <p style={{ fontSize: "15px", fontWeight: 700, color: supplierFilter === s.name ? "#38bdf8" : "#f1f5f9", margin: "0 0 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.name}
                </p>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    <strong style={{ color: "#94a3b8", fontWeight: 600 }}>{s.count}</strong> products
                  </span>
                  <span style={{ fontSize: "11px", color: "#475569" }}>{formatRelative(s.latest)}</span>
                </div>
                {s.categories.length > 0 && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>
                    {s.categories.slice(0, 3).map((cat) => (
                      <span key={cat} style={{
                        fontSize: "10px", padding: "2px 7px", borderRadius: "6px",
                        background: "rgba(148,163,184,0.08)", color: "#94a3b8",
                        border: "1px solid rgba(148,163,184,0.12)",
                      }}>
                        {cat}
                      </span>
                    ))}
                    {s.categories.length > 3 && (
                      <span style={{ fontSize: "10px", color: "#475569" }}>+{s.categories.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "48px 24px" }}>
            <div style={{ fontSize: "28px", animation: "pulse-soft 1.5s ease-in-out infinite" }}>📦</div>
            <span style={{ color: "#64748b", fontSize: "14px" }}>Loading supplier prices…</span>
          </div>
        )}
        {error && !loading && <div className="empty-state" style={{ color: "#fca5a5" }}>{error}</div>}

        {!loading && !error && !hasPrices && (
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "56px 24px" }}>
            <div style={{ fontSize: "40px", opacity: 0.3 }}>📦</div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>No supplier prices yet</h3>
            <p style={{ color: "#64748b", fontSize: "14px", margin: 0, textAlign: "center", maxWidth: "400px" }}>
              Upload a price list above and your products will appear here once processed. BillyBot will extract product names, prices, and categories automatically.
            </p>
          </div>
        )}

        {!loading && !error && hasPrices && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Search & filter bar */}
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{ flex: "1 1 220px", minWidth: "180px", position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: "#475569", pointerEvents: "none" }}>🔍</span>
                  <input
                    className="chat-input"
                    style={{ width: "100%", paddingLeft: "34px", fontSize: "13px" }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products, suppliers, categories…"
                  />
                </div>
                {/* Supplier filter */}
                <select
                  style={selectStyle}
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  <option value={EMPTY_OPTION}>All suppliers</option>
                  {supplierOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {/* Category filter */}
                <select
                  style={selectStyle}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value={EMPTY_OPTION}>All categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {/* View toggle */}
                <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    style={{
                      padding: "7px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
                      background: viewMode === "table" ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.02)",
                      color: viewMode === "table" ? "#38bdf8" : "#64748b",
                    }}
                  >
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    style={{
                      padding: "7px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
                      background: viewMode === "cards" ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.02)",
                      color: viewMode === "cards" ? "#38bdf8" : "#64748b",
                    }}
                  >
                    Cards
                  </button>
                </div>
                {/* Count */}
                <span style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" }}>
                  {filteredPrices.length} of {prices.length}
                </span>
                {/* Clear filters */}
                {(supplierFilter !== EMPTY_OPTION || categoryFilter !== EMPTY_OPTION || search.trim()) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setSupplierFilter(EMPTY_OPTION); setCategoryFilter(EMPTY_OPTION); }}
                    style={{
                      fontSize: "12px", color: "#f87171", background: "transparent", border: "none",
                      cursor: "pointer", fontWeight: 600, padding: "4px 0",
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {filteredPrices.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "40px 24px" }}>
                <div style={{ fontSize: "28px", opacity: 0.3, marginBottom: "8px" }}>🔍</div>
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>No products match your filters.</p>
              </div>
            ) : viewMode === "table" ? (
              /* ── Table view ── */
              <div className="table-card scrollable-table">
                <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowX: "auto", overflowY: "auto" }}>
                  <table className="data-table">
                    <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ minWidth: "120px" }}>Supplier</th>
                        <th style={{ minWidth: "180px" }}>Product</th>
                        <th>Category</th>
                        <th>Format</th>
                        <th>Each</th>
                        <th>Roll £/m²</th>
                        <th>Cut £/m²</th>
                        <th>£/m²</th>
                        <th>£/m</th>
                        <th>W (m)</th>
                        <th>L (m)</th>
                        <th>Updated</th>
                        <th className="sticky-cell" style={{ minWidth: "140px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrices.map((price) => {
                        const isEditing = editingId === price.id;
                        const isSaving = savingId === price.id;
                        const isDeleting = deletingId === price.id;

                        return (
                          <tr key={price.id} style={{ opacity: isDeleting ? 0.4 : 1, transition: "opacity 0.2s" }}>
                            <td>
                              <span style={{ fontSize: "13px", color: "#94a3b8" }}>{price.supplier_name || "—"}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: "14px", color: "#f1f5f9", fontWeight: 500 }}>{price.product_name || "Untitled"}</span>
                            </td>
                            <td>
                              {price.category ? (
                                <span style={{
                                  fontSize: "11px", padding: "2px 8px", borderRadius: "6px",
                                  background: "rgba(148,163,184,0.08)", color: "#94a3b8",
                                  border: "1px solid rgba(148,163,184,0.12)",
                                }}>{price.category}</span>
                              ) : <span style={{ color: "#475569" }}>—</span>}
                            </td>
                            <td>
                              {isEditing ? (
                                <select
                                  className="input-fluid supplierPriceInput"
                                  style={{ color: "#f1f5f9", fontWeight: 500, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.15)", borderRadius: "6px", padding: "4px 8px", fontSize: "12px" }}
                                  value={editValues?.format ?? ""}
                                  onChange={(e) => updateField("format", e.target.value)}
                                >
                                  <option value="">—</option>
                                  <option value="roll">Roll</option>
                                  <option value="tile">Tile</option>
                                  <option value="plank">Plank</option>
                                  <option value="sheet">Sheet</option>
                                </select>
                              ) : (
                                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{price.format ? price.format.charAt(0).toUpperCase() + price.format.slice(1) : "—"}</span>
                              )}
                            </td>
                            {/* Price cells */}
                            {(["price", "roll_price", "cut_price", "m2_price", "price_per_m"] as const).map((field) => (
                              <td key={field}>
                                {isEditing ? (
                                  <input
                                    className="input-fluid supplierPriceInput"
                                    style={{ color: "#f1f5f9", fontWeight: 500, width: "70px" }}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={editValues?.[field] ?? ""}
                                    onChange={(e) => updateField(field, e.target.value)}
                                  />
                                ) : (
                                  <span style={{ color: price[field] !== null ? "#f1f5f9" : "#475569", fontWeight: price[field] !== null ? 500 : 400, fontVariantNumeric: "tabular-nums" }}>
                                    {formatCurrency(price[field])}
                                  </span>
                                )}
                              </td>
                            ))}
                            {/* Width / Length */}
                            {(["width_m", "length_m"] as const).map((field) => (
                              <td key={field}>
                                {isEditing ? (
                                  <input
                                    className="input-fluid supplierPriceInput"
                                    style={{ color: "#f1f5f9", fontWeight: 500, width: "55px" }}
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={editValues?.[field] ?? ""}
                                    onChange={(e) => updateField(field, e.target.value)}
                                  />
                                ) : (
                                  <span style={{ color: price[field] !== null ? "#e2e8f0" : "#475569", fontSize: "13px" }}>
                                    {price[field] !== null ? price[field] : "—"}
                                  </span>
                                )}
                              </td>
                            ))}
                            <td>
                              <span style={{ fontSize: "12px", color: "#475569" }}>{formatRelative(price.updated_at || price.created_at)}</span>
                            </td>
                            <td className="sticky-cell">
                              {isSaving ? (
                                <span style={{ fontSize: "12px", color: "#64748b" }}>Saving…</span>
                              ) : isEditing ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button className="btn btn-primary" style={{ fontSize: "11px", padding: "5px 12px" }} onClick={() => saveEdit(price)}>Save</button>
                                  <button className="btn btn-secondary" style={{ fontSize: "11px", padding: "5px 12px" }} onClick={cancelEdit}>Cancel</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button className="btn btn-secondary" style={{ fontSize: "11px", padding: "5px 12px" }} onClick={() => startEdit(price)} disabled={!!editingId}>Edit</button>
                                  <button
                                    type="button"
                                    onClick={() => deletePrice(price)}
                                    disabled={!!editingId || isDeleting}
                                    style={{
                                      fontSize: "11px", padding: "5px 10px", borderRadius: "8px", cursor: "pointer",
                                      background: "transparent", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171",
                                      opacity: editingId ? 0.3 : 1,
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* ── Card view ── */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {filteredPrices.map((price) => {
                  const bestPrice = getBestPrice(price);
                  const isDeleting = deletingId === price.id;
                  return (
                    <div
                      key={price.id}
                      className="card"
                      style={{
                        padding: "16px 18px", opacity: isDeleting ? 0.4 : 1,
                        transition: "opacity 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "10px" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {price.product_name || "Untitled"}
                          </p>
                          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
                            {price.supplier_name || "Unknown supplier"}
                          </p>
                        </div>
                        {bestPrice !== null && (
                          <span style={{
                            fontSize: "16px", fontWeight: 700, color: "#38bdf8", whiteSpace: "nowrap",
                            fontVariantNumeric: "tabular-nums",
                          }}>
                            {formatCurrency(bestPrice)}
                          </span>
                        )}
                      </div>
                      {/* Tags */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "10px" }}>
                        {price.category && (
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "6px", background: "rgba(148,163,184,0.08)", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.12)" }}>
                            {price.category}
                          </span>
                        )}
                        {price.format && (
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "6px", background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.12)" }}>
                            {price.format.charAt(0).toUpperCase() + price.format.slice(1)}
                          </span>
                        )}
                        {price.uom && (
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "6px", background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.12)" }}>
                            {price.uom}
                          </span>
                        )}
                      </div>
                      {/* Price breakdown */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", marginBottom: "10px" }}>
                        {price.price !== null && <PriceRow label="Each" value={price.price} />}
                        {price.roll_price !== null && <PriceRow label="Roll £/m²" value={price.roll_price} />}
                        {price.cut_price !== null && <PriceRow label="Cut £/m²" value={price.cut_price} />}
                        {price.m2_price !== null && <PriceRow label="£/m²" value={price.m2_price} />}
                        {price.price_per_m !== null && <PriceRow label="£/m" value={price.price_per_m} />}
                        {price.width_m !== null && <DimRow label="Width" value={`${price.width_m}m`} />}
                        {price.length_m !== null && <DimRow label="Length" value={`${price.length_m}m`} />}
                      </div>
                      {/* Footer */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#475569" }}>{formatRelative(price.updated_at || price.created_at)}</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-secondary" style={{ fontSize: "11px", padding: "4px 10px" }} onClick={() => startEdit(price)} disabled={!!editingId}>Edit</button>
                          <button
                            type="button"
                            onClick={() => deletePrice(price)}
                            disabled={isDeleting}
                            style={{
                              fontSize: "11px", padding: "4px 10px", borderRadius: "8px", cursor: "pointer",
                              background: "transparent", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171",
                            }}
                          >
                            Delete
                          </button>
                        </div>
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

// ── Small components ──

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: `${color}11`, border: `1px solid ${color}26`,
      borderRadius: "10px", padding: "6px 14px", textAlign: "center",
      minWidth: "56px",
    }}>
      <p style={{ fontSize: "18px", fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "11px", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "12px", color: "#e2e8f0", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>£{Number(value).toFixed(2)}</span>
    </div>
  );
}

function DimRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "11px", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "12px", color: "#94a3b8" }}>{value}</span>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(148,163,184,0.15)",
  borderRadius: "10px",
  color: "#94a3b8",
  fontSize: "13px",
  padding: "9px 14px",
  outline: "none",
  cursor: "pointer",
  minWidth: "140px",
};
