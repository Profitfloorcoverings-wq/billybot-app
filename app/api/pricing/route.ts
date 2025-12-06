import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PricingPayload = {
  data?: unknown;
};

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
    const user = await getUserFromCookies();
    const profileId = user?.id;

    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
