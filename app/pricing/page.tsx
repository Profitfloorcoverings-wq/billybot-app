"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";

/* ------------------------------------------------------
   TYPES
-------------------------------------------------------*/

type ServiceConfig = { key: string; label: string; defaultOn?: boolean };
type RateConfig = { key: string; label: string; defaultValue: number; services?: string[]; always?: boolean };
type MarkupConfig = { key: string; label: string; defaultValue: number };
type MarkupValue = { value: number; unit: "percent" | "per_m2" };
type TabId = "services" | "base" | "materials" | "labour" | "vat" | "advanced";

export type PricingFormState = {
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

/* ------------------------------------------------------
   CONFIG
-------------------------------------------------------*/

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
  { key: "mat_carpet_domestic", label: "Carpet domestic per m² £", defaultValue: 12, services: ["service_domestic_carpets"] },
  { key: "mat_carpet_commercial", label: "Carpet commercial per m² £", defaultValue: 16, services: ["service_commercial_carpets"] },
  { key: "mat_safety", label: "Safety flooring per m² £", defaultValue: 18, services: ["service_vinyl_safety"] },
  { key: "mat_vinyl_domestic", label: "Vinyl domestic per m² £", defaultValue: 14, services: ["service_vinyl_domestic"] },
  { key: "mat_vinyl_commercial", label: "Vinyl commercial per m² £", defaultValue: 18, services: ["service_vinyl_safety"] },
  { key: "mat_carpet_tiles", label: "Carpet tiles per m² £", defaultValue: 19.5, services: ["service_carpet_tiles"] },
  { key: "mat_wall_cladding", label: "Wall cladding per m² £", defaultValue: 35, services: ["service_whiterock"] },
  { key: "mat_gripper", label: "Gripper per m £", defaultValue: 4, services: ["service_domestic_carpets", "service_commercial_carpets", "service_carpet_tiles"] },
  { key: "mat_underlay", label: "Underlay per m² £", defaultValue: 6, services: ["service_domestic_carpets", "service_commercial_carpets", "service_carpet_tiles"] },
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
  { key: "lab_carpet_domestic", label: "Labour carpet domestic per m² £", defaultValue: 8, services: ["service_domestic_carpets"] },
  { key: "lab_carpet_commercial", label: "Labour carpet commercial per m² £", defaultValue: 9, services: ["service_commercial_carpets"] },
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

/* ------------------------------------------------------
   DEFAULT FORM
-------------------------------------------------------*/

const DEFAULT_FORM: PricingFormState = {
  services: SERVICES.reduce((acc, s) => ({ ...acc, [s.key]: !!s.defaultOn }), {}),
  markups: MARKUP_CONFIG.reduce((acc, m) => ({ ...acc, [m.key]: { value: m.defaultValue, unit: "percent" } }), {}),
  materials: MATERIAL_CONFIG.reduce((acc, m) => ({ ...acc, [m.key]: m.defaultValue }), {}),
  labour: LABOUR_CONFIG.reduce((acc, m) => ({ ...acc, [m.key]: m.defaultValue }), {}),
  min_job_charge: 150,
  day_rate_per_fitter: 200,
  use_breakpoints: "no",
  breakpoint_text: "",
  vat_status: "registered",
  labour_split: "split",
};

/* ------------------------------------------------------
   STYLING COMPONENTS
-------------------------------------------------------*/

/* BIG MODERN TOGGLE SWITCH */
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex h-10 w-20 items-center rounded-full transition-all duration-200 
        ${checked ? "bg-[#5271FF]" : "bg-slate-700"} shadow-inner`}
    >
      <div
        className={`h-8 w-8 rounded-full bg-white shadow-md transform transition-transform duration-200
        ${checked ? "translate-x-10" : "translate-x-1"}`}
      />
    </button>
  );
}

/* FIELD ROW */
function Field({ label, hint, control }: { label: string; hint?: string; control: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[260px_1fr]">
      <div className="flex flex-col">
        <span className="text-sm text-white/80">{label}</span>
        {hint ? <span className="text-xs text-white/60">{hint}</span> : null}
      </div>
      <div>{control}</div>
    </div>
  );
}

/* CARD WRAPPER */
function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 p-6 shadow-md backdrop-blur">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle ? <p className="text-xs text-white/60 mb-4">{subtitle}</p> : null}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/* INPUT FIELD */
function Input({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value}
      min={0}
      step={0.1}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-32 rounded-md bg-white text-slate-900 px-3 py-2 text-sm outline-none border border-white/20 focus:border-[#5271FF] focus:ring-1 focus:ring-[#5271FF]"
    />
  );
}

/* UNIT TOGGLE */
function UnitToggle({ unit, onChange }: { unit: "percent" | "per_m2"; onChange: (v: "percent" | "per_m2") => void }) {
  return (
    <div className="flex rounded-full overflow-hidden border border-white/15 text-sm">
      <button
        onClick={() => onChange("percent")}
        className={`px-3 py-1.5 ${unit === "percent" ? "bg-[#5271FF] text-white" : "text-white/70"}`}
      >
        %
      </button>
      <button
        onClick={() => onChange("per_m2")}
        className={`px-3 py-1.5 border-l border-white/10 ${unit === "per_m2" ? "bg-[#5271FF] text-white" : "text-white/70"}`}
      >
        £/m²
      </button>
    </div>
  );
}

/* PRICING TABS (MATCH SIDEBAR STYLE) */
function PricingTabs({ active, onChange }: { active: TabId; onChange: (v: TabId) => void }) {
  const tabs = [
    { id: "services", label: "Services" },
    { id: "base", label: "Base Rates" },
    { id: "materials", label: "Materials" },
    { id: "labour", label: "Labour" },
    { id: "vat", label: "VAT" },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id as TabId)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all
              ${isActive
                ? "bg-[#5271FF] text-white shadow-[0_0_12px_rgba(82,113,255,0.55)]"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* SAVE BAR (MATCH CHAT SEND BUTTON) */
function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-0 w-full border-t border-white/10 bg-black/40 backdrop-blur px-4 py-3">
      <div className="max-w-6xl mx-auto flex justify-end items-center gap-3">
        {saved ? <span className="text-xs text-white/60">Saved</span> : null}
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-full px-6 py-3 text-sm font-semibold text-white
            bg-gradient-to-r from-[#F97316] to-[#FB923C]
            shadow-[0_0_20px_rgba(249,115,22,0.55)]
            hover:brightness-110 active:translate-y-[1px]
            transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------
   MAIN PAGE
-------------------------------------------------------*/

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("services");
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* LOAD EXISTING PRICING */
  useEffect(() => {
    async function loadPricing() {
      setLoading(true);
      try {
        const res = await fetch("/api/pricing");
        const data = await res.json();
        if (data?.data) {
          setForm((prev) => ({ ...prev, ...data.data }));
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    loadPricing();
  }, []);

  const activeServices = useMemo(() => {
    return new Set(Object.entries(form.services).filter(([, on]) => on).map(([key]) => key));
  }, [form.services]);

  function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    fetch("/api/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: form }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Save failed");
        setSaved(true);
      })
      .catch(() => setError("Unable to save changes."))
      .finally(() => {
        setSaving(false);
        setTimeout(() => setSaved(false), 2000);
      });
  }

  /* ------------------------------------------------------
     RENDER
  -------------------------------------------------------*/

  return (
    <main className="min-h-screen bg-[#0B1120] text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 pb-32 flex flex-col gap-8">

        <div>
          <h1 className="text-2xl font-semibold">Pricing settings</h1>
          <p className="text-sm text-white/60">Keep services, rates, VAT, and labour aligned in one place.</p>
        </div>

        <PricingTabs active={activeTab} onChange={setActiveTab} />

        {error && (
          <div className="rounded-md border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-white/70">Loading…</div>
        ) : (
          <>
            {activeTab === "services" && (
              <Card title="Services" subtitle="Switch on what you quote for. Turn off anything you don’t do.">
                {SERVICES.map((svc) => (
                  <Field
                    key={svc.key}
                    label={svc.label}
                    control={
                      <Switch
                        checked={form.services[svc.key]}
                        onChange={(v) => setForm((p) => ({ ...p, services: { ...p.services, [svc.key]: v } }))}
                      />
                    }
                  />
                ))}
              </Card>
            )}

            {activeTab === "base" && (
              <Card title="Base Rates" subtitle="Set minimum charges and material markups.">
                <Field
                  label="Minimum charge per job"
                  control={
                    <Input
                      value={form.min_job_charge}
                      onChange={(v) => setForm((p) => ({ ...p, min_job_charge: v }))}
                    />
                  }
                />

                <Field
                  label="Day rate per fitter"
                  control={
                    <Input
                      value={form.day_rate_per_fitter}
                      onChange={(v) => setForm((p) => ({ ...p, day_rate_per_fitter: v }))}
                    />
                  }
                />

                <div className="border-t border-white/10 my-3" />

                {MARKUP_CONFIG.map((cfg) => (
                  <Field
                    key={cfg.key}
                    label={cfg.label}
                    control={
                      <div className="flex items-center gap-3">
                        <Input
                          value={form.markups[cfg.key].value}
                          onChange={(v) =>
                            setForm((p) => ({
                              ...p,
                              markups: { ...p.markups, [cfg.key]: { ...p.markups[cfg.key], value: v } },
                            }))
                          }
                        />
                        <UnitToggle
                          unit={form.markups[cfg.key].unit}
                          onChange={(u) =>
                            setForm((p) => ({
                              ...p,
                              markups: { ...p.markups, [cfg.key]: { ...p.markups[cfg.key], unit: u } },
                            }))
                          }
                        />
                      </div>
                    }
                  />
                ))}
              </Card>
            )}

            {activeTab === "materials" && (
              <Card title="Materials" subtitle="Set per m² / per unit material rates.">
                {MATERIAL_CONFIG.filter((cfg) =>
                  cfg.always ? true : cfg.services?.some((svc) => activeServices.has(svc))
                ).map((cfg) => (
                  <Field
                    key={cfg.key}
                    label={cfg.label}
                    control={
                      <Input
                        value={form.materials[cfg.key]}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, materials: { ...p.materials, [cfg.key]: v } }))
                        }
                      />
                    }
                  />
                ))}
              </Card>
            )}

            {activeTab === "labour" && (
              <Card title="Labour" subtitle="Set labour rates. Control how labour shows on quotes.">
                {LABOUR_CONFIG.filter((cfg) =>
                  cfg.always ? true : cfg.services?.some((svc) => activeServices.has(svc))
                ).map((cfg) => (
                  <Field
                    key={cfg.key}
                    label={cfg.label}
                    control={
                      <Input
                        value={form.labour[cfg.key]}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, labour: { ...p.labour, [cfg.key]: v } }))
                        }
                      />
                    }
                  />
                ))}

                <Field
                  label="Show labour"
                  hint="Split into notes or keep labour on the main quote lines."
                  control={
                    <div className="flex gap-3">
                      <button
                        onClick={() => setForm((p) => ({ ...p, labour_split: "split" }))}
                        className={`px-4 py-2 rounded-md text-sm border border-white/15 transition
                          ${form.labour_split === "split" ? "bg-[#5271FF] text-white" : "bg-white/10 text-white/70"}`}
                      >
                        Split into notes
                      </button>

                      <button
                        onClick={() => setForm((p) => ({ ...p, labour_split: "no_split" }))}
                        className={`px-4 py-2 rounded-md text-sm border border-white/15 transition
                          ${form.labour_split === "no_split" ? "bg-[#5271FF] text-white" : "bg-white/10 text-white/70"}`}
                      >
                        Keep on lines
                      </button>
                    </div>
                  }
                />
              </Card>
            )}

            {activeTab === "vat" && (
              <Card title="VAT" subtitle="Tell BillyBot how to treat VAT in your quotes.">
                <Field
                  label="VAT registered"
                  control={
                    <Switch
                      checked={form.vat_status === "registered"}
                      onChange={(v) => setForm((p) => ({ ...p, vat_status: v ? "registered" : "exempt" }))}
                    />
                  }
                />
              </Card>
            )}

            {activeTab === "advanced" && (
              <Card
                title="Advanced"
                subtitle="Optional breakpoint logic for tiny or oversized jobs."
              >
                <Field
                  label="Use breakpoints"
                  control={
                    <Switch
                      checked={form.use_breakpoints === "yes"}
                      onChange={(v) => setForm((p) => ({ ...p, use_breakpoints: v ? "yes" : "no" }))}
                    />
                  }
                />

                {form.use_breakpoints === "yes" && (
                  <Field
                    label="Breakpoint logic"
                    hint="Describe pricing rules. Example: 'Under 10m² add labour. Over 60m² drop by 10%.'"
                    control={
                      <textarea
                        value={form.breakpoint_text}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, breakpoint_text: e.target.value }))
                        }
                        className="w-full rounded-md bg-black/40 text-white text-sm p-3 border border-white/20 focus:border-[#5271FF] focus:ring-1 focus:ring-[#5271FF] outline-none"
                        rows={4}
                      />
                    }
                  />
                )}
              </Card>
            )}
          </>
        )}
      </div>

      <SaveBar saving={saving} saved={saved} onSave={handleSave} />
    </main>
  );
}
