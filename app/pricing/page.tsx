"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";

type ServiceConfig = { key: string; label: string; defaultOn?: boolean };
type RateConfig = {
  key: string;
  label: string;
  defaultValue: number;
  services?: string[];
  always?: boolean;
};
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
  { key: "lab_carpet_domestic", label: "Labour carpet domestic per m² £", defaultValue: 8, services: ["service_domestic_carpets"] },
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

function mergeForm(prev: PricingFormState, next: Partial<PricingFormState>) {
  return {
    ...prev,
    ...next,
    services: { ...prev.services, ...(next.services || {}) },
    markups: { ...prev.markups, ...(next.markups || {}) },
    materials: { ...prev.materials, ...(next.materials || {}) },
    labour: { ...prev.labour, ...(next.labour || {}) },
  };
}

/* ---------- Small UI primitives ---------- */

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-14 items-center rounded-full border border-slate-600/70 px-1 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F97316] focus:ring-offset-slate-950 ${
        checked ? "bg-[#F97316]" : "bg-slate-800"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-slate-50 shadow-md transition-transform duration-150 ${
          checked ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  step = 0.1,
}: {
  value: number;
  onChange: (val: number) => void;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      step={step}
      min={0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full max-w-[160px] rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 shadow-sm outline-none transition focus:border-[#5271FF] focus:ring-2 focus:ring-[#5271FF]"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-[#5271FF] focus:ring-2 focus:ring-[#5271FF]"
    />
  );
}

function UnitToggle({
  unit,
  onChange,
}: {
  unit: "percent" | "per_m2";
  onChange: (val: "percent" | "per_m2") => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-700/80 bg-slate-900/80 text-xs text-slate-200">
      <button
        type="button"
        onClick={() => onChange("percent")}
        className={`px-3 py-1.5 transition ${
          unit === "percent"
            ? "bg-[#5271FF] text-white shadow-[0_0_10px_rgba(82,113,255,0.7)]"
            : "text-slate-400"
        }`}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onChange("per_m2")}
        className={`border-l border-slate-700/80 px-3 py-1.5 transition ${
          unit === "per_m2"
            ? "bg-[#5271FF] text-white shadow-[0_0_10px_rgba(82,113,255,0.7)]"
            : "text-slate-400"
        }`}
      >
        £/m²
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-center">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-100">{label}</span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      <div className="flex justify-start">{control}</div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] sm:px-7 sm:py-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-base font-semibold text-slate-50">{title}</h2>
        {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* ---------- Tabs ---------- */

function PricingTabs({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "services", label: "Services" },
    { id: "base", label: "Base rates" },
    { id: "materials", label: "Materials" },
    { id: "labour", label: "Labour" },
    { id: "vat", label: "VAT" },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        Sections
      </p>
      <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/80 p-1">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative rounded-full px-4 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "text-white shadow-[0_0_16px_rgba(59,130,246,0.85)]"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-[#2563EB] via-[#4F46E5] to-[#0EA5E9] opacity-90" />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Sections ---------- */

function ServicesSection({
  form,
  onToggle,
}: {
  form: PricingFormState;
  onToggle: (key: string, val: boolean) => void;
}) {
  return (
    <Card
      title="Services"
      subtitle="Switch on the work you take; turn off what you never quote."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {SERVICES.map((svc) => (
          <div
            key={svc.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5"
          >
            <span className="text-sm text-slate-100">{svc.label}</span>
            <Switch
              checked={!!form.services[svc.key]}
              onChange={(val) => onToggle(svc.key, val)}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function BaseRatesSection({
  form,
  onChangeMarkup,
  onChangeNumber,
}: {
  form: PricingFormState;
  onChangeMarkup: (key: string, value: number, unit: "percent" | "per_m2") => void;
  onChangeNumber: (key: "min_job_charge" | "day_rate_per_fitter", value: number) => void;
}) {
  return (
    <Card
      title="Base rates"
      subtitle="Set your minimums and markups. Adjust margin by % or £/m²."
    >
      <div className="space-y-4">
        <Field
          label="Minimum charge per job"
          control={
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">£</span>
              <NumberInput
                value={form.min_job_charge}
                onChange={(val) => onChangeNumber("min_job_charge", val)}
              />
            </div>
          }
        />
        <Field
          label="Day rate per fitter"
          control={
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">£/day</span>
              <NumberInput
                value={form.day_rate_per_fitter}
                onChange={(val) => onChangeNumber("day_rate_per_fitter", val)}
              />
            </div>
          }
        />
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Service markups
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {MARKUP_CONFIG.map((cfg) => (
            <div
              key={cfg.key}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5"
            >
              <span className="text-sm text-slate-100">{cfg.label}</span>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={form.markups[cfg.key]?.value ?? cfg.defaultValue}
                  onChange={(val) =>
                    onChangeMarkup(cfg.key, val, form.markups[cfg.key]?.unit ?? "percent")
                  }
                />
                <UnitToggle
                  unit={form.markups[cfg.key]?.unit ?? "percent"}
                  onChange={(unit) =>
                    onChangeMarkup(
                      cfg.key,
                      form.markups[cfg.key]?.value ?? cfg.defaultValue,
                      unit
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function MaterialsSection({
  form,
  activeServices,
  onChange,
}: {
  form: PricingFormState;
  activeServices: Set<string>;
  onChange: (key: string, value: number) => void;
}) {
  const materials = useMemo(
    () =>
      MATERIAL_CONFIG.filter((cfg) =>
        cfg.always ? true : cfg.services?.some((svc) => activeServices.has(svc))
      ),
    [activeServices]
  );

  return (
    <Card
      title="Materials"
      subtitle="Per m² or per unit material rates, tailored to the services you offer."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {materials.map((cfg) => (
          <div
            key={cfg.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5"
          >
            <span className="text-sm text-slate-100">{cfg.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">£</span>
              <NumberInput
                value={form.materials[cfg.key] ?? cfg.defaultValue}
                onChange={(val) => onChange(cfg.key, val)}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LabourSection({
  form,
  activeServices,
  onChange,
  onSplitChange,
}: {
  form: PricingFormState;
  activeServices: Set<string>;
  onChange: (key: string, value: number) => void;
  onSplitChange: (value: "split" | "no_split") => void;
}) {
  const labour = useMemo(
    () =>
      LABOUR_CONFIG.filter((cfg) =>
        cfg.always ? true : cfg.services?.some((svc) => activeServices.has(svc))
      ),
    [activeServices]
  );

  return (
    <Card
      title="Labour"
      subtitle="Keep fitting rates clear and choose how labour appears on quotes."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {labour.map((cfg) => (
          <div
            key={cfg.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2.5"
          >
            <span className="text-sm text-slate-100">{cfg.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">£</span>
              <NumberInput
                value={form.labour[cfg.key] ?? cfg.defaultValue}
                onChange={(val) => onChange(cfg.key, val)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <Field
          label="Show labour on quotes"
          hint="Split into notes or keep on the main line items."
          control={
            <div className="inline-flex rounded-full border border-slate-700/80 bg-slate-900/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => onSplitChange("split")}
                className={`rounded-full px-3 py-1.5 font-medium transition ${
                  form.labour_split === "split"
                    ? "bg-[#F97316] text-white shadow-[0_0_14px_rgba(249,115,22,0.9)]"
                    : "text-slate-300"
                }`}
              >
                Split into notes
              </button>
              <button
                type="button"
                onClick={() => onSplitChange("no_split")}
                className={`rounded-full px-3 py-1.5 font-medium transition ${
                  form.labour_split === "no_split"
                    ? "bg-[#F97316] text-white shadow-[0_0_14px_rgba(249,115,22,0.9)]"
                    : "text-slate-300"
                }`}
              >
                Keep on lines
              </button>
            </div>
          }
        />
      </div>
    </Card>
  );
}

function VatSection({
  form,
  onToggle,
}: {
  form: PricingFormState;
  onToggle: (val: "registered" | "exempt") => void;
}) {
  const isRegistered = form.vat_status === "registered";
  return (
    <Card
      title="VAT"
      subtitle="Tell BillyBot whether to treat your quotes as VAT registered."
    >
      <Field
        label="VAT registered"
        control={
          <div className="flex items-center gap-3">
            <Switch
              checked={isRegistered}
              onChange={(val) => onToggle(val ? "registered" : "exempt")}
            />
            <span className="text-xs text-slate-400">
              {isRegistered ? "Quotes show VAT breakdown." : "Quotes are treated as VAT exempt."}
            </span>
          </div>
        }
      />
    </Card>
  );
}

function AdvancedSection({
  form,
  onToggle,
  onTextChange,
}: {
  form: PricingFormState;
  onToggle: (val: "yes" | "no") => void;
  onTextChange: (val: string) => void;
}) {
  return (
    <Card
      title="Advanced"
      subtitle="Breakpoint rules for tiny or oversized jobs."
    >
      <Field
        label="Use breakpoints"
        control={
          <div className="flex items-center gap-3">
            <Switch
              checked={form.use_breakpoints === "yes"}
              onChange={(val) => onToggle(val ? "yes" : "no")}
            />
            <span className="text-xs text-slate-400">
              Automatically adjust pricing for unusually small or large jobs.
            </span>
          </div>
        }
      />
      {form.use_breakpoints === "yes" && (
        <Field
          label="Breakpoint logic"
          hint="Describe how pricing shifts above or below certain areas."
          control={
            <TextArea
              value={form.breakpoint_text}
              onChange={onTextChange}
              placeholder="Example: Under 10m² increase labour to £30/m²; over 60m² drop by 10%."
            />
          }
        />
      )}
    </Card>
  );
}

/* ---------- Save bar ---------- */

function SaveBar({
  saving,
  saved,
  onSave,
}: {
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="sticky bottom-0 left-0 right-0 border-t border-slate-900 bg-slate-950/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-end gap-3">
        {saved && (
          <span className="text-xs text-emerald-400">
            Saved
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#FDBA74] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_22px_rgba(249,115,22,0.75)] transition hover:brightness-110 active:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("services");
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPricing() {
      setLoading(true);
      try {
        const res = await fetch("/api/pricing");
        if (!res.ok) throw new Error(`Failed to load pricing (${res.status})`);
        const data = (await res.json()) as { data?: Partial<PricingFormState> | null };
        if (data?.data) {
          setForm((prev) => mergeForm(prev, data.data ?? {}));
        }
      } catch (err) {
        console.error("Pricing load error", err);
        setError("Unable to load pricing right now.");
      } finally {
        setLoading(false);
      }
    }

    void loadPricing();
  }, []);

  const activeServices = useMemo(
    () => new Set(Object.entries(form.services).filter(([, on]) => on).map(([key]) => key)),
    [form.services]
  );

  function handleServiceToggle(key: string, val: boolean) {
    setForm((prev) => ({ ...prev, services: { ...prev.services, [key]: val } }));
  }

  function handleMarkupChange(key: string, value: number, unit: "percent" | "per_m2") {
    setForm((prev) => ({
      ...prev,
      markups: { ...prev.markups, [key]: { value, unit } },
    }));
  }

  function handleMaterialChange(key: string, value: number) {
    setForm((prev) => ({ ...prev, materials: { ...prev.materials, [key]: value } }));
  }

  function handleLabourChange(key: string, value: number) {
    setForm((prev) => ({ ...prev, labour: { ...prev.labour, [key]: value } }));
  }

  function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    void (async () => {
      try {
        const res = await fetch("/api/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: form }),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        setSaved(true);
      } catch (err) {
        console.error("Pricing save error", err);
        setError("Unable to save changes. Please try again.");
      } finally {
        setSaving(false);
        setTimeout(() => setSaved(false), 2000);
      }
    })();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-28 pt-10 sm:px-6">
        <header className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Pricing settings
            </h1>
            <p className="text-sm text-slate-400">
              Keep services, rates, VAT and labour aligned in one place.
            </p>
          </div>
          <PricingTabs active={activeTab} onChange={setActiveTab} />
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-900/20 px-4 py-3 text-xs text-red-100">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-6 text-sm text-slate-300">
            Loading pricing…
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === "services" && (
              <ServicesSection form={form} onToggle={handleServiceToggle} />
            )}
            {activeTab === "base" && (
              <BaseRatesSection
                form={form}
                onChangeMarkup={handleMarkupChange}
                onChangeNumber={(key, value) =>
                  setForm((prev) => ({ ...prev, [key]: value }))
                }
              />
            )}
            {activeTab === "materials" && (
              <MaterialsSection
                form={form}
                activeServices={activeServices}
                onChange={handleMaterialChange}
              />
            )}
            {activeTab === "labour" && (
              <LabourSection
                form={form}
                activeServices={activeServices}
                onChange={handleLabourChange}
                onSplitChange={(value) =>
                  setForm((prev) => ({ ...prev, labour_split: value }))
                }
              />
            )}
            {activeTab === "vat" && (
              <VatSection
                form={form}
                onToggle={(val) => setForm((prev) => ({ ...prev, vat_status: val }))}
              />
            )}
            {activeTab === "advanced" && (
              <AdvancedSection
                form={form}
                onToggle={(val) =>
                  setForm((prev) => ({ ...prev, use_breakpoints: val }))
                }
                onTextChange={(val) =>
                  setForm((prev) => ({ ...prev, breakpoint_text: val }))
                }
              />
            )}
          </div>
        )}
      </div>

      <SaveBar saving={saving} saved={saved} onSave={handleSave} />
    </main>
  );
}
