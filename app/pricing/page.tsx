"use client";

import { useEffect, useState } from "react";

// Webhook endpoint (same as original onboarding form)
const WEBHOOK_URL =
  "https://tradiebrain.app.n8n.cloud/webhook/pricing-onboarding";

// ----------------- CONFIG -----------------

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
  {
    id: "mat_carpet_commercial",
    label: "Carpet commercial per m² £",
    default: 16,
  },
  { id: "mat_safety", label: "Safety flooring per m² £", default: 18 },
  { id: "mat_vinyl_domestic", label: "Vinyl domestic per m² £", default: 14 },
  { id: "mat_vinyl_commercial", label: "Vinyl commercial per m² £", default: 18 },
  { id: "mat_carpet_tiles", label: "Carpet tiles per m² £", default: 19.5 },
  { id: "mat_wall_cladding", label: "Wall cladding per m² £", default: 35 },
  { id: "mat_gripper", label: "Gripper per m £", default: 4 },
  { id: "mat_underlay", label: "Underlay per m² £", default: 6 },
  {
    id: "mat_coved",
    label: "Coved skirting materials per m £",
    default: 10,
  },
  { id: "mat_weld", label: "Weld rod per roll £", default: 25 },
  { id: "mat_adhesive", label: "Adhesive per m² £", default: 3 },
  { id: "mat_ply", label: "Ply board per m² £", default: 12 },
  { id: "mat_latex", label: "Latex per m² £", default: 10 },
  { id: "mat_door_bars", label: "Door bars per m £", default: 8 },
  { id: "mat_nosings", label: "Standard nosings per m £", default: 25 },
  { id: "mat_matting", label: "Entrance matting per m² £", default: 35 },
];

const labourConfig = [
  {
    id: "lab_carpet_domestic",
    label: "Labour carpet domestic per m² £",
    default: 8,
  },
  {
    id: "lab_carpet_commercial",
    label: "Labour carpet commercial per m² £",
    default: 9,
  },
  { id: "lab_lvt", label: "Labour LVT per m² £", default: 16 },
  {
    id: "lab_ceramic",
    label: "Labour ceramic tiles per m² £",
    default: 25,
  },
  {
    id: "lab_safety",
    label: "Labour safety flooring per m² £",
    default: 22,
  },
  {
    id: "lab_vinyl_domestic",
    label: "Labour vinyl domestic per m² £",
    default: 12,
  },
  {
    id: "lab_vinyl_commercial",
    label: "Labour vinyl commercial per m² £",
    default: 14,
  },
  {
    id: "lab_carpet_tiles",
    label: "Labour carpet tiles per m² £",
    default: 8,
  },
  {
    id: "lab_wall_cladding",
    label: "Labour wall cladding per m² £",
    default: 16,
  },
  {
    id: "lab_coved",
    label: "Labour coved skirting per m £",
    default: 12,
  },
  { id: "lab_ply", label: "Labour ply board per m² £", default: 6 },
  { id: "lab_latex", label: "Labour latex per m² £", default: 6 },
  { id: "lab_nosings", label: "Labour nosings per m £", default: 8 },
  { id: "lab_matting", label: "Labour matting per m² £", default: 8 },
  { id: "lab_general", label: "Labour general £/m²", default: 1 },
  {
    id: "lab_uplift",
    label: "Uplift existing flooring per m² £",
    default: 3,
  },
  { id: "lab_waste", label: "Waste disposal per m² £", default: 2 },
  {
    id: "lab_furniture",
    label: "Furniture removal per room £",
    default: 25,
  },
];

// ----------------- DEFAULT PRICING JSON -----------------

type PricingState = Record<string, any>;

function buildDefaultPricing(uid: string, sessionId: string): PricingState {
  const data: PricingState = {
    uid,
    session_id: sessionId,

    // Services (same defaults as original)
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

    // Safety nets
    min_job_charge: 150,
    day_rate_per_fitter: 200,

    // Breakpoints
    use_breakpoints: "no",
    breakpoint_text: "",

    // VAT
    vat_status: "registered",

    // Labour display
    labour_split: "split",
  };

  // Default markups
  markupServices.forEach((svc) => {
    data[`markup_${svc}_value`] = 50;
    data[`markup_${svc}_unit`] = "percent";
  });

  // Materials
  materialConfig.forEach((cfg) => {
    data[cfg.id] = cfg.default;
  });

  // Labour
  labourConfig.forEach((cfg) => {
    data[cfg.id] = cfg.default;
  });

  return data;
}

// ----------------- MAIN PAGE -----------------

type TabId = "services" | "rates" | "advanced";

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingState | null>(null);
  const [tab, setTab] = useState<TabId>("services");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialise uid + session_id and defaults
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let uid = sp.get("uid") || "";
    let sessionId = sp.get("session_id") || "";

    if (!uid) uid = crypto.randomUUID();
    if (!sessionId) sessionId = crypto.randomUUID();

    setPricing(buildDefaultPricing(uid, sessionId));
  }, []);

  function updateField(key: string, value: any) {
    setPricing((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function updateMany(fields: Record<string, any>) {
    setPricing((prev) => ({ ...(prev || {}), ...fields }));
  }

  async function handleSave() {
    if (!pricing) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricing),
      });

      if (!res.ok) {
        throw new Error(`Webhook returned ${res.status}`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      console.error("Webhook error", e);
      setError("Something went wrong sending your pricing to BillyBot.");
    } finally {
      setSaving(false);
    }
  }

  if (!pricing) {
    return (
      <div className="flex h-full items-center justify-center text-slate-200">
        Loading pricing…
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
            Pricing settings
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            BILLYBOT PRICING SETTINGS
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-xl">
            Keep services, margins, VAT and labour preferences aligned for every
            client. BillyBot will quote exactly how you price.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_0_25px_rgba(249,115,22,0.7)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save & sync with BillyBot"}
          </button>
          <div className="text-xs h-4 text-right">
            {saved && (
              <span className="text-emerald-300">Saved and sent ✓</span>
            )}
            {error && <span className="text-rose-300">{error}</span>}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="inline-flex rounded-full border border-slate-700 bg-slate-950/70 p-1 text-xs font-medium shadow-[0_0_20px_rgba(15,23,42,0.8)]">
        {[
          { id: "services", label: "Services" },
          { id: "rates", label: "Rates" },
          { id: "advanced", label: "Advanced" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as TabId)}
            className={`relative px-4 py-2 rounded-full transition text-xs sm:text-sm ${
              tab === t.id
                ? "bg-gradient-to-r from-orange-500 to-orange-400 text-slate-950 shadow-[0_0_18px_rgba(249,115,22,0.7)]"
                : "text-slate-300 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {tab === "services" && (
        <div className="space-y-6">
          <SettingsCard
            title="Services you offer"
            description="Turn on only the jobs you actually take on."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <ServiceToggle
                label="Domestic carpets"
                checked={!!pricing.service_domestic_carpets}
                onChange={(v) => updateField("service_domestic_carpets", v)}
              />
              <ServiceToggle
                label="Commercial carpets (glue-down)"
                checked={!!pricing.service_commercial_carpets}
                onChange={(v) => updateField("service_commercial_carpets", v)}
              />
              <ServiceToggle
                label="Carpet tiles"
                checked={!!pricing.service_carpet_tiles}
                onChange={(v) => updateField("service_carpet_tiles", v)}
              />
              <ServiceToggle
                label="LVT / Luxury Vinyl Tiles"
                checked={!!pricing.service_lvt}
                onChange={(v) => updateField("service_lvt", v)}
              />
              <ServiceToggle
                label="Domestic vinyl"
                checked={!!pricing.service_vinyl_domestic}
                onChange={(v) => updateField("service_vinyl_domestic", v)}
              />
              <ServiceToggle
                label="Safety / commercial vinyl"
                checked={!!pricing.service_vinyl_safety}
                onChange={(v) => updateField("service_vinyl_safety", v)}
              />
              <ServiceToggle
                label="Laminate"
                checked={!!pricing.service_laminate}
                onChange={(v) => updateField("service_laminate", v)}
              />
              <ServiceToggle
                label="Solid / engineered wood"
                checked={!!pricing.service_wood}
                onChange={(v) => updateField("service_wood", v)}
              />
              <ServiceToggle
                label="Altro Whiterock (wall cladding)"
                checked={!!pricing.service_whiterock}
                onChange={(v) => updateField("service_whiterock", v)}
              />
              <ServiceToggle
                label="Ceramic tiles"
                checked={!!pricing.service_ceramic}
                onChange={(v) => updateField("service_ceramic", v)}
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Leave at least one service on. Switch off anything you never
              touch.
            </p>
          </SettingsCard>

          <SettingsCard
            title="Small job rules"
            description="Protect your day rate on tiny jobs."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Minimum job charge £"
                value={pricing.min_job_charge ?? 150}
                onChange={(val) =>
                  updateField("min_job_charge", Number(val) || 0)
                }
              />
              <InputField
                label="Day rate per fitter £"
                value={pricing.day_rate_per_fitter ?? 200}
                onChange={(val) =>
                  updateField("day_rate_per_fitter", Number(val) || 0)
                }
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              BillyBot will check quotes against these when jobs start looking
              like a full day.
            </p>
          </SettingsCard>
        </div>
      )}

      {tab === "rates" && (
        <div className="space-y-6">
          <SettingsCard
            title="Material markups"
            description="How much you add on top of supplier cost for each service."
          >
            <div className="space-y-3">
              {markupServices.map((svc) => {
                const valueKey = `markup_${svc}_value`;
                const unitKey = `markup_${svc}_unit`;
                const value = pricing[valueKey] ?? 50;
                const unit = pricing[unitKey] ?? "percent";
                const label = markupLabels[svc];

                if (!pricing[svc]) return null;

                return (
                  <MarkupRow
                    key={svc}
                    label={label}
                    value={value}
                    unit={unit}
                    onChange={(val, unitVal) =>
                      updateMany({
                        [valueKey]: val,
                        [unitKey]: unitVal,
                      })
                    }
                  />
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Use % for normal margins or switch to £/m² if that's how you
              quote.
            </p>
          </SettingsCard>

          <SettingsCard
            title="Base material rates"
            description="Your mid-range material prices. BillyBot can still tweak them per job."
          >
            <div className="space-y-3">
              {materialConfig.map((cfg) => (
                <InputRow
                  key={cfg.id}
                  label={cfg.label}
                  value={pricing[cfg.id] ?? cfg.default}
                  onChange={(val) =>
                    updateField(cfg.id, Number(val) || cfg.default)
                  }
                />
              ))}
            </div>
          </SettingsCard>

<SettingsCard
  title="Base labour rates"
  description="Your typical labour prices for each type of work."
>
  <div className="space-y-3">
    {labourConfig.map((cfg) => (
      <InputRow
        key={cfg.id}
        label={cfg.label}
        value={form[cfg.id]}
        onChange={(val) => updateField(cfg.id, val)}
      />
    ))}
  </div>
</SettingsCard>

{/* SMALL JOB RULES */}
<SettingsCard
  title="Small job rules"
  description="Ensure even tiny jobs still cover your time."
>
  <InputRow
    label="Minimum job charge £"
    value={form.min_job_charge}
    onChange={(val) => updateField("min_job_charge", val)}
  />

  <InputRow
    label="Day rate per fitter £"
    value={form.day_rate_per_fitter}
    onChange={(val) => updateField("day_rate_per_fitter", val)}
  />

  <p className="text-xs text-gray-400 mt-2">
    BillyBot checks quotes against these when jobs look like a full day.
  </p>
</SettingsCard>

{/* BREAKPOINTS */}
<SettingsCard
  title="Breakpoints"
  description="If you charge different rates for small or huge jobs, set that here."
>
  <RadioRow
    name="use_breakpoints"
    value={form.use_breakpoints}
    options={[
      { label: "No breakpoints", value: "no" },
      { label: "Yes – I use breakpoints", value: "yes" },
    ]}
    onChange={(val) => updateField("use_breakpoints", val)}
  />

  {form.use_breakpoints === "yes" && (
    <div className="mt-3 space-y-2">
      <label className="block text-sm text-gray-200">Your breakpoint rules</label>
      <textarea
        className="clean-input !h-32 !resize-y"
        value={form.breakpoint_text}
        onChange={(e) => updateField("breakpoint_text", e.target.value)}
        placeholder={`Example:
- If LVT is under 10m², charge £30/m² labour
- Over 60m² drop labour & mats by 10%
- Over 100m² reduce labour by £4/m²`}
      />
      <p className="text-xs text-gray-400">
        Keep it simple. BillyBot converts it into hard rules.
      </p>
    </div>
  )}
</SettingsCard>

{/* VAT */}
<SettingsCard
  title="VAT setup"
  description="How BillyBot should treat tax inside Xero, Sage or QuickBooks."
>
  <RadioRow
    name="vat_status"
    value={form.vat_status}
    options={[
      { label: "VAT registered", value: "registered" },
      { label: "Not VAT registered / VAT exempt", value: "exempt" },
    ]}
    onChange={(val) => updateField("vat_status", val)}
  />
</SettingsCard>

{/* LABOUR DISPLAY */}
<SettingsCard
  title="Labour display"
  description="Where labour appears on your quotes."
>
  <RadioRow
    name="labour_split"
    value={form.labour_split}
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
    onChange={(val) => updateField("labour_split", val)}
  />

  <p className="text-xs text-gray-400 mt-2">
    If you pay subcontractors directly and don’t want VAT on labour, keep it split.
  </p>
</SettingsCard>

{/* SAVE BUTTON */}
<div className="flex justify-end pt-6">
  <button
    onClick={handleSubmit}
    className="px-6 py-3 rounded-xl font-semibold text-black bg-orange-400 hover:bg-orange-500 transition"
  >
    Save pricing
  </button>
</div>

</div>
); // END return
} // END component

export default PricingPage;
