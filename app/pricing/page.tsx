"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import { useClientFlags } from "@/components/client-flags/ClientFlagsProvider";

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

type BreakpointService =
  | "domestic_carpet"
  | "commercial_carpet"
  | "carpet_tiles"
  | "lvt"
  | "domestic_vinyl"
  | "commercial_vinyl"
  | "wall_cladding"
  | "safety";
type BreakpointOperator = "gte" | "lte";
type BreakpointTarget = "materials" | "labour" | "both";
type BreakpointAdjustmentType = "percent" | "gbp_per_m2" | "gbp_fixed";
type BreakpointAdjustmentMode = "more" | "less" | "exact";

type BreakpointAdjustment = {
  type: BreakpointAdjustmentType;
  mode: BreakpointAdjustmentMode;
  value: number;
};

type BreakpointRule = {
  id: string;
  enabled: boolean;
  service: BreakpointService;
  operator: BreakpointOperator;
  threshold_m2: number;
  target: BreakpointTarget;
  adjustment: BreakpointAdjustment;
};

type BreakpointRuleDraft = {
  id: string;
  enabled: boolean;
  service: BreakpointService | "";
  operator: BreakpointOperator | "";
  threshold_m2: string;
  target: BreakpointTarget | "";
  adjustment: {
    type: BreakpointAdjustmentType | "";
    mode: BreakpointAdjustmentMode;
    value: string;
  };
};

const serviceOptions: ServiceOption[] = [
  { label: "Domestic carpets", column: "service_domestic_carpet" },
  { label: "Commercial carpets", column: "service_commercial_carpet" },
  { label: "Carpet tiles", column: "service_carpet_tiles" },
  { label: "LVT", column: "service_lvt" },
  { label: "Domestic vinyl", column: "service_domestic_vinyl" },
  { label: "Safety / commercial vinyl", column: "service_commercial_vinyl" },
  { label: "Altro Whiterock (wall cladding)", column: "service_wall_cladding" },
];

const breakpointServiceOptions: Array<{
  label: string;
  value: BreakpointService;
  toggle: string;
}> = [
  { label: "Domestic carpet", value: "domestic_carpet", toggle: "service_domestic_carpet" },
  { label: "Commercial carpet", value: "commercial_carpet", toggle: "service_commercial_carpet" },
  { label: "Carpet tiles", value: "carpet_tiles", toggle: "service_carpet_tiles" },
  { label: "LVT", value: "lvt", toggle: "service_lvt" },
  { label: "Domestic vinyl", value: "domestic_vinyl", toggle: "service_domestic_vinyl" },
  { label: "Commercial vinyl", value: "commercial_vinyl", toggle: "service_commercial_vinyl" },
  { label: "Safety flooring", value: "safety", toggle: "service_commercial_vinyl" },
  { label: "Wall cladding", value: "wall_cladding", toggle: "service_wall_cladding" },
];

const breakpointOperatorOptions: Array<{ label: string; value: BreakpointOperator }> = [
  { label: "Over", value: "gte" },
  { label: "Under", value: "lte" },
];

const breakpointTargetOptions: Array<{ label: string; value: BreakpointTarget }> = [
  { label: "Materials", value: "materials" },
  { label: "Labour", value: "labour" },
  { label: "Both", value: "both" },
];

const breakpointAdjustmentOptions: Array<{ label: string; value: BreakpointAdjustmentType }> = [
  { label: "%", value: "percent" },
  { label: "£/m²", value: "gbp_per_m2" },
  { label: "£ fixed", value: "gbp_fixed" },
];

const breakpointAdjustmentModeOptions: Array<{ label: string; value: BreakpointAdjustmentMode }> = [
  { label: "MORE", value: "more" },
  { label: "LESS", value: "less" },
  { label: "EXACT", value: "exact" },
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
    materials: ["mat_carpet_tiles_m2"],
    labour: ["lab_carpet_tiles_m2"],
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
  { label: "Carpet tiles material (£/m²)", column: "mat_carpet_tiles_m2" },
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
  { label: "Weld rod (each)", column: "mat_weld" },
  { label: "Nosings per metre", column: "mat_nosings_m" },
  { label: "Underlay per m²", column: "mat_underlay" },
  { label: "Gripper per metre", column: "mat_gripper" },
  { label: "Waste disposal per m²", column: "waste_disposal" },
  { label: "Furniture removal (per room)", column: "furniture_removal" },
];

const labourPriceFields: NumericField[] = [
  { label: "Domestic carpet labour per m²", column: "lab_domestic_carpet_m2" },
  { label: "Commercial carpet labour per m²", column: "lab_commercial_carpet_m2" },
  { label: "Carpet tiles labour per m²", column: "lab_carpet_tiles_m2" },
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
  "mat_weld",
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

function toNumberOrNull(value: string) {
  if (!value && value !== "0") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function generateBreakpointId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `bp_${Math.random().toString(36).slice(2, 10)}`;
}

function createBreakpointRuleDraft(overrides?: Partial<BreakpointRuleDraft>): BreakpointRuleDraft {
  return {
    id: generateBreakpointId(),
    enabled: true,
    service: "",
    operator: "gte",
    threshold_m2: "",
    target: "materials",
    adjustment: {
      type: "percent",
      mode: "more",
      value: "",
    },
    ...overrides,
  };
}

function isBreakpointService(value: string): value is BreakpointService {
  return breakpointServiceOptions.some((option) => option.value === value);
}

function isBreakpointOperator(value: string): value is BreakpointOperator {
  return value === "gte" || value === "lte";
}

function isBreakpointTarget(value: string): value is BreakpointTarget {
  return value === "materials" || value === "labour" || value === "both";
}

function isBreakpointAdjustmentType(value: string): value is BreakpointAdjustmentType {
  return value === "percent" || value === "gbp_per_m2" || value === "gbp_fixed";
}

function isBreakpointAdjustmentMode(value: string): value is BreakpointAdjustmentMode {
  return value === "more" || value === "less" || value === "exact";
}

function normalizePositiveValue(value: string) {
  if (!value) return value;
  return value.startsWith("-") ? value.slice(1) : value;
}

function normalizeBreakpointRules(value: unknown) {
  let raw = value;
  let warning: string | null = null;

  if (typeof value === "string") {
    if (!value.trim()) {
      return { rules: [] as BreakpointRuleDraft[], warning };
    }

    try {
      raw = JSON.parse(value);
    } catch (err) {
      console.warn("Unable to parse breakpoints_json", err);
      return {
        rules: [] as BreakpointRuleDraft[],
        warning: "Existing breakpoint rules could not be read. Reset to start fresh.",
      };
    }
  }

  if (!raw) {
    return { rules: [] as BreakpointRuleDraft[], warning };
  }

  if (!Array.isArray(raw)) {
    return {
      rules: [] as BreakpointRuleDraft[],
      warning: "Existing breakpoint rules are not in the expected list format.",
    };
  }

  let hasInvalid = false;
  const rules: BreakpointRuleDraft[] = raw.map((entry) => {
    if (!entry || typeof entry !== "object") {
      hasInvalid = true;
      return createBreakpointRuleDraft();
    }

    const record = entry as Record<string, unknown>;
    const adjustment =
      record.adjustment && typeof record.adjustment === "object"
        ? (record.adjustment as Record<string, unknown>)
        : {};

    const service: BreakpointService | "" =
      typeof record.service === "string" && isBreakpointService(record.service)
        ? record.service
        : "";
    const operator: BreakpointOperator | "" =
      typeof record.operator === "string" && isBreakpointOperator(record.operator)
        ? record.operator
        : "";
    const target: BreakpointTarget | "" =
      typeof record.target === "string" && isBreakpointTarget(record.target)
        ? record.target
        : "";
    const adjustmentType: BreakpointAdjustmentType | "" =
      typeof adjustment.type === "string" && isBreakpointAdjustmentType(adjustment.type)
        ? adjustment.type
        : "";
    const modeCandidate =
      typeof adjustment.mode === "string" && isBreakpointAdjustmentMode(adjustment.mode)
        ? adjustment.mode
        : typeof adjustment.direction === "string" && isBreakpointAdjustmentMode(adjustment.direction)
          ? adjustment.direction
          : "more";
    const thresholdValue =
      typeof record.threshold_m2 === "number" || typeof record.threshold_m2 === "string"
        ? String(record.threshold_m2)
        : "";
    let adjustmentValue =
      typeof adjustment.value === "number" || typeof adjustment.value === "string"
        ? String(adjustment.value)
        : "";
    let adjustmentMode = modeCandidate;

    const numericAdjustmentValue = Number(adjustmentValue);
    if (Number.isFinite(numericAdjustmentValue) && numericAdjustmentValue < 0) {
      adjustmentMode = "less";
      adjustmentValue = String(Math.abs(numericAdjustmentValue));
    }
    adjustmentValue = normalizePositiveValue(adjustmentValue);
    if (
      !service ||
      !operator ||
      !target ||
      !adjustmentType ||
      !adjustmentMode ||
      !thresholdValue ||
      !adjustmentValue
    ) {
      hasInvalid = true;
    }

    return {
      id: typeof record.id === "string" && record.id ? record.id : generateBreakpointId(),
      enabled: typeof record.enabled === "boolean" ? record.enabled : true,
      service,
      operator,
      threshold_m2: thresholdValue,
      target,
      adjustment: {
        type: adjustmentType,
        mode: adjustmentMode,
        value: adjustmentValue,
      },
    };
  });

  if (hasInvalid) {
    warning =
      warning ??
      "Some existing breakpoint rules were incomplete or invalid. Please review or reset.";
  }

  return { rules, warning };
}

function validateBreakpointRule(rule: BreakpointRuleDraft) {
  const errors: string[] = [];

  if (!rule.service || !isBreakpointService(rule.service)) {
    errors.push("Service is required.");
  }

  if (!rule.operator || !isBreakpointOperator(rule.operator)) {
    errors.push("Condition is required.");
  }

  const thresholdValue = toNumberOrNull(rule.threshold_m2);
  if (thresholdValue === null || thresholdValue <= 0) {
    errors.push("Threshold must be greater than 0.");
  }

  if (!rule.target || !isBreakpointTarget(rule.target)) {
    errors.push("Target is required.");
  }

  if (!rule.adjustment.type || !isBreakpointAdjustmentType(rule.adjustment.type)) {
    errors.push("Adjustment type is required.");
  }

  if (!rule.adjustment.mode || !isBreakpointAdjustmentMode(rule.adjustment.mode)) {
    errors.push("Adjustment mode is required.");
  }

  const adjustmentValue = toNumberOrNull(rule.adjustment.value);
  if (adjustmentValue === null || adjustmentValue <= 0) {
    errors.push("Adjustment value must be greater than 0.");
  }

  if (rule.adjustment.type === "percent" && rule.adjustment.mode === "exact") {
    errors.push("Exact mode is not allowed for percentage adjustments.");
  }

  return errors;
}

function toBreakpointRule(rule: BreakpointRuleDraft): BreakpointRule {
  return {
    id: rule.id,
    enabled: rule.enabled,
    service: rule.service as BreakpointService,
    operator: rule.operator as BreakpointOperator,
    threshold_m2: Number(rule.threshold_m2),
    target: rule.target as BreakpointTarget,
    adjustment: {
      type: rule.adjustment.type as BreakpointAdjustmentType,
      mode: rule.adjustment.mode,
      value: Math.abs(Number(rule.adjustment.value)),
    },
  };
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={checked ? "pill-toggle pill-toggle-on" : "pill-toggle"}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onChange(!checked);
        }
      }}
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

function AdjustmentToggle({
  value,
  onChange,
  disabled = false,
}: {
  value: BreakpointAdjustmentType | "";
  onChange: (value: BreakpointAdjustmentType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="option-toggle" role="group" aria-label="Adjustment type">
      {breakpointAdjustmentOptions.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={active ? "option-toggle-btn option-toggle-btn-active" : "option-toggle-btn"}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onChange(option.value);
              }
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AdjustmentModeToggle({
  value,
  onChange,
  disableExact = false,
  disabled = false,
}: {
  value: BreakpointAdjustmentMode;
  onChange: (value: BreakpointAdjustmentMode) => void;
  disableExact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="option-toggle" role="group" aria-label="Adjustment mode">
      {breakpointAdjustmentModeOptions.map((option) => {
        const active = option.value === value;
        const isDisabled = disabled || (disableExact && option.value === "exact");
        return (
          <button
            key={option.value}
            type="button"
            className={active ? "option-toggle-btn option-toggle-btn-active" : "option-toggle-btn"}
            aria-pressed={active}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) {
                onChange(option.value);
              }
            }}
          >
            {option.label}
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
  const { flags, refreshFlags } = useClientFlags();

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

  const [breakpointRules, setBreakpointRules] = useState<BreakpointRuleDraft[]>([]);
  const [breakpointWarning, setBreakpointWarning] = useState<string | null>(null);
  const [breakpointLive, setBreakpointLive] = useState<Record<string, boolean>>({});
  const [breakpointCollapsed, setBreakpointCollapsed] = useState<Record<string, boolean>>({});
  const [vatRegistered, setVatRegistered] = useState(true);
  const [labourDisplay, setLabourDisplay] = useState<"split" | "main">("split");

  const [accountingSystem, setAccountingSystem] = useState<string | null>(null);
  const [calibrateState, setCalibrateState] = useState<"idle" | "loading" | "done" | "error">("idle");

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

  const breakpointRuleErrors = useMemo(
    () => breakpointRules.map((rule) => validateBreakpointRule(rule)),
    [breakpointRules]
  );

  const breakpointsValid = useMemo(
    () => breakpointRuleErrors.every((errors) => errors.length === 0),
    [breakpointRuleErrors]
  );

  const persistSettings = useCallback(
    async (
      payload: Record<string, unknown>,
      serializedPayload: string,
      comparisonPayload: string = serializedPayload
    ): Promise<boolean> => {
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

        if (!flags.hasEdited) {
          const { error: clientError } = await supabase
            .from("clients")
            .update({ has_edited_pricing_settings: true })
            .eq("id", currentProfileId);

          if (clientError) {
            console.error("Failed to update pricing flags:", clientError);
          } else {
            await refreshFlags();
          }
        }

        lastSavedPayloadRef.current = comparisonPayload;
        return true;
      } catch (err) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to save pricing settings"
        );
        return false;
      }
    },
    [flags.hasEdited, refreshFlags, supabase]
  );

  const scheduleSave = useCallback(
    (
      payload: Record<string, unknown>,
      serializedPayload: string,
      immediate = false,
      comparisonPayload?: string
    ) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(
        () => {
          void persistSettings(payload, serializedPayload, comparisonPayload);
        },
        immediate ? 0 : 600
      );
    },
    [persistSettings]
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

      const { data: clientProfile } = await supabase
        .from("clients")
        .select("accounting_system")
        .eq("id", data.user.id)
        .maybeSingle();

      setAccountingSystem(
        (clientProfile as { accounting_system?: string | null } | null)?.accounting_system ?? null
      );

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

        const { rules: normalizedRules, warning } = normalizeBreakpointRules(
          settings.breakpoints_json
        );
        const liveMap = normalizedRules.reduce<Record<string, boolean>>((acc, rule) => {
          acc[rule.id] = true;
          return acc;
        }, {});
        const collapsedMap = normalizedRules.reduce<Record<string, boolean>>((acc, rule) => {
          acc[rule.id] = true;
          return acc;
        }, {});

        setBreakpointRules(normalizedRules);
        setBreakpointLive(liveMap);
        setBreakpointCollapsed(collapsedMap);
        setBreakpointWarning(warning);
      }

      setLoading(false);
    }

    void loadSettings();
  }, [router, supabase]);

  async function handleCalibrate() {
    setCalibrateState("loading");
    try {
      const res = await fetch("/api/pricing/calibrate", { method: "POST" });
      if (!res.ok) {
        setCalibrateState("error");
        return;
      }
      setCalibrateState("done");
    } catch {
      setCalibrateState("error");
    }
  }

  function buildSettingsPayload() {
    const payload: Record<string, unknown> = {
      vat_registered: vatRegistered,
      separate_labour: labourDisplay === "split",
      small_job_charge: toNumeric(smallJobs.small_job_charge),
      day_rate_per_fitter: toNumeric(smallJobs.day_rate_per_fitter),
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

    return { payload };
  }

  function updateBreakpointRule(
    id: string,
    updater: (rule: BreakpointRuleDraft) => BreakpointRuleDraft
  ) {
    setBreakpointRules((prev) => prev.map((rule) => (rule.id === id ? updater(rule) : rule)));
    setBreakpointLive((prev) => ({ ...prev, [id]: false }));
    setBreakpointCollapsed((prev) => ({ ...prev, [id]: false }));
  }

  function handleAddBreakpointRule() {
    const draft = createBreakpointRuleDraft();
    setBreakpointRules((prev) => [...prev, draft]);
    setBreakpointLive((prev) => ({ ...prev, [draft.id]: false }));
    setBreakpointCollapsed((prev) => ({ ...prev, [draft.id]: false }));
  }

  async function handleDeleteBreakpointRule(id: string) {
    const previousRules = breakpointRules;
    const previousLive = breakpointLive;
    const previousCollapsed = breakpointCollapsed;
    const nextRules = breakpointRules.filter((rule) => rule.id !== id);

    setBreakpointRules(nextRules);
    setBreakpointLive((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setBreakpointCollapsed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const { payload } = buildSettingsPayload();
    const breakpointsPayload = nextRules.map(toBreakpointRule);
    const combinedPayload = {
      ...payload,
      breakpoints_json: breakpointsPayload,
    };
    const serializedPayload = JSON.stringify(combinedPayload);
    const baseSerializedPayload = JSON.stringify(payload);

    const success = await persistSettings(combinedPayload, serializedPayload, baseSerializedPayload);

    if (!success) {
      setBreakpointRules(previousRules);
      setBreakpointLive(previousLive);
      setBreakpointCollapsed(previousCollapsed);
    }
  }

  function handleResetBreakpoints() {
    setBreakpointRules([]);
    setBreakpointWarning(null);
    setBreakpointLive({});
    setBreakpointCollapsed({});
  }

  function buildBreakpointPayload() {
    return breakpointRules.map(toBreakpointRule);
  }

  function handleBreakpointSave(ruleId: string) {
    const ruleIndex = breakpointRules.findIndex((rule) => rule.id === ruleId);
    if (ruleIndex === -1) {
      return;
    }

    if (!breakpointsValid) {
      return;
    }

    const errors = breakpointRuleErrors[ruleIndex] ?? [];
    if (errors.length > 0) {
      return;
    }

    const { payload } = buildSettingsPayload();
    const breakpointsPayload = buildBreakpointPayload();
    const combinedPayload = {
      ...payload,
      breakpoints_json: breakpointsPayload,
    };
    const serializedPayload = JSON.stringify(combinedPayload);

    const baseSerializedPayload = JSON.stringify(payload);
    scheduleSave(combinedPayload, serializedPayload, true, baseSerializedPayload);

    setBreakpointLive((prev) => ({ ...prev, [ruleId]: true }));
    setBreakpointCollapsed((prev) => ({ ...prev, [ruleId]: true }));
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

    const { payload } = buildSettingsPayload();

    const serializedPayload = JSON.stringify(payload);

    if (serializedPayload === lastSavedPayloadRef.current) {
      return;
    }

    setError(null);
    scheduleSave(payload, serializedPayload);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    labourDisplay,
    labourPrices,
    loading,
    markupState,
    materialPrices,
    serviceToggles,
    smallJobs,
    scheduleSave,
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

      {accountingSystem ? (
        <div className="card stack">
          <div className="settings-section-heading">
            <div className="stack">
              <h3 className="section-title text-lg">Calibrate from invoices</h3>
              <p className="section-subtitle">
                Import your last 12 months of{" "}
                <span style={{ textTransform: "capitalize" }}>{accountingSystem}</span> invoices so
                BillyBot can suggest accurate material and labour rates based on what you&apos;ve
                actually charged.
              </p>
              {calibrateState === "error" ? (
                <p className="text-sm text-red-300">Calibration failed. Please try again.</p>
              ) : null}
              {calibrateState === "done" ? (
                <p className="section-subtitle" style={{ color: "var(--brand1)" }}>
                  BillyBot is analysing your invoices — check your chat for a summary and suggested
                  pricing updates.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={calibrateState === "loading" || calibrateState === "done"}
              onClick={() => {
                void handleCalibrate();
              }}
            >
              {calibrateState === "loading"
                ? "Analysing…"
                : calibrateState === "done"
                  ? "Done ✓"
                  : calibrateState === "error"
                    ? "Retry"
                    : "Calibrate pricing"}
            </button>
          </div>
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
          </div>
          {breakpointWarning ? (
            <div className="breakpoint-warning">
              <span>{breakpointWarning}</span>
            </div>
          ) : null}
          <div className="breakpoint-actions">
            <button type="button" className="btn btn-secondary" onClick={handleAddBreakpointRule}>
              + Add rule
            </button>
          </div>
          {breakpointsValid ? null : (
            <p className="breakpoint-error-summary">
              Fix the highlighted fields to save breakpoint rules.
            </p>
          )}
          {breakpointRules.length ? (
            <div className="breakpoint-rule-list">
              {breakpointRules.map((rule, index) => {
                const errors = breakpointRuleErrors[index] ?? [];
                const hasErrors = errors.length > 0;
                const isLive = breakpointLive[rule.id] ?? false;
                const isCollapsed = breakpointCollapsed[rule.id] ?? false;
                const summaryService = rule.service
                  ? breakpointServiceOptions.find((option) => option.value === rule.service)?.label ??
                    rule.service
                  : "Select service";
                const summaryOperator = breakpointOperatorOptions.find(
                  (option) => option.value === rule.operator
                )?.label;
                const summaryTarget = breakpointTargetOptions.find(
                  (option) => option.value === rule.target
                )?.label;
                const summaryAdjustmentType = breakpointAdjustmentOptions.find(
                  (option) => option.value === rule.adjustment.type
                )?.label;
                const summaryAdjustmentMode = breakpointAdjustmentModeOptions.find(
                  (option) => option.value === rule.adjustment.mode
                )?.label;
                const summaryAdjustmentValue = rule.adjustment.value || "—";

                return (
                  <div key={rule.id} className="breakpoint-rule-card">
                    <div className="breakpoint-rule-header">
                      <div className="breakpoint-rule-summary">
                        <span className="breakpoint-field-label">Summary</span>
                        <span>
                          {summaryService}{" "}
                          {summaryOperator ? summaryOperator.toLowerCase() : "—"}{" "}
                          {rule.threshold_m2 || "—"} m² ·{" "}
                          {summaryTarget ? summaryTarget.toLowerCase() : "—"} ·{" "}
                          {summaryAdjustmentMode
                            ? summaryAdjustmentMode.toLowerCase()
                            : "—"}{" "}
                          {summaryAdjustmentValue} {summaryAdjustmentType ?? ""}
                        </span>
                      </div>
                      <div className="breakpoint-rule-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() =>
                            setBreakpointCollapsed((prev) => ({
                              ...prev,
                              [rule.id]: !isCollapsed,
                            }))
                          }
                        >
                          {isCollapsed ? "Edit" : "Collapse"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          onClick={() => handleBreakpointSave(rule.id)}
                          disabled={hasErrors || !breakpointsValid || isLive}
                        >
                          {isLive ? "Live" : "Save"}
                        </button>
                      </div>
                    </div>
                    {isCollapsed ? null : (
                      <>
                        <div className="breakpoint-rule-grid">
                          <div className="breakpoint-field">
                            <span className="breakpoint-field-label">Enabled</span>
                            <Toggle
                              checked={rule.enabled}
                              onChange={(value) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  enabled: value,
                                }));
                              }}
                            />
                          </div>
                          <label className="breakpoint-field">
                            <span className="breakpoint-field-label">Service</span>
                            <select
                              value={rule.service}
                              onChange={(e) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  service: e.target.value as BreakpointService | "",
                                }));
                              }}
                            >
                              <option value="">Select service</option>
                              {breakpointServiceOptions.map((option) => {
                                const isEnabled = serviceToggles[option.toggle];
                                return (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                    disabled={!isEnabled}
                                  >
                                    {option.label}
                                  </option>
                                );
                              })}
                            </select>
                          </label>
                          <label className="breakpoint-field">
                            <span className="breakpoint-field-label">Condition</span>
                            <select
                              value={rule.operator}
                              onChange={(e) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  operator: e.target.value as BreakpointOperator | "",
                                }));
                              }}
                            >
                              <option value="">Select</option>
                              {breakpointOperatorOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="breakpoint-field">
                            <span className="breakpoint-field-label">Threshold (m²)</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={rule.threshold_m2}
                              onChange={(e) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  threshold_m2: e.target.value,
                                }));
                              }}
                            />
                          </label>
                          <label className="breakpoint-field">
                            <span className="breakpoint-field-label">Target</span>
                            <select
                              value={rule.target}
                              onChange={(e) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  target: e.target.value as BreakpointTarget | "",
                                }));
                              }}
                            >
                              <option value="">Select</option>
                              {breakpointTargetOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="breakpoint-field">
                            <span className="breakpoint-field-label">Adjustment type</span>
                            <AdjustmentToggle
                              value={rule.adjustment.type}
                              onChange={(value) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  adjustment: {
                                    ...current.adjustment,
                                    type: value,
                                    mode:
                                      value === "percent" && current.adjustment.mode === "exact"
                                        ? "more"
                                        : current.adjustment.mode,
                                  },
                                }));
                              }}
                            />
                          </div>
                          <div className="breakpoint-field">
                            <span className="breakpoint-field-label">Adjustment mode</span>
                            <AdjustmentModeToggle
                              value={rule.adjustment.mode}
                              disableExact={rule.adjustment.type === "percent"}
                              onChange={(value) => {
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  adjustment: { ...current.adjustment, mode: value },
                                }));
                              }}
                            />
                          </div>
                          <label className="breakpoint-field">
                            <span className="breakpoint-field-label">Value</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              value={rule.adjustment.value}
                              onChange={(e) => {
                                const nextValue = normalizePositiveValue(e.target.value);
                                updateBreakpointRule(rule.id, (current) => ({
                                  ...current,
                                  adjustment: { ...current.adjustment, value: nextValue },
                                }));
                              }}
                            />
                          </label>
                          <div className="breakpoint-field breakpoint-field-actions">
                            <span className="breakpoint-field-label">Delete</span>
                            <button
                              type="button"
                              className="btn btn-secondary btn-small"
                              onClick={() => handleDeleteBreakpointRule(rule.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {hasErrors ? (
                          <div className="breakpoint-rule-errors">
                            {errors.map((message) => (
                              <span key={message}>{message}</span>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="section-subtitle">
              No breakpoint rules yet. Add one to set up area-based adjustments.
            </p>
          )}
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
