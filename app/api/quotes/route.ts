import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const user = await getUserFromCookies();
    const profileId = user?.id;

    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const latestOnly = searchParams.get("latest") === "1";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (latestOnly) {
      const { data, error } = await supabase
        .from("quotes")
        .select("created_at")
        .eq("client_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return NextResponse.json({
        latest_created_at: data?.created_at ?? null,
      });
    }

    const { data: quotes, error } = await supabase
      .from("quotes")
      .select(
        "id, quote_reference, pdf_url, client_id, created_at, customer_name, job_ref"
      )
      .eq("client_id", profileId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ quotes: quotes ?? [] });
  } catch (err: unknown) {
    console.error("QUOTES API ERROR:", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Server error",
      },
      { status: 500 }
    );
  }
}
