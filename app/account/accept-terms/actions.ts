"use server";

import { unstable_noStore } from "next/cache";

import { createServerClient } from "@/utils/supabase/server";

export async function acceptTerms() {
  // Ensure the onboarding update is immediately visible to guards.
  unstable_noStore();

  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Please sign in again to continue.");
  }

  const { data, error } = await supabase
    .from("clients")
    .upsert({
      id: user.id,
      is_onboarded: true,
      terms_accepted: true,
      accepted_terms_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return { clientId: data?.id ?? user.id, profileId: user.id };
}
