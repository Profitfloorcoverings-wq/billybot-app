"use client";

import { useState, useEffect } from "react";

type Unit = "percent" | "per_m2";

type ServiceToggle = {
  key: string;
  label: string;
};

type MarkupField = {
  key: string;
  serviceKey: string;
  label: string;
  defaultValue: number;
};

type BaseRateField = {
  key: string;
  label: string;
  defaultValue: number;
};

const serviceToggles: ServiceToggle[] = [
  { key: "service_domestic_carpets", label: "Domestic carpets" },
  { key: "service_commercial_carpets", label: "Commercial carpets (glue down)" },
  { key: "service_carpet_tiles", label: "Carpet tiles" },
  { key: "service_lvt", label: "LVT / Luxury Vinyl Tiles" },
  { key: "service_vinyl_domestic", label: "Domestic vinyl" },
  { key: "service_vinyl_safety", label: "Commercial and safety vinyl" },
  { key: "service_laminate", label: "Laminate" },
  { key: "service_wood", label: "Solid and engineered wood" },
  { key: "service_whiterock", label: "Altro Whiterock (wall cladding)" },
  { key: "service_ceramic", label: "Ceramic tiles" },
];

const markupFields: MarkupField[] = [
  { key: "markup_service_domestic_carpets", serviceKey: "service_domestic_carpets", label: "Domestic carpet", defaultValue: 50 },
  { key: "markup_service_commercial_carpets", serviceKey: "service_commercial_carpets", label: "Commercial carpet", defaultValue: 50 },
  { key: "markup_service_carpet_tiles", serviceKey: "service_carpet_tiles", label: "Carpet tiles", defaultValue: 50 },
  { key: "markup_service_lvt", serviceKey: "service_lvt", label: "LVT", defaultValue: 50 },
  { key: "markup_service_vinyl_domestic", serviceKey: "service_vinyl_domestic", label: "Vinyl domestic", defaultValue: 50 },
  { key: "markup_service_vinyl_safety", serviceKey: "service_vinyl_safety", label: "Safety and commercial vinyl", defaultValue: 50 },
  { key: "markup_service_laminate", serviceKey: "service_laminate", label: "Laminate", defaultValue: 50 },
  { key: "markup_service_wood", serviceKey: "service_wood", label: "Solid and engineered wood", defaultValue: 50 },
  { key: "markup_service_whiterock", serviceKey: "service_whiterock", label: "Wall cladding", defaultValue: 50 },
  { key: "markup_service_ceramic", serviceKey: "service_ceramic", label: "Ceramic tiles", defaultValue: 50 },
];

const baseMaterialFields: BaseRateField[] = [
  { key: "mat_lvt", label: "LVT per m² £", defaultValue: 26 },
  { key: "mat_ceramic", label: "Ceramic tiles per m² £", defaultValue: 30 },
  { key: "mat_carpet_domestic", label: "Carpet domestic per m² £", defaultValue: 12 },
  { key: "mat_carpet_commercial", label: "Carpet commercial per m² £", defaultValue: 16 },
  { key: "mat_safety", label: "Safety flooring per m² £", defaultValue: 18 },
  { key: "mat_vinyl_domestic", label: "Vinyl domestic per m² £", defaultValue: 14 },
  { key: "mat_vinyl_commercial", label: "Vinyl commercial per m² £", defaultValue: 18 },
  { key: "mat_carpet_tiles", label: "Carpet tiles per m² £", defaultValue: 19.5 },
  { key: "mat_wall_cladding", label: "Wall cladding per m² £", defaultValue: 35 },
  { key: "mat_gripper", label: "Gripper per m £", defaultValue: 4 },
  { key: "mat_underlay", label: "Underlay per m² £", defaultValue: 6 },
  { key: "mat_coved", label: "Coved skirting materials per m £", defaultValue: 10 },
  { key: "mat_weld", label: "Weld rod per roll £", defaultValue: 25 },
  { key: "mat_adhesive", label: "Adhesive per m² £", defaultValue: 3 },
  { key: "mat_ply", label: "Ply board per m² £", defaultValue: 12 },
  { key: "mat_latex", label: "Latex per m² £", defaultValue: 10 },
  { key: "mat_door_bars", label: "Door bars per m £", defaultValue: 8 },
  { key: "mat_nosings", label: "Standard nosings per m £", defaultValue: 25 },
  { key: "mat_matting", label: "Entrance matting per m² £", defaultValue: 35 },
];

const baseLabourFields: BaseRateField[] = [
  { key: "lab_carpet_domestic", label: "Labour carpet domestic per m² £", defaultValue: 8 },
  { key: "lab_carpet_commercial", label: "Labour carpet commercial per m² £", defaultValue: 9 },
  { key: "lab_lvt", label: "Labour LVT per m² £", defaultValue: 16 },
  { key: "lab_ceramic", label: "Labour ceramic tiles per m² £", defaultValue: 25 },
  { key: "lab_safety", label: "Labour safety flooring per m² £", defaultValue: 22 },
  { key: "lab_vinyl_domestic", label: "Labour vinyl domestic per m² £", defaultValue: 12 },
  { key: "lab_vinyl_commercial", label: "Labour vinyl commercial per m² £", defaultValue: 14 },
  { key: "lab_carpet_tiles", label: "Labour carpet tiles per m² £", defaultValue: 8 },
  { key: "lab_wall_cladding", label: "Labour wall cladding per m² £", defaultValue: 16 },
  { key: "lab_coved", label: "Labour coved skirting per m £", defaultValue: 12 },
  { key: "lab_ply", label: "Labour ply board per m² £", defaultValue: 6 },
  { key: "lab_latex", label: "Labour latex per m² £", defaultValue: 6 },
  { key: "lab_nosings", label: "Labour nosings per m £", defaultValue: 8 },
  { key: "lab_matting", label: "Labour matting per m² £", defaultValue: 8 },
  { key: "lab_general", label: "Labour general £/m²", defaultValue: 1 },
  { key: "lab_uplift", label: "Uplift existing flooring per m² £", defaultValue: 3 },
  { key: "lab_waste", label: "Waste disposal per m² £", defaultValue: 2 },
  { key: "lab_furniture", label: "Furniture removal per room £", defaultValue: 25 },
];

type SectionKey =
  | "overview"
  | "services"
  | "markups"
  | "baseRates"
  | "safetyNets"
  | "breakpoints"
  | "taxLabour";

const sections: { key: SectionKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "services", label: "Services" },
  { key: "markups", label: "Markups" },
  { key: "baseRates", label: "Base rates" },
  { key: "safetyNets", label: "Safety nets" },
  { key: "breakpoints", label: "Breakpoints" },
  { key: "taxLabour", label: "Tax and labour" },
];

export default function PricingPage() {
  const [activeSection, setActiveSection] = useState<SectionKey>("overview");

  const [services, setServices] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    serviceToggles.forEach((s) => {
      initial[s.key] = true;
    });
    return initial;
  });

  const [markups, setMarkups] = useState<
    Record<string, { value: number; unit: Unit }>
  >(() => {
    const initial: Record<string, { value: number; unit: Unit }> = {};
    markupFields.forEach((m) => {
      initial[m.key] = { value: m.defaultValue, unit: "percent" };
    });
    return initial;
  });

  const [materials, setMaterials] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    baseMaterialFields.forEach((f) => {
      initial[f.key] = f.defaultValue;
    });
    return initial;
  });

  const [labour, setLabour] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    baseLabourFields.forEach((f) => {
      initial[f.key] = f.defaultValue;
    });
    return initial;
  });

  const [minJobCharge, setMinJobCharge] = useState<number>(150);
  const [dayRatePerFitter, setDayRatePerFitter] = useState<number>(200);

  const [useBreakpoints, setUseBreakpoints] = useState<"no" | "yes">("no");
  const [breakpointText, setBreakpointText] = useState<string>("");

  const [vatStatus, setVatStatus] = useState<"registered" | "exempt">(
    "registered"
  );

  const [labourSplit, setLabourSplit] = useState<"split" | "no_split">("split");

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "error">("idle");

  // TODO: keep your existing Supabase load here
  useEffect(() => {
    // Load existing pricing from Supabase and hydrate all state above
    // Make sure you keep the same Supabase logic you already had
  }, []);

  const handleToggleService = (key: string) => {
    const turnedOnCount = Object.values(services).filter(Boolean).length;
    const isOn = services[key];

    if (turnedOnCount === 1 && isOn) {
      return;
    }

    setServices((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleMarkupValueChange = (key: string, value: number) => {
    setMarkups((prev) => ({
      ...prev,
      [key]: { ...prev[key], value },
    }));
  };

  const handleMarkupUnitChange = (key: string, unit: Unit) => {
    setMarkups((prev) => ({
      ...prev,
      [key]: { ...prev[key], unit },
    }));
  };

  const handleMaterialChange = (key: string, value: number) => {
    setMaterials((prev) => ({ ...prev, [key]: value }));
  };

  const handleLabourChange = (key: string, value: number) => {
    setLabour((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const payload = {
        services,
        markups,
        materials,
        labour,
        min_job_charge: minJobCharge,
        day_rate_per_fitter: dayRatePerFitter,
        use_breakpoints: useBreakpoints,
        breakpoint_text: breakpointText,
        vat_status: vatStatus,
        labour_split: labourSplit,
      };

      // TODO: replace this with your existing Supabase save function
      // For example: await savePricingToSupabase(payload);
      console.log("Save pricing payload", payload);

      setSaveStatus("ok");
    } catch (err) {
      console.error("Save pricing error", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Pricing logic at a glance
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                Set this page up once and BillyBot will quote like you do on
                every job. Services, markups, base rates, safety nets, and tax
                are all controlled here.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.9)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Services
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  {Object.values(services).filter(Boolean).length}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Active work types BillyBot can quote
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.9)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Minimum per job
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  £{minJobCharge.toFixed(0)}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Safety net so tiny jobs still pay
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.9)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Day rate per fitter
                </div>
                <div className="mt-2 text-3xl font-black text-white">
                  £{dayRatePerFitter.toFixed(0)}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  BillyBot checks quotes against this on big jobs
                </p>
              </div>
            </div>
          </div>
        );

      case "services":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Services you actually take on
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                Switch off anything you never touch. At least one service must
                stay on.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {serviceToggles.map((s) => {
                const isOn = services[s.key];
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleToggleService(s.key)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm shadow-sm transition ${
                      isOn
                        ? "border-[var(--brand2)] bg-[rgba(59,130,246,0.18)]"
                        : "border-[var(--line)] bg-[rgba(15,23,42,0.9)]"
                    }`}
                  >
                    <span className="font-medium text-white">{s.label}</span>
                    <span
                      className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition ${
                        isOn
                          ? "bg-[var(--brand1)] justify-end"
                          : "bg-[rgba(148,163,184,0.5)] justify-start"
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full bg-white shadow" />
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[var(--muted)]">
              BillyBot will only quote for services that are switched on here.
            </p>
          </div>
        );

      case "markups":
        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Material markups by service
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                Tell BillyBot how much you add on for each service. Use percent
                or a flat pound per m².
              </p>
            </div>

            <div className="space-y-3">
              {markupFields
                .filter((m) => services[m.serviceKey])
                .map((m) => {
                  const state = markups[m.key];
                  const value = state?.value ?? 0;
                  const unit = state?.unit ?? "percent";

                  return (
                    <div
                      key={m.key}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.95)] p-4 shadow-sm md:flex-row md:items-center"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white">
                          {m.label}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          Typical setup is around 50 percent
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-xl bg-[rgba(15,23,42,1)] border border-[var(--line)] px-3 py-2">
                          <input
                            type="number"
                            className="w-20 bg-transparent text-right text-sm text-white outline-none"
                            value={value}
                            min={0}
                            step={0.5}
                            onChange={(e) =>
                              handleMarkupValueChange(
                                m.key,
                                Number(e.target.value || 0)
                              )
                            }
                          />
                        </div>
                        <div className="inline-flex rounded-xl bg-[rgba(15,23,42,1)] border border-[var(--line)] p-1 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkupUnitChange(m.key, "percent")
                            }
                            className={`px-3 py-1 rounded-lg font-semibold ${
                              unit === "percent"
                                ? "bg-[var(--brand1)] text-white"
                                : "text-[var(--muted)]"
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkupUnitChange(m.key, "per_m2")
                            }
                            className={`px-3 py-1 rounded-lg font-semibold ${
                              unit === "per_m2"
                                ? "bg-[var(--brand1)] text-white"
                                : "text-[var(--muted)]"
                            }`}
                          >
                            £/m²
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <p className="text-xs text-[var(--muted)]">
              You can change these any time. BillyBot will use the latest
              values on the next quote.
            </p>
          </div>
        );

      case "baseRates":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Base materials and labour
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                These are your normal mid range rates. BillyBot uses them before
                applying markups and any breakpoints.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Materials
                </h3>
                <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.95)] p-4 space-y-3 max-h-[420px] overflow-y-auto">
                  {baseMaterialFields.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-xs text-white">{f.label}</span>
                      <div className="flex items-center rounded-xl bg-[rgba(15,23,42,1)] border border-[var(--line)] px-3 py-1.5">
                        <span className="mr-1 text-xs text-[var(--muted)]">
                          £
                        </span>
                        <input
                          type="number"
                          className="w-20 bg-transparent text-right text-xs text-white outline-none"
                          value={materials[f.key] ?? 0}
                          min={0}
                          step={0.5}
                          onChange={(e) =>
                            handleMaterialChange(
                              f.key,
                              Number(e.target.value || 0)
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  Labour
                </h3>
                <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.95)] p-4 space-y-3 max-h-[420px] overflow-y-auto">
                  {baseLabourFields.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-xs text-white">{f.label}</span>
                      <div className="flex items-center rounded-xl bg-[rgba(15,23,42,1)] border border-[var(--line)] px-3 py-1.5">
                        <span className="mr-1 text-xs text-[var(--muted)]">
                          £
                        </span>
                        <input
                          type="number"
                          className="w-20 bg-transparent text-right text-xs text-white outline-none"
                          value={labour[f.key] ?? 0}
                          min={0}
                          step={0.5}
                          onChange={(e) =>
                            handleLabourChange(
                              f.key,
                              Number(e.target.value || 0)
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)]">
              Do not overthink this. You will see real quotes go out and can
              tweak from there.
            </p>
          </div>
        );

      case "safetyNets":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Safety nets</h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                Protect your time on small jobs with a minimum charge and day
                rate per fitter.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">
                  Minimum charge per job
                </div>
                <div className="text-xs text-[var(--muted)]">
                  The least you are happy to earn, even on a tiny job.
                </div>
                <div className="mt-2 inline-flex items-center rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,1)] px-4 py-2">
                  <span className="mr-1 text-sm text-[var(--muted)]">£</span>
                  <input
                    type="number"
                    className="w-24 bg-transparent text-lg font-semibold text-white outline-none"
                    value={minJobCharge}
                    min={0}
                    step={5}
                    onChange={(e) =>
                      setMinJobCharge(Number(e.target.value || 0))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold text-white">
                  Day rate per fitter
                </div>
                <div className="text-xs text-[var(--muted)]">
                  Used when BillyBot spots that a job is likely a full day.
                </div>
                <div className="mt-2 inline-flex items-center rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,1)] px-4 py-2">
                  <span className="mr-1 text-sm text-[var(--muted)]">£</span>
                  <input
                    type="number"
                    className="w-24 bg-transparent text-lg font-semibold text-white outline-none"
                    value={dayRatePerFitter}
                    min={0}
                    step={10}
                    onChange={(e) =>
                      setDayRatePerFitter(Number(e.target.value || 0))
                    }
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-[var(--muted)]">
              These are safety rails so you are never driving across town for
              peanuts.
            </p>
          </div>
        );

      case "breakpoints":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Breakpoints</h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                If your prices change for tiny areas or massive projects, write
                the rules here in plain English.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  Use breakpoints
                </div>
                <div className="mt-2 inline-flex rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,1)] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setUseBreakpoints("no")}
                    className={`px-3 py-1.5 rounded-xl font-semibold ${
                      useBreakpoints === "no"
                        ? "bg-[var(--brand1)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    No breakpoints
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseBreakpoints("yes")}
                    className={`px-3 py-1.5 rounded-xl font-semibold ${
                      useBreakpoints === "yes"
                        ? "bg-[var(--brand1)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Yes, I use breakpoints
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  If you turn this off BillyBot keeps your base rates flat.
                </p>
              </div>

              {useBreakpoints === "yes" && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-white">
                    Describe your breakpoints
                  </div>
                  <textarea
                    className="mt-1 min-h-[180px] w-full rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.95)] p-4 text-sm text-white outline-none"
                    placeholder={`Example:
- If LVT is under 10m² charge £30/m² for labour.
- Over 60m² drop labour and materials by 10 percent.
- Over 100m² drop labour by £4/m² and materials by 15 percent.

Write your own version for each service you offer.`}
                    value={breakpointText}
                    onChange={(e) => setBreakpointText(e.target.value)}
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Keep it simple. BillyBot will convert this to hard rules.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case "taxLabour":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white">
                VAT and labour display
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)] max-w-2xl">
                This controls how tax is handled in Sage, Xero, or QuickBooks
                and where labour shows on your quotes.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-white">
                  VAT status
                </div>
                <div className="inline-flex rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,1)] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setVatStatus("registered")}
                    className={`px-3 py-1.5 rounded-xl font-semibold ${
                      vatStatus === "registered"
                        ? "bg-[var(--brand1)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    VAT registered
                  </button>
                  <button
                    type="button"
                    onClick={() => setVatStatus("exempt")}
                    className={`px-3 py-1.5 rounded-xl font-semibold ${
                      vatStatus === "exempt"
                        ? "bg-[var(--brand1)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Not registered or exempt
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-white">
                  Labour display
                </div>
                <div className="inline-flex rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,1)] p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setLabourSplit("split")}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-left ${
                      labourSplit === "split"
                        ? "bg-[var(--brand1)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Split labour into notes
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabourSplit("no_split")}
                    className={`px-3 py-1.5 rounded-xl font-semibold text-left ${
                      labourSplit === "no_split"
                        ? "bg-[var(--brand1)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    Keep labour on main lines
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  If you pay fitters direct and do not want VAT on labour, keep
                  labour in the notes.
                </p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="pricing-page h-[calc(100vh-120px)] overflow-hidden">
      <header className="mb-4 rounded-3xl border border-[var(--line)] bg-[rgba(13,19,35,0.9)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Pricing settings</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Set your prices once. BillyBot will use them on every future
              quote.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === "ok" && (
              <span className="text-xs font-semibold text-emerald-400">
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs font-semibold text-red-400">
                Save failed
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand1)] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,0.55)] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save pricing"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100%-96px)] gap-4">
        <aside className="hidden w-60 flex-shrink-0 flex-col rounded-3xl border border-[var(--line)] bg-[rgba(6,10,20,0.95)] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] md:flex">
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Pricing sections
          </div>
          <nav className="space-y-1">
            {sections.map((section) => {
              const active = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-[rgba(37,99,235,0.18)] text-white border border-[var(--brand2)]"
                      : "text-[var(--muted)] hover:bg-[rgba(15,23,42,0.9)] border border-transparent"
                  }`}
                >
                  <span>{section.label}</span>
                  {active && (
                    <span className="h-2 w-2 rounded-full bg-[var(--brand1)]" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 rounded-3xl border border-[var(--line)] bg-[rgba(6,10,20,0.95)] p-4 md:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.45)] overflow-y-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
