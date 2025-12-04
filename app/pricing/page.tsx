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
  {
    key: "mat_vinyl_domestic",
    label: "Vinyl domestic per m² £",
    defaultValue: 14,
    services: ["service_vinyl_domestic"],
  },
  {
    key: "mat_vinyl_commercial",
    label: "Vinyl commercial per m² £",
    defaultValue: 18,
    services: ["service_vinyl_safety"],
  },
  {
    key: "mat_carpet_tiles",
    label: "Carpet tiles per m² £",
    defaultValue: 19.5,
    services: ["service_carpet_tiles"],
  },
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

/* UI components */

function Switch({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-9 w-16 items-center rounded-full border border-white/15 transition-all focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70 focus:ring-offset-2 focus:ring-offset-slate-950 ${
        checked ? "bg-[#FF7A1A]" : "bg-slate-800/80"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-7 w-7 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.45)] transition-transform ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
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
    <div className="flex flex-col gap-1 rounded-xl bg-slate-900/40 px-4 py-3">
      <div>
        <p className="text-xs font-medium text-slate-100">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
      </div>
      <div className="mt-1">{control}</div>
    </div>
  );
}

function Input({
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
      value={value}
      step={step}
      min={0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full max-w-[9rem] rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 shadow-[0_0_0_1px_rgba(15,23,42,1)] outline-none transition focus:border-[#5271FF] focus:ring-1 focus:ring-[#5271FF]"
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
      className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-[#5271FF] focus:ring-1 focus:ring-[#5271FF] placeholder:text-slate-500"
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
    <div className="inline-flex overflow-hidden rounded-full border border-white/10 bg-slate-950/70 text-xs text-slate-100 shadow-inner">
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
        className={`border-l border-white/10 px-3 py-1.5 transition ${
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
    <nav className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-3" aria-label="Pricing sections">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
        Sections
      </span>
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "text-sky-100 shadow-[0_0_0_1px_rgba(59,130,246,0.6),0_0_16px_rgba(56,189,248,0.45)]"
                  : "text-slate-400 hover:text-slate-100"
              }`}
            >
              <span
                className={`absolute inset-0 rounded-full transition ${
                  isActive ? "bg-[#1d2a5c]" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="w-full">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-6 shadow-[0_18px_55px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </section>
  );
}

/* Sections */

function ServicesSection({
  form,
  onToggle,
}: {
  form: PricingFormState;
  onToggle: (key: string, val: boolean) => void;
}) {
  return (
    <Card>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-50">Services</h2>
        <p className="text-xs text-slate-400">
          Switch on the work you take; turn off what you never quote.
        </p>
      </header>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SERVICES.map((svc) => (
          <div
            key={svc.key}
            className="flex items-center justify-between rounded-xl bg-slate-900/50 px-4 py-2.5"
          >
            <p className="text-xs font-medium text-slate-100">{svc.label}</p>
            <Switch checked={!!form.services[svc.key]} onChange={(val) => onToggle(svc.key, val)} />
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
    <Card>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-50">Base rates</h2>
        <p className="text-xs text-slate-400">
          Adjust margin by % or £/m², and set your baseline charges.
        </p>
      </header>

      <div className="mt-4 grid gap-3">
        <Field
          label="Minimum charge per job"
          control={<Input value={form.min_job_charge} onChange={(val) => onChangeNumber("min_job_charge", val)} />}
        />
        <Field
          label="Day rate per fitter"
          control={
            <Input value={form.day_rate_per_fitter} onChange={(val) => onChangeNumber("day_rate_per_fitter", val)} />
          }
        />
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
          Service markups
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {MARKUP_CONFIG.map((cfg) => (
            <div key={cfg.key} className="flex flex-col gap-2 rounded-xl bg-slate-900/40 px-4 py-3">
              <p className="text-xs font-medium text-slate-100">{cfg.label}</p>
              <div className="flex items-center gap-3">
                <Input
                  value={form.markups[cfg.key]?.value ?? cfg.defaultValue}
                  onChange={(val) =>
                    onChangeMarkup(cfg.key, val, form.markups[cfg.key]?.unit ?? "percent")
                  }
                />
                <UnitToggle
                  unit={form.markups[cfg.key]?.unit ?? "percent"}
                  onChange={(unit) =>
                    onChangeMarkup(cfg.key, form.markups[cfg.key]?.value ?? cfg.defaultValue, unit)
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
        cfg.always ? true : cfg.services?.some((svc) => activeServices.has(svc)),
      ),
    [activeServices],
  );

  return (
    <Card>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-50">Materials</h2>
        <p className="text-xs text-slate-400">
          Set per m² or per unit material rates for the services you run.
        </p>
      </header>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {materials.map((cfg) => (
          <Field
            key={cfg.key}
            label={cfg.label}
            control={
              <Input
                value={form.materials[cfg.key] ?? cfg.defaultValue}
                onChange={(val) => onChange(cfg.key, val)}
              />
            }
          />
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
        cfg.always ? true : cfg.services?.some((svc) => activeServices.has(svc)),
      ),
    [activeServices],
  );

  return (
    <Card>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-50">Labour</h2>
        <p className="text-xs text-slate-400">
          Keep fitting rates clear and choose how labour appears on quotes.
        </p>
      </header>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {labour.map((cfg) => (
          <Field
            key={cfg.key}
            label={cfg.label}
            control={
              <Input
                value={form.labour[cfg.key] ?? cfg.defaultValue}
                onChange={(val) => onChange(cfg.key, val)}
              />
            }
          />
        ))}
      </div>

      <div className="mt-6 border-t border-white/10 pt-4">
        <Field
          label="Show labour"
          hint="Split labour into notes or keep it on main lines."
          control={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSplitChange("split")}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  form.labour_split === "split"
                    ? "border-[#FF7A1A] bg-[#FF7A1A] text-white shadow-[0_0_16px_rgba(249,115,22,0.7)]"
                    : "border-white/15 bg-slate-900/60 text-slate-100"
                }`}
              >
                Split into notes
              </button>
              <button
                type="button"
                onClick={() => onSplitChange("no_split")}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  form.labour_split === "no_split"
                    ? "border-[#FF7A1A] bg-[#FF7A1A] text-white shadow-[0_0_16px_rgba(249,115,22,0.7)]"
                    : "border-white/15 bg-slate-900/60 text-slate-100"
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
    <Card>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-50">VAT</h2>
        <p className="text-xs text-slate-400">
          Tell BillyBot whether to treat quotes as VAT registered.
        </p>
      </header>

      <div className="mt-4">
        <Field
          label="VAT registered"
          control={<Switch checked={isRegistered} onChange={(val) => onToggle(val ? "registered" : "exempt")} />}
        />
      </div>
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
  const usingBreakpoints = form.use_breakpoints === "yes";

  return (
    <Card>
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-50">Advanced</h2>
        <p className="text-xs text-slate-400">
          Set breakpoint rules for tiny or oversized jobs.
        </p>
      </header>

      <div className="mt-4 space-y-3">
        <Field
          label="Use breakpoints"
          control={<Switch checked={usingBreakpoints} onChange={(val) => onToggle(val ? "yes" : "no")} />}
        />
        {usingBreakpoints ? (
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
        ) : null}
      </div>
    </Card>
  );
}

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 border-t border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-3">
        {saved ? <span className="text-xs text-slate-400">Saved</span> : null}
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F97316] to-[#FB923C] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_0_18px_rgba(248,113,22,0.8)] transition hover:brightness-105 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/* Page */

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
      } finally {
        setLoading(false);
      }
    }

    void loadPricing();
  }, []);

  const activeServices = useMemo(
    () => new Set(Object.entries(form.services).filter(([, on]) => on).map(([key]) => key)),
    [form.services],
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
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-24 pt-10">
        {/* Header */}
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-5 shadow-[0_18px_55px_rgba(0,0,0,0.7)]">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-slate-50">Pricing settings</h1>
            <p className="text-xs text-slate-400">
              Keep services, rates, VAT, and labour aligned in one place.
            </p>
          </div>
          <PricingTabs active={activeTab} onChange={setActiveTab} />
        </header>

        {error ? (
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-xs text-red-100">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-4 text-xs text-slate-300">
            Loading pricing…
          </div>
        ) : (
          <div className="space-y-5">
            {activeTab === "services" ? (
              <ServicesSection form={form} onToggle={handleServiceToggle} />
            ) : null}
            {activeTab === "base" ? (
              <BaseRatesSection
                form={form}
                onChangeMarkup={handleMarkupChange}
                onChangeNumber={(key, value) => setForm((prev) => ({ ...prev, [key]: value }))}
              />
            ) : null}
            {activeTab === "materials" ? (
              <MaterialsSection
                form={form}
                activeServices={activeServices}
                onChange={handleMaterialChange}
              />
            ) : null}
            {activeTab === "labour" ? (
              <LabourSection
                form={form}
                activeServices={activeServices}
                onChange={handleLabourChange}
                onSplitChange={(value) => setForm((prev) => ({ ...prev, labour_split: value }))}
              />
            ) : null}
            {activeTab === "vat" ? (
              <VatSection
                form={form}
                onToggle={(val) => setForm((prev) => ({ ...prev, vat_status: val }))}
              />
            ) : null}
            {activeTab === "advanced" ? (
              <AdvancedSection
                form={form}
                onToggle={(val) => setForm((prev) => ({ ...prev, use_breakpoints: val }))}
                onTextChange={(val) => setForm((prev) => ({ ...prev, breakpoint_text: val }))}
              />
            ) : null}
          </div>
        )}
      </div>
      <SaveBar saving={saving} saved={saved} onSave={handleSave} />
    </main>
  );
}
