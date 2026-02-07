import { createClient } from "@supabase/supabase-js";

import { buildPricingProfile } from "@/lib/pricing/buildProfile";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function rebuildPricingProfile(profileId: string) {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are missing");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: settings, error: settingsError } = await supabase
    .from("pricing_settings")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  if (!settings) {
    throw new Error("Pricing settings not found for profile");
  }

  const profileJson = buildPricingProfile({
    settings,
    vatRegistered: settings.vat_registered,
  });

  if (!profileJson || typeof profileJson !== "object") {
    throw new Error("Unable to rebuild pricing profile");
  }

  const { error: upsertError } = await supabase.from("pricing_profiles").upsert({
    profile_id: profileId,
    profile_json: profileJson,
    vat_registered: profileJson.vat_registered,
    effective_from: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    throw upsertError;
  }

  return profileJson;
}
