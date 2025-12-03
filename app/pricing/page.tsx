"use client";

import type React from "react";
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

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0d1222] p-4 shadow-sm">
      <div className="mb-3 space-y-1">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description ? <p className="text-xs text-white/60">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/15 transition-colors ${
        checked ? "bg-orange-500/80" : "bg-white/10"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-1"}`}
      />
    </span>
  );
}

type ServicesSectionProps = {
  form: PricingFormState;
  onToggleService: (key: string) => void;
  activeServices: Set<string>;
};

function ServicesSection({ form, onToggleService, activeServices }: ServicesSectionProps) {
  return (
    <SectionCard title="Services" description="Switch on the work you take. BillyBot quotes only for enabled services.">
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((svc) => (
          <button
            key={svc.key}
            type="button"
            onClick={() => onToggleService(svc.key)}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition hover:border-orange-400/50 hover:bg-white/10"
          >
            <div className="space-y-1">
              <p className="font-medium">{svc.label}</p>
              <p className="text-xs text-white/60">{form.services[svc.key] ? "On" : "Off"}</p>
            </div>
            <Switch checked={!!form.services[svc.key]} />
          </button>
        ))}
      </div>
      {activeServices.size === 0 ? (
        <p className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-50">
          Turn on at least one service to configure markups and rates.
        </p>
      ) : null}
    </SectionCard>
  );
}

type BaseRatesSectionProps = {
  form: PricingFormState;
  activeServices: Set<string>;
  onMarkupChange: (key: string, value: Partial<MarkupValue>) => void;
  onRateChange: (collection: "materials" | "labour", key: string, value: number) => void;
  onNumberChange: (key: "min_job_charge" | "day_rate_per_fitter", value: number) => void;
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[1.1fr_auto] items-center gap-3 text-sm text-white sm:grid-cols-[1.2fr_0.9fr]">
      <span className="text-xs font-medium text-white/80 sm:text-sm">{label}</span>
      <div className="flex w-full items-center justify-end">{children}</div>
    </label>
  );
}

function numberInputProps(value: number, onChange: (val: number) => void) {
  return {
    type: "number",
    value,
    min: 0,
    step: 0.1,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value)),
    className: "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-400 focus:outline-none",
  } satisfies React.InputHTMLAttributes<HTMLInputElement>;
}

function BaseRatesSection({
  form,
  activeServices,
  onMarkupChange,
  onRateChange,
  onNumberChange,
}: BaseRatesSectionProps) {
  const filtered = (config: RateConfig[]) =>
    config.filter((cfg) => cfg.always || (cfg.services && cfg.services.some((svc) => activeServices.has(svc))));

  return (
    <SectionCard title="Base rates" description="Minimums, markups, and per-unit pricing.">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldRow label="Minimum charge per job">
          <input {...numberInputProps(form.min_job_charge, (v) => onNumberChange("min_job_charge", v))} step={1} />
        </FieldRow>
        <FieldRow label="Day rate per fitter">
          <input {...numberInputProps(form.day_rate_per_fitter, (v) => onNumberChange("day_rate_per_fitter", v))} step={1} />
        </FieldRow>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Markups</p>
        {MARKUP_CONFIG.filter((cfg) => activeServices.has(cfg.key)).map((cfg) => {
          const entry = form.markups[cfg.key] ?? { value: cfg.defaultValue, unit: "percent" };
          return (
            <div key={cfg.key} className="grid items-center gap-2 sm:grid-cols-[1.2fr_0.6fr_0.6fr]">
              <span className="text-sm text-white">{cfg.label}</span>
              <input
                {...numberInputProps(entry.value, (v) => onMarkupChange(cfg.key, { value: v }))}
                step={0.1}
              />
              <select
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-400 focus:outline-none"
                value={entry.unit}
                onChange={(e) =>
                  onMarkupChange(cfg.key, {
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
          <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
            Enable a service to set its markup.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Materials</p>
        {filtered(MATERIAL_CONFIG).map((cfg) => (
          <FieldRow key={cfg.key} label={cfg.label}>
            <input
              {...numberInputProps(form.materials[cfg.key] ?? cfg.defaultValue, (v) => onRateChange("materials", cfg.key, v))}
            />
          </FieldRow>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Labour</p>
        {filtered(LABOUR_CONFIG).map((cfg) => (
          <FieldRow key={cfg.key} label={cfg.label}>
            <input
              {...numberInputProps(form.labour[cfg.key] ?? cfg.defaultValue, (v) => onRateChange("labour", cfg.key, v))}
            />
          </FieldRow>
        ))}
      </div>
    </SectionCard>
  );
}

type BreakpointsSectionProps = {
  form: PricingFormState;
  onBreakpointsChange: (value: "yes" | "no", text?: string) => void;
};

function RadioRow({
  label,
  name,
  value,
  checked,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:border-orange-400/40">
      <span>{label}</span>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-orange-500"
      />
    </label>
  );
}

function BreakpointsSection({ form, onBreakpointsChange }: BreakpointsSectionProps) {
  return (
    <SectionCard title="Breakpoints" description="Adjust pricing for very small or large jobs.">
      <div className="space-y-2">
        <RadioRow
          label="Keep base rates flat"
          name="use_breakpoints"
          value="no"
          checked={form.use_breakpoints === "no"}
          onChange={() => onBreakpointsChange("no")}
        />
        <RadioRow
          label="Use breakpoints for edge cases"
          name="use_breakpoints"
          value="yes"
          checked={form.use_breakpoints === "yes"}
          onChange={() => onBreakpointsChange("yes")}
        />
      </div>

      {form.use_breakpoints === "yes" ? (
        <div className="space-y-1">
          <p className="text-xs text-white/70">Describe how pricing should change for tiny or large jobs.</p>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-400 focus:outline-none"
            value={form.breakpoint_text}
            onChange={(e) => onBreakpointsChange("yes", e.target.value)}
            placeholder="Example: under 10m² increase labour, over 60m² reduce labour and materials by 10%."
          />
        </div>
      ) : null}
    </SectionCard>
  );
}

type VatSectionProps = { form: PricingFormState; onVatChange: (value: "registered" | "exempt") => void };

function VatSection({ form, onVatChange }: VatSectionProps) {
  return (
    <SectionCard title="VAT setup" description="Tell BillyBot how to handle tax on quotes.">
      <div className="space-y-2">
        <RadioRow
          label="VAT registered"
          name="vat_status"
          value="registered"
          checked={form.vat_status === "registered"}
          onChange={() => onVatChange("registered")}
        />
        <RadioRow
          label="Not VAT registered / VAT exempt"
          name="vat_status"
          value="exempt"
          checked={form.vat_status === "exempt"}
          onChange={() => onVatChange("exempt")}
        />
      </div>
    </SectionCard>
  );
}

type LabourSectionProps = {
  form: PricingFormState;
  onLabourSplitChange: (value: "split" | "no_split") => void;
};

function LabourSection({ form, onLabourSplitChange }: LabourSectionProps) {
  return (
    <SectionCard title="Labour display" description="Choose how labour shows on quotes.">
      <div className="space-y-2">
        <RadioRow
          label="Split labour into notes (no VAT on labour)"
          name="labour_split"
          value="split"
          checked={form.labour_split === "split"}
          onChange={() => onLabourSplitChange("split")}
        />
        <RadioRow
          label="Keep labour on main quote lines"
          name="labour_split"
          value="no_split"
          checked={form.labour_split === "no_split"}
          onChange={() => onLabourSplitChange("no_split")}
        />
      </div>
    </SectionCard>
  );
}

function AdvancedSection() {
  return (
    <SectionCard title="Advanced options" description="Extra controls live here.">
      <p className="text-sm text-white/70">No advanced options yet. We will add them here when ready.</p>
    </SectionCard>
  );
}

type TabId = "services" | "base" | "breakpoints" | "vat" | "labour" | "advanced";

export default function PricingPage() {
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId | "all">("all");

  const activeServices = useMemo(() => {
    return new Set(Object.keys(form.services).filter((key) => form.services[key]));
  }, [form.services]);

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

  const handleNumberChange = (key: "min_job_charge" | "day_rate_per_fitter", value: number) => {
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

  const handleBreakpointsChange = (value: "yes" | "no", text?: string) => {
    setForm((prev) => ({
      ...prev,
      use_breakpoints: value,
      breakpoint_text: text !== undefined ? text : value === "no" ? "" : prev.breakpoint_text,
    }));
  };

  const handleVatChange = (value: "registered" | "exempt") => {
    setForm((prev) => ({ ...prev, vat_status: value }));
  };

  const handleLabourSplitChange = (value: "split" | "no_split") => {
    setForm((prev) => ({ ...prev, labour_split: value }));
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

  const tabs: { id: TabId | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "services", label: "Services" },
    { id: "base", label: "Base rates" },
    { id: "breakpoints", label: "Breakpoints" },
    { id: "vat", label: "VAT" },
    { id: "labour", label: "Labour" },
    { id: "advanced", label: "Advanced" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-28">
      <header className="rounded-xl border border-white/10 bg-[#0c111f] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.15em] text-white/60">Pricing</p>
            <h1 className="text-xl font-semibold text-white">Keep your pricing simple</h1>
            <p className="text-sm text-white/70">Update services, rates, and VAT in one clean place.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Live profile
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                activeTab === tab.id
                  ? "border-orange-400 bg-orange-500/80 text-white"
                  : "border-white/10 bg-white/5 text-white/80 hover:border-orange-400/60 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        {loading ? (
          <div className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Loading pricing...</div>
        ) : null}

        {!loading && (activeTab === "all" || activeTab === "services") ? (
          <ServicesSection
            form={form}
            activeServices={activeServices}
            onToggleService={handleServiceToggle}
          />
        ) : null}

        {!loading && (activeTab === "all" || activeTab === "base") ? (
          <BaseRatesSection
            form={form}
            activeServices={activeServices}
            onMarkupChange={handleMarkupChange}
            onRateChange={handleRateChange}
            onNumberChange={handleNumberChange}
          />
        ) : null}

        {!loading && (activeTab === "all" || activeTab === "breakpoints") ? (
          <BreakpointsSection form={form} onBreakpointsChange={handleBreakpointsChange} />
        ) : null}

        {!loading && (activeTab === "all" || activeTab === "vat") ? (
          <VatSection form={form} onVatChange={handleVatChange} />
        ) : null}

        {!loading && (activeTab === "all" || activeTab === "labour") ? (
          <LabourSection form={form} onLabourSplitChange={handleLabourSplitChange} />
        ) : null}

        {!loading && (activeTab === "all" || activeTab === "advanced") ? <AdvancedSection /> : null}

        {error ? (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : null}
        {status ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}

        <div className="fixed bottom-4 left-0 right-0 z-10 flex justify-center px-4">
          <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-white/10 bg-[#0c111f] px-4 py-2 shadow-lg">
            <span className="text-xs text-white/70">Save applies across all sections</span>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving
                </>
              ) : (
                "Save pricing"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
