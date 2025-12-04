"use client";

import { useState, useEffect, useCallback } from "react";

// Webhook destination (same as old onboarding form)
const WEBHOOK_URL =
  "https://tradiebrain.app.n8n.cloud/webhook/pricing-onboarding";

// Helper: simple debounce for autosave
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ------------------ STATIC CONFIG ------------------ */

// Services
const markupServices = [
  "service_domestic_carpets",
  "service_commercial_carpets",
  "service_carpet_tiles",
  "service_lvt",
  "service_vinyl_domestic",
  "service_vinyl_safety",
  "service_laminate",
  "service_wood",
  "service_whiterock",
  "service_ceramic",
] as const;

const markupLabels: Record<string, string> = {
  service_domestic_carpets: "Domestic carpet",
  service_commercial_carpets: "Commercial carpet",
  service_carpet_tiles: "Carpet tiles",
  service_lvt: "LVT",
  service_vinyl_domestic: "Vinyl domestic",
  service_vinyl_safety: "Safety / commercial vinyl",
  service_laminate: "Laminate",
  service_wood: "Solid / engineered wood",
  service_whiterock: "Wall cladding",
  service_ceramic: "Ceramic tiles",
};

// Material defaults
const materialConfig = [
  { id: "mat_lvt", label: "LVT per m² £", default: 26 },
  { id: "mat_ceramic", label: "Ceramic tiles per m² £", default: 30 },
  { id: "mat_carpet_domestic", label: "Carpet domestic per m² £", default: 12 },
  { id: "mat_carpet_commercial", label: "Carpet commercial per m² £", default: 16 },
  { id: "mat_safety", label: "Safety flooring per m² £", default: 18 },
  { id: "mat_vinyl_domestic", label: "Vinyl domestic per m² £", default: 14 },
  { id: "mat_vinyl_commercial", label: "Vinyl commercial per m² £", default: 18 },
  { id: "mat_carpet_tiles", label: "Carpet tiles per m² £", default: 19.5 },
  { id: "mat_wall_cladding", label: "Wall cladding per m² £", default: 35 },
  { id: "mat_gripper", label: "Gripper per m £", default: 4 },
  { id: "mat_underlay", label: "Underlay per m² £", default: 6 },
  { id: "mat_coved", label: "Coved skirting per m £", default: 10 },
  { id: "mat_weld", label: "Weld rod per roll £", default: 25 },
  { id: "mat_adhesive", label: "Adhesive per m² £", default: 3 },
  { id: "mat_ply", label: "Ply board per m² £", default: 12 },
  { id: "mat_latex", label: "Latex per m² £", default: 10 },
  { id: "mat_door_bars", label: "Door bars per m £", default: 8 },
  { id: "mat_nosings", label: "Standard nosings per m £", default: 25 },
  { id: "mat_matting", label: "Entrance matting per m² £", default: 35 },
];

// Labour defaults
const labourConfig = [
  { id: "lab_carpet_domestic", label: "Labour carpet domestic per m² £", default: 8 },
  { id: "lab_carpet_commercial", label: "Labour carpet commercial per m² £", default: 9 },
  { id: "lab_lvt", label: "Labour LVT per m² £", default: 16 },
  { id: "lab_ceramic", label: "Labour ceramic tiles per m² £", default: 25 },
  { id: "lab_safety", label: "Labour safety flooring per m² £", default: 22 },
  { id: "lab_vinyl_domestic", label: "Labour vinyl domestic per m² £", default: 12 },
  { id: "lab_vinyl_commercial", label: "Labour vinyl commercial per m² £", default: 14 },
  { id: "lab_carpet_tiles", label: "Labour carpet tiles per m² £", default: 8 },
  { id: "lab_wall_cladding", label: "Labour wall cladding per m² £", default: 16 },
  { id: "lab_coved", label: "Labour coved skirting per m £", default: 12 },
  { id: "lab_ply", label: "Labour ply board per m² £", default: 6 },
  { id: "lab_latex", label: "Labour latex per m² £", default: 6 },
  { id: "lab_nosings", label: "Labour nosings per m £", default: 8 },
  { id: "lab_matting", label: "Labour matting per m² £", default: 8 },
  { id: "lab_general", label: "Labour general £/m²", default: 1 },
  { id: "lab_uplift", label: "Uplift existing flooring per m² £", default: 3 },
  { id: "lab_waste", label: "Waste disposal per m² £", default: 2 },
  { id: "lab_furniture", label: "Furniture removal per room £", default: 25 },
];

/* ------------------ DEFAULT PRICING JSON ------------------ */

function buildDefaultPricing(uid: string, sessionId: string) {
  const data: Record<string, any> = {
    uid,
    session_id: sessionId,

    service_domestic_carpets: true,
    service_commercial_carpets: true,
    service_carpet_tiles: true,
    service_lvt: true,
    service_vinyl_domestic: true,
    service_vinyl_safety: true,
    service_laminate: false,
    service_wood: false,
    service_whiterock: false,
    service_ceramic: false,

    min_job_charge: 150,
    day_rate_per_fitter: 200,

    use_breakpoints: "no",
    breakpoint_text: "",

    vat_status: "registered",
    labour_split: "split",
  };

  markupServices.forEach((svc) => {
    data[`markup_${svc}_value`] = 50;
    data[`markup_${svc}_unit`] = "percent";
  });

  materialConfig.forEach((cfg) => (data[cfg.id] = cfg.default));
  labourConfig.forEach((cfg) => (data[cfg.id] = cfg.default));

  return data;
}

/* ------------------ PAGE COMPONENT ------------------ */

export default function PricingPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [pricing, setPricing] = useState<Record<string, any> | null>(null);

  // Generate uid + session_id on first load (matches old onboarding)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let uid = params.get("uid") || crypto.randomUUID();
    let sessionId = params.get("session_id") || crypto.randomUUID();

    setPricing(buildDefaultPricing(uid, sessionId));
  }, []);

  // Debounced webhook save
  const debouncedSave = useCallback(
    debounce(async (payload: Record<string, any>) => {
      setSaving(true);
      setSaved(false);

      try {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Webhook error:", err);
      }

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800),
    []
  );

  function updateField(key: string, value: any) {
    setPricing((prev) => {
      const next = { ...(prev || {}), [key]: value };
      debouncedSave(next);
      return next;
    });
  }

  function updateMany(map: Record<string, any>) {
    setPricing((prev) => {
      const next = { ...(prev || {}), ...map };
      debouncedSave(next);
      return next;
    });
  }

  if (!pricing) {
    return <div className="p-10 text-white">Loading…</div>;
  }

  /* ------------------ UI ------------------ */

  return (
    <div className="pricing-page max-w-5xl mx-auto py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Pricing settings</h1>
          <p className="text-sm text-gray-300 mt-1">
            Set your rules once. BillyBot will quote exactly how you do.
          </p>
        </div>
        <div className="text-sm">
          {saving && <span className="text-amber-300">Saving…</span>}
          {!saving && saved && <span className="text-emerald-300">Saved ✓</span>}
        </div>
      </header>

      {/* -------- SERVICES -------- */}
      <SettingsCard title="Services you offer" description="Turn on only what you do.">
        <div className="grid gap-3 sm:grid-cols-2">
          {markupServices.map((svc) => (
            <ServiceToggle
              key={svc}
              label={markupLabels[svc]}
              checked={!!pricing[svc]}
              onChange={(v) => updateField(svc, v)}
            />
          ))}
        </div>
      </SettingsCard>

      {/* -------- MARKUPS -------- */}
      <SettingsCard title="Material markups" description="How much you add on.">
        <div className="space-y-3">
          {markupServices.map((svc) => {
            if (!pricing[svc]) return null;
            return (
              <MarkupRow
                key={svc}
                label={markupLabels[svc]}
                value={pricing[`markup_${svc}_value`]}
                unit={pricing[`markup_${svc}_unit`]}
                onChange={(val, u) =>
                  updateMany({
                    [`markup_${svc}_value`]: val,
                    [`markup_${svc}_unit`]: u,
                  })
                }
              />
            );
          })}
        </div>
      </SettingsCard>

      {/* -------- MATERIAL RATES -------- */}
      <SettingsCard title="Base material rates" description="Your standard material costs.">
        <div className="space-y-2">
          {materialConfig.map((cfg) => (
            <InputRow
              key={cfg.id}
              label={cfg.label}
              value={pricing[cfg.id]}
              onChange={(v) => updateField(cfg.id, Number(v))}
            />
          ))}
        </div>
      </SettingsCard>

      {/* -------- LABOUR RATES -------- */}
      <SettingsCard title="Base labour rates" description="Your normal labour prices.">
        <div className="space-y-2">
          {labourConfig.map((cfg) => (
            <InputRow
              key={cfg.id}
              label={cfg.label}
              value={pricing[cfg.id]}
              onChange={(v) => updateField(cfg.id, Number(v))}
            />
          ))}
        </div>
      </SettingsCard>

      {/* -------- SMALL JOB -------- */}
      <SettingsCard title="Small job rules" description="Protect your day rate.">
        <InputRow
          label="Minimum job charge £"
          value={pricing.min_job_charge}
          onChange={(v) => updateField("min_job_charge", Number(v))}
        />
        <InputRow
          label="Day rate per fitter £"
          value={pricing.day_rate_per_fitter}
          onChange={(v) => updateField("day_rate_per_fitter", Number(v))}
        />
      </SettingsCard>

      {/* -------- BREAKPOINTS -------- */}
      <SettingsCard
        title="Breakpoints"
        description="Change pricing for tiny or huge jobs."
      >
        <RadioRow
          name="use_breakpoints"
          value={pricing.use_breakpoints}
          options={[
            { label: "No breakpoints", value: "no" },
            { label: "Yes – I use breakpoints", value: "yes" },
          ]}
          onChange={(v) => updateField("use_breakpoints", v)}
        />

        {pricing.use_breakpoints === "yes" && (
          <textarea
            className="clean-input h-32 resize-y mt-3"
            defaultValue={pricing.breakpoint_text}
            onChange={(e) => updateField("breakpoint_text", e.target.value)}
            placeholder="Describe your breakpoint rules…"
          />
        )}
      </SettingsCard>

      {/* -------- VAT -------- */}
      <SettingsCard title="VAT setup" description="How tax is handled on quotes.">
        <RadioRow
          name="vat_status"
          value={pricing.vat_status}
          options={[
            { label: "VAT registered", value: "registered" },
            { label: "Not VAT registered / VAT exempt", value: "exempt" },
          ]}
          onChange={(v) => updateField("vat_status", v)}
        />
      </SettingsCard>

      {/* -------- LABOUR DISPLAY -------- */}
      <SettingsCard title="Labour display" description="Where labour shows on quotes.">
        <RadioRow
          name="labour_split"
          value={pricing.labour_split}
          options={[
            {
              label: "Split labour into notes (no VAT on labour)",
              value: "split",
            },
            {
              label: "Keep labour on main quote lines",
              value: "no_split",
            },
          ]}
          onChange={(v) => updateField("labour_split", v)}
        />
      </SettingsCard>
    </div>
  );
}

/* ------------------ UI COMPONENTS ------------------ */

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[#111827] border border-gray-700 rounded-xl p-6 shadow-lg space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function ServiceToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex justify-between items-center text-white">
      <span className="text-sm">{label}</span>
      <div onClick={() => onChange(!checked)} className="cursor-pointer">
        <div className="pricing-toggle" data-active={checked} />
      </div>
    </label>
  );
}

function MarkupRow({
  label,
  value,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number, unit: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm text-white">{label}</span>
      <input
        type="number"
        className="clean-input"
        defaultValue={value}
        onChange={(e) => onChange(Number(e.target.value), unit)}
      />
      <select
        className="clean-input"
        defaultValue={unit}
        onChange={(e) => onChange(value, e.target.value)}
      >
        <option value="percent">% markup</option>
        <option value="per_m2">£/m²</option>
      </select>
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm text-white">{label}</span>
      <input
        type="number"
        className="clean-input col-span-2"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function RadioRow({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 cursor-pointer text-white"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
            className="clean-radio"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
