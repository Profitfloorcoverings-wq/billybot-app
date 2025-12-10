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

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("vat_registered")
    .eq("id", profileId)
    .maybeSingle();

  if (clientError) {
    throw clientError;
  }

  const vatRegistered = client?.vat_registered ?? settings?.vat_registered ?? false;

  const pricingProfile = buildPricingProfile({
    settings: settings ?? {},
    vatRegistered,
  });

  const { error: upsertError } = await supabase.from("pricing_profiles").upsert({
    id: profileId,
    profile_json: pricingProfile,
    vat_registered: vatRegistered,
    effective_from: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    throw upsertError;
  }

  return pricingProfile;
}
