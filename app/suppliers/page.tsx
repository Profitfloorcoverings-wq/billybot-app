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
};

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
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        if (data?.user?.id) {
          setProfileId(data.user.id);
        }
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
    };
  }, [profileId]);

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

  const formatValue = (value?: number | string | null) => {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    return value;
  };

  const sanitizeValue = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "");

  const sanitizeFilename = (filename: string) => {
    const trimmed = filename.trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0) {
      return sanitizeValue(trimmed);
    }
    const name = sanitizeValue(trimmed.slice(0, lastDot));
    const extension = sanitizeValue(trimmed.slice(lastDot + 1));
    if (!extension) return name;
    return `${name}.${extension}`;
  };

  const isAllowedFile = (file: File) => {
    const allowedExtensions = ["pdf", "csv", "xls", "xlsx"];
    const type = file.type?.toLowerCase() ?? "";
    if (type) {
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
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return allowedExtensions.includes(extension);
  };

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    prices.forEach((price) => {
      if (price.supplier_name) names.add(price.supplier_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [prices]);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    prices.forEach((price) => {
      if (price.category) categories.add(price.category);
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [prices]);

  const filteredPrices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return prices.filter((price) => {
      if (supplierFilter !== EMPTY_OPTION && price.supplier_name !== supplierFilter) {
        return false;
      }
      if (categoryFilter !== EMPTY_OPTION && price.category !== categoryFilter) {
        return false;
      }

      if (!query) return true;

      const fields = [
        price.supplier_name,
        price.product_name,
        price.category,
        price.product_id,
        price.item_ref_value,
      ];

      return fields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [prices, search, supplierFilter, categoryFilter]);

  const startEdit = (price: SupplierPrice) => {
    if (savingId) return;
    setEditingId(price.id);
    setEditValues({
      price: price.price?.toString() ?? "",
      roll_price: price.roll_price?.toString() ?? "",
      cut_price: price.cut_price?.toString() ?? "",
      m2_price: price.m2_price?.toString() ?? "",
      price_per_m: price.price_per_m?.toString() ?? "",
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
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
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
        setPrices((prev) =>
          prev.map((item) => (item.id === price.id ? data.price! : item))
        );
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

  const handleUploadClick = () => {
    setUploadMessage(null);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    setUploadMessage(null);
    setUploadError(null);

    if (!profileId) {
      setUploadError("Unable to determine client ID. Please refresh and try again.");
      return;
    }

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
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
      const { error: uploadErrorResponse } = await supabase.storage
        .from("price_lists")
        .upload(uploadPath, file, {
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadErrorResponse) {
        throw new Error(uploadErrorResponse.message);
      }

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

      setUploadMessage("Price list accepted — processing started. Prices will appear once complete.");
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

  const hasPrices = prices.length > 0;
  const hasFilteredPrices = filteredPrices.length > 0;

  const selectStyle = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(148,163,184,0.15)",
    borderRadius: "10px",
    color: "#94a3b8",
    fontSize: "13px",
    padding: "10px 14px",
    outline: "none",
    width: "100%",
    cursor: "pointer",
  };

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Suppliers Pricing</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Search, review, and edit your supplier pricing in one place.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {!loading && prices.length > 0 && (
              <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" as const }}>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1 }}>{prices.length}</p>
                <p style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Products</p>
              </div>
            )}
            {/* Live indicator */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 12px", borderRadius: "999px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#4ade80", letterSpacing: "0.04em" }}>Live</span>
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

        {/* Upload card */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#f1f5f9", marginBottom: "4px" }}>Upload a price list</p>
              <p style={{ fontSize: "13px", color: "#64748b" }}>
                Supports PDF, CSV, XLS, and XLSX up to 25MB. Prices update automatically once processed.
              </p>
            </div>
            <div>
              <button
                className="btn btn-primary"
                onClick={handleUploadClick}
                disabled={isUploading}
                style={{ whiteSpace: "nowrap" as const }}
              >
                {isUploading ? "Uploading…" : "Upload price list"}
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
          {uploadMessage && (
            <p style={{ fontSize: "13px", color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "10px 14px", marginTop: "14px", margin: "14px 0 0" }}>
              ✓ {uploadMessage}
            </p>
          )}
          {uploadError && (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginTop: "14px", margin: "14px 0 0" }}>
              {uploadError}
            </p>
          )}
        </div>

        {loading && <div className="empty-state">Loading supplier prices…</div>}
        {error && !loading && <div className="empty-state" style={{ color: "#fca5a5" }}>{error}</div>}

        {!loading && !error && !hasPrices && (
          <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>No supplier prices yet</h3>
            <p style={{ color: "#475569", fontSize: "14px" }}>Upload a price list above and your pricing will appear here once processed.</p>
          </div>
        )}

        {!loading && !error && hasPrices && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Search & filter card */}
            <div className="card" style={{ padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "16px", flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{ flex: "1 1 200px", minWidth: "200px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#475569", marginBottom: "8px" }}>
                    Search
                  </p>
                  <input
                    className="chat-input"
                    style={{ width: "100%" }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by supplier, product, category, or IDs"
                  />
                </div>
                {/* Supplier filter */}
                <div style={{ flex: "0 1 180px", minWidth: "140px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#475569", marginBottom: "8px" }}>
                    Supplier
                  </p>
                  <select
                    style={selectStyle}
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                  >
                    <option value={EMPTY_OPTION}>All suppliers</option>
                    {supplierOptions.map((supplier) => (
                      <option key={supplier} value={supplier}>{supplier}</option>
                    ))}
                  </select>
                </div>
                {/* Category filter */}
                <div style={{ flex: "0 1 180px", minWidth: "140px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#475569", marginBottom: "8px" }}>
                    Category
                  </p>
                  <select
                    style={selectStyle}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value={EMPTY_OPTION}>All categories</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                {/* Count */}
                <p style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap" as const, paddingBottom: "11px" }}>
                  {hasFilteredPrices ? `${filteredPrices.length} showing` : "0 showing"}
                </p>
              </div>
            </div>

            {hasFilteredPrices ? (
              <div className="table-card scrollable-table">
                <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowX: "auto", overflowY: "auto" }}>
                  <table className="data-table">
                    <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                      <tr>
                        <th>Supplier</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th>UOM</th>
                        <th>Each</th>
                        <th>Roll £/m²</th>
                        <th>Cut £/m²</th>
                        <th>£/m²</th>
                        <th>£/m</th>
                        <th>Updated</th>
                        <th className="sticky-cell">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrices.map((price) => {
                        const isEditing = editingId === price.id;
                        const updatedLabel = formatDate(price.updated_at || price.created_at);
                        const isSaving = savingId === price.id;

                        return (
                          <tr key={price.id}>
                            <td style={{ color: "rgba(241,245,249,0.45)" }}>
                              {price.supplier_name || "—"}
                            </td>
                            <td>
                              <p style={{ fontSize: "15px", color: "#f1f5f9", fontWeight: 500 }}>
                                {price.product_name || "Untitled"}
                              </p>
                            </td>
                            <td style={{ color: "rgba(241,245,249,0.45)" }}>{price.category || "—"}</td>
                            <td style={{ color: "rgba(241,245,249,0.45)" }}>{price.uom || "—"}</td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  style={{ color: "#f1f5f9", fontWeight: 500 }}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.price ?? ""}
                                  onChange={(e) => updateField("price", e.target.value)}
                                />
                              ) : price.price !== null && price.price !== undefined ? (
                                <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{price.price}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  style={{ color: "#f1f5f9", fontWeight: 500 }}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.roll_price ?? ""}
                                  onChange={(e) => updateField("roll_price", e.target.value)}
                                />
                              ) : (
                                <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{formatValue(price.roll_price)}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  style={{ color: "#f1f5f9", fontWeight: 500 }}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.cut_price ?? ""}
                                  onChange={(e) => updateField("cut_price", e.target.value)}
                                />
                              ) : (
                                <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{formatValue(price.cut_price)}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  style={{ color: "#f1f5f9", fontWeight: 500 }}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.m2_price ?? ""}
                                  onChange={(e) => updateField("m2_price", e.target.value)}
                                />
                              ) : (
                                <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{formatValue(price.m2_price)}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  style={{ color: "#f1f5f9", fontWeight: 500 }}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.price_per_m ?? ""}
                                  onChange={(e) => updateField("price_per_m", e.target.value)}
                                />
                              ) : (
                                <span style={{ color: "#f1f5f9", fontWeight: 500 }}>{formatValue(price.price_per_m)}</span>
                              )}
                            </td>
                            <td style={{ color: "rgba(241,245,249,0.45)", fontSize: "12px" }}>{updatedLabel || "—"}</td>
                            <td className="sticky-cell">
                              {isSaving ? (
                                <span style={{ fontSize: "12px", color: "#64748b" }}>Saving…</span>
                              ) : isEditing ? (
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <button className="btn btn-primary" style={{ fontSize: "12px", padding: "6px 14px" }} onClick={() => saveEdit(price)}>
                                    Save
                                  </button>
                                  <button className="btn btn-secondary" style={{ fontSize: "12px", padding: "6px 14px" }} onClick={cancelEdit}>
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: "12px", padding: "6px 14px" }}
                                  onClick={() => startEdit(price)}
                                  disabled={!!editingId}
                                >
                                  Edit
                                </button>
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
              <div className="empty-state">No supplier prices match your filters.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
