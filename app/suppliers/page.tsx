"use client";

import { useEffect, useMemo, useState } from "react";

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
  product_name: string;
  uom: string;
  price: number | null;
  roll_price: number | null;
  cut_price: number | null;
  m2_price: number | null;
  price_per_m: number | null;
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
  const [activeEditId, setActiveEditId] = useState<string | number | null>(null);
  const [editValues, setEditValues] = useState<SupplierPriceUpdate | null>(null);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPrices() {
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
    }

    loadPrices();
  }, []);

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
    setActiveEditId(price.id);
    setEditValues({
      product_name: price.product_name ?? "",
      uom: price.uom ?? "",
      price: price.price ?? null,
      roll_price: price.roll_price ?? null,
      cut_price: price.cut_price ?? null,
      m2_price: price.m2_price ?? null,
      price_per_m: price.price_per_m ?? null,
    });
  };

  const cancelEdit = () => {
    if (savingId) return;
    setActiveEditId(null);
    setEditValues(null);
  };

  const updateField = (field: keyof SupplierPriceUpdate, value: string) => {
    if (!editValues) return;
    if (["price", "roll_price", "cut_price", "m2_price", "price_per_m"].includes(field)) {
      if (value === "") {
        setEditValues({ ...editValues, [field]: null });
        return;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return;
      setEditValues({ ...editValues, [field]: parsed });
      return;
    }
    setEditValues({ ...editValues, [field]: value });
  };

  const saveEdit = async (price: SupplierPrice) => {
    if (!editValues || savingId) return;

    const normalized = {
      product_name: editValues.product_name.trim(),
      uom: editValues.uom.trim(),
      price: editValues.price,
      roll_price: editValues.roll_price,
      cut_price: editValues.cut_price,
      m2_price: editValues.m2_price,
      price_per_m: editValues.price_per_m,
    };

    if (!normalized.product_name || !normalized.uom || !Number.isFinite(normalized.price ?? NaN)) {
      setError("Please provide product name, UOM, and a valid price.");
      return;
    }

    const numericFields: Array<keyof SupplierPriceUpdate> = [
      "price",
      "roll_price",
      "cut_price",
      "m2_price",
      "price_per_m",
    ];

    const hasInvalidNumber = numericFields.some((field) => {
      const value = normalized[field];
      if (value === null || value === undefined) return false;
      return !Number.isFinite(value) || value < 0;
    });

    if (hasInvalidNumber) {
      setError("Prices must be finite numbers greater than or equal to 0.");
      return;
    }

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

      setActiveEditId(null);
      setEditValues(null);
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

  const hasPrices = prices.length > 0;
  const hasFilteredPrices = filteredPrices.length > 0;

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
          <div className="stack">
            <h3 className="section-title text-lg">Email price lists to pricelists@billybot.ai</h3>
            <p className="section-subtitle">Accepted: PDF, Excel, CSV</p>
          </div>
          <p className="text-sm text-[var(--muted)]">Prices appear once processed.</p>
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
              <div className="table-card">
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrices.map((price) => {
                      const isEditing = activeEditId === price.id;
                      const updatedLabel = formatDate(price.updated_at || price.created_at);
                      const isSaving = savingId === price.id;

                      return (
                        <tr key={price.id}>
                          <td>{price.supplier_name || "—"}</td>
                          <td>
                            <div className="stack gap-1">
                              {isEditing ? (
                                <input
                                  className="input-fluid"
                                  value={editValues?.product_name ?? ""}
                                  onChange={(e) => updateField("product_name", e.target.value)}
                                />
                              ) : (
                                <p className="font-semibold text-[15px] text-white">
                                  {price.product_name || "Untitled"}
                                </p>
                              )}
                            </div>
                          </td>
                          <td>{price.category || "—"}</td>
                          <td>
                            {isEditing ? (
                              <input
                                className="input-fluid"
                                value={editValues?.uom ?? ""}
                                onChange={(e) => updateField("uom", e.target.value)}
                              />
                            ) : (
                              price.uom || "—"
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="input-fluid"
                                type="number"
                                min="0"
                                step="0.01"
                                value={Number.isFinite(editValues?.price) ? editValues?.price : ""}
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
                                className="input-fluid"
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  Number.isFinite(editValues?.roll_price)
                                    ? editValues?.roll_price
                                    : ""
                                }
                                onChange={(e) => updateField("roll_price", e.target.value)}
                              />
                            ) : (
                              formatValue(price.roll_price)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="input-fluid"
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  Number.isFinite(editValues?.cut_price)
                                    ? editValues?.cut_price
                                    : ""
                                }
                                onChange={(e) => updateField("cut_price", e.target.value)}
                              />
                            ) : (
                              formatValue(price.cut_price)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="input-fluid"
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  Number.isFinite(editValues?.m2_price)
                                    ? editValues?.m2_price
                                    : ""
                                }
                                onChange={(e) => updateField("m2_price", e.target.value)}
                              />
                            ) : (
                              formatValue(price.m2_price)
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="input-fluid"
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  Number.isFinite(editValues?.price_per_m)
                                    ? editValues?.price_per_m
                                    : ""
                                }
                                onChange={(e) => updateField("price_per_m", e.target.value)}
                              />
                            ) : (
                              formatValue(price.price_per_m)
                            )}
                          </td>
                          <td>
                            <div className="stack gap-2">
                              <span>{updatedLabel || "—"}</span>
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
                                  disabled={!!activeEditId}
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
            ) : (
              <div className="empty-state">No supplier prices match your filters.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
