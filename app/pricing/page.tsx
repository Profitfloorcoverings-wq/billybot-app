"use client";

import { useEffect, useMemo, useState } from "react";

type ServiceConfig = { key: string; label: string; defaultOn?: boolean };
type RateConfig = {
  key: string;
  label: string;
  defaultValue: number;
  services?: string[];
  always?: boolean;
};

type MarkupConfig = {
  key: string;
  label: string;
  defaultValue: number;
};

type MarkupValue = { value: number; unit: "percent" | "per_m2" };

type PricingFormState = {
  services: Record<string, boolean>;
  markups: Record<string, MarkupValue>;
  materials: Record<string, number>;
  labour: Record<string, number>;
  min_job_charge: number;
  day_rate_per_fitter: number;
  use_breakpoints: "yes" | "no";
  breakpoint_text: string;
  vat_status: "registered" | "exempt";
  labour_split: "split" | "no_split";
};

const SERVICES: ServiceConfig[] = [
  { key: "service_domestic_carpets", label: "Domestic carpets", defaultOn: true },
  { key: "service_commercial_carpets", label: "Commercial carpets (glue-down)", defaultOn: true },
  { key: "service_carpet_tiles", label: "Carpet tiles", defaultOn: true },
  { key: "service_lvt", label: "LVT / Luxury Vinyl Tiles", defaultOn: true },
  { key: "service_vinyl_domestic", label: "Domestic vinyl", defaultOn: true },
  { key: "service_vinyl_safety", label: "Commercial / safety vinyl", defaultOn: true },
  { key: "service_laminate", label: "Laminate" },
  { key: "service_wood", label: "Solid / engineered wood" },
  { key: "service_whiterock", label: "Altro Whiterock (wall cladding)" },
  { key: "service_ceramic", label: "Ceramic tiles" },
];

const MARKUP_CONFIG: MarkupConfig[] = [
  { key: "service_domestic_carpets", label: "Domestic carpet", defaultValue: 50 },
  { key: "service_commercial_carpets", label: "Commercial carpet", defaultValue: 50 },
  { key: "service_carpet_tiles", label: "Carpet tiles", defaultValue: 50 },
  { key: "service_lvt", label: "LVT", defaultValue: 50 },
  { key: "service_vinyl_domestic", label: "Vinyl domestic", defaultValue: 50 },
  { key: "service_vinyl_safety", label: "Safety / commercial vinyl", defaultValue: 50 },
  { key: "service_laminate", label: "Laminate", defaultValue: 50 },
  { key: "service_wood", label: "Solid / engineered wood", defaultValue: 50 },
  { key: "service_whiterock", label: "Wall cladding", defaultValue: 50 },
  { key: "service_ceramic", label: "Ceramic tiles", defaultValue: 50 },
];

const MATERIAL_CONFIG: RateConfig[] = [
  { key: "mat_lvt", label: "LVT per m² £", defaultValue: 26, services: ["service_lvt"] },
  { key: "mat_ceramic", label: "Ceramic tiles per m² £", defaultValue: 30, services: ["service_ceramic"] },
  {
    key: "mat_carpet_domestic",
    label: "Carpet domestic per m² £",
    defaultValue: 12,
    services: ["service_domestic_carpets"],
  },
  {
    key: "mat_carpet_commercial",
    label: "Carpet commercial per m² £",
    defaultValue: 16,
    services: ["service_commercial_carpets"],
  },
  { key: "mat_safety", label: "Safety flooring per m² £", defaultValue: 18, services: ["service_vinyl_safety"] },
  { key: "mat_vinyl_domestic", label: "Vinyl domestic per m² £", defaultValue: 14, services: ["service_vinyl_domestic"] },
  { key: "mat_vinyl_commercial", label: "Vinyl commercial per m² £", defaultValue: 18, services: ["service_vinyl_safety"] },
  { key: "mat_carpet_tiles", label: "Carpet tiles per m² £", defaultValue: 19.5, services: ["service_carpet_tiles"] },
  { key: "mat_wall_cladding", label: "Wall cladding per m² £", defaultValue: 35, services: ["service_whiterock"] },
  {
    key: "mat_gripper",
    label: "Gripper per m £",
    defaultValue: 4,
    services: ["service_domestic_carpets", "service_commercial_carpets", "service_carpet_tiles"],
  },
  {
    key: "mat_underlay",
    label: "Underlay per m² £",
    defaultValue: 6,
    services: ["service_domestic_carpets", "service_commercial_carpets", "service_carpet_tiles"],
  },
  { key: "mat_coved", label: "Coved skirting materials per m £", defaultValue: 10, services: ["service_vinyl_safety"] },
  { key: "mat_weld", label: "Weld rod per roll £", defaultValue: 25, services: ["service_vinyl_safety"] },
  { key: "mat_adhesive", label: "Adhesive per m² £", defaultValue: 3, always: true },
  { key: "mat_ply", label: "Ply board per m² £", defaultValue: 12, always: true },
  { key: "mat_latex", label: "Latex per m² £", defaultValue: 10, always: true },
  { key: "mat_door_bars", label: "Door bars per m £", defaultValue: 8, always: true },
  { key: "mat_nosings", label: "Standard nosings per m £", defaultValue: 25, always: true },
  { key: "mat_matting", label: "Entrance matting per m² £", defaultValue: 35, always: true },
];

const LABOUR_CONFIG: RateConfig[] = [
  {
    key: "lab_carpet_domestic",
    label: "Labour carpet domestic per m² £",
    defaultValue: 8,
    services: ["service_domestic_carpets"],
  },
  {
    key: "lab_carpet_commercial",
    label: "Labour carpet commercial per m² £",
    defaultValue: 9,
    services: ["service_commercial_carpets"],
  },
  { key: "lab_lvt", label: "Labour LVT per m² £", defaultValue: 16, services: ["service_lvt"] },
  { key: "lab_ceramic", label: "Labour ceramic tiles per m² £", defaultValue: 25, services: ["service_ceramic"] },
  { key: "lab_safety", label: "Labour safety flooring per m² £", defaultValue: 22, services: ["service_vinyl_safety"] },
  { key: "lab_vinyl_domestic", label: "Labour vinyl domestic per m² £", defaultValue: 12, services: ["service_vinyl_domestic"] },
  { key: "lab_vinyl_commercial", label: "Labour vinyl commercial per m² £", defaultValue: 14, services: ["service_vinyl_safety"] },
  { key: "lab_carpet_tiles", label: "Labour carpet tiles per m² £", defaultValue: 8, services: ["service_carpet_tiles"] },
  { key: "lab_wall_cladding", label: "Labour wall cladding per m² £", defaultValue: 16, services: ["service_whiterock"] },
  { key: "lab_coved", label: "Labour coved skirting per m £", defaultValue: 12, services: ["service_vinyl_safety"] },
  { key: "lab_ply", label: "Labour ply board per m² £", defaultValue: 6, always: true },
  { key: "lab_latex", label: "Labour latex per m² £", defaultValue: 6, always: true },
  { key: "lab_nosings", label: "Labour nosings per m £", defaultValue: 8, always: true },
  { key: "lab_matting", label: "Labour matting per m² £", defaultValue: 8, always: true },
  { key: "lab_general", label: "Labour general £/m²", defaultValue: 1, always: true },
  { key: "lab_uplift", label: "Uplift existing flooring per m² £", defaultValue: 3, always: true },
  { key: "lab_waste", label: "Waste disposal per m² £", defaultValue: 2, always: true },
  { key: "lab_furniture", label: "Furniture removal per room £", defaultValue: 25, always: true },
];

const defaultServices = SERVICES.reduce<Record<string, boolean>>((acc, svc) => {
  acc[svc.key] = !!svc.defaultOn;
  return acc;
}, {});

const defaultMarkups = MARKUP_CONFIG.reduce<Record<string, MarkupValue>>((acc, cfg) => {
  acc[cfg.key] = { value: cfg.defaultValue, unit: "percent" };
  return acc;
}, {});

const defaultMaterials = MATERIAL_CONFIG.reduce<Record<string, number>>((acc, cfg) => {
  acc[cfg.key] = cfg.defaultValue;
  return acc;
}, {});

const defaultLabour = LABOUR_CONFIG.reduce<Record<string, number>>((acc, cfg) => {
  acc[cfg.key] = cfg.defaultValue;
  return acc;
}, {});

const DEFAULT_FORM: PricingFormState = {
  services: defaultServices,
  markups: defaultMarkups,
  materials: defaultMaterials,
  labour: defaultLabour,
  min_job_charge: 150,
  day_rate_per_fitter: 200,
  use_breakpoints: "no",
  breakpoint_text: "",
  vat_status: "registered",
  labour_split: "split",
};

export default function PricingPage() {
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeServices = useMemo(() => {
    return new Set(Object.keys(form.services).filter((key) => form.services[key]));
  }, [form.services]);

  const mergeForm = (
    current: PricingFormState,
    incoming: Partial<PricingFormState>
  ): PricingFormState => {
    const next = { ...current };

    if (incoming.services) {
      next.services = { ...current.services, ...incoming.services };
    }
    if (incoming.markups) {
      const merged: Record<string, MarkupValue> = { ...current.markups };
      for (const key of Object.keys(incoming.markups)) {
        const value = incoming.markups[key];
        if (value && typeof value === "object" && "value" in value && "unit" in value) {
          merged[key] = {
            value: Number((value as MarkupValue).value) || 0,
            unit: (value as MarkupValue).unit === "per_m2" ? "per_m2" : "percent",
          };
        }
      }
      next.markups = merged;
    }
    if (incoming.materials) {
      const merged: Record<string, number> = { ...current.materials };
      for (const [key, val] of Object.entries(incoming.materials)) {
        if (typeof val === "number") merged[key] = val;
      }
      next.materials = merged;
    }
    if (incoming.labour) {
      const merged: Record<string, number> = { ...current.labour };
      for (const [key, val] of Object.entries(incoming.labour)) {
        if (typeof val === "number") merged[key] = val;
      }
      next.labour = merged;
    }

    if (typeof incoming.min_job_charge === "number") {
      next.min_job_charge = incoming.min_job_charge;
    }
    if (typeof incoming.day_rate_per_fitter === "number") {
      next.day_rate_per_fitter = incoming.day_rate_per_fitter;
    }
    if (incoming.use_breakpoints === "yes" || incoming.use_breakpoints === "no") {
      next.use_breakpoints = incoming.use_breakpoints;
    }
    if (typeof incoming.breakpoint_text === "string") {
      next.breakpoint_text = incoming.breakpoint_text;
    }
    if (incoming.vat_status === "registered" || incoming.vat_status === "exempt") {
      next.vat_status = incoming.vat_status;
    }
    if (incoming.labour_split === "split" || incoming.labour_split === "no_split") {
      next.labour_split = incoming.labour_split;
    }

    return next;
  };

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        const res = await fetch("/api/pricing", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load pricing (${res.status})`);
        }
        const data = (await res.json()) as { data?: Partial<PricingFormState> | null };
        if (data?.data) {
          setForm((prev) => mergeForm(prev, data.data ?? {}));
        }
      } catch (err) {
        console.error("Pricing load error", err);
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load pricing"
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleServiceToggle = (key: string) => {
    setForm((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [key]: !prev.services[key],
      },
    }));
  };

  const handleMarkupChange = (key: string, value: Partial<MarkupValue>) => {
    setForm((prev) => ({
      ...prev,
      markups: {
        ...prev.markups,
        [key]: {
          value: value.value !== undefined ? Number(value.value) : prev.markups[key]?.value || 0,
          unit: value.unit ?? prev.markups[key]?.unit ?? "percent",
        },
      },
    }));
  };

  const handleNumberChange = (
    key: "min_job_charge" | "day_rate_per_fitter",
    value: number
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRateChange = (collection: "materials" | "labour", key: string, value: number) => {
    setForm((prev) => ({
      ...prev,
      [collection]: {
        ...prev[collection],
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setError(null);

    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: form }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save (${res.status})`);
      }

      setStatus("Pricing saved");
    } catch (err) {
      console.error("Pricing save error", err);
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save"
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredRates = (config: RateConfig[]) => {
    return config.filter((cfg) => cfg.always || (cfg.services && cfg.services.some((svc) => activeServices.has(svc))));
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[var(--line)] bg-[rgba(13,19,35,0.85)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pricing</p>
          <h1 className="text-3xl font-black text-white">Set your pricing logic</h1>
          <p className="max-w-3xl text-sm text-[var(--muted)]">
            Update the services you offer, set base rates, markups, VAT, and labour display. BillyBot will use these
            settings instantly when quoting.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[rgba(37,99,235,0.12)] px-4 py-3 text-sm font-semibold text-[var(--text)]">
          <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
          Live pricing profile
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Services</h2>
                <p className="text-sm text-[var(--muted)]">Toggle the jobs you take on.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SERVICES.map((svc) => {
                const on = form.services[svc.key];
                return (
                  <button
                    key={svc.key}
                    type="button"
                    onClick={() => handleServiceToggle(svc.key)}
                    className={`flex items-start justify-between rounded-2xl border px-4 py-3 text-left shadow-sm transition ${
                      on
                        ? "border-[rgba(249,115,22,0.5)] bg-[rgba(249,115,22,0.12)]"
                        : "border-[var(--line)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.14)]"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white">{svc.label}</div>
                      <div className="text-xs text-[var(--muted)]">{on ? "Active" : "Off"}</div>
                    </div>
                    <span
                      className={`mt-1 inline-flex h-6 w-10 items-center rounded-full border px-1 transition ${
                        on
                          ? "border-[rgba(249,115,22,0.8)] bg-gradient-to-r from-[var(--accent1)] to-[var(--accent2)]"
                          : "border-[var(--line)] bg-[rgba(255,255,255,0.04)]"
                      }`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full bg-white shadow transition ${on ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Markup logic</h2>
                <p className="text-sm text-[var(--muted)]">Set material markups per service.</p>
              </div>
            </div>

            <div className="space-y-3">
              {MARKUP_CONFIG.filter((cfg) => activeServices.has(cfg.key)).map((cfg) => {
                const entry = form.markups[cfg.key] ?? { value: cfg.defaultValue, unit: "percent" };
                return (
                  <div key={cfg.key} className="grid items-center gap-3 sm:grid-cols-[1.3fr_0.7fr_0.7fr]">
                    <label className="text-sm font-semibold text-white">{cfg.label}</label>
                    <input
                      type="number"
                      className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                      value={entry.value}
                      min={0}
                      step={0.1}
                      onChange={(e) => handleMarkupChange(cfg.key, { value: Number(e.target.value) })}
                      required
                    />
                    <select
                      className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                      value={entry.unit}
                      onChange={(e) =>
                        handleMarkupChange(cfg.key, {
                          unit: e.target.value === "per_m2" ? "per_m2" : "percent",
                        })
                      }
                    >
                      <option value="percent">%</option>
                      <option value="per_m2">£/m²</option>
                    </select>
                  </div>
                );
              })}
              {activeServices.size === 0 ? (
                <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--muted)]">
                  Turn on at least one service to set markups.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Base material rates</h2>
                <p className="text-sm text-[var(--muted)]">Set materials per m² or per unit.</p>
              </div>
            </div>
            <div className="space-y-3">
              {filteredRates(MATERIAL_CONFIG).map((cfg) => (
                <div key={cfg.key} className="grid items-center gap-3 sm:grid-cols-[1.3fr_0.7fr]">
                  <label className="text-sm font-semibold text-white">{cfg.label}</label>
                  <input
                    type="number"
                    className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                    value={form.materials[cfg.key] ?? cfg.defaultValue}
                    min={0}
                    step={0.1}
                    onChange={(e) => handleRateChange("materials", cfg.key, Number(e.target.value))}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white">Base labour rates</h2>
                <p className="text-sm text-[var(--muted)]">Set labour per m² or per unit.</p>
              </div>
            </div>
            <div className="space-y-3">
              {filteredRates(LABOUR_CONFIG).map((cfg) => (
                <div key={cfg.key} className="grid items-center gap-3 sm:grid-cols-[1.3fr_0.7fr]">
                  <label className="text-sm font-semibold text-white">{cfg.label}</label>
                  <input
                    type="number"
                    className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                    value={form.labour[cfg.key] ?? cfg.defaultValue}
                    min={0}
                    step={0.1}
                    onChange={(e) => handleRateChange("labour", cfg.key, Number(e.target.value))}
                    required
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-bold text-white">Safety nets</h2>
            <p className="text-sm text-[var(--muted)]">Minimum job and day rates.</p>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Minimum charge per job</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                  value={form.min_job_charge}
                  min={0}
                  step={1}
                  onChange={(e) => handleNumberChange("min_job_charge", Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Day rate per fitter</label>
                <input
                  type="number"
                  className="w-full rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                  value={form.day_rate_per_fitter}
                  min={0}
                  step={1}
                  onChange={(e) => handleNumberChange("day_rate_per_fitter", Number(e.target.value))}
                  required
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-bold text-white">Breakpoints</h2>
            <p className="text-sm text-[var(--muted)]">Optional rate changes for big or small jobs.</p>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <label className={`pill-like ${form.use_breakpoints === "no" ? "pill-like-active" : ""}`}>
                  <input
                    type="radio"
                    name="use_breakpoints"
                    className="hidden"
                    checked={form.use_breakpoints === "no"}
                    onChange={() =>
                      setForm((prev) => ({ ...prev, use_breakpoints: "no", breakpoint_text: prev.breakpoint_text }))
                    }
                  />
                  <span>No breakpoints</span>
                </label>
                <label className={`pill-like ${form.use_breakpoints === "yes" ? "pill-like-active" : ""}`}>
                  <input
                    type="radio"
                    name="use_breakpoints"
                    className="hidden"
                    checked={form.use_breakpoints === "yes"}
                    onChange={() => setForm((prev) => ({ ...prev, use_breakpoints: "yes" }))}
                  />
                  <span>Yes - I use breakpoints</span>
                </label>
              </div>
              {form.use_breakpoints === "yes" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Describe your breakpoints</label>
                  <textarea
                    className="min-h-[140px] w-full rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-white"
                    value={form.breakpoint_text}
                    onChange={(e) => setForm((prev) => ({ ...prev, breakpoint_text: e.target.value }))}
                    placeholder={`Example:\n- If LVT is under 10m², charge £30/m² for labour.\n- Over 60m², drop labour and materials by 10%.\n- Over 100m², drop labour by £4/m² and materials by 15%.`}
                    required
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-bold text-white">VAT setup</h2>
            <p className="text-sm text-[var(--muted)]">Tell BillyBot how to treat tax.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className={`pill-like ${form.vat_status === "registered" ? "pill-like-active" : ""}`}>
                <input
                  type="radio"
                  name="vat_status"
                  className="hidden"
                  checked={form.vat_status === "registered"}
                  onChange={() => setForm((prev) => ({ ...prev, vat_status: "registered" }))}
                />
                <span>VAT registered</span>
              </label>
              <label className={`pill-like ${form.vat_status === "exempt" ? "pill-like-active" : ""}`}>
                <input
                  type="radio"
                  name="vat_status"
                  className="hidden"
                  checked={form.vat_status === "exempt"}
                  onChange={() => setForm((prev) => ({ ...prev, vat_status: "exempt" }))}
                />
                <span>Not VAT registered / VAT exempt</span>
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
            <h2 className="text-xl font-bold text-white">Labour display</h2>
            <p className="text-sm text-[var(--muted)]">Choose how labour appears on quotes.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className={`pill-like ${form.labour_split === "split" ? "pill-like-active" : ""}`}>
                <input
                  type="radio"
                  name="labour_split"
                  className="hidden"
                  checked={form.labour_split === "split"}
                  onChange={() => setForm((prev) => ({ ...prev, labour_split: "split" }))}
                />
                <span>Split labour into notes (no VAT on labour)</span>
              </label>
              <label className={`pill-like ${form.labour_split === "no_split" ? "pill-like-active" : ""}`}>
                <input
                  type="radio"
                  name="labour_split"
                  className="hidden"
                  checked={form.labour_split === "no_split"}
                  onChange={() => setForm((prev) => ({ ...prev, labour_split: "no_split" }))}
                />
                <span>Keep labour on main quote lines</span>
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[var(--line)] bg-[rgba(10,15,28,0.9)] px-4 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
          <div className="text-sm text-[var(--muted)]">
            {loading ? "Loading your saved pricing…" : "Save to keep BillyBot quoting with the latest pricing."}
            {status ? <span className="ml-2 text-emerald-400">{status}</span> : null}
            {error ? <span className="ml-2 text-rose-400">{error}</span> : null}
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-full bg-gradient-to-r from-[var(--accent1)] to-[var(--accent2)] px-6 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(249,115,22,0.35)] transition hover:shadow-[0_0_30px_rgba(249,115,22,0.55)] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save pricing"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
