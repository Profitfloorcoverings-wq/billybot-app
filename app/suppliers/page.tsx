"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const EMPTY_OPTION = "__all";

type SupplierPrice = {
  id: number | string;
  created_at: string | null;
  updated_at: string | null;
  client_id: string | null;
  supplier_id: string | null;
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

type UploadMessage = {
  tone: "success" | "error";
  text: string;
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
  const [uploadMessage, setUploadMessage] = useState<UploadMessage | null>(null);
  const [uploadingSupplierId, setUploadingSupplierId] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
  const ACCEPTED_MIME_TYPES = new Set([
    "application/pdf",
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  const ACCEPTED_EXTENSIONS = new Set(["pdf", "csv", "xlsx", "xls"]);

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

  const supplierOptions = useMemo(() => {
    const names = new Set<string>();
    prices.forEach((price) => {
      if (price.supplier_name) names.add(price.supplier_name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [prices]);

  const supplierUploadOptions = useMemo(() => {
    const options = new Map<string, { id: string; name: string }>();
    prices.forEach((price) => {
      if (!price.supplier_name) return;
      const supplierId = price.supplier_id || price.supplier_name;
      if (!supplierId) return;
      const key = `${supplierId}-${price.supplier_name}`;
      if (!options.has(key)) {
        options.set(key, { id: supplierId, name: price.supplier_name });
      }
    });
    return Array.from(options.values()).sort((a, b) => a.name.localeCompare(b.name));
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

  const sanitizeFilename = (filename: string) => {
    const lower = filename.toLowerCase();
    const lastDotIndex = lower.lastIndexOf(".");
    const extension = lastDotIndex >= 0 ? lower.slice(lastDotIndex) : "";
    const baseName = lastDotIndex >= 0 ? lower.slice(0, lastDotIndex) : lower;
    const sanitizedBase = baseName
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const sanitizedExtension = extension.replace(/[^a-z0-9.]/g, "");
    return `${sanitizedBase || "file"}${sanitizedExtension}`;
  };

  const validateFile = (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      return "File must be 25MB or smaller.";
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isValidType =
      ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.has(extension);

    if (!isValidType) {
      return "Only PDF, CSV, XLS, or XLSX files are supported.";
    }

    return null;
  };

  const startUpload = (supplier: { id: string; name: string }) => {
    setUploadMessage(null);
    setSelectedSupplier(supplier);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!selectedSupplier) {
      setUploadMessage({ tone: "error", text: "Select a supplier before uploading." });
      return;
    }

    if (!profileId) {
      setUploadMessage({ tone: "error", text: "Unable to upload without a client ID." });
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setUploadMessage({ tone: "error", text: validationError });
      return;
    }

    const sanitizedFilename = sanitizeFilename(file.name);
    const uploadPath = `raw/${profileId}/${selectedSupplier.id}/${crypto.randomUUID()}-${sanitizedFilename}`;

    setUploadingSupplierId(selectedSupplier.id);
    setUploadMessage(null);

    try {
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("price_lists")
        .upload(uploadPath, file, { contentType: file.type || undefined });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const webhookResponse = await fetch(
        "https://tradiebrain.app.n8n.cloud/webhook/v1/suppliers/price-lists/ingest",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: profileId,
            supplier_id: selectedSupplier.id,
            supplier_name: selectedSupplier.name,
            file: {
              bucket: "price_lists",
              path: uploadPath,
              mime_type: file.type,
              original_filename: file.name,
            },
          }),
        }
      );

      if (!webhookResponse.ok) {
        setUploadMessage({
          tone: "error",
          text: "Upload succeeded but processing failed. Please try again.",
        });
        return;
      }

      setUploadMessage({
        tone: "success",
        text: "Upload successful. Processing will start shortly.",
      });
    } catch (err) {
      console.error("Price list upload error", err);
      setUploadMessage({
        tone: "error",
        text:
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Upload failed. Please try again.",
      });
    } finally {
      setUploadingSupplierId(null);
    }
  };

  const hasPrices = prices.length > 0;
  const hasFilteredPrices = filteredPrices.length > 0;
  const isUploading = uploadingSupplierId !== null;

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Suppliers Pricing</h1>
          <p className="section-subtitle">
            Search, review, and edit your supplier pricing in one place.
          </p>
        </div>
        <div className="tag">Live</div>
      </div>

      <div className="stack gap-4">
        <div className="card stack gap-3">
          <div className="stack gap-2">
            <h3 className="section-title text-lg">Upload price list</h3>
            <p className="section-subtitle">
              Upload a price list for a specific supplier. Accepted: PDF, CSV, XLS, or XLSX.
            </p>
          </div>
          {uploadMessage && (
            <div
              className={`toast ${
                uploadMessage.tone === "error"
                  ? "border border-rose-500/50 bg-rose-500/10 text-rose-200"
                  : "border border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
              }`}
            >
              {uploadMessage.text}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.csv,.xls,.xlsx"
            onChange={handleFileChange}
          />
          {supplierUploadOptions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Add supplier pricing to enable uploads for specific suppliers.
            </p>
          ) : (
            <div className="stack gap-2">
              {supplierUploadOptions.map((supplier) => {
                const isRowUploading = uploadingSupplierId === supplier.id;
                return (
                  <div
                    key={`${supplier.id}-${supplier.name}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="stack">
                      <p className="font-semibold">{supplier.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Upload the latest pricing for this supplier.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => startUpload(supplier)}
                      disabled={isUploading}
                    >
                      {isRowUploading ? "Uploading…" : "Upload price list"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {loading && <div className="empty-state">Loading supplier prices…</div>}

        {error && !loading && <div className="empty-state">{error}</div>}

        {!loading && !error && !hasPrices && (
          <div className="empty-state stack items-center">
            <h3 className="section-title">No supplier prices yet</h3>
            <p className="section-subtitle">
              Your supplier pricing will appear here once uploaded.
            </p>
          </div>
        )}

        {!loading && !error && hasPrices && (
          <div className="stack gap-4">
            <div className="card stack gap-3">
              <div className="stack md:row md:items-center md:justify-between gap-4">
                <div className="stack flex-1">
                  <p className="section-subtitle">Search</p>
                  <input
                    className="input-fluid"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by supplier, product, category, or IDs"
                  />
                </div>
                <div className="stack sm:row gap-3 w-full md:w-auto">
                  <div className="stack">
                    <p className="section-subtitle">Supplier</p>
                    <select
                      className="input-fluid"
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                    >
                      <option value={EMPTY_OPTION}>All suppliers</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="stack">
                    <p className="section-subtitle">Category</p>
                    <select
                      className="input-fluid"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value={EMPTY_OPTION}>All categories</option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="tag">
                {hasFilteredPrices ? `${filteredPrices.length} showing` : "0 showing"}
              </div>
            </div>

            {hasFilteredPrices ? (
              <div className="table-card scrollable-table">
                <div className="relative w-full overflow-x-auto">
                  <table className="data-table">
                    <thead>
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
                            <td>{price.supplier_name || "—"}</td>
                            <td>
                              <div className="stack gap-1">
                                <p className="font-semibold text-[15px] text-white">
                                  {price.product_name || "Untitled"}
                                </p>
                              </div>
                            </td>
                            <td>{price.category || "—"}</td>
                            <td>{price.uom || "—"}</td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.price ?? ""}
                                  onChange={(e) => updateField("price", e.target.value)}
                                />
                              ) : price.price !== null && price.price !== undefined ? (
                                price.price
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.roll_price ?? ""}
                                  onChange={(e) => updateField("roll_price", e.target.value)}
                                />
                              ) : (
                                formatValue(price.roll_price)
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.cut_price ?? ""}
                                  onChange={(e) => updateField("cut_price", e.target.value)}
                                />
                              ) : (
                                formatValue(price.cut_price)
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.m2_price ?? ""}
                                  onChange={(e) => updateField("m2_price", e.target.value)}
                                />
                              ) : (
                                formatValue(price.m2_price)
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  className="input-fluid supplierPriceInput"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.price_per_m ?? ""}
                                  onChange={(e) => updateField("price_per_m", e.target.value)}
                                />
                              ) : (
                                formatValue(price.price_per_m)
                              )}
                            </td>
                            <td>{updatedLabel || "—"}</td>
                            <td className="sticky-cell">
                              <div className="stack gap-2">
                                {isSaving ? (
                                  <span className="text-xs text-[var(--muted)]">Saving…</span>
                                ) : isEditing ? (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      className="btn btn-primary"
                                      onClick={() => saveEdit(price)}
                                    >
                                      Save
                                    </button>
                                    <button className="btn btn-secondary" onClick={cancelEdit}>
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() => startEdit(price)}
                                    disabled={!!editingId}
                                  >
                                    Edit
                                  </button>
                                )}
                              </div>
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
