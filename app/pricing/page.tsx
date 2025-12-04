"use client";

import React, { useState } from "react";

type Unit = "percent" | "per_m2";

type ServiceKey =
  | "service_domestic_carpets"
  | "service_commercial_carpets"
  | "service_carpet_tiles"
  | "service_lvt"
  | "service_vinyl_domestic"
  | "service_vinyl_safety"
  | "service_laminate"
  | "service_wood"
  | "service_whiterock"
  | "service_ceramic";

type ServiceConfig = {
  key: ServiceKey;
  label: string;
  description?: string;
  defaultOn?: boolean;
};

type MarkupConfig = {
  key: ServiceKey;
  label: string;
  defaultValue: number;
};

type RateConfig = {
  key: string;
  label: string;
  defaultValue: number;
  services?: ServiceKey[];
  always?: boolean;
};

type MarkupState = {
  value: number;
  unit: Unit;
};

type PricingState = {
  services: Record<ServiceKey, boolean>;
  markups: Record<ServiceKey, MarkupState>;
  materials: Record<string, number>;
  labour: Record<string, number>;
  minJobCharge: number;
  dayRatePerFitter: number;
  useBreakpoints: "yes" | "no";
  breakpointText: string;
  vatStatus: "registered" | "exempt";
  labourSplit: "split" | "no_split";
};

const serviceConfigs: ServiceConfig[] = [
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

const markupConfigs: MarkupConfig[] = [
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

const materialConfigs: RateConfig[] = [
  { key: "mat_lvt", label: "LVT per m² £", defaultValue: 26, services: ["service_lvt"] },
  { key: "mat_ceramic", label: "Ceramic tiles per m² £", defaultValue: 30, services: ["service_ceramic"] },
  { key: "mat_carpet_domestic", label: "Carpet domestic per m² £", defaultValue: 12, services: ["service_domestic_carpets"] },
  { key: "mat_carpet_commercial", label: "Carpet commercial per m² £", defaultValue: 16, services: ["service_commercial_carpets"] },
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

const labourConfigs: RateConfig[] = [
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
  {
    key: "lab_ceramic",
    label: "Labour ceramic tiles per m² £",
    defaultValue: 25,
    services: ["service_ceramic"],
  },
  {
    key: "lab_safety",
    label: "Labour safety flooring per m² £",
    defaultValue: 22,
    services: ["service_vinyl_safety"],
  },
  {
    key: "lab_vinyl_domestic",
    label: "Labour vinyl domestic per m² £",
    defaultValue: 12,
    services: ["service_vinyl_domestic"],
  },
  {
    key: "lab_vinyl_commercial",
    label: "Labour vinyl commercial per m² £",
    defaultValue: 14,
    services: ["service_vinyl_safety"],
  },
  {
    key: "lab_carpet_tiles",
    label: "Labour carpet tiles per m² £",
    defaultValue: 8,
    services: ["service_carpet_tiles"],
  },
  {
    key: "lab_wall_cladding",
    label: "Labour wall cladding per m² £",
    defaultValue: 16,
    services: ["service_whiterock"],
  },
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

function buildInitialState(): PricingState {
  const services: Record<ServiceKey, boolean> = {} as any;
  const markups: Record<ServiceKey, MarkupState> = {} as any;
  const materials: Record<string, number> = {};
  const labour: Record<string, number> = {};

  serviceConfigs.forEach(s => {
    services[s.key] = !!s.defaultOn;
  });

  markupConfigs.forEach(m => {
    markups[m.key] = { value: m.defaultValue, unit: "percent" };
  });

  materialConfigs.forEach(m => {
    materials[m.key] = m.defaultValue;
  });

  labourConfigs.forEach(l => {
    labour[l.key] = l.defaultValue;
  });

  return {
    services,
    markups,
    materials,
    labour,
    minJobCharge: 150,
    dayRatePerFitter: 200,
    useBreakpoints: "no",
    breakpointText: "",
    vatStatus: "registered",
    labourSplit: "split",
  };
}

/* Simple UI helpers */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
        checked
          ? "bg-gradient-to-r from-blue-600 to-blue-500 border-blue-400 shadow-[0_0_0_1px_rgba(59,130,246,0.4)]"
          : "bg-slate-800 border-slate-600",
      ].join(" ")}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-full bg-slate-900 p-0.5 border border-slate-700">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "px-3 py-1 text-xs font-semibold rounded-full transition-all",
              active
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow"
                : "text-slate-300",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* MAIN PAGE */

export default function PricingSettingsPage() {
  const [state, setState] = useState<PricingState>(buildInitialState);
  const [saving, setSaving] = useState(false);

  const activeServiceSet = new Set(
    Object.entries(state.services)
      .filter(([, on]) => on)
      .map(([key]) => key as ServiceKey)
  );

  const showMaterialRow = (cfg: RateConfig) =>
    cfg.always || (cfg.services && cfg.services.some(s => activeServiceSet.has(s)));

  const showLabourRow = showMaterialRow;

  async function handleSave() {
    try {
      setSaving(true);

      // TODO: wire this into your Supabase or API save logic
      // Example:
      // await savePricingToSupabase(profileId, state);

      console.log("Pricing settings payload", state);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 pb-24 lg:flex-row lg:px-6">
        {/* Left column: title and quick info */}
        <div className="w-full lg:w-72 lg:flex-none">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
              <h1 className="text-lg font-semibold tracking-tight text-slate-50">
                Pricing settings
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Set everything once so BillyBot can quote like you on every job.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full bg-blue-600/20 px-2 py-0.5 text-blue-200">
                  Services
                </span>
                <span className="rounded-full bg-slate-700/60 px-2 py-0.5">
                  Markups
                </span>
                <span className="rounded-full bg-slate-700/60 px-2 py-0.5">
                  Base rates
                </span>
                <span className="rounded-full bg-slate-700/60 px-2 py-0.5">
                  VAT & labour
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
              <p className="font-medium text-slate-200">
                Quick tip
              </p>
              <p className="mt-1">
                Start with your normal everyday prices. You can tighten specific quotes later inside each job.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={[
                "inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold",
                "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40",
                saving ? "opacity-60 cursor-wait" : "hover:brightness-110",
              ].join(" ")}
            >
              {saving ? "Saving..." : "Save pricing"}
            </button>
          </div>
        </div>

        {/* Right column: cards */}
        <div className="flex-1 space-y-5">
          {/* Services card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/40">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-50">
                  Services you take on
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Turn off anything you never touch. At least one service must stay on.
                </p>
              </div>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {activeServiceSet.size} active
              </span>
            </header>

            <div className="grid gap-3 sm:grid-cols-2">
              {serviceConfigs.map(service => {
                const checked = state.services[service.key];
                return (
                  <button
                    key={service.key}
                    type="button"
                    onClick={() => {
                      // prevent turning off the very last service
                      if (checked && activeServiceSet.size === 1) return;
                      setState(prev => ({
                        ...prev,
                        services: {
                          ...prev.services,
                          [service.key]: !checked,
                        },
                      }));
                    }}
                    className={[
                      "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-all",
                      checked
                        ? "border-blue-500/70 bg-blue-600/10 shadow-[0_0_0_1px_rgba(59,130,246,0.5)]"
                        : "border-slate-800 bg-slate-900/80 hover:border-slate-700",
                    ].join(" ")}
                  >
                    <div>
                      <p className="font-medium text-slate-50">
                        {service.label}
                      </p>
                    </div>
                    <Toggle
                      checked={checked}
                      onChange={value => {
                        if (!value && activeServiceSet.size === 1) return;
                        setState(prev => ({
                          ...prev,
                          services: {
                            ...prev.services,
                            [service.key]: value,
                          },
                        }));
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Markups card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/40">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-50">
                  Material markups
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Set how much you add on for each service. Use percent or a flat £ per m².
                </p>
              </div>
            </header>

            <div className="space-y-2">
              {markupConfigs.map(cfg => {
                if (!activeServiceSet.has(cfg.key)) return null;
                const m = state.markups[cfg.key];
                return (
                  <div
                    key={cfg.key}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-[8rem]">
                      <p className="text-sm font-medium text-slate-50">
                        {cfg.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={m?.value ?? cfg.defaultValue}
                        onChange={e =>
                          setState(prev => ({
                            ...prev,
                            markups: {
                              ...prev.markups,
                              [cfg.key]: {
                                ...(prev.markups[cfg.key] || {
                                  value: cfg.defaultValue,
                                  unit: "percent" as Unit,
                                }),
                                value: Number(e.target.value),
                              },
                            },
                          }))
                        }
                        className="h-9 w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-sm text-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <Segmented
                        value={m?.unit ?? "percent"}
                        onChange={val =>
                          setState(prev => ({
                            ...prev,
                            markups: {
                              ...prev.markups,
                              [cfg.key]: {
                                ...(prev.markups[cfg.key] || {
                                  value: cfg.defaultValue,
                                  unit: "percent" as Unit,
                                }),
                                unit: val as Unit,
                              },
                            },
                          }))
                        }
                        options={[
                          { value: "percent", label: "%" },
                          { value: "per_m2", label: "£ / m²" },
                        ]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Base rates card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/40">
            <header className="mb-4">
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Base rates
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                These are your normal mid range prices. Tiny or massive job tweaks come from breakpoints.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Materials */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Materials
                </p>
                <div className="space-y-2">
                  {materialConfigs
                    .filter(showMaterialRow)
                    .map(cfg => (
                      <div
                        key={cfg.key}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                      >
                        <span className="text-xs text-slate-200">
                          {cfg.label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={state.materials[cfg.key]}
                          onChange={e =>
                            setState(prev => ({
                              ...prev,
                              materials: {
                                ...prev.materials,
                                [cfg.key]: Number(e.target.value),
                              },
                            }))
                          }
                          className="h-8 w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                </div>
              </div>

              {/* Labour */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Labour
                </p>
                <div className="space-y-2">
                  {labourConfigs
                    .filter(showLabourRow)
                    .map(cfg => (
                      <div
                        key={cfg.key}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                      >
                        <span className="text-xs text-slate-200">
                          {cfg.label}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={state.labour[cfg.key]}
                          onChange={e =>
                            setState(prev => ({
                              ...prev,
                              labour: {
                                ...prev.labour,
                                [cfg.key]: Number(e.target.value),
                              },
                            }))
                          }
                          className="h-8 w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>

          {/* Safety nets card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/40">
            <header className="mb-4">
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Safety nets for small jobs
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Make sure tiny jobs still cover your time.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm">
                  <span className="text-slate-200">
                    Minimum charge per job
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">£</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={state.minJobCharge}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          minJobCharge: Number(e.target.value),
                        }))
                      }
                      className="h-8 w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  What you want to earn even if it is just one room.
                </p>
              </div>

              <div>
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm">
                  <span className="text-slate-200">
                    Day rate per fitter
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">£</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={state.dayRatePerFitter}
                      onChange={e =>
                        setState(prev => ({
                          ...prev,
                          dayRatePerFitter: Number(e.target.value),
                        }))
                      }
                      className="h-8 w-24 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-slate-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </label>
                <p className="mt-1 text-xs text-slate-400">
                  BillyBot can check when a job starts to look like a full day.
                </p>
              </div>
            </div>
          </section>

          {/* Breakpoints card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/40">
            <header className="mb-4">
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Breakpoints for big and small jobs
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Use different rates for tiny areas or huge projects if you need to.
              </p>
            </header>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setState(prev => ({ ...prev, useBreakpoints: "no" }))
                }
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium",
                  state.useBreakpoints === "no"
                    ? "bg-blue-600 text-white shadow"
                    : "bg-slate-800 text-slate-300",
                ].join(" ")}
              >
                No breakpoints
              </button>
              <button
                type="button"
                onClick={() =>
                  setState(prev => ({ ...prev, useBreakpoints: "yes" }))
                }
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium",
                  state.useBreakpoints === "yes"
                    ? "bg-blue-600 text-white shadow"
                    : "bg-slate-800 text-slate-300",
                ].join(" ")}
              >
                Yes, I use breakpoints
              </button>
            </div>

            {state.useBreakpoints === "yes" && (
              <div className="space-y-2">
                <textarea
                  value={state.breakpointText}
                  onChange={e =>
                    setState(prev => ({
                      ...prev,
                      breakpointText: e.target.value,
                    }))
                  }
                  className="min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-50 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={`Example:
- If LVT is under 10m², charge £30/m² for labour.
- Over 60m², drop labour and materials by 10%.
- Over 100m², drop labour by £4/m² and materials by 15%.`}
                />
                <p className="text-xs text-slate-400">
                  Keep it in plain English. BillyBot will turn this into hard rules.
                </p>
              </div>
            )}
          </section>

          {/* VAT and labour card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 shadow-lg shadow-black/40">
            <header className="mb-4">
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                VAT and labour display
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                This controls how quotes behave inside Sage, QuickBooks or Xero.
              </p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  VAT status
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setState(prev => ({ ...prev, vatStatus: "registered" }))
                    }
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium",
                      state.vatStatus === "registered"
                        ? "bg-blue-600 text-white shadow"
                        : "bg-slate-800 text-slate-300",
                    ].join(" ")}
                  >
                    VAT registered
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setState(prev => ({ ...prev, vatStatus: "exempt" }))
                    }
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium",
                      state.vatStatus === "exempt"
                        ? "bg-blue-600 text-white shadow"
                        : "bg-slate-800 text-slate-300",
                    ].join(" ")}
                  >
                    Not VAT registered / VAT exempt
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Labour display
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setState(prev => ({ ...prev, labourSplit: "split" }))
                    }
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium",
                      state.labourSplit === "split"
                        ? "bg-blue-600 text-white shadow"
                        : "bg-slate-800 text-slate-300",
                    ].join(" ")}
                  >
                    Split labour into notes (no VAT on labour)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setState(prev => ({ ...prev, labourSplit: "no_split" }))
                    }
                    className={[
                      "rounded-full px-3 py-1.5 text-xs font-medium",
                      state.labourSplit === "no_split"
                        ? "bg-blue-600 text-white shadow"
                        : "bg-slate-800 text-slate-300",
                    ].join(" ")}
                  >
                    Keep labour on main quote lines
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  If you pay fitters direct and do not want VAT on labour, keep the first option.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-end pb-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={[
                "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold",
                "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/40",
                saving ? "opacity-60 cursor-wait" : "hover:brightness-110",
              ].join(" ")}
            >
              {saving ? "Saving..." : "Save pricing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
