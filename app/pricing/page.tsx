"use client";

import { useState, useEffect } from "react";

// Webhook URL
const WEBHOOK_URL =
  "https://tradiebrain.app.n8n.cloud/webhook/pricing-onboarding";

// ---------------- CONFIG ----------------

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
  { id: "mat_coved", label: "Coved skirting materials per m £", default: 10 },
  { id: "mat_weld", label: "Weld rod per roll £", default: 25 },
  { id: "mat_adhesive", label: "Adhesive per m² £", default: 3 },
  { id: "mat_ply", label: "Ply board per m² £", default: 12 },
  { id: "mat_latex", label: "Latex per m² £", default: 10 },
  { id: "mat_door_bars", label: "Door bars per m £", default: 8 },
  { id: "mat_nosings", label: "Standard nosings per m £", default: 25 },
  { id: "mat_matting", label: "Entrance matting per m² £", default: 35 },
];

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

// ---------------- DEFAULTS ----------------

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

  materialConfig.forEach((cfg) => {
    data[cfg.id] = cfg.default;
  });

  labourConfig.forEach((cfg) => {
    data[cfg.id] = cfg.default;
  });

  return data;
}

// ---------------- MAIN COMPONENT ----------------

export default function PricingPage() {
  const [pricing, setPricing] = useState<Record<string, any> | null>(null);
  const [tab, setTab] = useState<"services" | "rates" | "advanced">("services");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialise defaults
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let uid = sp.get("uid") || crypto.randomUUID();
    let sessionId = sp.get("session_id") || crypto.randomUUID();
    setPricing(buildDefaultPricing(uid, sessionId));
  }, []);

  function updateField(key: string, value: any) {
    setPricing((prev) => ({ ...(prev || {}), [key]: value }));
  }

  async function handleSave() {
    if (!pricing) return;
    setSaving(true);
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pricing),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!pricing) return <div className="p-10 text-white">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">

      {/* HEADER */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Pricing settings</h1>
          <p className="text-sm text-gray-300 mt-1">
            Set your rules once. BillyBot will quote exactly how you do.
          </p>
        </div>
        <button
          onClick={handleSave}
          className="px-6 py-3 rounded-xl font-semibold text-black bg-orange-400 hover:bg-orange-500 transition"
        >
          {saving ? "Saving…" : "Save pricing"}
        </button>
      </header>

      {/* TABS */}
      <nav className="flex gap-3 text-sm">
        <button
          className={tab === "services" ? "text-orange-400" : "text-gray-300"}
          onClick={() => setTab("services")}
        >
          Services
        </button>
        <button
          className={tab === "rates" ? "text-orange-400" : "text-gray-300"}
          onClick={() => setTab("rates")}
        >
          Rates
        </button>
        <button
          className={tab === "advanced" ? "text-orange-400" : "text-gray-300"}
          onClick={() => setTab("advanced")}
        >
          Advanced
        </button>
      </nav>

      {/* SERVICES TAB */}
      {tab === "services" && (
        <div className="space-y-6">
          <SettingsCard
            title="Services you offer"
            description="Turn on only the jobs you actually take on."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {markupServices.map((svc) => (
<ServiceToggle
  label={markupLabels[svc]}
  checked={!!pricing[svc]}
  onChange={(v: boolean) => updateField(svc, v)}
/>
              ))}
            </div>
          </SettingsCard>

          <SettingsCard
            title="Small job rules"
            description="Protect yourself on tiny jobs."
          >
            <InputRow
              label="Minimum job charge £"
              value={pricing.min_job_charge}
              onChange={(val) => updateField("min_job_charge", Number(val))}
            />
            <InputRow
              label="Day rate per fitter £"
              value={pricing.day_rate_per_fitter}
              onChange={(val) =>
                updateField("day_rate_per_fitter", Number(val))
              }
            />
          </SettingsCard>
        </div>
      )}

      {/* RATES TAB */}
      {tab === "rates" && (
        <div className="space-y-6">
          <SettingsCard
            title="Material markups"
            description="How much margin you add to each service."
          >
            {markupServices.map((svc) => {
              if (!pricing[svc]) return null;
              const valKey = `markup_${svc}_value`;
              const unitKey = `markup_${svc}_unit`;
              return (
                <MarkupRow
                  key={svc}
                  label={markupLabels[svc]}
                  value={pricing[valKey]}
                  unit={pricing[unitKey]}
                  onChange={(val, unit) => {
                    updateField(valKey, val);
                    updateField(unitKey, unit);
                  }}
                />
              );
            })}
          </SettingsCard>

          <SettingsCard title="Base material rates" description="">
            {materialConfig.map((cfg) => (
              <InputRow
                key={cfg.id}
                label={cfg.label}
                value={pricing[cfg.id]}
                onChange={(val) =>
                  updateField(cfg.id, Number(val) || cfg.default)
                }
              />
            ))}
          </SettingsCard>

          <SettingsCard title="Base labour rates" description="">
            {labourConfig.map((cfg) => (
              <InputRow
                key={cfg.id}
                label={cfg.label}
                value={pricing[cfg.id]}
                onChange={(val) =>
                  updateField(cfg.id, Number(val) || cfg.default)
                }
              />
            ))}
          </SettingsCard>
        </div>
      )}

      {/* ADVANCED TAB */}
      {tab === "advanced" && (
        <div className="space-y-6">
          <SettingsCard title="Breakpoints" description="">
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
                className="clean-input w-full h-32 mt-3"
                value={pricing.breakpoint_text}
                onChange={(e) => updateField("breakpoint_text", e.target.value)}
              />
            )}
          </SettingsCard>

          <SettingsCard title="VAT setup" description="">
            <RadioRow
              name="vat_status"
              value={pricing.vat_status}
              options={[
                { label: "VAT registered", value: "registered" },
                { label: "Not VAT registered", value: "exempt" },
              ]}
              onChange={(v) => updateField("vat_status", v)}
            />
          </SettingsCard>

          <SettingsCard title="Labour display" description="">
            <RadioRow
              name="labour_split"
              value={pricing.labour_split}
              options={[
                { label: "Split labour into notes", value: "split" },
                { label: "Keep labour on main lines", value: "no_split" },
              ]}
              onChange={(v) => updateField("labour_split", v)}
            />
          </SettingsCard>
        </div>
      )}
    </div>
  );
}

// ---------------- UI COMPONENTS ----------------

function SettingsCard({ title, description, children }: any) {
  return (
    <section className="bg-[#111827] border border-gray-700 rounded-xl p-6 shadow-lg space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ServiceToggle({ label, checked, onChange }: any) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-white">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function InputRow({ label, value, onChange }: any) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm text-white">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="clean-input col-span-2"
      />
    </div>
  );
}

function MarkupRow({ label, value, unit, onChange }: any) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm text-white">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value), unit)}
        className="clean-input"
      />
      <select
        value={unit}
        onChange={(e) => onChange(value, e.target.value)}
        className="clean-input"
      >
        <option value="percent">% markup</option>
        <option value="per_m2">£/m²</option>
      </select>
    </div>
  );
}

function RadioRow({ name, value, options, onChange }: any) {
  return (
    <div className="space-y-2">
      {options.map((opt: any) => (
        <label key={opt.value} className="flex items-center gap-3 text-white">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
