"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";

type ServiceConfig = { key: string; label: string; defaultOn?: boolean };
type RateConfig = { key: string; label: string; defaultValue: number; services?: string[]; always?: boolean };
type MarkupConfig = { key: string; label: string; defaultValue: number };
type MarkupValue = { value: number; unit: "percent" | "per_m2" };
type TabId = "services" | "base" | "materials" | "labour" | "vat";

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

function Switch({ checked }: { checked: boolean }) {
  return (
    <span
      className={`relative inline-flex h-5 w-9 items-center rounded-full border border-white/15 transition-colors ${
        checked ? "bg-orange-500" : "bg-white/10"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[220px_1fr]">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-white/90">{label}</span>
        {hint ? <span className="text-xs text-white/50">{hint}</span> : null}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

function Input({ value, onChange, step = 0.1 }: { value: number; onChange: (val: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400"
    />
  );
}

function TextArea({ value, onChange, placeholder }: { value: string; onChange: (val: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (val: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-orange-400"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-[#0D1117] text-white">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#0D1117] p-6 shadow-sm">
      <div className="flex flex-col gap-1 pb-2">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description ? <p className="text-xs text-white/50">{description}</p> : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function PricingTabs({ tabs, active, onChange }: { tabs: { id: TabId; label: string }[]; active: TabId; onChange: (id: TabId) => void }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-3 py-1.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--brand2)]/70 ${
              isActive
                ? "bg-[linear-gradient(135deg,var(--brand1),var(--brand2))] text-white shadow"
                : "text-white/70 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function ServicesSection({ form, onToggle }: { form: PricingFormState; onToggle: (key: string) => void }) {
  return (
    <Card title="Services" description="Choose the work you offer. Toggle to include or exclude.">
      <div className="flex flex-col divide-y divide-white/5">
        {SERVICES.map((svc) => (
          <div key={svc.key} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-white">{svc.label}</span>
              <span className="text-xs text-white/50">{form.services[svc.key] ? "On" : "Off"}</span>
            </div>
            <button
              type="button"
              onClick={() => onToggle(svc.key)}
              className="transition hover:scale-105 focus:outline-none"
              aria-label={`Toggle ${svc.label}`}
            >
              <Switch checked={!!form.services[svc.key]} />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BaseRatesSection({
  form,
  activeServices,
  onNumberChange,
  onMarkupChange,
  onBreakpointsChange,
}: {
  form: PricingFormState;
  activeServices: Set<string>;
  onNumberChange: (key: "min_job_charge" | "day_rate_per_fitter", value: number) => void;
  onMarkupChange: (key: string, value: Partial<MarkupValue>) => void;
  onBreakpointsChange: (value: "yes" | "no", text?: string) => void;
}) {
  const markups = MARKUP_CONFIG.filter((cfg) => activeServices.has(cfg.key) || defaultServices[cfg.key]);

  return (
    <Card title="Base rates" description="Core charges and markups that drive every quote.">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3">
            <Field label="Minimum charge" hint="Applied automatically to small jobs">
              <div className="flex items-center gap-2">
                <Input value={form.min_job_charge} onChange={(v) => onNumberChange("min_job_charge", v)} step={1} />
                <span className="text-xs text-white/50">£</span>
              </div>
            </Field>
            <Field label="Day rate per fitter">
              <div className="flex items-center gap-2">
                <Input value={form.day_rate_per_fitter} onChange={(v) => onNumberChange("day_rate_per_fitter", v)} step={1} />
                <span className="text-xs text-white/50">£/day</span>
              </div>
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-semibold text-white">Service markups</span>
            <span className="text-xs text-white/60">Adjust margin by % or £/m²</span>
          </div>
          <div className="flex flex-col divide-y divide-white/5">
            {markups.map((cfg) => (
              <div key={cfg.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="text-sm text-white/90">{cfg.label}</span>
                <Input value={form.markups[cfg.key]?.value ?? cfg.defaultValue} onChange={(value) => onMarkupChange(cfg.key, { value })} />
                <Select
                  value={form.markups[cfg.key]?.unit ?? "percent"}
                  onChange={(unit) => onMarkupChange(cfg.key, { unit: unit as MarkupValue["unit"] })}
                  options={[
                    { value: "percent", label: "%" },
                    { value: "per_m2", label: "£/m²" },
                  ]}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-semibold text-white">Breakpoints</span>
            <span className="text-xs text-white/60">Adjust pricing for unusual job sizes</span>
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0D1117] px-3 py-2">
              <div className="flex flex-col">
                <span className="text-sm text-white">Use breakpoints</span>
                <span className="text-xs text-white/50">Turn on to add rules for small/large jobs</span>
              </div>
              <button
                type="button"
                onClick={() => onBreakpointsChange(form.use_breakpoints === "yes" ? "no" : "yes")}
                className="focus:outline-none"
              >
                <Switch checked={form.use_breakpoints === "yes"} />
              </button>
            </label>
            {form.use_breakpoints === "yes" ? (
              <TextArea
                value={form.breakpoint_text}
                onChange={(val) => onBreakpointsChange("yes", val)}
                placeholder="Example: Under 10m² increase labour, over 60m² reduce materials by 10%."
              />
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}

function MaterialsSection({ form, activeServices, onChange }: { form: PricingFormState; activeServices: Set<string>; onChange: (key: string, value: number) => void }) {
  const items = MATERIAL_CONFIG.filter((cfg) => cfg.always || (cfg.services && cfg.services.some((svc) => activeServices.has(svc))));

  return (
    <Card title="Materials" description="Per-unit material pricing across your services.">
      <div className="flex flex-col divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
        {items.map((cfg) => (
          <div key={cfg.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 p-4 first:rounded-t-xl last:rounded-b-xl">
            <span className="text-sm text-white/90">{cfg.label}</span>
            <Input value={form.materials[cfg.key] ?? cfg.defaultValue} onChange={(v) => onChange(cfg.key, v)} />
            <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/60">£/m²</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LabourSection({
  form,
  activeServices,
  onRateChange,
  onSplitChange,
}: {
  form: PricingFormState;
  activeServices: Set<string>;
  onRateChange: (key: string, value: number) => void;
  onSplitChange: (value: "split" | "no_split") => void;
}) {
  const items = LABOUR_CONFIG.filter((cfg) => cfg.always || (cfg.services && cfg.services.some((svc) => activeServices.has(svc))));

  return (
    <Card title="Labour" description="Labour rates and how they appear on quotes.">
      <div className="flex flex-col divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
        {items.map((cfg) => (
          <div key={cfg.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 p-4 first:rounded-t-xl last:rounded-b-xl">
            <span className="text-sm text-white/90">{cfg.label}</span>
            <Input value={form.labour[cfg.key] ?? cfg.defaultValue} onChange={(v) => onRateChange(cfg.key, v)} />
            <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/60">£/m²</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-white">Labour display</span>
            <span className="text-xs text-white/60">Choose how labour shows on quotes</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onSplitChange("split")}
              className={`rounded-md px-3 py-1 text-sm transition ${
                form.labour_split === "split"
                  ? "bg-orange-500 text-white"
                  : "border border-white/15 bg-white/5 text-white/70 hover:border-white/40"
              }`}
            >
              Split to notes
            </button>
            <button
              type="button"
              onClick={() => onSplitChange("no_split")}
              className={`rounded-md px-3 py-1 text-sm transition ${
                form.labour_split === "no_split"
                  ? "bg-orange-500 text-white"
                  : "border border-white/15 bg-white/5 text-white/70 hover:border-white/40"
              }`}
            >
              Show on lines
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function VatSection({ form, onChange }: { form: PricingFormState; onChange: (value: "registered" | "exempt") => void }) {
  return (
    <Card title="VAT" description="Tell BillyBot how to handle VAT on your quotes.">
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0D1117] px-3 py-2">
        <div className="flex flex-col">
          <span className="text-sm text-white">VAT registered</span>
          <span className="text-xs text-white/50">Toggle off if you are VAT exempt</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(form.vat_status === "registered" ? "exempt" : "registered")}
          className="focus:outline-none"
        >
          <Switch checked={form.vat_status === "registered"} />
        </button>
      </div>
    </Card>
  );
}


function SaveBar({ saving, status }: { saving: boolean; status: string | null }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/40 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <span className="text-xs text-white/60">Save changes to apply across all quotes.</span>
        <div className="flex items-center gap-3 text-sm text-emerald-300">
          {status ? <span>{status}</span> : null}
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [form, setForm] = useState<PricingFormState>(DEFAULT_FORM);
  const [activeTab, setActiveTab] = useState<TabId>("services");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeServices = useMemo(() => {
    return new Set(Object.entries(form.services).filter(([, enabled]) => enabled).map(([key]) => key));
  }, [form.services]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/pricing");
        if (!res.ok) throw new Error(`Failed to load pricing (${res.status})`);
        const data = (await res.json()) as { data?: Partial<PricingFormState> | null };
        if (mounted && data?.data) {
          setForm((prev) => mergeForm(prev, data.data ?? {}));
        }
      } catch (err) {
        console.error("Pricing load error", err);
        if (mounted) {
          setError(
            err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "Unable to load pricing"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleServiceToggle = (key: string) => {
    setForm((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: !prev.services[key] },
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
    setForm((prev) => ({ ...prev, [key]: value }));
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

  const handleVatChange = (value: "registered" | "exempt") => setForm((prev) => ({ ...prev, vat_status: value }));

  const handleLabourSplitChange = (value: "split" | "no_split") => setForm((prev) => ({ ...prev, labour_split: value }));

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

      if (!res.ok) throw new Error(`Failed to save (${res.status})`);

      setStatus("Saved");
    } catch (err) {
      console.error("Pricing save error", err);
      setError(
        err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "Unable to save"
      );
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 2500);
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "services", label: "Services" },
    { id: "base", label: "Base Rates" },
    { id: "materials", label: "Materials" },
    { id: "labour", label: "Labour" },
    { id: "vat", label: "VAT" },
  ];

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 pb-28">
      <header className="flex flex-col gap-2 pt-4">
        <h1 className="text-lg font-semibold text-white">Pricing settings</h1>
        <p className="text-sm text-white/60">Keep services, rates, VAT, and labour rules aligned in one place.</p>
        <PricingTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {loading ? <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Loading pricing…</div> : null}
        {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

        {!loading && activeTab === "services" ? <ServicesSection form={form} onToggle={handleServiceToggle} /> : null}
        {!loading && activeTab === "base" ? (
          <BaseRatesSection
            form={form}
            activeServices={activeServices}
            onNumberChange={handleNumberChange}
            onMarkupChange={handleMarkupChange}
            onBreakpointsChange={handleBreakpointsChange}
          />
        ) : null}
        {!loading && activeTab === "materials" ? (
          <MaterialsSection form={form} activeServices={activeServices} onChange={(key, value) => handleRateChange("materials", key, value)} />
        ) : null}
        {!loading && activeTab === "labour" ? (
          <LabourSection
            form={form}
            activeServices={activeServices}
            onRateChange={(key, value) => handleRateChange("labour", key, value)}
            onSplitChange={handleLabourSplitChange}
          />
        ) : null}
        {!loading && activeTab === "vat" ? <VatSection form={form} onChange={handleVatChange} /> : null}

        <SaveBar saving={saving} status={status} />
      </form>
    </main>
  );
}
