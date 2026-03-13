import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Set status to generating
    const { error: updateError } = await supabase
      .from("clients")
      .update({ voice_profile_status: "generating" })
      .eq("id", userId);

    if (updateError) throw updateError;

    // Fire N8N webhook (don't block on processing)
    const webhookUrl = process.env.N8N_VOICE_PROFILE_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Voice profile webhook not configured" },
        { status: 500 }
      );
    }

    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BillyBot-Secret": process.env.N8N_SHARED_SECRET ?? "",
      },
      body: JSON.stringify({ profile_id: userId }),
    });

    if (!webhookRes.ok) {
      console.error("N8N voice profile webhook failed:", webhookRes.status, await webhookRes.text().catch(() => ""));
    }

    return NextResponse.json({ status: "generating" });
  } catch (err: unknown) {
    console.error("VOICE_PROFILE GENERATE ERROR:", err);
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
