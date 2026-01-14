"use server";

import { unstable_noStore } from "next/cache";

import { createServerClient } from "@/utils/supabase/server";

export async function acceptTerms() {
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
    .update({
      is_onboarded: true,
      terms_accepted: true,
    })
    .eq("id", user.id)
    .select("id")
    .single();

  if (error) {
    throw new Error("Unable to save terms acceptance (RLS/DB).");
  }

  if (!data?.id) {
    throw new Error("Business profile not found. Please complete setup first.");
  }

  return { clientId: data.id, profileId: user.id };
}
