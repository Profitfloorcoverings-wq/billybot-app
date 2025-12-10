export type BuildPricingProfileInput = {
  settings?: Record<string, unknown> | null;
  vatRegistered?: boolean;
};

function parseBreakpoints(value: unknown) {
  if (!value) return [] as unknown[];

  if (typeof value === "string") {
    try {
      return JSON.parse(value || "[]");
    } catch (err) {
      console.warn("Unable to parse breakpoints_json", err);
      return [] as unknown[];
    }
  }

  return value;
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

  const profile = {
    profile_id: typeof s.profile_id === "string" ? s.profile_id : null,
    vat_registered: booleanOr(
      typeof vatRegistered === "boolean" ? vatRegistered : s.vat_registered,
      true
    ),
    separate_labour: booleanOr(s.separate_labour, true),

    // rules
    small_job_charge: numberOrZero(s.small_job_charge),
    min_labour_charge: numberOrZero(s.min_labour_charge),
    day_rate_per_fitter: numberOrZero(s.day_rate_per_fitter),
    default_markup_percent: numberOrZero(s.default_markup_percent),
    breakpoints_json: parseBreakpoints(s.breakpoints_json),

    // service toggles
    service_domestic_carpet: booleanOr(s.service_domestic_carpet, true),
    service_commercial_carpet: booleanOr(s.service_commercial_carpet, true),
    service_carpet_tiles: booleanOr(s.service_carpet_tiles, true),
    service_lvt: booleanOr(s.service_lvt, true),
    service_domestic_vinyl: booleanOr(s.service_domestic_vinyl, true),
    service_commercial_vinyl: booleanOr(s.service_commercial_vinyl, true),
    service_wall_cladding: booleanOr(s.service_wall_cladding, true),

    // material prices
    mat_lvt_m2: numberOrZero(s.mat_lvt_m2),
    mat_ceramic_tiles_m2: numberOrZero(s.mat_ceramic_tiles_m2),
    mat_domestic_carpet_m2: numberOrZero(s.mat_domestic_carpet_m2),
    mat_commercial_carpet_m2: numberOrZero(s.mat_commercial_carpet_m2),
    mat_safety_m2: numberOrZero(s.mat_safety_m2),
    mat_domestic_vinyl_m2: numberOrZero(s.mat_domestic_vinyl_m2),
    mat_commercial_vinyl_m2: numberOrZero(s.mat_commercial_vinyl_m2),
    mat_wall_cladding_m2: numberOrZero(s.mat_wall_cladding_m2),

    // extras
    mat_ply_m2: numberOrZero(s.mat_ply_m2),
    mat_weld: numberOrZero(s.mat_weld),
    mat_coved_m2: numberOrZero(s.mat_coved_m2),
    mat_gripper: numberOrZero(s.mat_gripper),
    mat_matting_m2: numberOrZero(s.mat_matting_m2),
    mat_nosings_m: numberOrZero(s.mat_nosings_m),
    mat_adhesive_m2: numberOrZero(s.mat_adhesive_m2),
    mat_underlay: numberOrZero(s.mat_underlay),
    mat_door_bars_each: numberOrZero(s.mat_door_bars_each),
    mat_uplift_m2: numberOrZero(s.mat_uplift_m2),
    furniture_removal: numberOrZero(s.furniture_removal),

    // labour prices
    lab_domestic_carpet_m2: numberOrZero(s.lab_domestic_carpet_m2),
    lab_commercial_carpet_m2: numberOrZero(s.lab_commercial_carpet_m2),
    lab_carpet_tiles_m2: numberOrZero(s.lab_carpet_tiles_m2),
    lab_lvt_m2: numberOrZero(s.lab_lvt_m2),
    lab_ceramic_tiles_m2: numberOrZero(s.lab_ceramic_tiles_m2),
    lab_safety_m2: numberOrZero(s.lab_safety_m2),
    lab_domestic_vinyl_m2: numberOrZero(s.lab_domestic_vinyl_m2),
    lab_commercial_vinyl_m2: numberOrZero(s.lab_commercial_vinyl_m2),
    lab_wall_cladding_m2: numberOrZero(s.lab_wall_cladding_m2),
    lab_coved_m: numberOrZero(s.lab_coved_m),
    lab_ply_m2: numberOrZero(s.lab_ply_m2),
    lab_latex_m2: numberOrZero(s.lab_latex_m2),

    // markup values/types
    markup_domestic_carpet_value: numberOrZero(s.markup_domestic_carpet_value),
    markup_domestic_carpet_type: textOrDefault(s.markup_domestic_carpet_type, "%"),
    markup_commercial_carpet_value: numberOrZero(s.markup_commercial_carpet_value),
    markup_commercial_carpet_type: textOrDefault(s.markup_commercial_carpet_type, "%"),
    markup_carpet_tiles_value: numberOrZero(s.markup_carpet_tiles_value),
    markup_carpet_tiles_type: textOrDefault(s.markup_carpet_tiles_type, "%"),
    markup_lvt_value: numberOrZero(s.markup_lvt_value),
    markup_lvt_type: textOrDefault(s.markup_lvt_type, "%"),
    markup_domestic_vinyl_value: numberOrZero(s.markup_domestic_vinyl_value),
    markup_domestic_vinyl_type: textOrDefault(s.markup_domestic_vinyl_type, "%"),
    markup_commercial_vinyl_value: numberOrZero(s.markup_commercial_vinyl_value),
    markup_commercial_vinyl_type: textOrDefault(s.markup_commercial_vinyl_type, "%"),
    markup_wall_cladding_value: numberOrZero(s.markup_wall_cladding_value),
    markup_wall_cladding_type: textOrDefault(s.markup_wall_cladding_type, "%"),

    updated_at: s.updated_at ?? new Date().toISOString(),
  };

  if (!profile || typeof profile !== "object") {
    throw new Error("Invalid pricing profile generated");
  }

  return profile;
}
