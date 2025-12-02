"use client";

import { createClient } from "@supabase/supabase-js";

export const createSupabaseBrowser = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: { params: { eventsPerSecond: 2 } },
    }
  );
};
