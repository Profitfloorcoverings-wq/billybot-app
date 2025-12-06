"use client";

import { useMemo, useState } from "react";

type BooleanMap = Record<string, boolean>;
type NumericMap = Record<string, string>;

type MarkupMap = Record<
  string,
  {
    value: string;
    type: "£" | "%";
  }
>;

const serviceOptions = [
  "Domestic carpets",
  "Commercial carpets",
  "Carpet tiles",
  "LVT",
  "Domestic vinyl",
  "Safety / commercial vinyl",
  "Laminate",
  "Solid or engineered wood",
  "Altro Whiterock (wall cladding)",
  "Ceramic tiles",
];

const markupOptions = [
  "Domestic carpet markup",
  "Commercial carpet markup",
  "Carpet tiles markup",
  "LVT markup",
  "Domestic vinyl markup",
  "Safety vinyl markup",
  "Laminate markup",
  "Wood markup",
  "Whiterock markup",
  "Ceramic tiles markup",
];

const materialPriceFields = [
  "LVT material price per m²",
  "Ceramic tiles material price per m²",
  "Domestic carpet material price per m²",
  "Commercial carpet material price per m²",
  "Safety flooring material price per m²",
  "Domestic vinyl material price per m²",
  "Commercial vinyl material price per m²",
  "Carpet tiles material price per m²",
  "Wall cladding material price per m²",
  "Gripper material price per metre",
  "Underlay material price per m²",
  "Coved skirting material price per metre",
  "Weld rod material price per roll",
  "Adhesive material price per m²",
  "Ply board material price per m²",
  "Latex material price per m²",
  "Door bars material price per metre",
  "Stair nosings material price per metre",
  "Entrance matting material price per m²",
];

const labourPriceFields = [
  "Domestic carpet labour per m²",
  "Commercial carpet labour per m²",
  "LVT labour per m²",
  "Ceramic tile labour per m²",
  "Safety flooring labour per m²",
  "Domestic vinyl labour per m²",
  "Commercial vinyl labour per m²",
  "Carpet tiles labour per m²",
  "Wall cladding labour per m²",
  "Coved skirting labour per metre",
  "Ply boarding labour per m²",
  "Latex labour per m²",
  "Stair nosings labour per metre",
  "Entrance matting labour per m²",
  "General labour per m²",
  "Uplift existing flooring labour per m²",
  "Waste disposal labour per m²",
  "Furniture removal labour per room",
];

const smallJobFields = ["Minimum job charge", "Day rate per fitter"];

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

function createMarkupState(keys: string[]): MarkupMap {
  return keys.reduce<MarkupMap>((acc, key) => {
    acc[key] = { value: "", type: "%" };
    return acc;
  }, {});
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
  const [serviceToggles, setServiceToggles] = useState<BooleanMap>(() =>
    createBooleanState(serviceOptions)
  );

  const [markupState, setMarkupState] = useState<MarkupMap>(() =>
    createMarkupState(markupOptions)
  );

  const [materialPrices, setMaterialPrices] = useState<NumericMap>(() =>
    createNumericState(materialPriceFields)
  );

  const [labourPrices, setLabourPrices] = useState<NumericMap>(() =>
    createNumericState(labourPriceFields)
  );

  const [smallJobs, setSmallJobs] = useState<NumericMap>(() =>
    createNumericState(smallJobFields)
  );

  const [breakpointsEnabled, setBreakpointsEnabled] = useState(false);
  const [breakpointRules, setBreakpointRules] = useState(
    "Lower per-m² rate after 50m²\nPremium after 5 rooms"
  );
  const [vatRegistered, setVatRegistered] = useState(true);
  const [labourDisplay, setLabourDisplay] = useState<"split" | "main">(
    "split"
  );

  const sortedServiceOptions = useMemo(
    () => [...serviceOptions].sort((a, b) => a.localeCompare(b)),
    []
  );

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
              <div key={service} className="setting-tile setting-tile-row">
                <div className="stack">
                  <span className="setting-label">{service}</span>
                  <span className="setting-hint">
                    Control whether this service is offered.
                  </span>
                </div>
                <Toggle
                  checked={serviceToggles[service]}
                  onChange={(value) =>
                    setServiceToggles((prev) => ({ ...prev, [service]: value }))
                  }
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
                Set markup amounts for each service and choose whether to apply £ or %.
              </p>
            </div>
          </div>
          <div className="settings-tiles">
            {markupOptions.map((label) => {
              const { value, type } = markupState[label];
              return (
                <div key={label} className="setting-tile setting-tile-row">
                  <div className="stack">
                    <span className="setting-label">{label}</span>
                    <span className="setting-hint">Markup applied to materials.</span>
                  </div>
                  <div className="setting-actions">
                    <input
                      className="input-compact"
                      type="number"
                      inputMode="decimal"
                      value={value}
                      onChange={(e) =>
                        setMarkupState((prev) => ({
                          ...prev,
                          [label]: { ...prev[label], value: e.target.value },
                        }))
                      }
                    />
                    <OptionToggle
                      value={type}
                      options={["£", "%"]}
                      onChange={(option) =>
                        setMarkupState((prev) => ({
                          ...prev,
                          [label]: { ...prev[label], type: option as "£" | "%" },
                        }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="settings-section-heading">
          <div className="stack">
            <h3 className="section-title text-lg">Base material prices</h3>
            <p className="section-subtitle">
              Enter material prices per m², metre, or roll to drive quoting calculations.
            </p>
          </div>
        </div>
        <div className="settings-grid-compact">
          {materialPriceFields.map((label) => (
            <NumberField
              key={label}
              label={label}
              value={materialPrices[label]}
              onChange={(val) =>
                setMaterialPrices((prev) => ({ ...prev, [label]: val }))
              }
            />
          ))}
        </div>
      </div>

      <div className="card stack">
        <div className="settings-section-heading">
          <div className="stack">
            <h3 className="section-title text-lg">Base labour prices</h3>
            <p className="section-subtitle">Labour rates per m², metre, or room.</p>
          </div>
        </div>
        <div className="settings-grid-compact">
          {labourPriceFields.map((label) => (
            <NumberField
              key={label}
              label={label}
              value={labourPrices[label]}
              onChange={(val) =>
                setLabourPrices((prev) => ({ ...prev, [label]: val }))
              }
            />
          ))}
        </div>
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
            {smallJobFields.map((label) => (
              <NumberField
                key={label}
                label={label}
                value={smallJobs[label]}
                onChange={(val) => setSmallJobs((prev) => ({ ...prev, [label]: val }))}
              />
            ))}
          </div>
        </div>

        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Breakpoint rules</h3>
              <p className="section-subtitle">
                Enable breakpoints to apply special rules for certain sizes.
              </p>
            </div>
            <Toggle
              checked={breakpointsEnabled}
              onChange={(val) => setBreakpointsEnabled(val)}
            />
          </div>
          <textarea
            className="input-fluid breakpoint-textarea"
            rows={5}
            placeholder="Describe breakpoint logic here..."
            disabled={!breakpointsEnabled}
            value={breakpointRules}
            onChange={(e) => setBreakpointRules(e.target.value)}
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
              onChange={(val) => setVatRegistered(val)}
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
              onChange={(val) =>
                setLabourDisplay(val === "Split labour into notes" ? "split" : "main")
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
