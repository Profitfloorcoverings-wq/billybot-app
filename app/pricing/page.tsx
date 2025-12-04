"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Unit = "percent" | "per_m2";

type ServiceId =
  | "service_domestic_carpets"
  | "service_commercial_carpets"
  | "service_carpet_tiles"
  | "service_lvt"
  | "service_vinyl_domestic"
  | "service_vinyl_safety"
  | "service_laminate"
  | "service_wood"
  | "service_whiterock"
  | "service_ceramic";

type PricingTab =
  | "Services"
  | "Markups"
  | "Materials"
  | "Labour"
  | "VAT"
  | "Advanced";

const SERVICE_CONFIG: { id: ServiceId; label: string; defaultOn: boolean }[] = [
  { id: "service_domestic_carpets", label: "Domestic carpets", defaultOn: true },
  {
    id: "service_commercial_carpets",
    label: "Commercial carpets (glue-down)",
    defaultOn: true,
  },
  { id: "service_carpet_tiles", label: "Carpet tiles", defaultOn: true },
  { id: "service_lvt", label: "LVT / Luxury Vinyl Tiles", defaultOn: true },
  { id: "service_vinyl_domestic", label: "Domestic vinyl", defaultOn: true },
  { id: "service_vinyl_safety", label: "Commercial / safety vinyl", defaultOn: true },
  { id: "service_laminate", label: "Laminate", defaultOn: false },
  { id: "service_wood", label: "Solid / engineered wood", defaultOn: false },
  { id: "service_whiterock", label: "Altro Whiterock (wall cladding)", defaultOn: false },
  { id: "service_ceramic", label: "Ceramic tiles", defaultOn: false },
];

const MARKUP_LABELS: Record<ServiceId, string> = {
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

type MaterialConfig = {
  id: string;
  label: string;
  defaultValue: number;
  services?: ServiceId[];
  always?: boolean;
};

const MATERIAL_CONFIG: MaterialConfig[] = [
  { id: "mat_lvt", label: "LVT per m² £", defaultValue: 26, services: ["service_lvt"] },
  {
    id: "mat_ceramic",
    label: "Ceramic tiles per m² £",
    defaultValue: 30,
    services: ["service_ceramic"],
  },
  {
    id: "mat_carpet_domestic",
    label: "Carpet domestic per m² £",
    defaultValue: 12,
    services: ["service_domestic_carpets"],
  },
  {
    id: "mat_carpet_commercial",
    label: "Carpet commercial per m² £",
    defaultValue: 16,
    services: ["service_commercial_carpets"],
  },
  {
    id: "mat_safety",
    label: "Safety flooring per m² £",
    defaultValue: 18,
    services: ["service_vinyl_safety"],
  },
  {
    id: "mat_vinyl_domestic",
    label: "Vinyl domestic per m² £",
    defaultValue: 14,
    services: ["service_vinyl_domestic"],
  },
  {
    id: "mat_vinyl_commercial",
    label: "Vinyl commercial per m² £",
    defaultValue: 18,
    services: ["service_vinyl_safety"],
  },
  {
    id: "mat_carpet_tiles",
    label: "Carpet tiles per m² £",
    defaultValue: 19.5,
    services: ["service_carpet_tiles"],
  },
  {
    id: "mat_wall_cladding",
    label: "Wall cladding per m² £",
    defaultValue: 35,
    services: ["service_whiterock"],
  },
  { id: "mat_gripper", label: "Gripper per m £", defaultValue: 4, always: true },
  { id: "mat_underlay", label: "Underlay per m² £", defaultValue: 6, always: true },
  { id: "mat_coved", label: "Coved skirting materials per m £", defaultValue: 10, always: true },
  { id: "mat_weld", label: "Weld rod per roll £", defaultValue: 25, always: true },
  { id: "mat_adhesive", label: "Adhesive per m² £", defaultValue: 3, always: true },
  { id: "mat_ply", label: "Ply board per m² £", defaultValue: 12, always: true },
  { id: "mat_latex", label: "Latex per m² £", defaultValue: 10, always: true },
  { id: "mat_door_bars", label: "Door bars per m £", defaultValue: 8, always: true },
  { id: "mat_nosings", label: "Standard nosings per m £", defaultValue: 25, always: true },
  { id: "mat_matting", label: "Entrance matting per m² £", defaultValue: 35, always: true },
];

type LabourConfig = {
  id: string;
  label: string;
  defaultValue: number;
  services?: ServiceId[];
  always?: boolean;
};

const LABOUR_CONFIG: LabourConfig[] = [
  {
    id: "lab_carpet_domestic",
    label: "Labour carpet domestic per m² £",
    defaultValue: 8,
    services: ["service_domestic_carpets"],
  },
  {
    id: "lab_carpet_commercial",
    label: "Labour carpet commercial per m² £",
    defaultValue: 9,
    services: ["service_commercial_carpets"],
  },
  { id: "lab_lvt", label: "Labour LVT per m² £", defaultValue: 16, services: ["service_lvt"] },
  { id: "lab_ceramic", label: "Labour ceramic tiles per m² £", defaultValue: 25, services: ["service_ceramic"] },
  { id: "lab_safety", label: "Labour safety flooring per m² £", defaultValue: 22, services: ["service_vinyl_safety"] },
  {
    id: "lab_vinyl_domestic",
    label: "Labour vinyl domestic per m² £",
    defaultValue: 12,
    services: ["service_vinyl_domestic"],
  },
  {
    id: "lab_vinyl_commercial",
    label: "Labour vinyl commercial per m² £",
    defaultValue: 14,
    services: ["service_vinyl_safety"],
  },
  { id: "lab_carpet_tiles", label: "Labour carpet tiles per m² £", defaultValue: 8, services: ["service_carpet_tiles"] },
  { id: "lab_wall_cladding", label: "Labour wall cladding per m² £", defaultValue: 16, services: ["service_whiterock"] },
  { id: "lab_coved", label: "Labour coved skirting per m £", defaultValue: 12, services: ["service_vinyl_safety"] },
  { id: "lab_ply", label: "Labour ply board per m² £", defaultValue: 6, always: true },
  { id: "lab_latex", label: "Labour latex per m² £", defaultValue: 6, always: true },
  { id: "lab_nosings", label: "Labour nosings per m £", defaultValue: 8, always: true },
  { id: "lab_matting", label: "Labour matting per m² £", defaultValue: 8, always: true },
  { id: "lab_general", label: "Labour general £/m²", defaultValue: 1, always: true },
  { id: "lab_uplift", label: "Uplift existing flooring per m² £", defaultValue: 3, always: true },
  { id: "lab_waste", label: "Waste disposal per m² £", defaultValue: 2, always: true },
  { id: "lab_furniture", label: "Furniture removal per room £", defaultValue: 25, always: true },
];

type MarkupState = Record<
  ServiceId,
  {
    value: number;
    unit: Unit;
  }
>;

type NumericMap = Record<string, number>;

const SUBMIT_URL = "https://tradiebrain.app.n8n.cloud/webhook/pricing-onboarding";

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70">Loading pricing…</div>}>
      <PricingPageContent />
    </Suspense>
  );
}

function PricingPageContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PricingTab>("Services");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [services, setServices] = useState<Record<ServiceId, boolean>>(() => {
    const defaults: Record<ServiceId, boolean> = {
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
    };
    return defaults;
  });

  const [markups, setMarkups] = useState<MarkupState>(() => {
    const initial = {} as MarkupState;
    SERVICE_CONFIG.forEach((svc) => {
      initial[svc.id] = { value: 50, unit: "percent" };
    });
    return initial;
  });

  const [materials, setMaterials] = useState<NumericMap>(() => {
    const initial: NumericMap = {};
    MATERIAL_CONFIG.forEach((cfg) => {
      initial[cfg.id] = cfg.defaultValue;
    });
    return initial;
  });

  const [labour, setLabour] = useState<NumericMap>(() => {
    const initial: NumericMap = {};
    LABOUR_CONFIG.forEach((cfg) => {
      initial[cfg.id] = cfg.defaultValue;
    });
    return initial;
  });

  const [minJobCharge, setMinJobCharge] = useState<number>(150);
  const [dayRatePerFitter, setDayRatePerFitter] = useState<number>(200);
  const [useBreakpoints, setUseBreakpoints] = useState<"yes" | "no">("no");
  const [breakpointText, setBreakpointText] = useState<string>("");
  const [vatStatus, setVatStatus] = useState<"registered" | "exempt">("registered");
  const [labourSplit, setLabourSplit] = useState<"split" | "no_split">("split");

  const sessionId = searchParams.get("session_id") ?? "";
  const uid = searchParams.get("uid") ?? "";

  const activeServices = useMemo(
    () => SERVICE_CONFIG.filter((svc) => services[svc.id]).map((svc) => svc.id),
    [services]
  );

  const submitForm = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaved(false);
    setError(null);

    if (activeServices.length === 0) {
      setError("Please keep at least one service active.");
      return;
    }

    if (useBreakpoints === "yes" && !breakpointText.trim()) {
      setError("Add your breakpoint notes before saving.");
      return;
    }

    try {
      setSaving(true);
      const formData = new FormData();

      // Hidden fields
      formData.append("session_id", sessionId);
      formData.append("uid", uid);

      // Services
      SERVICE_CONFIG.forEach((svc) => {
        formData.append(svc.id, services[svc.id] ? "true" : "false");
      });

      // Markups for active services only
      activeServices.forEach((svcId) => {
        const { value, unit } = markups[svcId];
        formData.append(`markup_${svcId}_value`, String(value));
        formData.append(`markup_${svcId}_unit`, unit);
      });

      // Materials
      MATERIAL_CONFIG.forEach((cfg) => {
        const show = cfg.always || cfg.services?.some((id) => services[id]);
        if (!show) return;
        formData.append(cfg.id, String(materials[cfg.id] ?? cfg.defaultValue));
      });

      // Labour
      LABOUR_CONFIG.forEach((cfg) => {
        const show = cfg.always || cfg.services?.some((id) => services[id]);
        if (!show) return;
        formData.append(cfg.id, String(labour[cfg.id] ?? cfg.defaultValue));
      });

      // Small job logic
      formData.append("min_job_charge", String(minJobCharge));
      formData.append("day_rate_per_fitter", String(dayRatePerFitter));

      // Breakpoints
      formData.append("use_breakpoints", useBreakpoints);
      if (useBreakpoints === "yes") {
        formData.append("breakpoint_text", breakpointText);
      }

      // VAT
      formData.append("vat_status", vatStatus);

      // Labour display
      formData.append("labour_split", labourSplit);

      const res = await fetch(SUBMIT_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`);
      }

      setSaved(true);
    } catch (err) {
      console.error("Pricing save error", err);
      setError("Unable to save pricing right now. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 text-white">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-white/70">Pricing settings</p>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">BILLYBOT PRICING SETTINGS</h1>
            <p className="text-sm text-white/60">
              Keep services, margins, VAT, and labour preferences aligned for every client.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={submitForm} className="relative">
        <input type="hidden" name="session_id" value={sessionId} />
        <input type="hidden" name="uid" value={uid} />

        <div className="rounded-full border border-white/10 bg-black/40 p-1 text-sm text-white/70">
          <PricingTabs activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="mt-4">
          {activeTab === "Services" ? (
            <ServicesSection services={services} setServices={setServices} />
          ) : null}
          {activeTab === "Markups" ? (
            <MarkupsSection
              activeServices={activeServices}
              markups={markups}
              setMarkups={setMarkups}
            />
          ) : null}
          {activeTab === "Materials" ? (
            <MaterialsSection
              services={services}
              materials={materials}
              setMaterials={setMaterials}
            />
          ) : null}
          {activeTab === "Labour" ? (
            <LabourSection
              services={services}
              labour={labour}
              setLabour={setLabour}
              labourSplit={labourSplit}
              setLabourSplit={setLabourSplit}
            />
          ) : null}
          {activeTab === "VAT" ? (
            <VatSection vatStatus={vatStatus} setVatStatus={setVatStatus} />
          ) : null}
          {activeTab === "Advanced" ? (
            <AdvancedSection
              minJobCharge={minJobCharge}
              setMinJobCharge={setMinJobCharge}
              dayRatePerFitter={dayRatePerFitter}
              setDayRatePerFitter={setDayRatePerFitter}
              useBreakpoints={useBreakpoints}
              setUseBreakpoints={setUseBreakpoints}
              breakpointText={breakpointText}
              setBreakpointText={setBreakpointText}
            />
          ) : null}
        </div>

        <SaveBar saving={saving} saved={saved} />

        {error ? (
          <div className="mt-3 text-sm text-red-300">{error}</div>
        ) : null}
      </form>
    </div>
  );
}

function PricingTabs({
  activeTab,
  onChange,
}: {
  activeTab: PricingTab;
  onChange: (tab: PricingTab) => void;
}) {
  const tabs: PricingTab[] = ["Services", "Markups", "Materials", "Labour", "VAT", "Advanced"];
  return (
    <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      {tabs.map((tab) => {
        const active = activeTab === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              active ? "bg-[#5271FF] text-white shadow" : "bg-transparent text-white/60 hover:text-white"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

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
    <section className="rounded-xl border border-white/10 bg-[#0F172A] p-6 shadow-sm">
      <div className="mb-4 space-y-1">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description ? <p className="text-xs text-white/60">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border border-white/15 transition ${
        checked ? "bg-[#FF7A1A]" : "bg-white/15"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ServicesSection({
  services,
  setServices,
}: {
  services: Record<ServiceId, boolean>;
  setServices: (next: Record<ServiceId, boolean>) => void;
}) {
  const toggleService = (id: ServiceId) => {
    setServices({ ...services, [id]: !services[id] });
  };

  return (
    <SectionCard
      title="Services"
      description="Switch on the work you take. Keep at least one service active."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SERVICE_CONFIG.map((svc) => (
          <div
            key={svc.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3"
          >
            <label className="text-sm text-white/80" htmlFor={svc.id}>
              {svc.label}
            </label>
            <input type="hidden" name={svc.id} value={services[svc.id] ? "true" : "false"} />
            <Switch checked={services[svc.id]} onChange={() => toggleService(svc.id)} />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function MarkupsSection({
  activeServices,
  markups,
  setMarkups,
}: {
  activeServices: ServiceId[];
  markups: MarkupState;
  setMarkups: (next: MarkupState) => void;
}) {
  const updateMarkup = (id: ServiceId, field: "value" | "unit", value: number | Unit) => {
    setMarkups({ ...markups, [id]: { ...markups[id], [field]: value } });
  };

  return (
    <SectionCard
      title="Material markups"
      description="Adjust margin by % or £/m² for the services you offer."
    >
      {activeServices.length === 0 ? (
        <p className="text-sm text-white/60">Turn on a service to set its markup.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {activeServices.map((svcId) => (
            <div key={svcId} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex-1 space-y-1">
                <div className="text-sm font-medium text-white">{MARKUP_LABELS[svcId]}</div>
                <div className="text-xs text-white/60">Set your preferred uplift.</div>
              </div>
              <input
                type="number"
                name={`markup_${svcId}_value`}
                value={markups[svcId].value}
                onChange={(e) => updateMarkup(svcId, "value", Number(e.target.value))}
                min={0}
                step={0.1}
                className="w-24 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70"
                required
              />
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 p-1 text-xs font-semibold text-white/70">
                {(["percent", "per_m2"] as Unit[]).map((unit) => {
                  const active = markups[svcId].unit === unit;
                  return (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => updateMarkup(svcId, "unit", unit)}
                      className={`rounded-full px-3 py-1 transition ${
                        active
                          ? "bg-[#FF7A1A] text-white shadow"
                          : "text-white/70 hover:text-white"
                      }`}
                    >
                      {unit === "percent" ? "%" : "£/m²"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function MaterialsSection({
  services,
  materials,
  setMaterials,
}: {
  services: Record<ServiceId, boolean>;
  materials: NumericMap;
  setMaterials: (next: NumericMap) => void;
}) {
  const visible = MATERIAL_CONFIG.filter(
    (cfg) => cfg.always || cfg.services?.some((svc) => services[svc])
  );

  const updateMaterial = (id: string, value: number) => {
    setMaterials({ ...materials, [id]: value });
  };

  return (
    <SectionCard
      title="Base material rates"
      description="Set the material rates you want BillyBot to quote with."
    >
      <div className="flex flex-col gap-3">
        {visible.map((cfg) => (
          <div
            key={cfg.id}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_auto] sm:items-center"
          >
            <label className="text-sm text-white/80" htmlFor={cfg.id}>
              {cfg.label}
            </label>
            <input
              type="number"
              id={cfg.id}
              name={cfg.id}
              value={materials[cfg.id]}
              onChange={(e) => updateMaterial(cfg.id, Number(e.target.value))}
              min={0}
              step={0.1}
              className="w-28 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70"
              required
            />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function LabourSection({
  services,
  labour,
  setLabour,
  labourSplit,
  setLabourSplit,
}: {
  services: Record<ServiceId, boolean>;
  labour: NumericMap;
  setLabour: (next: NumericMap) => void;
  labourSplit: "split" | "no_split";
  setLabourSplit: (value: "split" | "no_split") => void;
}) {
  const visible = LABOUR_CONFIG.filter(
    (cfg) => cfg.always || cfg.services?.some((svc) => services[svc])
  );

  const updateLabour = (id: string, value: number) => {
    setLabour({ ...labour, [id]: value });
  };

  return (
    <SectionCard title="Labour" description="Set labour rates and how they appear on quotes.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {visible.map((cfg) => (
            <div
              key={cfg.id}
              className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_auto] sm:items-center"
            >
              <label className="text-sm text-white/80" htmlFor={cfg.id}>
                {cfg.label}
              </label>
              <input
                type="number"
                id={cfg.id}
                name={cfg.id}
                value={labour[cfg.id]}
                onChange={(e) => updateLabour(cfg.id, Number(e.target.value))}
                min={0}
                step={0.1}
                className="w-28 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70"
                required
              />
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-medium text-white">Labour display</div>
          <p className="text-xs text-white/60">Choose how labour should appear on quotes.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {(
              [
                { value: "split", label: "Split labour into notes (no VAT on labour)" },
                { value: "no_split", label: "Keep labour on main quote lines" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                  labourSplit === opt.value
                    ? "border-[#FF7A1A]/60 bg-[#FF7A1A]/10 text-white"
                    : "border-white/15 bg-black/10 text-white/70 hover:border-white/30"
                }`}
              >
                <input
                  type="radio"
                  name="labour_split"
                  value={opt.value}
                  checked={labourSplit === opt.value}
                  onChange={() => setLabourSplit(opt.value)}
                  className="hidden"
                  required
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function VatSection({
  vatStatus,
  setVatStatus,
}: {
  vatStatus: "registered" | "exempt";
  setVatStatus: (value: "registered" | "exempt") => void;
}) {
  return (
    <SectionCard title="VAT setup" description="Tell BillyBot how to handle VAT on your quotes.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {(
          [
            { value: "registered", label: "VAT registered" },
            { value: "exempt", label: "Not VAT registered / VAT exempt" },
          ] as const
        ).map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
              vatStatus === opt.value
                ? "border-[#FF7A1A]/60 bg-[#FF7A1A]/10 text-white"
                : "border-white/15 bg-black/10 text-white/70 hover:border-white/30"
            }`}
          >
            <input
              type="radio"
              name="vat_status"
              value={opt.value}
              checked={vatStatus === opt.value}
              onChange={() => setVatStatus(opt.value)}
              className="hidden"
              required
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

function AdvancedSection({
  minJobCharge,
  setMinJobCharge,
  dayRatePerFitter,
  setDayRatePerFitter,
  useBreakpoints,
  setUseBreakpoints,
  breakpointText,
  setBreakpointText,
}: {
  minJobCharge: number;
  setMinJobCharge: (value: number) => void;
  dayRatePerFitter: number;
  setDayRatePerFitter: (value: number) => void;
  useBreakpoints: "yes" | "no";
  setUseBreakpoints: (value: "yes" | "no") => void;
  breakpointText: string;
  setBreakpointText: (value: string) => void;
}) {
  return (
    <SectionCard title="Advanced" description="Safety nets, day rates, and breakpoint notes.">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_auto] sm:items-center">
          <label className="text-sm text-white/80" htmlFor="min_job_charge">
            Minimum charge per job
          </label>
          <input
            type="number"
            id="min_job_charge"
            name="min_job_charge"
            value={minJobCharge}
            onChange={(e) => setMinJobCharge(Number(e.target.value))}
            min={0}
            step={1}
            className="w-32 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_auto] sm:items-center">
          <label className="text-sm text-white/80" htmlFor="day_rate_per_fitter">
            Day rate per fitter
          </label>
          <input
            type="number"
            id="day_rate_per_fitter"
            name="day_rate_per_fitter"
            value={dayRatePerFitter}
            onChange={(e) => setDayRatePerFitter(Number(e.target.value))}
            min={0}
            step={1}
            className="w-32 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70"
            required
          />
        </div>

        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-white">Breakpoints</div>
              <p className="text-xs text-white/60">Use different rates for tiny or huge jobs.</p>
            </div>
            <div className="flex items-center gap-3">
              {(
                [
                  { value: "no", label: "No breakpoints" },
                  { value: "yes", label: "Use breakpoints" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                    useBreakpoints === opt.value
                      ? "border-[#FF7A1A]/60 bg-[#FF7A1A]/10 text-white"
                      : "border-white/15 bg-black/10 text-white/70 hover:border-white/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="use_breakpoints"
                    value={opt.value}
                    checked={useBreakpoints === opt.value}
                    onChange={() => setUseBreakpoints(opt.value)}
                    className="hidden"
                    required
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {useBreakpoints === "yes" ? (
            <div className="mt-3">
              <label className="text-xs uppercase tracking-wide text-white/60" htmlFor="breakpoint_text">
                Breakpoint notes
              </label>
              <textarea
                id="breakpoint_text"
                name="breakpoint_text"
                value={breakpointText}
                onChange={(e) => setBreakpointText(e.target.value)}
                required={useBreakpoints === "yes"}
                placeholder={`Example:\n- If LVT is under 10m², charge £30/m² for labour.\n- Over 60m², drop labour and materials by 10%.\n- Over 100m², drop labour by £4/m² and materials by 15%.`}
                className="mt-2 min-h-[120px] w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]/70"
              />
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function SaveBar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <div className="sticky bottom-0 left-0 right-0 mt-6 flex items-center justify-end gap-3 rounded-lg border border-white/10 bg-black/40 p-4 backdrop-blur">
      {saved ? <span className="text-sm text-white/70">Saved</span> : null}
      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(249,115,22,0.55)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {saving ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
            <span>Saving…</span>
          </>
        ) : (
          "Save changes"
        )}
      </button>
    </div>
  );
}
