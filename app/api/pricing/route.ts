import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

const PRICING_SETTING_COLUMNS = [
  "vat_registered",
  "separate_labour",
  "service_domestic_carpet",
  "service_commercial_carpet",
  "service_carpet_tiles",
  "service_lvt",
  "service_domestic_vinyl",
  "service_commercial_vinyl",
  "service_wall_cladding",
  "markup_domestic_carpet_value",
  "markup_domestic_carpet_type",
  "markup_commercial_carpet_value",
  "markup_commercial_carpet_type",
  "markup_carpet_tiles_value",
  "markup_carpet_tiles_type",
  "markup_lvt_value",
  "markup_lvt_type",
  "markup_domestic_vinyl_value",
  "markup_domestic_vinyl_type",
  "markup_commercial_vinyl_value",
  "markup_commercial_vinyl_type",
  "markup_wall_cladding_value",
  "markup_wall_cladding_type",
  "mat_lvt_m2",
  "mat_ceramic_tiles_m2",
  "mat_domestic_carpet_m2",
  "mat_commercial_carpet_m2",
  "mat_carpet_tiles_m2",
  "mat_safety_m2",
  "mat_domestic_vinyl_m2",
  "mat_commercial_vinyl_m2",
  "mat_wall_cladding_m2",
  "mat_ply_m2",
  "mat_weld",
  "mat_coved_m2",
  "mat_gripper",
  "mat_matting_m2",
  "mat_nosings_m",
  "mat_adhesive_m2",
  "mat_latex_m2",
  "mat_underlay",
  "mat_door_bars_each",
  "mat_uplift_m2",
  "waste_disposal",
  "furniture_removal",
  "lab_domestic_carpet_m2",
  "lab_commercial_carpet_m2",
  "lab_carpet_tiles_m2",
  "lab_lvt_m2",
  "lab_ceramic_tiles_m2",
  "lab_safety_m2",
  "lab_domestic_vinyl_m2",
  "lab_commercial_vinyl_m2",
  "lab_wall_cladding_m2",
  "lab_coved_m",
  "lab_ply_m2",
  "lab_latex_m2",
  "lab_door_bars_each",
  "lab_nosings_m",
  "lab_matting_m2",
  "lab_uplift_m2",
  "lab_gripper_m",
  "small_job_charge",
  "min_labour_charge",
  "day_rate_per_fitter",
  "default_markup_percent",
  "breakpoints_json",
];

type PricingPayload = {
  profileId?: string;
  settings?: Record<string, unknown>;
};

export async function GET() {
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
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: data ?? null });
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
    const profileId = body.profileId ?? user?.id;

    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!body?.settings || typeof body.settings !== "object") {
      return NextResponse.json({ error: "Missing settings" }, { status: 400 });
    }

    const sanitizedSettings = Object.entries(body.settings).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        if (PRICING_SETTING_COLUMNS.includes(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {}
    );

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from("pricing_settings").upsert({
      ...sanitizedSettings,
      profile_id: profileId,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    if (!appUrl) {
      throw new Error("Application URL is not configured");
    }

    const rebuildResponse = await fetch(`${appUrl}/api/pricing/rebuild`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });

    if (!rebuildResponse.ok) {
      const rebuildBody = await rebuildResponse.json().catch(() => ({}));
      throw new Error(rebuildBody.error ?? "Unable to rebuild pricing profile");
    }

    return NextResponse.json({ success: true });
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
