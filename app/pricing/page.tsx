"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ensurePricingSettings } from "@/lib/pricing/ensurePricingSettings";
import {
  BREAKPOINT_DEFAULT,
  EXTRAS_LABOUR_COLUMNS,
  EXTRAS_MATERIAL_COLUMNS,
  LABOUR_PRICE_FIELDS,
  MARKUP_OPTIONS,
  MATERIAL_PRICE_FIELDS,
  SERVICE_OPTIONS,
  SERVICE_REGISTRY,
  SMALL_JOB_FIELDS,
} from "@/lib/pricing/pricingSettingsConfig";
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

const serviceOptions = SERVICE_OPTIONS;
const serviceRegistry = SERVICE_REGISTRY;
const markupOptions = MARKUP_OPTIONS;
const materialPriceFields = MATERIAL_PRICE_FIELDS;
const labourPriceFields = LABOUR_PRICE_FIELDS;
const extrasMaterialColumns = EXTRAS_MATERIAL_COLUMNS;
const extrasLabourColumns = EXTRAS_LABOUR_COLUMNS;
const smallJobFields = SMALL_JOB_FIELDS;

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
  const [isSaved, setIsSaved] = useState(false);

  const markUnsaved = () => setIsSaved(false);

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

      const ensureResult = await ensurePricingSettings(supabase, data.user.id);

      if (ensureResult.error) {
        setError(ensureResult.error.message);
        setLoading(false);
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

  async function handleSave() {
    setError(null);

    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data?.user) {
        throw new Error("You must be signed in to update pricing settings.");
      }

      const currentProfileId = data.user.id;

      let parsedBreakpoints: unknown = [];

      if (breakpointsEnabled) {
        try {
          parsedBreakpoints = JSON.parse(breakpointRules || BREAKPOINT_DEFAULT);
        } catch (parseErr) {
          throw new Error("Breakpoint rules must be valid JSON.");
        }
      }

      const payload: Record<string, unknown> = {
        vat_registered: vatRegistered,
        separate_labour: labourDisplay === "split",
        small_job_charge: toNumeric(smallJobs.small_job_charge),
        day_rate_per_fitter: toNumeric(smallJobs.day_rate_per_fitter),
        breakpoints_json: breakpointsEnabled ? parsedBreakpoints : [],
        updated_at: new Date(),
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

      const response = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: currentProfileId, settings: payload }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Unable to save pricing settings");
      }

      const { profile_json } = (await response.json()) as { profile_json?: unknown };

      if (profile_json) {
        console.debug("Pricing profile rebuilt", profile_json);
      }

      setIsSaved(true);
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save pricing settings"
      );
    }
  }

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
                    markUnsaved();
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
                          markUnsaved();
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
                          markUnsaved();
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
                  markUnsaved();
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
                  markUnsaved();
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
                  markUnsaved();
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
                  markUnsaved();
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
                  markUnsaved();
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
                markUnsaved();
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
              markUnsaved();
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
                markUnsaved();
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
                markUnsaved();
                setLabourDisplay(val === "Split labour into notes" ? "split" : "main");
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaved}
        >
          {isSaved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
