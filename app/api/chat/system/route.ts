import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Dev fallback profile
const DEV_PROFILE_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { reply, conversation_id } = body;

    if (!reply || !conversation_id) {
      return NextResponse.json(
        { error: "Missing reply or conversation_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert assistant message into your messages table
    const { error } = await supabase.from("messages").insert({
      conversation_id,
      role: "assistant",
      content: reply,
      profile_id: DEV_PROFILE_ID
    });

    if (error) throw error;

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("SYSTEM ROUTE ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
