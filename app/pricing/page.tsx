"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type BooleanMap = Record<string, boolean>;
type NumericMap = Record<string, string>;
type MarkupMap = Record<
  string,
  {
    value: string;
    type: "£" | "%";
  }
>;

type ServiceOption = { label: string; column: string };
type MarkupOption = {
  label: string;
  valueColumn: string;
  typeColumn: string;
};
type NumericField = { label: string; column: string };

const serviceOptions: ServiceOption[] = [
  { label: "Domestic carpets", column: "service_domestic_carpet" },
  { label: "Commercial carpets", column: "service_commercial_carpet" },
  { label: "Carpet tiles", column: "service_carpet_tiles" },
  { label: "LVT", column: "service_lvt" },
  { label: "Domestic vinyl", column: "service_domestic_vinyl" },
  { label: "Safety / commercial vinyl", column: "service_commercial_vinyl" },
  { label: "Altro Whiterock (wall cladding)", column: "service_wall_cladding" },
];

const serviceRegistry: Record<
  string,
  { markups: string[]; materials: string[]; labour: string[] }
> = {
  service_domestic_carpet: {
    markups: ["markup_domestic_carpet_value"],
    materials: ["mat_domestic_carpet_m2"],
    labour: ["lab_domestic_carpet_m2"],
  },
  service_commercial_carpet: {
    markups: ["markup_commercial_carpet_value"],
    materials: ["mat_commercial_carpet_m2"],
    labour: ["lab_commercial_carpet_m2"],
  },
  service_carpet_tiles: {
    markups: ["markup_carpet_tiles_value"],
    materials: [],
    labour: [],
  },
  service_lvt: {
    markups: ["markup_lvt_value"],
    materials: ["mat_lvt_m2"],
    labour: ["lab_lvt_m2"],
  },
  service_domestic_vinyl: {
    markups: ["markup_domestic_vinyl_value"],
    materials: ["mat_domestic_vinyl_m2"],
    labour: ["lab_domestic_vinyl_m2"],
  },
  service_commercial_vinyl: {
    markups: ["markup_commercial_vinyl_value"],
    materials: ["mat_commercial_vinyl_m2", "mat_safety_m2"],
    labour: ["lab_commercial_vinyl_m2", "lab_safety_m2"],
  },
  service_wall_cladding: {
    markups: ["markup_wall_cladding_value"],
    materials: ["mat_wall_cladding_m2"],
    labour: ["lab_wall_cladding_m2"],
  },
};

const markupOptions: MarkupOption[] = [
  {
    label: "Domestic carpet markup",
    valueColumn: "markup_domestic_carpet_value",
    typeColumn: "markup_domestic_carpet_type",
  },
  {
    label: "Commercial carpet markup",
    valueColumn: "markup_commercial_carpet_value",
    typeColumn: "markup_commercial_carpet_type",
  },
  {
    label: "Carpet tiles markup",
    valueColumn: "markup_carpet_tiles_value",
    typeColumn: "markup_carpet_tiles_type",
  },
  {
    label: "LVT markup",
    valueColumn: "markup_lvt_value",
    typeColumn: "markup_lvt_type",
  },
  {
    label: "Domestic vinyl markup",
    valueColumn: "markup_domestic_vinyl_value",
    typeColumn: "markup_domestic_vinyl_type",
  },
  {
    label: "Safety vinyl markup",
    valueColumn: "markup_commercial_vinyl_value",
    typeColumn: "markup_commercial_vinyl_type",
  },
  {
    label: "Whiterock markup",
    valueColumn: "markup_wall_cladding_value",
    typeColumn: "markup_wall_cladding_type",
  },
];

const materialPriceFields: NumericField[] = [
  { label: "LVT material price per m²", column: "mat_lvt_m2" },
  { label: "Ceramic tiles material price per m²", column: "mat_ceramic_tiles_m2" },
  {
    label: "Domestic carpet material price per m²",
    column: "mat_domestic_carpet_m2",
  },
  {
    label: "Commercial carpet material price per m²",
    column: "mat_commercial_carpet_m2",
  },
  { label: "Safety flooring material price per m²", column: "mat_safety_m2" },
  { label: "Domestic vinyl material price per m²", column: "mat_domestic_vinyl_m2" },
  { label: "Commercial vinyl material price per m²", column: "mat_commercial_vinyl_m2" },
  { label: "Wall cladding material price per m²", column: "mat_wall_cladding_m2" },
  { label: "Adhesive per m²", column: "mat_adhesive_m2" },
  { label: "Uplift existing flooring per m²", column: "mat_uplift_m2" },
  { label: "Latex per m²", column: "mat_latex_m2" },
  { label: "Ply board per m²", column: "mat_ply_m2" },
  { label: "Coved skirting per metre", column: "mat_coved_m2" },
  { label: "Matting per m²", column: "mat_matting_m2" },
  { label: "Standard door bars (each)", column: "mat_door_bars_each" },
  { label: "Nosings per metre", column: "mat_nosings_m" },
  { label: "Underlay per m²", column: "mat_underlay" },
  { label: "Gripper per metre", column: "mat_gripper" },
  { label: "Waste disposal per m²", column: "waste_disposal" },
  { label: "Furniture removal (per room)", column: "furniture_removal" },
];

const labourPriceFields: NumericField[] = [
  { label: "Domestic carpet labour per m²", column: "lab_domestic_carpet_m2" },
  { label: "Commercial carpet labour per m²", column: "lab_commercial_carpet_m2" },
  { label: "LVT labour per m²", column: "lab_lvt_m2" },
  { label: "Ceramic tile labour per m²", column: "lab_ceramic_tiles_m2" },
  { label: "Safety flooring labour per m²", column: "lab_safety_m2" },
  { label: "Domestic vinyl labour per m²", column: "lab_domestic_vinyl_m2" },
  { label: "Commercial vinyl labour per m²", column: "lab_commercial_vinyl_m2" },
  { label: "Wall cladding labour per m²", column: "lab_wall_cladding_m2" },
  { label: "Coved skirting per metre", column: "lab_coved_m" },
  { label: "Ply boarding per m²", column: "lab_ply_m2" },
  { label: "Latex per m²", column: "lab_latex_m2" },
  { label: "Door bars (each)", column: "lab_door_bars_each" },
  { label: "Nosings per metre", column: "lab_nosings_m" },
  { label: "Matting per m²", column: "lab_matting_m2" },
  { label: "Uplift per m²", column: "lab_uplift_m2" },
  { label: "Gripper per metre", column: "lab_gripper_m" },
];

const extrasMaterialColumns = new Set([
  "mat_adhesive_m2",
  "mat_uplift_m2",
  "mat_latex_m2",
  "mat_ply_m2",
  "mat_coved_m2",
  "mat_matting_m2",
  "mat_door_bars_each",
  "mat_nosings_m",
  "mat_underlay",
  "mat_gripper",
  "waste_disposal",
  "furniture_removal",
]);
const extrasLabourColumns = new Set([
  "lab_coved_m",
  "lab_ply_m2",
  "lab_latex_m2",
  "lab_door_bars_each",
  "lab_nosings_m",
  "lab_matting_m2",
  "lab_uplift_m2",
  "lab_gripper_m",
]);

const smallJobFields: NumericField[] = [
  { label: "Minimum job charge", column: "small_job_charge" },
  { label: "Day rate per fitter", column: "day_rate_per_fitter" },
];

const BREAKPOINT_DEFAULT = "[]";

function createBooleanState(keys: string[]): BooleanMap {
  return keys.reduce<BooleanMap>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

function createNumericState(keys: string[]): NumericMap {
  return keys.reduce<NumericMap>((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

function createMarkupState(options: MarkupOption[]): MarkupMap {
  return options.reduce<MarkupMap>((acc, option) => {
    acc[option.valueColumn] = { value: "", type: "%" };
    return acc;
  }, {});
}

function numberToInput(value?: number | null) {
  return value === null || typeof value === "undefined" ? "" : String(value);
}

function toNumeric(value: string) {
  if (!value && value !== "0") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={checked ? "pill-toggle pill-toggle-on" : "pill-toggle"}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="pill-toggle-handle" aria-hidden />
      <span className="pill-toggle-label">{checked ? "On" : "Off"}</span>
      {label ? <span className="pill-toggle-sub">{label}</span> : null}
    </button>
  );
}

function OptionToggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="option-toggle" role="group" aria-label="Select option">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            className={active ? "option-toggle-btn option-toggle-btn-active" : "option-toggle-btn"}
            aria-pressed={active}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="setting-tile">
      <span className="setting-label">{label}</span>
      <input
        className="input-fluid"
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [serviceToggles, setServiceToggles] = useState<BooleanMap>(() =>
    createBooleanState(serviceOptions.map((option) => option.column))
  );

  const [markupState, setMarkupState] = useState<MarkupMap>(() =>
    createMarkupState(markupOptions)
  );

  const [materialPrices, setMaterialPrices] = useState<NumericMap>(() =>
    createNumericState(materialPriceFields.map((field) => field.column))
  );

  const [labourPrices, setLabourPrices] = useState<NumericMap>(() =>
    createNumericState(labourPriceFields.map((field) => field.column))
  );

  const [smallJobs, setSmallJobs] = useState<NumericMap>(() =>
    createNumericState(smallJobFields.map((field) => field.column))
  );

  const [breakpointsEnabled, setBreakpointsEnabled] = useState(false);
  const [breakpointRules, setBreakpointRules] = useState(BREAKPOINT_DEFAULT);
  const [vatRegistered, setVatRegistered] = useState(true);
  const [labourDisplay, setLabourDisplay] = useState<"split" | "main">("split");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydratedRef = useRef(false);
  const lastSavedPayloadRef = useRef<string | null>(null);

  const sortedServiceOptions = useMemo(
    () => [...serviceOptions].sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const { visibleMarkups, visibleMaterials, visibleLabour } = useMemo(() => {
    const markups = new Set<string>();
    const materials = new Set<string>();
    const labour = new Set<string>();

    Object.entries(serviceRegistry).forEach(([service, config]) => {
      if (!serviceToggles[service]) return;
      config.markups.forEach((column) => markups.add(column));
      config.materials.forEach((column) => materials.add(column));
      config.labour.forEach((column) => labour.add(column));
    });

    return { visibleMarkups: markups, visibleMaterials: materials, visibleLabour: labour };
  }, [serviceToggles]);

  const visibleMarkupOptions = useMemo(
    () => markupOptions.filter((option) => visibleMarkups.has(option.valueColumn)),
    [visibleMarkups]
  );

  const visibleMaterialFields = useMemo(
    () => materialPriceFields.filter((field) => visibleMaterials.has(field.column)),
    [visibleMaterials]
  );

  const visibleLabourFields = useMemo(
    () => labourPriceFields.filter((field) => visibleLabour.has(field.column)),
    [visibleLabour]
  );

  const extraMaterialFields = useMemo(
    () => materialPriceFields.filter((field) => extrasMaterialColumns.has(field.column)),
    []
  );

  const extraLabourFields = useMemo(
    () => labourPriceFields.filter((field) => extrasLabourColumns.has(field.column)),
    []
  );

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setError(null);

      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data?.user) {
        router.push("/auth/login");
        return;
      }

      const { data: settings, error: settingsError } = await supabase
        .from("pricing_settings")
        .select("*")
        .eq("profile_id", data.user.id)
        .maybeSingle();

      if (settingsError) {
        setError(settingsError.message);
        setLoading(false);
        return;
      }

      if (settings) {
        setVatRegistered(settings.vat_registered ?? true);
        setLabourDisplay(settings.separate_labour === false ? "main" : "split");

        setServiceToggles((prev) => {
          const next = { ...prev };
          serviceOptions.forEach(({ column }) => {
            next[column] = settings[column] ?? prev[column];
          });
          return next;
        });

        setMarkupState((prev) => {
          const next = { ...prev };
          markupOptions.forEach(({ valueColumn, typeColumn }) => {
            next[valueColumn] = {
              value: numberToInput(settings[valueColumn]),
              type: settings[typeColumn] === "£" ? "£" : "%",
            };
          });
          return next;
        });

        setMaterialPrices((prev) => {
          const next = { ...prev };
          materialPriceFields.forEach(({ column }) => {
            next[column] = numberToInput(settings[column]);
          });
          return next;
        });

        setLabourPrices((prev) => {
          const next = { ...prev };
          labourPriceFields.forEach(({ column }) => {
            next[column] = numberToInput(settings[column]);
          });
          return next;
        });

        setSmallJobs((prev) => {
          const next = { ...prev };
          smallJobFields.forEach(({ column }) => {
            next[column] = numberToInput(settings[column]);
          });
          return next;
        });

        const bpValue = settings.breakpoints_json;
        const serializedBreakpoints = bpValue
          ? typeof bpValue === "string"
            ? bpValue
            : JSON.stringify(bpValue)
          : BREAKPOINT_DEFAULT;

        setBreakpointRules(serializedBreakpoints || BREAKPOINT_DEFAULT);
        setBreakpointsEnabled(Boolean(serializedBreakpoints && serializedBreakpoints !== BREAKPOINT_DEFAULT));
      }

      setLoading(false);
    }

    void loadSettings();
  }, [router, supabase]);

  function buildSettingsPayload() {
    let parsedBreakpoints: unknown = [];

    if (breakpointsEnabled) {
      try {
        parsedBreakpoints = JSON.parse(breakpointRules || BREAKPOINT_DEFAULT);
      } catch (parseErr) {
        return { payload: null, error: "Breakpoint rules must be valid JSON." };
      }
    }

    const payload: Record<string, unknown> = {
      vat_registered: vatRegistered,
      separate_labour: labourDisplay === "split",
      small_job_charge: toNumeric(smallJobs.small_job_charge),
      day_rate_per_fitter: toNumeric(smallJobs.day_rate_per_fitter),
      breakpoints_json: breakpointsEnabled ? parsedBreakpoints : [],
    };

    serviceOptions.forEach(({ column }) => {
      payload[column] = serviceToggles[column];
    });

    markupOptions.forEach(({ valueColumn, typeColumn }) => {
      payload[valueColumn] = toNumeric(markupState[valueColumn]?.value ?? "");
      payload[typeColumn] = markupState[valueColumn]?.type ?? "%";
    });

    materialPriceFields.forEach(({ column }) => {
      payload[column] = toNumeric(materialPrices[column]);
    });

    labourPriceFields.forEach(({ column }) => {
      payload[column] = toNumeric(labourPrices[column]);
    });

    return { payload, error: null };
  }

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!hasHydratedRef.current) {
      const initialPayload = buildSettingsPayload();
      lastSavedPayloadRef.current = initialPayload.payload
        ? JSON.stringify(initialPayload.payload)
        : null;
      hasHydratedRef.current = true;
      return;
    }

    const { payload, error: payloadError } = buildSettingsPayload();

    if (payloadError) {
      setError(payloadError);
      return;
    }

    setError(null);

    const serializedPayload = JSON.stringify(payload);

    if (serializedPayload === lastSavedPayloadRef.current) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const { data, error: userError } = await supabase.auth.getUser();

          if (userError || !data?.user) {
            throw new Error("You must be signed in to update pricing settings.");
          }

          const currentProfileId = data.user.id;
          const response = await fetch("/api/pricing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profileId: currentProfileId,
              settings: { ...payload, updated_at: new Date() },
            }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error ?? "Unable to save pricing settings");
          }

          const { profile_json } = (await response.json()) as { profile_json?: unknown };

          if (profile_json) {
            console.debug("Pricing profile rebuilt", profile_json);
          }

          const { error: milestoneError } = await supabase
            .from("clients")
            .update({ has_edited_pricing_settings: true })
            .eq("id", currentProfileId);

          if (milestoneError) {
            console.error("Failed to update pricing settings milestone", milestoneError);
          }

          lastSavedPayloadRef.current = serializedPayload;
        } catch (err) {
          setError(
            err && typeof err === "object" && "message" in err
              ? String((err as { message?: string }).message)
              : "Unable to save pricing settings"
          );
        }
      })();
    }, 600);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    breakpointsEnabled,
    breakpointRules,
    labourDisplay,
    labourPrices,
    loading,
    markupState,
    materialPrices,
    serviceToggles,
    smallJobs,
    supabase,
    vatRegistered,
  ]);

  if (loading) {
    return (
      <div className="page-container">
        <p className="section-subtitle">Loading pricing settings...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Pricing</h1>
          <p className="section-subtitle">
            Configure pricing, labour, and VAT preferences for your quotes.
          </p>
        </div>
        <div className="tag">Pricing settings</div>
      </div>

      {error ? (
        <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
          {error}
        </div>
      ) : null}

      <div className="settings-grid">
        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Service options</h3>
              <p className="section-subtitle">Toggle services on or off for quoting.</p>
            </div>
          </div>
          <div className="settings-tiles">
            {sortedServiceOptions.map((service) => (
              <div key={service.column} className="setting-tile setting-tile-row">
                <div className="stack">
                  <span className="setting-label">{service.label}</span>
                  <span className="setting-hint">Control whether this service is offered.</span>
                </div>
                <Toggle
                  checked={serviceToggles[service.column]}
                  onChange={(value) => {
                    setServiceToggles((prev) => ({ ...prev, [service.column]: value }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Material markup settings</h3>
              <p className="section-subtitle">
                Set % or £ markup amounts to be applied to suppliers product prices for each
                service.
              </p>
            </div>
          </div>
          <div className="settings-tiles">
            {visibleMarkupOptions.length ? (
              visibleMarkupOptions.map((option) => {
                const { value, type } = markupState[option.valueColumn];
                return (
                  <div key={option.valueColumn} className="setting-tile setting-tile-row">
                    <div className="stack">
                      <span className="setting-label">{option.label}</span>
                      <span className="setting-hint">Markup applied to materials.</span>
                    </div>
                    <div className="setting-actions">
                      <input
                        className="input-compact"
                        type="number"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => {
                          setMarkupState((prev) => ({
                            ...prev,
                            [option.valueColumn]: { ...prev[option.valueColumn], value: e.target.value },
                          }));
                        }}
                      />
                      <OptionToggle
                        value={type}
                        options={["£", "%"]}
                        onChange={(optionValue) => {
                          setMarkupState((prev) => ({
                            ...prev,
                            [option.valueColumn]: {
                              ...prev[option.valueColumn],
                              type: optionValue as "£" | "%",
                            },
                          }));
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="section-subtitle">Enable a service to configure these settings.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="settings-section-heading">
          <div className="stack">
            <h3 className="section-title text-lg">Base material prices</h3>
            <p className="section-subtitle">
              Enter your most commonly used base rate or mid-range price for each floor type.
              These will be used when a product does not exist in your price lists.
            </p>
          </div>
        </div>
        {visibleMaterialFields.length ? (
          <div className="settings-grid-compact">
            {visibleMaterialFields.map((field) => (
              <NumberField
                key={field.column}
                label={field.label}
                value={materialPrices[field.column]}
                onChange={(val) => {
                  setMaterialPrices((prev) => ({ ...prev, [field.column]: val }));
                }}
              />
            ))}
          </div>
        ) : (
          <p className="section-subtitle">Enable a service to configure these settings.</p>
        )}
      </div>

      <div className="card stack">
        <div className="settings-section-heading">
          <div className="stack">
            <h3 className="section-title text-lg">Base labour prices</h3>
            <p className="section-subtitle">
              Enter your most commonly used labour rate for each floor type.
            </p>
          </div>
        </div>
        {visibleLabourFields.length ? (
          <div className="settings-grid-compact">
            {visibleLabourFields.map((field) => (
              <NumberField
                key={field.column}
                label={field.label}
                value={labourPrices[field.column]}
                onChange={(val) => {
                  setLabourPrices((prev) => ({ ...prev, [field.column]: val }));
                }}
              />
            ))}
          </div>
        ) : (
          <p className="section-subtitle">Enable a service to configure these settings.</p>
        )}
      </div>

      <div className="card stack">
        <div className="settings-section-heading">
          <div className="stack">
            <h3 className="section-title text-lg">Extras &amp; add-ons (Materials)</h3>
            <p className="section-subtitle">
              Configure global add-ons and advanced material pricing items.
            </p>
          </div>
        </div>
        {extraMaterialFields.length ? (
          <div className="settings-grid-compact">
            {extraMaterialFields.map((field) => (
              <NumberField
                key={field.column}
                label={field.label}
                value={materialPrices[field.column]}
                onChange={(val) => {
                  setMaterialPrices((prev) => ({ ...prev, [field.column]: val }));
                }}
              />
            ))}
          </div>
        ) : (
          <p className="section-subtitle">No material extras are available yet.</p>
        )}
      </div>

      <div className="card stack">
        <div className="settings-section-heading">
          <div className="stack">
            <h3 className="section-title text-lg">Extras (Labour)</h3>
            <p className="section-subtitle">
              Configure labour add-ons for prep work and accessories.
            </p>
          </div>
        </div>
        {extraLabourFields.length ? (
          <div className="settings-grid-compact">
            {extraLabourFields.map((field) => (
              <NumberField
                key={field.column}
                label={field.label}
                value={labourPrices[field.column]}
                onChange={(val) => {
                  setLabourPrices((prev) => ({ ...prev, [field.column]: val }));
                }}
              />
            ))}
          </div>
        ) : (
          <p className="section-subtitle">No labour extras are available yet.</p>
        )}
      </div>

      <div className="settings-grid">
        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Small job rules</h3>
              <p className="section-subtitle">Configure minimum charges and day rates.</p>
            </div>
          </div>
          <div className="settings-grid-compact">
            {smallJobFields.map((field) => (
              <NumberField
                key={field.column}
                label={field.label}
                value={smallJobs[field.column]}
                onChange={(val) => {
                  setSmallJobs((prev) => ({ ...prev, [field.column]: val }));
                }}
              />
            ))}
          </div>
        </div>

        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Breakpoint rules</h3>
              <p className="section-subtitle">
                Provide rules to apply special logic for bigger or smaller jobs (e.g. for jobs
                over 100m² charge 10% less on carpet tile materials and £2/m² less on
                labour).
              </p>
            </div>
            <Toggle
              checked={breakpointsEnabled}
              onChange={(val) => {
                setBreakpointsEnabled(val);
              }}
            />
          </div>
          <textarea
            className="input-fluid breakpoint-textarea"
            rows={5}
            placeholder="Provide a JSON array of breakpoint rules"
            disabled={!breakpointsEnabled}
            value={breakpointRules}
            onChange={(e) => {
              setBreakpointRules(e.target.value);
            }}
          />
        </div>
      </div>

      <div className="settings-grid">
        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">VAT settings</h3>
              <p className="section-subtitle">Toggle VAT registration on or off.</p>
            </div>
            <Toggle
              checked={vatRegistered}
              onChange={(val) => {
                setVatRegistered(val);
              }}
            />
          </div>
        </div>

        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Labour display settings</h3>
              <p className="section-subtitle">
                Choose how labour items appear on the quote output.
              </p>
            </div>
            <OptionToggle
              value={
                labourDisplay === "split"
                  ? "Split labour into notes"
                  : "Keep labour on main quote lines"
              }
              options={["Split labour into notes", "Keep labour on main quote lines"]}
              onChange={(val) => {
                setLabourDisplay(val === "Split labour into notes" ? "split" : "main");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
