import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LABOUR_PRICE_FIELDS,
  MARKUP_OPTIONS,
  MATERIAL_PRICE_FIELDS,
  SERVICE_OPTIONS,
  SMALL_JOB_FIELDS,
} from "@/lib/pricing/pricingSettingsConfig";

type EnsurePricingResult = {
  created: boolean;
  error?: Error;
};

const EXTRA_NUMERIC_COLUMNS = [
  "lab_carpet_tiles_m2",
  "mat_weld",
  "min_labour_charge",
  "default_markup_percent",
];

const NUMERIC_COLUMNS = Array.from(
  new Set([
    ...MARKUP_OPTIONS.map((option) => option.valueColumn),
    ...MATERIAL_PRICE_FIELDS.map((field) => field.column),
    ...LABOUR_PRICE_FIELDS.map((field) => field.column),
    ...SMALL_JOB_FIELDS.map((field) => field.column),
    ...EXTRA_NUMERIC_COLUMNS,
  ])
);

const SERVICE_COLUMNS = SERVICE_OPTIONS.map((option) => option.column);
const MARKUP_TYPE_COLUMNS = MARKUP_OPTIONS.map((option) => option.typeColumn);

function buildPricingDefaults(profileId: string) {
  const defaults: Record<string, unknown> = {
    profile_id: profileId,
    vat_registered: true,
    separate_labour: true,
    breakpoints_json: [],
  };

  SERVICE_COLUMNS.forEach((column) => {
    defaults[column] = true;
  });

  MARKUP_TYPE_COLUMNS.forEach((column) => {
    defaults[column] = "%";
  });

  NUMERIC_COLUMNS.forEach((column) => {
    defaults[column] = 1;
  });

  return defaults;
}

export async function ensurePricingSettings(
  supabase: SupabaseClient,
  profileId: string
): Promise<EnsurePricingResult> {
  const { data, error } = await supabase
    .from("pricing_settings")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) {
    return { created: false, error };
  }

  if (data) {
    return { created: false };
  }

  const { error: insertError } = await supabase
    .from("pricing_settings")
    .insert(buildPricingDefaults(profileId));

  if (insertError) {
    return { created: false, error: insertError };
  }

  return { created: true };
}

export const PRICING_NUMERIC_COLUMNS = NUMERIC_COLUMNS;
export const PRICING_SERVICE_COLUMNS = SERVICE_COLUMNS;
export const PRICING_MARKUP_TYPE_COLUMNS = MARKUP_TYPE_COLUMNS;
