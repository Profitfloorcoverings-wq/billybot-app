import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEV_PROFILE_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

export async function GET(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get("profile_id") || DEV_PROFILE_ID;
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
      .select("id, quote_reference, pdf_url, client_id, created_at")
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
