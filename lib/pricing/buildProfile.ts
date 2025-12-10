type BuildPricingProfileInput = {
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

export function buildPricingProfile({ settings, vatRegistered }: BuildPricingProfileInput) {
  const s = settings ?? {};

  return {
    rules: {
      price_breaks: parseBreakpoints(s?.breakpoints_json),
      small_job_fee: numberOrZero(s.small_job_charge),
    },

    extras: {
      ply_m2: numberOrZero(s.lab_ply_m2),
      latex_m2: numberOrZero(s.lab_latex_m2),
      nosings_m: numberOrZero(s.mat_nosings_m),
      uplift_m2: numberOrZero(s.mat_uplift_m2),
      adhesive_m2: numberOrZero(s.mat_adhesive_m2),
      door_bars_each: numberOrZero(s.mat_door_bars_each),
      furniture_removal: numberOrZero(s.furniture_removal),
      entrance_matting_m2: numberOrZero(s.mat_matting_m2),
    },

    labour: {
      min_labour_charge: numberOrZero(s.min_labour_charge),
      day_rate_per_fitter: numberOrZero(s.day_rate_per_fitter),
      rates_m2: {
        lab_lvt: numberOrZero(s.lab_lvt_m2),
        lab_ply: numberOrZero(s.lab_ply_m2),
        lab_coved: numberOrZero(s.lab_coved_m),
        lab_latex: numberOrZero(s.lab_latex_m2),
        lab_safety: numberOrZero(s.lab_safety_m2),
        lab_carpet_tiles: numberOrZero(s.lab_carpet_tiles_m2),
        lab_vinyl_domestic: numberOrZero(s.lab_domestic_vinyl_m2),
        lab_carpet_domestic: numberOrZero(s.lab_domestic_carpet_m2),
        lab_vinyl_commercial: numberOrZero(s.lab_commercial_vinyl_m2),
        lab_carpet_commercial: numberOrZero(s.lab_commercial_carpet_m2),
      },
    },

    services: [
      booleanOr(s.service_domestic_carpet, false) && "domestic_carpet",
      booleanOr(s.service_commercial_carpet, false) && "commercial_carpet",
      booleanOr(s.service_carpet_tiles, false) && "carpet_tiles",
      booleanOr(s.service_lvt, false) && "lvt_tiles",
      booleanOr(s.service_domestic_vinyl, false) && "domestic_vinyl",
      booleanOr(s.service_commercial_vinyl, false) && "commercial_vinyl",
      booleanOr(s.service_wall_cladding, false) && "solid_wood",
    ].filter(Boolean),

    materials: {
      mode: "markup",
      default_markup_percent: numberOrZero(s.default_markup_percent),
      overrides: {
        mat_lvt: numberOrZero(s.markup_lvt_value),
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
        mat_carpet_tiles: numberOrZero(s.mat_carpet_tiles_m2),
        mat_vinyl_domestic: numberOrZero(s.mat_domestic_vinyl_m2),
        mat_carpet_domestic: numberOrZero(s.mat_domestic_carpet_m2),
        mat_vinyl_commercial: numberOrZero(s.mat_commercial_vinyl_m2),
        mat_carpet_commercial: numberOrZero(s.mat_commercial_carpet_m2),
      },
    },

    vat_registered: booleanOr(
      typeof vatRegistered === "boolean" ? vatRegistered : s.vat_registered,
      false
    ),
    separate_labour: booleanOr(s.separate_labour, true),
  };
}
