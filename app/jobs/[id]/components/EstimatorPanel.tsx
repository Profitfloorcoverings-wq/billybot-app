"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AreasPanel from "./AreasPanel";
import {
  type TenderMetadata,
  type TenderSpec,
  type TenderAccessory,
  type TenderPricingLine,
  type TenderFormat,
  TENDER_FORMAT_LABELS,
  emptyTenderMetadata,
  computeAdjustedM2,
  computeLineTotal,
} from "@/types/tender";
import {
  FLOORING_TO_PRICING_KEY,
  DEFAULT_WASTAGE_PCT,
  DEFAULT_PREP_COSTS,
  ACCESSORY_PRESETS,
  ACCESSORY_UNITS,
} from "@/lib/tender/defaults";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PricingSettings = Record<string, number | string | boolean | null>;

type SupplierPrice = {
  supplier_name: string;
  product_name: string;
  base_price: number;
  uom: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SECTION_KEYS = ["specs", "quantities", "pricing", "accessories", "prelims", "totals", "docs"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_LABELS: Record<SectionKey, string> = {
  specs: "Specifications",
  quantities: "Quantities",
  pricing: "Pricing Build-Up",
  accessories: "Accessories",
  prelims: "Prelims & OH&P",
  totals: "Summary",
  docs: "Attached Docs",
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

const ROOM_BY_ROOM_FORMATS = new Set<TenderFormat>(["full_boq", "schedule_drawings", "drawings_only"]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uid(): string {
  return crypto.randomUUID();
}

function fmt(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deadlineInfo(deadline: string | null): { label: string; color: string } | null {
  if (!deadline) return null;
  const now = Date.now();
  const target = new Date(deadline).getTime();
  const diff = target - now;
  if (diff < 0) return { label: "Overdue", color: "#ef4444" };
  const hours = diff / 3_600_000;
  if (hours < 48) return { label: `${Math.round(hours)}h left`, color: "#ef4444" };
  const days = Math.ceil(hours / 24);
  if (days <= 7) return { label: `${days}d left`, color: "#fb923c" };
  return { label: `${days}d left`, color: "#34d399" };
}

/* ------------------------------------------------------------------ */
/*  Inline-editable cell                                               */
/* ------------------------------------------------------------------ */

function EditCell({
  value,
  onChange,
  type = "text",
  style,
  placeholder,
  selectOptions,
}: {
  value: string | number | null;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  style?: React.CSSProperties;
  placeholder?: string;
  selectOptions?: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== String(value ?? "")) onChange(draft);
  }, [draft, value, onChange]);

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: "6px",
          minWidth: "40px",
          display: "inline-block",
          color: value ? "#e2e8f0" : "#64748b",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(148,163,184,0.1)",
          fontSize: "13px",
          ...style,
        }}
      >
        {selectOptions ? (selectOptions.find((o) => o.value === value)?.label ?? value ?? placeholder ?? "—") : (value ?? placeholder ?? "—")}
      </span>
    );
  }

  if (selectOptions) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
        style={{
          background: "#1e293b",
          border: "1px solid #38bdf8",
          borderRadius: "6px",
          color: "#e2e8f0",
          padding: "4px 8px",
          fontSize: "13px",
          outline: "none",
          ...style,
        }}
      >
        <option value="">—</option>
        {selectOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      placeholder={placeholder}
      style={{
        background: "#1e293b",
        border: "1px solid #38bdf8",
        borderRadius: "6px",
        color: "#e2e8f0",
        padding: "4px 8px",
        fontSize: "13px",
        outline: "none",
        width: type === "number" ? "80px" : "auto",
        ...style,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible section wrapper                                        */
/* ------------------------------------------------------------------ */

function Section({ title, sectionKey, expanded, onToggle, children, badge }: {
  title: string;
  sectionKey: SectionKey;
  expanded: boolean;
  onToggle: (k: SectionKey) => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(148,163,184,0.1)",
      borderRadius: "14px",
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#f1f5f9",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "14px", fontWeight: 700 }}>{title}</span>
          {badge}
        </span>
        <span style={{ fontSize: "16px", color: "#64748b", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▾
        </span>
      </button>
      {expanded ? (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(148,163,184,0.08)" }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress pill bar                                                  */
/* ------------------------------------------------------------------ */

type ProgressStep = { key: string; label: string; complete: boolean };

function ProgressTracker({ steps }: { steps: ProgressStep[] }) {
  const done = steps.filter((s) => s.complete).length;
  const allDone = done === steps.length;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      {steps.map((s) => (
        <span
          key={s.key}
          style={{
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: "999px",
            background: s.complete ? "rgba(52,211,153,0.15)" : "rgba(148,163,184,0.1)",
            color: s.complete ? "#34d399" : "#64748b",
            border: `1px solid ${s.complete ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.15)"}`,
          }}
        >
          {s.label}
        </span>
      ))}
      <span style={{
        fontSize: "12px",
        fontWeight: 700,
        color: allDone ? "#34d399" : "#94a3b8",
        marginLeft: "4px",
      }}>
        {allDone ? "Submit-ready" : `${done}/${steps.length} complete`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function EstimatorPanel({ jobId }: { jobId: string }) {
  const [tender, setTender] = useState<TenderMetadata>(emptyTenderMetadata());
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set(["specs"]));
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [supplierPrices, setSupplierPrices] = useState<SupplierPrice[]>([]);
  const [areasSummary, setAreasSummary] = useState<Record<string, number>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTenderRef = useRef(tender);

  // Keep ref in sync
  useEffect(() => { latestTenderRef.current = tender; }, [tender]);

  /* ---------- Load tender + pricing data ---------- */
  useEffect(() => {
    async function load() {
      const [tenderRes, pricingRes, supplierRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/tender`),
        fetch("/api/pricing"),
        fetch("/api/supplier-prices"),
      ]);

      if (tenderRes.ok) {
        const { tender: t } = await tenderRes.json();
        if (t) setTender({ ...emptyTenderMetadata(), ...t });
      }
      if (pricingRes.ok) {
        const data = await pricingRes.json();
        setPricing(data.pricing || data);
      }
      if (supplierRes.ok) {
        const data = await supplierRes.json();
        setSupplierPrices(data.prices || data || []);
      }
      setLoading(false);
    }
    void load();
  }, [jobId]);

  /* ---------- Auto-save with debounce ---------- */
  const saveTender = useCallback((updated: TenderMetadata) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/tender`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        setSaveState(res.ok ? "saved" : "error");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
        setTimeout(() => setSaveState("idle"), 3000);
      }
    }, 500);
  }, [jobId]);

  const update = useCallback((patch: Partial<TenderMetadata>) => {
    setTender((prev) => {
      const next = { ...prev, ...patch };
      saveTender(next);
      return next;
    });
  }, [saveTender]);

  /* ---------- Section toggle ---------- */
  const toggleSection = useCallback((key: SectionKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  /* ---------- Auto-fill pricing line from settings ---------- */
  const autoFillLine = useCallback((flooringType: string): Omit<TenderPricingLine, "total_m2" | "adjusted_m2" | "line_total"> => {
    const keys = FLOORING_TO_PRICING_KEY[flooringType];
    const prep = DEFAULT_PREP_COSTS[flooringType] || { adhesive: 0, primer: 0, smoothing: 0 };
    const labourRate = keys && pricing ? Number(pricing[keys.lab]) || 0 : 0;
    const matRate = keys && pricing ? Number(pricing[keys.mat]) || 0 : 0;

    return {
      flooring_type: flooringType,
      wastage_pct: DEFAULT_WASTAGE_PCT[flooringType] ?? 10,
      material_cost_m2: matRate,
      adhesive_cost_m2: prep.adhesive,
      primer_cost_m2: prep.primer,
      smoothing_cost_m2: prep.smoothing,
      labour_cost_m2: labourRate,
    };
  }, [pricing]);

  /* ---------- Compute progress ---------- */
  const progress = useMemo((): ProgressStep[] => {
    const t = tender;
    return [
      { key: "format", label: "Format", complete: !!t.format },
      { key: "specs", label: "Specs", complete: t.specs.length > 0 },
      { key: "quantities", label: "Quantities", complete: t.pricing_lines.some((l) => l.total_m2 > 0) || Object.values(areasSummary).some((v) => v > 0) },
      { key: "materials", label: "Materials", complete: t.pricing_lines.some((l) => l.material_cost_m2 > 0) },
      { key: "labour", label: "Labour", complete: t.pricing_lines.some((l) => l.labour_cost_m2 > 0) },
      { key: "accessories", label: "Accessories", complete: t.accessories.length > 0 },
      { key: "prelims", label: "Prelims", complete: t.prelims_value > 0 },
      { key: "ohp", label: "OH&P", complete: t.ohp_percent > 0 },
    ];
  }, [tender, areasSummary]);

  /* ---------- Compute totals ---------- */
  const totals = useMemo(() => {
    let materialsSub = 0;
    let labourSub = 0;
    let prepSub = 0;

    for (const line of tender.pricing_lines) {
      const adjM2 = line.adjusted_m2 || computeAdjustedM2(line.total_m2, line.wastage_pct);
      materialsSub += adjM2 * line.material_cost_m2;
      labourSub += adjM2 * line.labour_cost_m2;
      prepSub += adjM2 * (line.adhesive_cost_m2 + line.primer_cost_m2 + line.smoothing_cost_m2);
    }

    const accessoriesSub = tender.accessories.reduce((sum, a) => sum + a.quantity * a.unit_price, 0);
    const subtotal = materialsSub + labourSub + prepSub + accessoriesSub;
    const prelimsAmount = tender.prelims_type === "percentage"
      ? subtotal * (tender.prelims_value / 100)
      : tender.prelims_value;
    const ohpAmount = (subtotal + prelimsAmount) * (tender.ohp_percent / 100);
    const totalExVat = subtotal + prelimsAmount + ohpAmount;
    const vatRate = pricing && pricing.vat_registered ? 0.2 : 0;
    const vat = totalExVat * vatRate;
    const totalIncVat = totalExVat + vat;

    return { materialsSub, labourSub, prepSub, accessoriesSub, prelimsAmount, ohpAmount, totalExVat, vat, totalIncVat, vatRate };
  }, [tender, pricing]);

  /* ---------- Sync areas summary from AreasPanel (polling fallback) ---------- */
  useEffect(() => {
    if (!ROOM_BY_ROOM_FORMATS.has(tender.format)) return;
    async function fetchAreas() {
      try {
        const res = await fetch(`/api/job-areas?job_id=${jobId}`);
        if (!res.ok) return;
        const { areas } = await res.json();
        if (!Array.isArray(areas)) return;
        const summary: Record<string, number> = {};
        for (const a of areas) {
          const ft = a.flooring_type || "other";
          summary[ft] = (summary[ft] || 0) + (a.m2_calculated || 0) * (a.qty || 1);
        }
        setAreasSummary(summary);
      } catch { /* ignore */ }
    }
    void fetchAreas();
    const interval = setInterval(fetchAreas, 5000);
    return () => clearInterval(interval);
  }, [jobId, tender.format]);

  /* ------------------------------------------------------------------ */
  /*  Spec CRUD                                                         */
  /* ------------------------------------------------------------------ */

  const addSpec = useCallback(() => {
    const spec: TenderSpec = {
      id: uid(),
      flooring_type: "",
      nbs_code: null,
      product: "",
      adhesive: null,
      primer_dpm: null,
      smoothing_compound: null,
      installation_method: null,
      notes: null,
    };
    update({ specs: [...tender.specs, spec] });
  }, [tender.specs, update]);

  const updateSpec = useCallback((id: string, patch: Partial<TenderSpec>) => {
    update({ specs: tender.specs.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }, [tender.specs, update]);

  const removeSpec = useCallback((id: string) => {
    update({ specs: tender.specs.filter((s) => s.id !== id) });
  }, [tender.specs, update]);

  /* ------------------------------------------------------------------ */
  /*  Pricing lines CRUD                                                */
  /* ------------------------------------------------------------------ */

  const addPricingLine = useCallback((flooringType: string, m2: number = 0) => {
    const filled = autoFillLine(flooringType);
    const adjM2 = computeAdjustedM2(m2, filled.wastage_pct);
    const line: TenderPricingLine = { ...filled, total_m2: m2, adjusted_m2: adjM2, line_total: 0 };
    line.line_total = computeLineTotal(line);
    update({ pricing_lines: [...tender.pricing_lines, line] });
  }, [tender.pricing_lines, autoFillLine, update]);

  const updatePricingLine = useCallback((idx: number, patch: Partial<TenderPricingLine>) => {
    const lines = [...tender.pricing_lines];
    const merged = { ...lines[idx], ...patch };
    merged.adjusted_m2 = computeAdjustedM2(merged.total_m2, merged.wastage_pct);
    merged.line_total = computeLineTotal(merged);
    lines[idx] = merged;
    update({ pricing_lines: lines });
  }, [tender.pricing_lines, update]);

  const removePricingLine = useCallback((idx: number) => {
    update({ pricing_lines: tender.pricing_lines.filter((_, i) => i !== idx) });
  }, [tender.pricing_lines, update]);

  /* ------------------------------------------------------------------ */
  /*  Accessory CRUD                                                    */
  /* ------------------------------------------------------------------ */

  const addAccessory = useCallback((preset?: Omit<TenderAccessory, "id">) => {
    const acc: TenderAccessory = preset
      ? { ...preset, id: uid() }
      : { id: uid(), description: "", unit: "nr", quantity: 0, unit_price: 0 };
    update({ accessories: [...tender.accessories, acc] });
  }, [tender.accessories, update]);

  const updateAccessory = useCallback((id: string, patch: Partial<TenderAccessory>) => {
    update({ accessories: tender.accessories.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  }, [tender.accessories, update]);

  const removeAccessory = useCallback((id: string) => {
    update({ accessories: tender.accessories.filter((a) => a.id !== id) });
  }, [tender.accessories, update]);

  /* ------------------------------------------------------------------ */
  /*  Auto-populate pricing from specs + areas                          */
  /* ------------------------------------------------------------------ */

  const syncPricingFromData = useCallback(() => {
    const existingTypes = new Set(tender.pricing_lines.map((l) => l.flooring_type));
    const newLines = [...tender.pricing_lines];

    // From specs
    for (const spec of tender.specs) {
      if (spec.flooring_type && !existingTypes.has(spec.flooring_type)) {
        const m2 = areasSummary[spec.flooring_type] || 0;
        const filled = autoFillLine(spec.flooring_type);
        const adjM2 = computeAdjustedM2(m2, filled.wastage_pct);
        const line: TenderPricingLine = { ...filled, total_m2: m2, adjusted_m2: adjM2, line_total: 0 };
        line.line_total = computeLineTotal(line);
        newLines.push(line);
        existingTypes.add(spec.flooring_type);
      }
    }

    // From areas summary (types not in specs)
    for (const [ft, m2] of Object.entries(areasSummary)) {
      if (!existingTypes.has(ft) && m2 > 0) {
        const filled = autoFillLine(ft);
        const adjM2 = computeAdjustedM2(m2, filled.wastage_pct);
        const line: TenderPricingLine = { ...filled, total_m2: m2, adjusted_m2: adjM2, line_total: 0 };
        line.line_total = computeLineTotal(line);
        newLines.push(line);
        existingTypes.add(ft);
      }
    }

    // Update m2 from areas summary for existing lines
    for (let i = 0; i < newLines.length; i++) {
      const ft = newLines[i].flooring_type;
      if (areasSummary[ft] !== undefined && ROOM_BY_ROOM_FORMATS.has(tender.format)) {
        const m2 = areasSummary[ft];
        if (m2 !== newLines[i].total_m2) {
          const adjM2 = computeAdjustedM2(m2, newLines[i].wastage_pct);
          newLines[i] = { ...newLines[i], total_m2: m2, adjusted_m2: adjM2 };
          newLines[i].line_total = computeLineTotal(newLines[i]);
        }
      }
    }

    update({ pricing_lines: newLines });
  }, [tender.specs, tender.pricing_lines, tender.format, areasSummary, autoFillLine, update]);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
        <div style={{ width: "24px", height: "24px", border: "2px solid rgba(56,189,248,0.3)", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isRoomByRoom = ROOM_BY_ROOM_FORMATS.has(tender.format);
  const dl = deadlineInfo(tender.deadline);
  const canSubmit = tender.pricing_lines.length > 0 && tender.pricing_lines.every((l) => l.total_m2 > 0 && l.line_total > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* ---- Header ---- */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <EditCell
              value={tender.tender_ref}
              onChange={(v) => update({ tender_ref: v || null })}
              placeholder="Tender ref"
              style={{ fontWeight: 700, fontSize: "15px" }}
            />
            <EditCell
              value={tender.project_name}
              onChange={(v) => update({ project_name: v || null })}
              placeholder="Project name"
              style={{ fontSize: "14px" }}
            />
            <EditCell
              value={tender.client_org}
              onChange={(v) => update({ client_org: v || null })}
              placeholder="Client org"
              style={{ fontSize: "13px" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Deadline</span>
            <EditCell
              value={tender.deadline}
              onChange={(v) => update({ deadline: v || null })}
              type="date"
              placeholder="Set deadline"
            />
            {dl ? (
              <span style={{
                fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                background: `${dl.color}20`, color: dl.color, border: `1px solid ${dl.color}40`,
              }}>
                {dl.label}
              </span>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Save indicator */}
          <span style={{
            fontSize: "11px", fontWeight: 600,
            color: saveState === "saving" ? "#fbbf24" : saveState === "saved" ? "#34d399" : saveState === "error" ? "#ef4444" : "transparent",
            transition: "color 0.2s",
          }}>
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "\u00A0"}
          </span>

          {/* Format selector */}
          <select
            value={tender.format}
            onChange={(e) => update({ format: e.target.value as TenderFormat })}
            style={{
              background: "#1e293b",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "8px",
              color: "#e2e8f0",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
            }}
          >
            {Object.entries(TENDER_FORMAT_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Progress ---- */}
      <ProgressTracker steps={progress} />

      {/* ---- Specs Section ---- */}
      <Section
        title={SECTION_LABELS.specs}
        sectionKey="specs"
        expanded={expanded.has("specs")}
        onToggle={toggleSection}
        badge={
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8" }}>
            {tender.specs.length} spec{tender.specs.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <div style={{ overflowX: "auto", marginTop: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {["Flooring Type", "NBS Code", "Product", "Adhesive", "Primer/DPM", "Smoothing", "Method", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "8px 6px", fontSize: "10px", fontWeight: 700,
                    color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid rgba(148,163,184,0.1)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tender.specs.map((spec) => (
                <tr key={spec.id}>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.flooring_type} onChange={(v) => updateSpec(spec.id, { flooring_type: v })} selectOptions={FLOORING_TYPES} />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.nbs_code} onChange={(v) => updateSpec(spec.id, { nbs_code: v || null })} placeholder="M50/110" />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.product} onChange={(v) => updateSpec(spec.id, { product: v })} placeholder="Product name" />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.adhesive} onChange={(v) => updateSpec(spec.id, { adhesive: v || null })} placeholder="—" />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.primer_dpm} onChange={(v) => updateSpec(spec.id, { primer_dpm: v || null })} placeholder="—" />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.smoothing_compound} onChange={(v) => updateSpec(spec.id, { smoothing_compound: v || null })} placeholder="—" />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={spec.installation_method} onChange={(v) => updateSpec(spec.id, { installation_method: v || null })} placeholder="—" />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <button
                      type="button"
                      onClick={() => removeSpec(spec.id)}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        color: "#ef4444", fontSize: "14px", padding: "4px",
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addSpec}
          style={{
            marginTop: "10px", padding: "8px 16px", fontSize: "12px", fontWeight: 600,
            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
            borderRadius: "8px", color: "#38bdf8", cursor: "pointer",
          }}
        >
          + Add Spec
        </button>
      </Section>

      {/* ---- Quantities Section ---- */}
      <Section
        title={SECTION_LABELS.quantities}
        sectionKey="quantities"
        expanded={expanded.has("quantities")}
        onToggle={toggleSection}
        badge={
          isRoomByRoom ? (
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#38bdf8" }}>Room-by-room</span>
          ) : tender.format === "site_measure" ? (
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#fb923c" }}>Site measure</span>
          ) : (
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#94a3b8" }}>Overall m²</span>
          )
        }
      >
        <div style={{ marginTop: "12px" }}>
          {/* Room-by-room mode */}
          {isRoomByRoom ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <AreasPanel jobId={jobId} />
              {/* Summary by type */}
              {Object.keys(areasSummary).length > 0 ? (
                <div style={{
                  background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.12)",
                  borderRadius: "10px", padding: "12px 16px",
                }}>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                    Summary by type
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    {Object.entries(areasSummary).map(([ft, m2]) => (
                      <div key={ft} style={{ fontSize: "13px" }}>
                        <span style={{ color: "#94a3b8", fontWeight: 500 }}>
                          {FLOORING_TYPES.find((f) => f.value === ft)?.label || ft}:
                        </span>{" "}
                        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{fmt(m2)} m²</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Overall m2 mode */}
          {!isRoomByRoom && tender.format !== "site_measure" ? (
            <div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr>
                    {["Flooring Type", "Total m²", "Wastage %", "Adjusted m²"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "8px 6px", fontSize: "10px", fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
                        borderBottom: "1px solid rgba(148,163,184,0.1)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tender.pricing_lines.map((line, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: "6px", color: "#e2e8f0" }}>
                        {FLOORING_TYPES.find((f) => f.value === line.flooring_type)?.label || line.flooring_type}
                      </td>
                      <td style={{ padding: "6px" }}>
                        <EditCell
                          value={line.total_m2}
                          type="number"
                          onChange={(v) => updatePricingLine(idx, { total_m2: parseFloat(v) || 0 })}
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <EditCell
                          value={line.wastage_pct}
                          type="number"
                          onChange={(v) => updatePricingLine(idx, { wastage_pct: parseFloat(v) || 0 })}
                        />
                      </td>
                      <td style={{ padding: "6px", color: "#e2e8f0", fontWeight: 600 }}>
                        {fmt(line.adjusted_m2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tender.pricing_lines.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", padding: "12px 6px" }}>
                  Add specs above, then click &quot;Sync Pricing&quot; to populate quantities.
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Site measure mode */}
          {tender.format === "site_measure" ? (
            <div>
              <div style={{
                background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
                borderRadius: "10px", padding: "12px 16px", marginBottom: "12px",
              }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#fbbf24", margin: 0 }}>
                  Site measurement required — enter estimated m² per type or leave blank until measured.
                </p>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr>
                    {["Flooring Type", "Estimated m²", "Wastage %", "Adjusted m²"].map((h) => (
                      <th key={h} style={{
                        textAlign: "left", padding: "8px 6px", fontSize: "10px", fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
                        borderBottom: "1px solid rgba(148,163,184,0.1)",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tender.pricing_lines.map((line, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: "6px", color: "#e2e8f0" }}>
                        {FLOORING_TYPES.find((f) => f.value === line.flooring_type)?.label || line.flooring_type}
                      </td>
                      <td style={{ padding: "6px" }}>
                        <EditCell
                          value={line.total_m2 || null}
                          type="number"
                          onChange={(v) => updatePricingLine(idx, { total_m2: parseFloat(v) || 0 })}
                          placeholder="TBC"
                        />
                      </td>
                      <td style={{ padding: "6px" }}>
                        <EditCell
                          value={line.wastage_pct}
                          type="number"
                          onChange={(v) => updatePricingLine(idx, { wastage_pct: parseFloat(v) || 0 })}
                        />
                      </td>
                      <td style={{ padding: "6px", color: "#e2e8f0", fontWeight: 600 }}>
                        {line.total_m2 ? fmt(line.adjusted_m2) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </Section>

      {/* ---- Pricing Build-Up ---- */}
      <Section
        title={SECTION_LABELS.pricing}
        sectionKey="pricing"
        expanded={expanded.has("pricing")}
        onToggle={toggleSection}
        badge={
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8" }}>
            {tender.pricing_lines.length} line{tender.pricing_lines.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <div style={{ marginTop: "12px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={syncPricingFromData}
              style={{
                padding: "7px 14px", fontSize: "12px", fontWeight: 600,
                background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: "8px", color: "#38bdf8", cursor: "pointer",
              }}
            >
              Sync Pricing from Specs + Areas
            </button>
            <select
              onChange={(e) => { if (e.target.value) { addPricingLine(e.target.value); e.target.value = ""; } }}
              style={{
                background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px", color: "#94a3b8", padding: "7px 10px",
                fontSize: "12px", cursor: "pointer", outline: "none",
              }}
              defaultValue=""
            >
              <option value="" disabled>+ Add line...</option>
              {FLOORING_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr>
                  {["Type", "Adj m²", "Material/m²", "Adhesive/m²", "Primer/m²", "Smoothing/m²", "Labour/m²", "Line Total", ""].map((h) => (
                    <th key={h} style={{
                      textAlign: h === "" ? "center" : "left", padding: "8px 4px", fontSize: "10px",
                      fontWeight: 700, color: "#64748b", textTransform: "uppercase",
                      letterSpacing: "0.05em", borderBottom: "1px solid rgba(148,163,184,0.1)",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tender.pricing_lines.map((line, idx) => {
                  const keys = FLOORING_TO_PRICING_KEY[line.flooring_type];
                  const autoMat = keys && pricing ? Number(pricing[keys.mat]) || 0 : 0;
                  const autoLab = keys && pricing ? Number(pricing[keys.lab]) || 0 : 0;

                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                      <td style={{ padding: "6px 4px", color: "#e2e8f0", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {FLOORING_TYPES.find((f) => f.value === line.flooring_type)?.label || line.flooring_type}
                      </td>
                      <td style={{ padding: "6px 4px", color: "#94a3b8", fontWeight: 600 }}>
                        {fmt(line.adjusted_m2)}
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <EditCell value={line.material_cost_m2} type="number" onChange={(v) => updatePricingLine(idx, { material_cost_m2: parseFloat(v) || 0 })} />
                          <SourceBadge auto={autoMat > 0 && line.material_cost_m2 === autoMat} />
                        </span>
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <EditCell value={line.adhesive_cost_m2} type="number" onChange={(v) => updatePricingLine(idx, { adhesive_cost_m2: parseFloat(v) || 0 })} />
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <EditCell value={line.primer_cost_m2} type="number" onChange={(v) => updatePricingLine(idx, { primer_cost_m2: parseFloat(v) || 0 })} />
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <EditCell value={line.smoothing_cost_m2} type="number" onChange={(v) => updatePricingLine(idx, { smoothing_cost_m2: parseFloat(v) || 0 })} />
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <EditCell value={line.labour_cost_m2} type="number" onChange={(v) => updatePricingLine(idx, { labour_cost_m2: parseFloat(v) || 0 })} />
                          <SourceBadge auto={autoLab > 0 && line.labour_cost_m2 === autoLab} />
                        </span>
                      </td>
                      <td style={{ padding: "6px 4px", color: "#e2e8f0", fontWeight: 700, whiteSpace: "nowrap" }}>
                        £{fmt(line.line_total)}
                      </td>
                      <td style={{ padding: "6px 4px", textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => removePricingLine(idx)}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "14px", padding: "4px" }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      {/* ---- Accessories ---- */}
      <Section
        title={SECTION_LABELS.accessories}
        sectionKey="accessories"
        expanded={expanded.has("accessories")}
        onToggle={toggleSection}
        badge={
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8" }}>
            {tender.accessories.length} item{tender.accessories.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <div style={{ marginTop: "12px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {["Description", "Unit", "Qty", "Unit Price", "Total", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: "left", padding: "8px 6px", fontSize: "10px", fontWeight: 700,
                    color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
                    borderBottom: "1px solid rgba(148,163,184,0.1)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tender.accessories.map((acc) => (
                <tr key={acc.id}>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={acc.description} onChange={(v) => updateAccessory(acc.id, { description: v })} placeholder="Description" style={{ minWidth: "120px" }} />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell
                      value={acc.unit}
                      onChange={(v) => updateAccessory(acc.id, { unit: v as TenderAccessory["unit"] })}
                      selectOptions={ACCESSORY_UNITS as unknown as { value: string; label: string }[]}
                    />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={acc.quantity} type="number" onChange={(v) => updateAccessory(acc.id, { quantity: parseFloat(v) || 0 })} />
                  </td>
                  <td style={{ padding: "6px" }}>
                    <EditCell value={acc.unit_price} type="number" onChange={(v) => updateAccessory(acc.id, { unit_price: parseFloat(v) || 0 })} />
                  </td>
                  <td style={{ padding: "6px", color: "#e2e8f0", fontWeight: 600 }}>
                    £{fmt(acc.quantity * acc.unit_price)}
                  </td>
                  <td style={{ padding: "6px" }}>
                    <button
                      type="button"
                      onClick={() => removeAccessory(acc.id)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "14px", padding: "4px" }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => addAccessory()}
              style={{
                padding: "7px 14px", fontSize: "12px", fontWeight: 600,
                background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                borderRadius: "8px", color: "#38bdf8", cursor: "pointer",
              }}
            >
              + Add Accessory
            </button>
            <select
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                if (!isNaN(idx)) addAccessory(ACCESSORY_PRESETS[idx]);
                e.target.value = "";
              }}
              style={{
                background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px", color: "#94a3b8", padding: "7px 10px",
                fontSize: "12px", cursor: "pointer", outline: "none",
              }}
              defaultValue=""
            >
              <option value="" disabled>Presets...</option>
              {ACCESSORY_PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.description}</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* ---- Prelims & OH&P ---- */}
      <Section
        title={SECTION_LABELS.prelims}
        sectionKey="prelims"
        expanded={expanded.has("prelims")}
        onToggle={toggleSection}
      >
        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", minWidth: "80px" }}>Prelims</span>
            <select
              value={tender.prelims_type}
              onChange={(e) => update({ prelims_type: e.target.value as "percentage" | "lump_sum" })}
              style={{
                background: "#1e293b", border: "1px solid rgba(148,163,184,0.2)",
                borderRadius: "8px", color: "#e2e8f0", padding: "6px 10px",
                fontSize: "13px", cursor: "pointer", outline: "none",
              }}
            >
              <option value="percentage">Percentage (%)</option>
              <option value="lump_sum">Lump Sum (£)</option>
            </select>
            <EditCell
              value={tender.prelims_value}
              type="number"
              onChange={(v) => update({ prelims_value: parseFloat(v) || 0 })}
            />
            {tender.prelims_type === "percentage" ? (
              <span style={{ fontSize: "12px", color: "#64748b" }}>= £{fmt(totals.prelimsAmount)}</span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", minWidth: "80px" }}>OH&P %</span>
            <EditCell
              value={tender.ohp_percent}
              type="number"
              onChange={(v) => update({ ohp_percent: parseFloat(v) || 0 })}
            />
            <span style={{ fontSize: "12px", color: "#64748b" }}>= £{fmt(totals.ohpAmount)}</span>
          </div>
        </div>
      </Section>

      {/* ---- Totals Summary ---- */}
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.15)",
        borderRadius: "14px", padding: "18px 20px",
      }}>
        <h3 style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>
          Tender Total
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
          {[
            { label: "Materials", value: totals.materialsSub },
            { label: "Labour", value: totals.labourSub },
            { label: "Prep / Sundries", value: totals.prepSub },
            { label: "Accessories", value: totals.accessoriesSub },
            { label: "Prelims", value: totals.prelimsAmount },
            { label: "OH&P", value: totals.ohpAmount },
          ].map((item) => (
            <div key={item.label} style={{
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.08)",
              borderRadius: "10px", padding: "10px 12px",
            }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
                {item.label}
              </p>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
                £{fmt(item.value)}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(148,163,184,0.12)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "12px",
        }}>
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: "0 0 2px" }}>Total (ex VAT)</p>
              <p style={{ fontSize: "20px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>£{fmt(totals.totalExVat)}</p>
            </div>
            {totals.vatRate > 0 ? (
              <>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: "0 0 2px" }}>VAT (20%)</p>
                  <p style={{ fontSize: "16px", fontWeight: 700, color: "#94a3b8", margin: 0 }}>£{fmt(totals.vat)}</p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: "0 0 2px" }}>Total (inc VAT)</p>
                  <p style={{ fontSize: "20px", fontWeight: 800, color: "#f1f5f9", margin: 0 }}>£{fmt(totals.totalIncVat)}</p>
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              // TODO: wire to N8N tender quote generation webhook
              alert("Generate Tender Quote — wire to N8N webhook");
            }}
            style={{
              padding: "12px 28px", fontSize: "14px", fontWeight: 700,
              background: canSubmit ? "#f97316" : "rgba(148,163,184,0.15)",
              color: canSubmit ? "#fff" : "#64748b",
              border: "none", borderRadius: "10px", cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            Generate Tender Quote
          </button>
        </div>
      </div>

      {/* ---- Notes ---- */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: "14px", padding: "14px 18px",
      }}>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
          Notes
        </p>
        <textarea
          value={tender.notes || ""}
          onChange={(e) => update({ notes: e.target.value || null })}
          placeholder="Internal notes, exclusions, caveats..."
          rows={3}
          style={{
            width: "100%", background: "#0f172a", border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: "8px", color: "#e2e8f0", padding: "10px 12px",
            fontSize: "13px", resize: "vertical", outline: "none",
            fontFamily: "inherit",
          }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Source badge                                                        */
/* ------------------------------------------------------------------ */

function SourceBadge({ auto }: { auto: boolean }) {
  return (
    <span style={{
      fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "4px",
      background: auto ? "rgba(52,211,153,0.15)" : "rgba(148,163,184,0.1)",
      color: auto ? "#34d399" : "#64748b",
      border: `1px solid ${auto ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.15)"}`,
      textTransform: "uppercase",
      letterSpacing: "0.03em",
    }}>
      {auto ? "Auto" : "Manual"}
    </span>
  );
}
