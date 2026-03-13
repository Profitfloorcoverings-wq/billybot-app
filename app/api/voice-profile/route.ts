import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const VOICE_PROFILE_COLUMNS = [
  "voice_profile",
  "voice_examples",
  "voice_profile_generated_at",
  "voice_profile_email_count",
  "voice_profile_status",
  "voice_profile_manual_override",
] as const;

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("clients")
      .select(VOICE_PROFILE_COLUMNS.join(", "))
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: data ?? null });
  } catch (err: unknown) {
    console.error("VOICE_PROFILE GET ERROR:", err);
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

export async function PUT(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const voiceProfile = body?.voice_profile;

    if (typeof voiceProfile !== "string" || !voiceProfile.trim()) {
      return NextResponse.json(
        { error: "voice_profile is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("clients")
      .update({
        voice_profile: voiceProfile,
        voice_profile_manual_override: true,
      })
      .eq("id", userId)
      .select(VOICE_PROFILE_COLUMNS.join(", "))
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: unknown) {
    console.error("VOICE_PROFILE PUT ERROR:", err);
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
