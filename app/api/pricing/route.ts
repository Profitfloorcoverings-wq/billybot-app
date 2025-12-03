import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEV_PROFILE_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

type PricingPayload = {
  data?: unknown;
  profile_id?: string;
};

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("pricing_settings")
      .select("data")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: data?.data ?? null });
  } catch (err: unknown) {
    console.error("PRICING GET ERROR:", err);
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

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as PricingPayload;
    const profileId = body?.profile_id || DEV_PROFILE_ID;

    if (!body?.data) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("pricing_settings")
      .upsert({ profile_id: profileId, data: body.data });

    if (error) throw error;

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("PRICING POST ERROR:", err);
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
