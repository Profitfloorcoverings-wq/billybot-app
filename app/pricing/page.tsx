"use client";

import { useState } from "react";

export default function PricingPage() {
  return (
    <div className="pricing-page max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Pricing Settings</h1>
      <p className="text-gray-300 mb-8">
        Configure your services, material margins, labour rates, VAT, and advanced rules.
      </p>

      <div className="space-y-8">

        {/* SERVICES */}
        <SettingsCard title="Services you offer" description="Toggle any services you actually take on.">
          <ServiceToggle label="Domestic carpets" name="service_domestic_carpets" defaultChecked />
          <ServiceToggle label="Commercial carpets" name="service_commercial_carpets" defaultChecked />
          <ServiceToggle label="Carpet tiles" name="service_carpet_tiles" defaultChecked />
          <ServiceToggle label="LVT" name="service_lvt" defaultChecked />
          <ServiceToggle label="Domestic vinyl" name="service_vinyl_domestic" defaultChecked />
          <ServiceToggle label="Safety vinyl / commercial" name="service_vinyl_safety" defaultChecked />
          <ServiceToggle label="Laminate" name="service_laminate" />
          <ServiceToggle label="Wood flooring" name="service_wood" />
          <ServiceToggle label="Wall cladding (Whiterock)" name="service_whiterock" />
          <ServiceToggle label="Ceramic tiles" name="service_ceramic" />
        </SettingsCard>

        {/* MATERIAL MARKUPS */}
        <SettingsCard
          title="Material Markups"
          description="Choose the markup per service (percentage or £ per m²)."
        >
          <MarkupRow label="Domestic carpet" prefix="markup_service_domestic_carpets" />
          <MarkupRow label="Commercial carpet" prefix="markup_service_commercial_carpets" />
          <MarkupRow label="Carpet tiles" prefix="markup_service_carpet_tiles" />
          <MarkupRow label="LVT" prefix="markup_service_lvt" />
          <MarkupRow label="Vinyl domestic" prefix="markup_service_vinyl_domestic" />
          <MarkupRow label="Safety vinyl" prefix="markup_service_vinyl_safety" />
          <MarkupRow label="Laminate" prefix="markup_service_laminate" />
          <MarkupRow label="Wood flooring" prefix="markup_service_wood" />
          <MarkupRow label="Wall cladding" prefix="markup_service_whiterock" />
          <MarkupRow label="Ceramic tiles" prefix="markup_service_ceramic" />
        </SettingsCard>

        {/* MATERIAL RATES */}
        <SettingsCard
          title="Base Material Rates"
          description="Your normal per-m² or per-unit material rates."
        >
          <InputRow label="LVT per m² £" name="mat_lvt" defaultValue="26" />
          <InputRow label="Carpet domestic per m² £" name="mat_carpet_domestic" defaultValue="12" />
          <InputRow label="Carpet commercial per m² £" name="mat_carpet_commercial" defaultValue="16" />
          <InputRow label="Safety flooring per m² £" name="mat_safety" defaultValue="18" />
          <InputRow label="Vinyl domestic per m² £" name="mat_vinyl_domestic" defaultValue="14" />
          <InputRow label="Vinyl commercial per m² £" name="mat_vinyl_commercial" defaultValue="18" />
          <InputRow label="Carpet tiles per m² £" name="mat_carpet_tiles" defaultValue="19.5" />
          <InputRow label="Wall cladding per m² £" name="mat_wall_cladding" defaultValue="35" />
          <InputRow label="Adhesive per m² £" name="mat_adhesive" defaultValue="3" />
          <InputRow label="Ply per m² £" name="mat_ply" defaultValue="12" />
          <InputRow label="Latex per m² £" name="mat_latex" defaultValue="10" />
        </SettingsCard>

        {/* LABOUR RATES */}
        <SettingsCard
          title="Base Labour Rates"
          description="Your normal per-m² or per-unit labour rates."
        >
          <InputRow label="Carpet labour domestic per m² £" name="lab_carpet_domestic" defaultValue="8" />
          <InputRow label="Carpet labour commercial per m² £" name="lab_carpet_commercial" defaultValue="9" />
          <InputRow label="LVT labour per m² £" name="lab_lvt" defaultValue="16" />
          <InputRow label="Safety flooring labour per m² £" name="lab_safety" defaultValue="22" />
          <InputRow label="Vinyl domestic labour per m² £" name="lab_vinyl_domestic" defaultValue="12" />
          <InputRow label="Carpet tiles labour per m² £" name="lab_carpet_tiles" defaultValue="8" />
          <InputRow label="Wall cladding labour per m² £" name="lab_wall_cladding" defaultValue="16" />
          <InputRow label="General labour per m² £" name="lab_general" defaultValue="1" />
          <InputRow label="Uplift existing flooring per m² £" name="lab_uplift" defaultValue="3" />
        </SettingsCard>

        {/* SMALL JOBS */}
        <SettingsCard
          title="Small Job Rules"
          description="Your safety nets for tiny jobs."
        >
          <InputRow label="Minimum job charge £" name="min_job_charge" defaultValue="150" />
          <InputRow label="Day rate per fitter £" name="day_rate_per_fitter" defaultValue="200" />
        </SettingsCard>

        {/* VAT */}
        <SettingsCard
          title="VAT Settings"
          description="How BillyBot treats VAT inside accounting software."
        >
          <RadioRow
            name="vat_status"
            options={[
              { label: "VAT registered", value: "registered" },
              { label: "Not VAT registered / exempt", value: "exempt" },
            ]}
          />
        </SettingsCard>

        {/* LABOUR DISPLAY */}
        <SettingsCard
          title="Labour Display"
          description="How you want labour to show on quotes."
        >
          <RadioRow
            name="labour_split"
            options={[
              { label: "Split labour into notes (no VAT)", value: "split" },
              { label: "Show labour on main quote lines", value: "no_split" },
            ]}
          />
        </SettingsCard>

      </div>
    </div>
  );
}

/* COMPONENTS */

function SettingsCard({ title, description, children }) {
  return (
    <div className="bg-[#111827] border border-gray-700 rounded-xl p-6 space-y-4 shadow-lg">
      <div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ServiceToggle({ label, name, defaultChecked }) {
  return (
    <label className="flex items-center justify-between">
      <span className="text-white">{label}</span>
      <div className="flex items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="hidden" />
        <div className="pricing-toggle"></div>
      </div>
    </label>
  );
}

function MarkupRow({ label, prefix }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-center">
      <span className="text-white">{label}</span>
      <input name={`${prefix}_value`} defaultValue="50" className="clean-input" />
      <select name={`${prefix}_unit`} className="clean-input">
        <option value="percent">%</option>
        <option value="per_m2">£/m²</option>
      </select>
    </div>
  );
}

function InputRow({ label, name, defaultValue }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-center">
      <span className="text-white">{label}</span>
      <input name={name} defaultValue={defaultValue} className="clean-input col-span-2" />
    </div>
  );
}

function RadioRow({ name, options }) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label key={o.value} className="flex items-center gap-3 text-white cursor-pointer">
          <input type="radio" name={name} value={o.value} className="clean-radio" />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}
