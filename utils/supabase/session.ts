"use client";

import type { Session } from "@supabase/supabase-js";

import { createClient } from "./client";

export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("Supabase getSession error", error);
    return null;
  }

  return data.session;
}
