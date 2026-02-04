export type PricingSettings = Record<string, unknown> & {
  lab_carpet_tiles_m2?: number | null;
  mat_carpet_tiles_m2?: number | null;
};

export type BuildPricingProfileInput = {
  settings?: PricingSettings | null;
  vatRegistered?: boolean;
};

function parseBreakpoints(value: unknown) {
  if (!value) return [] as unknown[];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value || "[]");
      if (!Array.isArray(parsed)) {
        console.warn("breakpoints_json is not an array");
        return [] as unknown[];
      }
      return parsed;
    } catch (err) {
      console.warn("Unable to parse breakpoints_json", err);
      return [] as unknown[];
    }
  }

  if (!Array.isArray(value)) {
    console.warn("breakpoints_json is not an array");
    return [] as unknown[];
  }

  return value;
}

type BreakpointAdjustmentMode = "more" | "less" | "exact";

function isBreakpointAdjustmentMode(value: unknown): value is BreakpointAdjustmentMode {
  return value === "more" || value === "less" || value === "exact";
}

function normalizeBreakpointMode(mode: unknown, adjustmentValue: number | null) {
  if (typeof adjustmentValue === "number" && adjustmentValue < 0) {
    return "less";
  }

  return isBreakpointAdjustmentMode(mode) ? mode : "more";
}

function normalizeBreakpoints(value: unknown) {
  const rules = parseBreakpoints(value);

  return rules.map((rule) => {
    if (!rule || typeof rule !== "object") {
      return rule;
    }

    const record = rule as Record<string, unknown>;
    const adjustment =
      record.adjustment && typeof record.adjustment === "object"
        ? (record.adjustment as Record<string, unknown>)
        : {};
    const rawValue = adjustment.value;
    const adjustmentValue =
      typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string"
          ? Number(rawValue)
          : null;
    const normalizedMode = normalizeBreakpointMode(
      adjustment.mode ?? adjustment.direction,
      Number.isFinite(adjustmentValue) ? adjustmentValue : null
    );
    const normalizedValue =
      typeof adjustmentValue === "number" && Number.isFinite(adjustmentValue)
        ? Math.abs(adjustmentValue)
        : adjustment.value;

    return {
      ...record,
      adjustment: {
        ...adjustment,
        mode: normalizedMode,
        value: normalizedValue,
      },
    };
  });
}

function numberOrZero(value: unknown) {
  if (value === null || typeof value === "undefined") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function textOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.length ? value : fallback;
}

export function buildPricingProfile({ settings, vatRegistered }: BuildPricingProfileInput) {
  const s = settings ?? {};

  const services: string[] = [];
  if (booleanOr(s.service_domestic_carpet, true)) services.push("domestic_carpet");
  if (booleanOr(s.service_commercial_carpet, true)) services.push("commercial_carpet");
  if (booleanOr(s.service_carpet_tiles, true)) services.push("carpet_tiles");
  if (booleanOr(s.service_lvt, true)) services.push("lvt_tiles");
  if (booleanOr(s.service_domestic_vinyl, true)) services.push("domestic_vinyl");
  if (booleanOr(s.service_commercial_vinyl, true)) services.push("commercial_vinyl");

  // Always include legacy services even if toggles are missing in the UI
  if (!services.includes("laminate")) services.push("laminate");
  if (!services.includes("solid_wood")) services.push("solid_wood");

  const profile = {
    rules: {
      price_breaks: normalizeBreakpoints(s.breakpoints_json ?? []),
      small_job_fee: numberOrZero(s.small_job_charge),
    },
    extras: {
      ply_m2: numberOrZero(s.mat_ply_m2),
      latex_m2: numberOrZero(s.mat_latex_m2),
      nosings_m: numberOrZero(s.mat_nosings_m),
      uplift_m2: numberOrZero(s.mat_uplift_m2),
      adhesive_m2: numberOrZero(s.mat_adhesive_m2),
      door_bars_each: numberOrZero(s.mat_door_bars_each),
      coved_m2: numberOrZero(s.mat_coved_m2),
      underlay: numberOrZero(s.mat_underlay),
      gripper_m: numberOrZero(s.mat_gripper),
      waste_disposal: numberOrZero(s.waste_disposal),
      furniture_removal: numberOrZero(s.furniture_removal),
      entrance_matting_m2: numberOrZero(s.mat_matting_m2),
    },
    labour: {
      stairs: {},
      winders: numberOrZero(s.winders),
      rates_m2: {
        lab_lvt: numberOrZero(s.lab_lvt_m2),
        lab_ply: numberOrZero(s.lab_ply_m2),
        lab_coved: numberOrZero(s.lab_coved_m),
        lab_latex: numberOrZero(s.lab_latex_m2),
        lab_waste: numberOrZero(s.lab_waste_m2),
        lab_safety: numberOrZero(s.lab_safety_m2),
        lab_uplift: numberOrZero(s.lab_uplift_m2),
        lab_general: numberOrZero(s.lab_general_m2),
        lab_matting: numberOrZero(s.lab_matting_m2),
        lab_nosings: numberOrZero(s.lab_nosings_m),
        lab_furniture: numberOrZero(s.lab_furniture_m2),
        lab_door_bars: numberOrZero(s.lab_door_bars_each),
        lab_gripper: numberOrZero(s.lab_gripper_m),
        lab_carpet_tiles: numberOrZero(s.lab_carpet_tiles_m2),
        lab_vinyl_domestic: numberOrZero(s.lab_domestic_vinyl_m2),
        lab_carpet_domestic: numberOrZero(s.lab_domestic_carpet_m2),
        lab_vinyl_commercial: numberOrZero(s.lab_commercial_vinyl_m2),
        lab_carpet_commercial: numberOrZero(s.lab_commercial_carpet_m2),
      },
      wetroom_m2: {},
      patterned_m2: numberOrZero(s.patterned_m2),
      borders_strips_m2: numberOrZero(s.borders_strips_m2),
      min_labour_charge: numberOrZero(s.min_labour_charge),
      day_rate_per_fitter: numberOrZero(s.day_rate_per_fitter),
    },
    services,
    materials: {
      mode: textOrDefault(s.materials_mode, "markup"),
      overrides: {
        mat_lvt: numberOrZero(s.markup_lvt_value ?? s.mat_lvt_m2),
        mat_ply: numberOrZero(s.mat_ply_m2),
        mat_weld: numberOrZero(s.mat_weld),
        mat_coved: numberOrZero(s.mat_coved_m2),
        mat_latex: numberOrZero(s.mat_latex_m2),
        mat_safety: numberOrZero(s.mat_safety_m2),
        mat_gripper: numberOrZero(s.mat_gripper),
        mat_matting: numberOrZero(s.mat_matting_m2),
        mat_nosings: numberOrZero(s.mat_nosings_m),
        mat_adhesive: numberOrZero(s.mat_adhesive_m2),
        mat_underlay: numberOrZero(s.mat_underlay),
        mat_door_bars: numberOrZero(s.mat_door_bars_each),
        mat_carpet_tiles: numberOrZero(s.markup_carpet_tiles_value ?? s.mat_carpet_tiles_m2),
        mat_vinyl_domestic: numberOrZero(
          s.markup_domestic_vinyl_value ?? s.mat_domestic_vinyl_m2
        ),
        mat_carpet_domestic: numberOrZero(
          s.markup_domestic_carpet_value ?? s.mat_domestic_carpet_m2
        ),
        mat_vinyl_commercial: numberOrZero(
          s.markup_commercial_vinyl_value ?? s.mat_commercial_vinyl_m2
        ),
        mat_carpet_commercial: numberOrZero(
          s.markup_commercial_carpet_value ?? s.mat_commercial_carpet_m2
        ),
      },
      sell_rates_m2: {},
      fixed_addon_m2: {},
      default_markup_percent: numberOrZero(s.default_markup_percent),
    },
    vat_registered: booleanOr(
      typeof vatRegistered === "boolean" ? vatRegistered : s.vat_registered,
      true
    ),
    separate_labour: booleanOr(s.separate_labour, true),
  };

  if (!profile || typeof profile !== "object") {
    throw new Error("Invalid pricing profile generated");
  }

  return profile;
}
