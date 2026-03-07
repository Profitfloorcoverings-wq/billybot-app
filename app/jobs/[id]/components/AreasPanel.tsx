"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { parseDimensionExpr, type ParseResult } from "@/lib/jobs/parseDimensionExpr";

type JobArea = {
  id: string;
  job_id: string;
  client_id: string;
  building: string | null;
  floor: string | null;
  name: string;
  dimension_expr: string | null;
  m2_calculated: number | null;
  qty: number;
  flooring_type: string | null;
  product_spec: string | null;
  prep_notes: string | null;
  source: string;
  job_file_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const FLOORING_TYPES = [
  { value: "carpet", label: "Carpet" },
  { value: "carpet_tiles", label: "Carpet Tiles" },
  { value: "safety_vinyl", label: "Safety Vinyl" },
  { value: "smooth_vinyl", label: "Smooth Vinyl" },
  { value: "lvt_tiles", label: "LVT Tiles" },
  { value: "whiterock", label: "Whiterock" },
  { value: "matting", label: "Matting" },
  { value: "laminate", label: "Laminate" },
  { value: "engineered", label: "Engineered" },
  { value: "wood", label: "Wood" },
  { value: "tiles", label: "Tiles" },
  { value: "rubber", label: "Rubber" },
  { value: "resin", label: "Resin" },
  { value: "other", label: "Other" },
];

const SOURCE_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  ai_extracted: { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.3)", color: "#38bdf8", label: "AI Extracted" },
  manual: { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", color: "#94a3b8", label: "Manual" },
  drawing: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", color: "#f97316", label: "Drawing" },
};

function Badge({ bg, border, color, label }: { bg: string; border: string; color: string; label: string }) {
  return (
    <span style={{
      fontSize: "10px", fontWeight: 700, padding: "2px 8px",
      borderRadius: "999px", flexShrink: 0,
      background: bg, border: `1px solid ${border}`,
      color, textTransform: "uppercase", letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
}

function flooringLabel(type: string | null): string {
  return FLOORING_TYPES.find((t) => t.value === type)?.label ?? type ?? "";
}

type GroupedAreas = Map<string, Map<string, JobArea[]>>;

function groupAreas(areas: JobArea[]): GroupedAreas {
  const grouped: GroupedAreas = new Map();
  for (const area of areas) {
    const building = area.building || "General";
    const floor = area.floor || "Unspecified";
    if (!grouped.has(building)) grouped.set(building, new Map());
    const buildingMap = grouped.get(building)!;
    if (!buildingMap.has(floor)) buildingMap.set(floor, []);
    buildingMap.get(floor)!.push(area);
  }
  return grouped;
}

export default function AreasPanel({ jobId }: { jobId: string }) {
  const [areas, setAreas] = useState<JobArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dimPreview, setDimPreview] = useState<ParseResult | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [collapsedBuildings, setCollapsedBuildings] = useState<Set<string>>(new Set());
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add form state
  const [newArea, setNewArea] = useState({
    building: "",
    floor: "",
    name: "",
    dimension_expr: "",
    flooring_type: "",
    product_spec: "",
    qty: 1,
  });
  const [newDimPreview, setNewDimPreview] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);

  const loadAreas = useCallback(async () => {
    try {
      const res = await fetch(`/api/job-areas?job_id=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setAreas(data.areas ?? []);
      }
    } catch (err) {
      console.error("Failed to load areas", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadAreas();
  }, [loadAreas]);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`job-areas-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_areas", filter: `job_id=eq.${jobId}` },
        () => void loadAreas()
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [jobId, loadAreas]);

  // Summary stats
  const stats = useMemo(() => {
    const buildings = new Set(areas.map((a) => a.building).filter(Boolean));
    let totalM2 = 0;
    for (const area of areas) {
      if (area.m2_calculated) totalM2 += area.m2_calculated * area.qty;
    }
    return {
      buildings: buildings.size,
      areaCount: areas.length,
      totalM2: totalM2,
    };
  }, [areas]);

  const grouped = useMemo(() => groupAreas(areas), [areas]);

  // Existing building/floor values for dropdowns
  const existingBuildings = useMemo(
    () => [...new Set(areas.map((a) => a.building).filter(Boolean) as string[])],
    [areas]
  );
  const existingFloors = useMemo(
    () => [...new Set(areas.map((a) => a.floor).filter(Boolean) as string[])],
    [areas]
  );

  // Inline edit handlers
  function startEdit(areaId: string, field: string, currentValue: string) {
    setEditingId(areaId);
    setEditField(field);
    setEditValue(currentValue);
    if (field === "dimension_expr" && currentValue) {
      setDimPreview(parseDimensionExpr(currentValue));
    } else {
      setDimPreview(null);
    }
  }

  function handleEditChange(value: string) {
    setEditValue(value);
    if (editField === "dimension_expr") {
      setDimPreview(value.trim() ? parseDimensionExpr(value) : null);
    }
  }

  async function saveEdit() {
    if (!editingId || !editField) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const body: Record<string, unknown> = {};
    if (editField === "qty") {
      body[editField] = parseInt(editValue, 10) || 1;
    } else {
      body[editField] = editValue;
    }

    try {
      const res = await fetch(`/api/job-areas/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        setAreas((prev) => prev.map((a) => (a.id === editingId ? data.area : a)));
      }
    } catch (err) {
      console.error("Failed to save edit", err);
    }

    setEditingId(null);
    setEditField(null);
    setDimPreview(null);
  }

  async function handleDelete(areaId: string) {
    setDeleting(areaId);
    try {
      const res = await fetch(`/api/job-areas/${areaId}`, { method: "DELETE" });
      if (res.ok) {
        setAreas((prev) => prev.filter((a) => a.id !== areaId));
      }
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(null);
    }
  }

  async function handleAddArea() {
    if (!newArea.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/job-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          building: newArea.building || null,
          floor: newArea.floor || null,
          name: newArea.name,
          dimension_expr: newArea.dimension_expr || null,
          flooring_type: newArea.flooring_type || null,
          product_spec: newArea.product_spec || null,
          qty: newArea.qty,
          source: "manual",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAreas((prev) => [...prev, data.area]);
        setNewArea({ building: "", floor: "", name: "", dimension_expr: "", flooring_type: "", product_spec: "", qty: 1 });
        setNewDimPreview(null);
        setShowAddForm(false);
      }
    } catch (err) {
      console.error("Failed to add area", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateQuote() {
    const lines = areas
      .filter((a) => a.m2_calculated && a.m2_calculated > 0)
      .map((a) => ({
        type: a.flooring_type || "other",
        description: [a.building, a.floor, a.name].filter(Boolean).join(" > "),
        qty: a.qty,
        unit: "m2",
        unit_price: 0,
        m2: a.m2_calculated,
        product_spec: a.product_spec,
        prep_notes: a.prep_notes,
      }));

    if (!lines.length) return;

    try {
      await fetch("/api/quotes/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, lines }),
      });
    } catch (err) {
      console.error("Generate quote failed", err);
    }
  }

  const allHaveM2 = areas.length > 0 && areas.every((a) => a.m2_calculated && a.m2_calculated > 0);

  function toggleBuilding(building: string) {
    setCollapsedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(building)) next.delete(building); else next.add(building);
      return next;
    });
  }

  function toggleFloor(key: string) {
    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Shared input styles
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "6px", fontSize: "13px",
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.2)",
    color: "#e2e8f0", width: "100%",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: "pointer",
  };

  if (loading) {
    return <p style={{ fontSize: "14px", color: "#64748b" }}>Loading areas...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Summary bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: "12px", flexWrap: "wrap",
      }}>
        <p style={{ fontSize: "13px", color: "#94a3b8", margin: 0 }}>
          {stats.buildings > 0 ? `${stats.buildings} building${stats.buildings !== 1 ? "s" : ""} \u00B7 ` : ""}
          {stats.areaCount} area{stats.areaCount !== 1 ? "s" : ""}
          {stats.totalM2 > 0 ? ` \u00B7 ${stats.totalM2.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m\u00B2 total` : ""}
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{ padding: "7px 14px", fontSize: "12px" }}
          >
            + Add Area
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateQuote()}
            disabled={!allHaveM2}
            style={{
              padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
              background: allHaveM2 ? "#f97316" : "rgba(249,115,22,0.2)",
              color: allHaveM2 ? "#fff" : "#64748b",
              border: "none", cursor: allHaveM2 ? "pointer" : "not-allowed",
            }}
          >
            Generate Quote from Areas
          </button>
        </div>
      </div>

      {/* Add area form */}
      {showAddForm ? (
        <div style={{
          background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.15)",
          borderRadius: "12px", padding: "16px",
          display: "flex", flexDirection: "column", gap: "10px",
        }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "#38bdf8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            New Area
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {/* Building */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Building</label>
              <input
                list="buildings-list"
                value={newArea.building}
                onChange={(e) => setNewArea((p) => ({ ...p, building: e.target.value }))}
                placeholder="e.g. Block A"
                style={inputStyle}
              />
              <datalist id="buildings-list">
                {existingBuildings.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
            {/* Floor */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Floor</label>
              <input
                list="floors-list"
                value={newArea.floor}
                onChange={(e) => setNewArea((p) => ({ ...p, floor: e.target.value }))}
                placeholder="e.g. Ground Floor"
                style={inputStyle}
              />
              <datalist id="floors-list">
                {existingFloors.map((f) => <option key={f} value={f} />)}
              </datalist>
            </div>
            {/* Name */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Name *</label>
              <input
                value={newArea.name}
                onChange={(e) => setNewArea((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Reception"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "8px" }}>
            {/* Dimensions */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Dimensions</label>
              <input
                value={newArea.dimension_expr}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewArea((p) => ({ ...p, dimension_expr: val }));
                  setNewDimPreview(val.trim() ? parseDimensionExpr(val) : null);
                }}
                placeholder="e.g. 5x3m minus 1m2"
                style={inputStyle}
              />
              {newDimPreview ? (
                <p style={{
                  fontSize: "11px", margin: "3px 0 0",
                  color: newDimPreview.ok ? "#34d399" : "#fbbf24",
                }}>
                  {newDimPreview.ok ? newDimPreview.breakdown : newDimPreview.error}
                </p>
              ) : null}
            </div>
            {/* Flooring type */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Flooring</label>
              <select
                value={newArea.flooring_type}
                onChange={(e) => setNewArea((p) => ({ ...p, flooring_type: e.target.value }))}
                style={selectStyle}
              >
                <option value="">—</option>
                {FLOORING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {/* Product spec */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Product</label>
              <input
                value={newArea.product_spec}
                onChange={(e) => setNewArea((p) => ({ ...p, product_spec: e.target.value }))}
                placeholder="e.g. Polysafe"
                style={inputStyle}
              />
            </div>
            {/* Qty */}
            <div>
              <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "3px" }}>Qty</label>
              <input
                type="number"
                min={1}
                value={newArea.qty}
                onChange={(e) => setNewArea((p) => ({ ...p, qty: parseInt(e.target.value, 10) || 1 }))}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewDimPreview(null); }}
              style={{
                padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600,
                background: "transparent", border: "1px solid rgba(148,163,184,0.2)",
                color: "#94a3b8", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAddArea()}
              disabled={saving || !newArea.name.trim()}
              className="btn btn-primary"
              style={{ padding: "7px 14px", fontSize: "12px" }}
            >
              {saving ? "Saving..." : "Add Area"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Areas grouped by building → floor */}
      {areas.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#64748b" }}>No areas added to this job yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[...grouped.entries()].map(([building, floors]) => {
            const buildingCollapsed = collapsedBuildings.has(building);
            const buildingAreaCount = [...floors.values()].reduce((sum, arr) => sum + arr.length, 0);
            const buildingM2 = [...floors.values()].flat().reduce(
              (sum, a) => sum + (a.m2_calculated ?? 0) * a.qty, 0
            );

            return (
              <div key={building} style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(148,163,184,0.08)",
                borderRadius: "14px",
                overflow: "hidden",
              }}>
                {/* Building header */}
                {grouped.size > 1 || building !== "General" ? (
                  <button
                    type="button"
                    onClick={() => toggleBuilding(building)}
                    style={{
                      width: "100%", padding: "12px 16px",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: "12px", background: "rgba(255,255,255,0.03)",
                      border: "none", borderBottom: buildingCollapsed ? "none" : "1px solid rgba(148,163,184,0.06)",
                      cursor: "pointer", color: "#e2e8f0",
                    }}
                  >
                    <span style={{ fontSize: "14px", fontWeight: 700 }}>
                      {buildingCollapsed ? "\u25B8" : "\u25BE"} {building}
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      {buildingAreaCount} area{buildingAreaCount !== 1 ? "s" : ""}
                      {buildingM2 > 0 ? ` \u00B7 ${buildingM2.toFixed(1)} m\u00B2` : ""}
                    </span>
                  </button>
                ) : null}

                {!buildingCollapsed ? (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {[...floors.entries()].map(([floor, floorAreas]) => {
                      const floorKey = `${building}::${floor}`;
                      const floorCollapsed = collapsedFloors.has(floorKey);
                      const floorM2 = floorAreas.reduce(
                        (sum, a) => sum + (a.m2_calculated ?? 0) * a.qty, 0
                      );

                      return (
                        <div key={floorKey}>
                          {/* Floor header */}
                          {floors.size > 1 || floor !== "Unspecified" ? (
                            <button
                              type="button"
                              onClick={() => toggleFloor(floorKey)}
                              style={{
                                width: "100%", padding: "8px 16px 8px 28px",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                gap: "12px", background: "rgba(255,255,255,0.01)",
                                border: "none", borderBottom: "1px solid rgba(148,163,184,0.04)",
                                cursor: "pointer", color: "#cbd5e1",
                              }}
                            >
                              <span style={{ fontSize: "13px", fontWeight: 600 }}>
                                {floorCollapsed ? "\u25B8" : "\u25BE"} {floor}
                              </span>
                              <span style={{ fontSize: "11px", color: "#64748b" }}>
                                {floorAreas.length} area{floorAreas.length !== 1 ? "s" : ""}
                                {floorM2 > 0 ? ` \u00B7 ${floorM2.toFixed(1)} m\u00B2` : ""}
                              </span>
                            </button>
                          ) : null}

                          {!floorCollapsed ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              {floorAreas.map((area) => {
                                const sourceStyle = SOURCE_STYLES[area.source] ?? SOURCE_STYLES.manual;
                                const totalM2 = area.m2_calculated ? area.m2_calculated * area.qty : null;
                                const needsDims = !area.dimension_expr;

                                return (
                                  <div
                                    key={area.id}
                                    style={{
                                      padding: "12px 16px 12px 40px",
                                      borderBottom: "1px solid rgba(148,163,184,0.04)",
                                      display: "flex", flexDirection: "column", gap: "6px",
                                    }}
                                  >
                                    {/* Area header row */}
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                      {/* Name (click to edit) */}
                                      {editingId === area.id && editField === "name" ? (
                                        <input
                                          autoFocus
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          onBlur={() => void saveEdit()}
                                          onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape") { setEditingId(null); setEditField(null); } }}
                                          style={{ ...inputStyle, width: "180px", fontWeight: 600 }}
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startEdit(area.id, "name", area.name)}
                                          style={{
                                            background: "none", border: "none", padding: 0, cursor: "pointer",
                                            fontSize: "14px", fontWeight: 600, color: "#e2e8f0",
                                          }}
                                        >
                                          {area.name}
                                        </button>
                                      )}

                                      {/* Source badge */}
                                      <Badge {...sourceStyle} />

                                      {/* Flooring type badge */}
                                      {area.flooring_type ? (
                                        editingId === area.id && editField === "flooring_type" ? (
                                          <select
                                            autoFocus
                                            value={editValue}
                                            onChange={(e) => { setEditValue(e.target.value); }}
                                            onBlur={() => void saveEdit()}
                                            style={{ ...selectStyle, width: "140px" }}
                                          >
                                            <option value="">—</option>
                                            {FLOORING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                          </select>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => startEdit(area.id, "flooring_type", area.flooring_type || "")}
                                            style={{
                                              fontSize: "10px", fontWeight: 700, padding: "2px 8px",
                                              borderRadius: "999px", flexShrink: 0,
                                              background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)",
                                              color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.04em",
                                              cursor: "pointer",
                                            }}
                                          >
                                            {flooringLabel(area.flooring_type)}
                                          </button>
                                        )
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startEdit(area.id, "flooring_type", "")}
                                          style={{
                                            fontSize: "10px", fontWeight: 600, padding: "2px 8px",
                                            borderRadius: "999px",
                                            background: "rgba(148,163,184,0.08)", border: "1px dashed rgba(148,163,184,0.2)",
                                            color: "#475569", cursor: "pointer",
                                          }}
                                        >
                                          + Flooring
                                        </button>
                                      )}

                                      {/* Product spec */}
                                      {area.product_spec ? (
                                        <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                                          {area.product_spec}
                                        </span>
                                      ) : null}

                                      {/* Qty badge */}
                                      {area.qty > 1 ? (
                                        editingId === area.id && editField === "qty" ? (
                                          <input
                                            autoFocus
                                            type="number"
                                            min={1}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={() => void saveEdit()}
                                            onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); }}
                                            style={{ ...inputStyle, width: "60px" }}
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => startEdit(area.id, "qty", String(area.qty))}
                                            style={{
                                              fontSize: "10px", fontWeight: 700, padding: "2px 8px",
                                              borderRadius: "999px",
                                              background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)",
                                              color: "#fbbf24", cursor: "pointer",
                                            }}
                                          >
                                            x{area.qty}
                                          </button>
                                        )
                                      ) : null}

                                      {/* Needs dimensions badge */}
                                      {needsDims ? (
                                        <Badge
                                          bg="rgba(148,163,184,0.08)"
                                          border="rgba(148,163,184,0.15)"
                                          color="#64748b"
                                          label="Needs Dimensions"
                                        />
                                      ) : null}

                                      {/* Delete */}
                                      <button
                                        type="button"
                                        onClick={() => void handleDelete(area.id)}
                                        disabled={deleting === area.id}
                                        style={{
                                          marginLeft: "auto", fontSize: "11px", fontWeight: 600,
                                          background: "none", border: "none",
                                          color: deleting === area.id ? "#475569" : "#f87171",
                                          cursor: deleting === area.id ? "not-allowed" : "pointer",
                                          padding: "2px 6px",
                                        }}
                                      >
                                        {deleting === area.id ? "..." : "Delete"}
                                      </button>
                                    </div>

                                    {/* Dimensions row */}
                                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", paddingLeft: "2px" }}>
                                      <span style={{ fontSize: "11px", color: "#64748b", flexShrink: 0 }}>Dimensions:</span>
                                      {editingId === area.id && editField === "dimension_expr" ? (
                                        <div style={{ flex: 1 }}>
                                          <input
                                            autoFocus
                                            value={editValue}
                                            onChange={(e) => handleEditChange(e.target.value)}
                                            onBlur={() => void saveEdit()}
                                            onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(); if (e.key === "Escape") { setEditingId(null); setEditField(null); } }}
                                            placeholder="e.g. 5x3m minus 1m2"
                                            style={{ ...inputStyle, width: "280px" }}
                                          />
                                          {dimPreview ? (
                                            <p style={{
                                              fontSize: "11px", margin: "3px 0 0",
                                              color: dimPreview.ok ? "#34d399" : "#fbbf24",
                                            }}>
                                              {dimPreview.ok ? dimPreview.breakdown : dimPreview.error}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => startEdit(area.id, "dimension_expr", area.dimension_expr || "")}
                                          style={{
                                            background: "none", border: "none", padding: 0, cursor: "pointer",
                                            fontSize: "13px",
                                            color: area.dimension_expr ? "#e2e8f0" : "#475569",
                                            fontStyle: area.dimension_expr ? "normal" : "italic",
                                          }}
                                        >
                                          {area.dimension_expr || "click to add"}
                                        </button>
                                      )}

                                      {/* M2 display */}
                                      {area.m2_calculated ? (
                                        <span style={{ fontSize: "13px", color: "#34d399", fontWeight: 600, marginLeft: "auto", flexShrink: 0 }}>
                                          {"\u2192"} {area.m2_calculated.toFixed(2)} m{"\u00B2"}
                                          {area.qty > 1 ? (
                                            <span style={{ color: "#94a3b8", fontWeight: 400 }}>
                                              {" "}each {"\u00B7"} {totalM2?.toFixed(2)} m{"\u00B2"} total
                                            </span>
                                          ) : null}
                                        </span>
                                      ) : null}
                                    </div>

                                    {/* Prep notes */}
                                    {area.prep_notes ? (
                                      <div style={{ paddingLeft: "2px", display: "flex", alignItems: "baseline", gap: "8px" }}>
                                        <span style={{ fontSize: "11px", color: "#64748b", flexShrink: 0 }}>Prep:</span>
                                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{area.prep_notes}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
