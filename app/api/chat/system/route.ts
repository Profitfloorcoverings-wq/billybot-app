import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("profile_id")
      .eq("id", conversation_id)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase.from("messages").insert({
      conversation_id,
      profile_id: conversation.profile_id,
      role: "assistant",
      type: "text",
      content: reply,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("SYSTEM ROUTE ERROR:", err);
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
