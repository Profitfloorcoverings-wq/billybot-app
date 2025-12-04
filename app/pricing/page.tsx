"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Supabase table + columns
const TABLE_NAME = "pricing_profiles";
const PROFILE_JSON_COL = "profile_json";
const PROFILE_ID_COL = "profile_id";

// Webhook (same endpoint)
const WEBHOOK_URL = "https://tradiebrain.app.n8n.cloud/webhook/pricing-onboarding";

// Simple debounce
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Configs (mirroring your original onboarding logic)
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

// Build default JSON equivalent to your original onboarding defaults
function buildDefaultPricing(uid: string, sessionId: string) {
  const data: Record<string, any> = {
    uid,
    session_id: sessionId,

    // Step 1 services defaults (same as original form)
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

    // Min charge / day rate
    min_job_charge: 150,
    day_rate_per_fitter: 200,

    // Breakpoints
    use_breakpoints: "no",
    breakpoint_text: "",

    // VAT
    vat_status: "registered",

    // Labour split
    labour_split: "split",
  };

  // Markups 50% default, % unit
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

export default function PricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pricing, setPricing] = useState<Record<string, any> | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Initialise uid + session_id + profileId
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let uid = sp.get("uid") || "";
    let sessionId = sp.get("session_id") || "";

    if (!uid) uid = crypto.randomUUID();
    if (!sessionId) sessionId = crypto.randomUUID();

    setProfileId(uid); // we treat uid as profile_id key in Supabase

    // If we don't yet have pricing, seed it with defaults so UI doesn't flash empty
    setPricing((prev) => prev ?? buildDefaultPricing(uid, sessionId));
  }, []);

  // Load existing pricing JSON from Supabase (if any)
  useEffect(() => {
    if (!profileId) return;

    async function load() {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select(PROFILE_JSON_COL)
        .eq(PROFILE_ID_COL, profileId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading pricing:", error.message);
      }

      if (data && data[PROFILE_JSON_COL]) {
        const existing = data[PROFILE_JSON_COL] as Record<string, any>;
        // Make sure uid / session_id exist
        if (!existing.uid) existing.uid = profileId;
        if (!existing.session_id) existing.session_id = crypto.randomUUID();
        setPricing(existing);
      } else {
        // No row yet: keep or create defaults
        setPricing((prev) => {
          if (prev) return prev;
          const sess = crypto.randomUUID();
          return buildDefaultPricing(profileId, sess);
        });
      }

      setLoading(false);
    }

    load();
  }, [profileId]);

  // Debounced save
  const debouncedSave = useCallback(
    debounce(async (payload: Record<string, any>) => {
      if (!profileId) return;
      setSaving(true);
      setSaved(false);

      // Upsert into Supabase
      const { error: upsertError } = await supabase.from(TABLE_NAME).upsert({
        [PROFILE_ID_COL]: profileId,
        [PROFILE_JSON_COL]: payload,
      });

      if (upsertError) {
        console.error("Supabase upsert error:", upsertError.message);
      }

      // Fire webhook, mimicking old form-style payload
      const bodyToSend = {
        profile_id: profileId,
        ...payload,
      };

      try {
        await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyToSend),
        });
      } catch (err) {
        console.error("Webhook error:", err);
      }

      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 800),
    [profileId]
  );

  function updateField(key: string, value: any) {
    setPricing((prev) => {
      const next = { ...(prev || {}), [key]: value };
      debouncedSave(next);
      return next;
    });
  }

  function updateMany(fields: Record<string, any>) {
    setPricing((prev) => {
      const next = { ...(prev || {}), ...fields };
      debouncedSave(next);
      return next;
    });
  }

  if (loading || !pricing) {
    return <div className="p-10 text-white">Loading pricing settings…</div>;
  }

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

      {/* SERVICES */}
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
        <p className="text-xs text-gray-400 mt-2">
          At least one service should stay on. Turn off anything you never touch.
        </p>
      </SettingsCard>

      {/* MARKUPS */}
      <SettingsCard
        title="Material markups"
        description="How much you add on top of supplier cost for each service."
      >
        <div className="space-y-2">
          {markupServices.map((svc) => {
            const valueKey = `markup_${svc}_value`;
            const unitKey = `markup_${svc}_unit`;
            const value = pricing[valueKey] ?? 50;
            const unit = pricing[unitKey] ?? "percent";
            const label = markupLabels[svc];

            // Only show rows for services that are on
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
        <p className="text-xs text-gray-400 mt-2">
          Use % for typical margins or switch to £/m² if that matches how you buy.
        </p>
      </SettingsCard>

      {/* BASE MATERIAL RATES */}
      <SettingsCard
        title="Base material rates"
        description="Your mid-range material prices. You can still tweak them per quote."
      >
        <div className="space-y-2">
          {materialConfig.map((cfg) => (
            <InputRow
              key={cfg.id}
              label={cfg.label}
              value={pricing[cfg.id] ?? cfg.default}
              onChange={(val) => updateField(cfg.id, val)}
            />
          ))}
        </div>
      </SettingsCard>

      {/* BASE LABOUR RATES */}
      <SettingsCard
        title="Base labour rates"
        description="Your normal labour prices for each type of work."
      >
        <div className="space-y-2">
          {labourConfig.map((cfg) => (
            <InputRow
              key={cfg.id}
              label={cfg.label}
              value={pricing[cfg.id] ?? cfg.default}
              onChange={(val) => updateField(cfg.id, val)}
            />
          ))}
        </div>
      </SettingsCard>

      {/* SMALL JOB SAFETY NETS */}
      <SettingsCard
        title="Small job rules"
        description="Make sure even tiny jobs cover your time."
      >
        <InputRow
          label="Minimum job charge £"
          value={pricing.min_job_charge ?? 150}
          onChange={(val) => updateField("min_job_charge", Number(val))}
        />
        <InputRow
          label="Day rate per fitter £"
          value={pricing.day_rate_per_fitter ?? 200}
          onChange={(val) => updateField("day_rate_per_fitter", Number(val))}
        />
        <p className="text-xs text-gray-400 mt-2">
          BillyBot will check quotes against these when jobs start looking like a full day.
        </p>
      </SettingsCard>

      {/* BREAKPOINTS */}
      <SettingsCard
        title="Breakpoints (big / small jobs)"
        description="If you change rates for tiny or huge projects, add the rules here."
      >
        <RadioRow
          name="use_breakpoints"
          value={pricing.use_breakpoints ?? "no"}
          options={[
            { label: "No breakpoints", value: "no" },
            { label: "Yes – I use breakpoints", value: "yes" },
          ]}
          onChange={(val) => updateField("use_breakpoints", val)}
        />
        {pricing.use_breakpoints === "yes" && (
          <div className="mt-3 space-y-1">
            <label className="block text-sm text-gray-200">
              Describe your breakpoint rules
            </label>
            <textarea
              className="clean-input !h-32 !resize-y"
              defaultValue={pricing.breakpoint_text ?? ""}
              onChange={(e) => updateField("breakpoint_text", e.target.value)}
              placeholder={`Example:
- If LVT is under 10m², charge £30/m² for labour.
- Over 60m², drop labour and materials by 10%.
- Over 100m², drop labour by £4/m² and materials by 15%.

Add your own version for each service you offer.`}
            />
            <p className="text-xs text-gray-400">
              Keep it simple language. BillyBot will turn this into hard rules for you.
            </p>
          </div>
        )}
      </SettingsCard>

      {/* VAT */}
      <SettingsCard
        title="VAT setup"
        description="How your pricing should behave inside Sage, Xero or QuickBooks."
      >
        <RadioRow
          name="vat_status"
          value={pricing.vat_status ?? "registered"}
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
        description="Where labour shows on your quotes."
      >
        <RadioRow
          name="labour_split"
          value={pricing.labour_split ?? "split"}
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
          If you pay fitters directly and don’t want VAT on labour, keep the first option.
        </p>
      </SettingsCard>
    </div>
  );
}

/* ----------------- UI COMPONENTS ----------------- */

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
  onChange: (val: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm text-white">{label}</span>
      <div onClick={() => onChange(!checked)} className="flex items-center">
        <input type="checkbox" className="hidden" checked={checked} readOnly />
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
        className="clean-input"
        type="number"
        defaultValue={value}
        min={0}
        step={0.1}
        onChange={(e) => onChange(Number(e.target.value || 0), unit)}
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
  onChange: (val: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 items-center">
      <span className="text-sm text-white">{label}</span>
      <input
        className="clean-input col-span-2"
        type="number"
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
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-3 cursor-pointer text-sm text-white"
        >
          <input
            type="radio"
            name={name}
            className="clean-radio"
            value={opt.value}
            checked={value === opt.value}
            onChange={(e) => onChange(e.target.value)}
          />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}
