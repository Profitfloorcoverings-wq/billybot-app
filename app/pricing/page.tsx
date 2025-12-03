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

type ServicesSectionProps = {
  form: PricingFormState;
  onToggleService: (key: string) => void;
  activeServices: Set<string>;
};

type BaseRatesSectionProps = {
  form: PricingFormState;
  activeServices: Set<string>;
  onMarkupChange: (key: string, value: Partial<MarkupValue>) => void;
  onRateChange: (collection: "materials" | "labour", key: string, value: number) => void;
  onNumberChange: (key: "min_job_charge" | "day_rate_per_fitter", value: number) => void;
};

type BreakpointsSectionProps = {
  form: PricingFormState;
  onBreakpointsChange: (value: "yes" | "no", text?: string) => void;
};

type VatSectionProps = { form: PricingFormState; onVatChange: (value: "registered" | "exempt") => void };

type LabourSectionProps = {
  form: PricingFormState;
  onLabourSplitChange: (value: "split" | "no_split") => void;
};

 function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-[rgba(10,15,28,0.9)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? <p className="text-sm text-white/60">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

 function ToggleChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-10 items-center rounded-full p-1 transition-colors duration-200 ${
        active ? "bg-gradient-to-r from-orange-500 to-orange-400" : "bg-white/10"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
          active ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function ServicesSection({ form, onToggleService, activeServices }: ServicesSectionProps) {
  return (
    <SectionCard
      title="Services"
      description="Toggle the jobs you take on. Disabled services stay off quotes."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {SERVICES.map((svc) => (
          <button
            key={svc.key}
            type="button"
            onClick={() => onToggleService(svc.key)}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-left text-sm text-white transition hover:border-orange-400/70 hover:bg-white/10"
          >
            <div>
              <p className="font-semibold">{svc.label}</p>
              <p className="text-xs text-white/60">{form.services[svc.key] ? "Included" : "Excluded"}</p>
            </div>
            <ToggleChip active={!!form.services[svc.key]} />
          </button>
        ))}
      </div>
      {activeServices.size === 0 ? (
        <p className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
          Turn on at least one service to unlock markups and base rates.
        </p>
      ) : null}
    </SectionCard>
  );
}

function BaseRatesSection({
  form,
  onMarkupChange,
  onRateChange,
  onNumberChange,
  activeServices,
}: BaseRatesSectionProps) {
  const filtered = (config: RateConfig[]) => {
    return config.filter((cfg) => cfg.always || (cfg.services && cfg.services.some((svc) => activeServices.has(svc))));
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Guardrails"
        description="Set your minimum charge and day rate so small jobs still cover your time."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-white">Minimum charge per job</span>
            <input
              type="number"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.min_job_charge}
              min={0}
              step={1}
              onChange={(e) => onNumberChange("min_job_charge", Number(e.target.value))}
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-white">Day rate per fitter</span>
            <input
              type="number"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.day_rate_per_fitter}
              min={0}
              step={1}
              onChange={(e) => onNumberChange("day_rate_per_fitter", Number(e.target.value))}
              required
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Markup logic" description="Set material markups per service.">
        <div className="space-y-3">
          {MARKUP_CONFIG.filter((cfg) => activeServices.has(cfg.key)).map((cfg) => {
            const entry = form.markups[cfg.key] ?? { value: cfg.defaultValue, unit: "percent" };
            return (
              <div key={cfg.key} className="grid items-center gap-3 sm:grid-cols-[1.2fr_0.8fr_0.6fr]">
                <label className="text-sm font-semibold text-white">{cfg.label}</label>
                <input
                  type="number"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  value={entry.value}
                  min={0}
                  step={0.1}
                  onChange={(e) => onMarkupChange(cfg.key, { value: Number(e.target.value) })}
                  required
                />
                <select
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
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
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              Enable a service to set its markup.
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title="Base material rates" description="Materials per m² or per unit.">
        <div className="space-y-3">
          {filtered(MATERIAL_CONFIG).map((cfg) => (
            <div key={cfg.key} className="grid items-center gap-3 sm:grid-cols-[1.3fr_0.7fr]">
              <label className="text-sm font-semibold text-white">{cfg.label}</label>
              <input
                type="number"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={form.materials[cfg.key] ?? cfg.defaultValue}
                min={0}
                step={0.1}
                onChange={(e) => onRateChange("materials", cfg.key, Number(e.target.value))}
                required
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Base labour rates" description="Labour per m² or per unit.">
        <div className="space-y-3">
          {filtered(LABOUR_CONFIG).map((cfg) => (
            <div key={cfg.key} className="grid items-center gap-3 sm:grid-cols-[1.3fr_0.7fr]">
              <label className="text-sm font-semibold text-white">{cfg.label}</label>
              <input
                type="number"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={form.labour[cfg.key] ?? cfg.defaultValue}
                min={0}
                step={0.1}
                onChange={(e) => onRateChange("labour", cfg.key, Number(e.target.value))}
                required
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function BreakpointsSection({ form, onBreakpointsChange }: BreakpointsSectionProps) {
  return (
    <SectionCard
      title="Breakpoints"
      description="Adjust pricing rules for tiny areas or massive projects."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {["no", "yes"].map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white">
              <input
                type="radio"
                name="use_breakpoints"
                className="accent-orange-500"
                checked={form.use_breakpoints === value}
                onChange={() => onBreakpointsChange(value as "yes" | "no")}
              />
              {value === "yes" ? "Use breakpoints" : "No breakpoints"}
            </label>
          ))}
        </div>

        {form.use_breakpoints === "yes" ? (
          <label className="space-y-2">
            <span className="text-sm font-semibold text-white">Describe your breakpoints</span>
            <textarea
              className="min-h-[140px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Example: Under 10m² charge higher labour, over 60m² drop labour and materials by 10%."
              value={form.breakpoint_text}
              onChange={(e) => onBreakpointsChange("yes", e.target.value)}
              required
            />
          </label>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Keep base rates flat when you do not use breakpoints.
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function VatSection({ form, onVatChange }: VatSectionProps) {
  return (
    <SectionCard title="VAT setup" description="Tell BillyBot how to treat tax in your quotes.">
      <div className="flex flex-wrap gap-3">
        {[
          { value: "registered", label: "VAT registered" },
          { value: "exempt", label: "Not VAT registered / VAT exempt" },
        ].map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
          >
            <input
              type="radio"
              name="vat_status"
              className="accent-orange-500"
              checked={form.vat_status === opt.value}
              onChange={() => onVatChange(opt.value as "registered" | "exempt")}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

function LabourSection({ form, onLabourSplitChange }: LabourSectionProps) {
  return (
    <SectionCard
      title="Labour display"
      description="Choose how labour appears on quotes."
    >
      <div className="flex flex-wrap gap-3">
        {[
          { value: "split", label: "Split labour into notes (no VAT on labour)" },
          { value: "no_split", label: "Keep labour on main quote lines" },
        ].map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
          >
            <input
              type="radio"
              name="labour_split"
              className="accent-orange-500"
              checked={form.labour_split === opt.value}
              onChange={() => onLabourSplitChange(opt.value as "split" | "no_split")}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

function AdvancedSection() {
  return (
    <SectionCard
      title="Advanced options"
      description="Extra controls and future automations live here."
    >
      <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
        No extra options right now. We will surface new controls here as they launch.
      </p>
    </SectionCard>
  );
}

 const tabs = [
  { id: "services", label: "Services" },
  { id: "base", label: "Base rates" },
  { id: "breakpoints", label: "Breakpoints" },
  { id: "vat", label: "VAT setup" },
  { id: "labour", label: "Labour display" },
  { id: "advanced", label: "Advanced options" },
] as const;

 type TabId = (typeof tabs)[number]["id"];

 export default function PricingPage() {
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("services");

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

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-white/10 bg-[rgba(13,19,35,0.85)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Pricing</p>
            <h1 className="text-3xl font-black text-white">Set your pricing logic</h1>
            <p className="max-w-3xl text-sm text-white/70">
              Configure services, markups, and pricing behaviour. BillyBot will apply these settings instantly when quoting.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white">
            <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            Live pricing profile
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-orange-400 bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-[0_10px_30px_rgba(249,115,22,0.4)]"
                  : "border-white/10 bg-white/5 text-white/80 hover:border-orange-400/70 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="pb-28">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Loading pricing...
          </div>
        ) : null}

        {!loading && activeTab === "services" ? (
          <ServicesSection
            form={form}
            activeServices={activeServices}
            onToggleService={handleServiceToggle}
          />
        ) : null}

        {!loading && activeTab === "base" ? (
          <BaseRatesSection
            form={form}
            activeServices={activeServices}
            onMarkupChange={handleMarkupChange}
            onRateChange={handleRateChange}
            onNumberChange={handleNumberChange}
          />
        ) : null}

        {!loading && activeTab === "breakpoints" ? (
          <BreakpointsSection form={form} onBreakpointsChange={handleBreakpointsChange} />
        ) : null}

        {!loading && activeTab === "vat" ? (
          <VatSection form={form} onVatChange={handleVatChange} />
        ) : null}

        {!loading && activeTab === "labour" ? (
          <LabourSection form={form} onLabourSplitChange={handleLabourSplitChange} />
        ) : null}

        {!loading && activeTab === "advanced" ? <AdvancedSection /> : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}
        {status ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {status}
          </div>
        ) : null}

        <div className="fixed bottom-6 left-0 right-0 z-10 flex justify-center px-4">
          <div className="flex w-full max-w-3xl items-center justify-between gap-3 rounded-full border border-white/10 bg-[rgba(13,19,35,0.95)] px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.45)]">
            <div className="text-sm text-white/70">Save applies across all sections</div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.45)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Saving...
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

