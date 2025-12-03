import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Environment variables (server-side only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nWebhook = process.env.N8N_WEBHOOK_URL!;

// Dev fallback before auth is added
const DEV_PROFILE_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    // Server-side Supabase (service role key)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try to get auth user (will be null until you add login)
    const {
      data: { user },
    } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const profileId = user?.id ?? DEV_PROFILE_ID;

    // ---------------------------
    // 1. Find or create conversation
    // ---------------------------
    const { data: convos, error: convoSelectErr } = await supabase
      .from("conversations")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: true })
      .limit(1);

    if (convoSelectErr) throw convoSelectErr;

    let conversation = convos?.[0];

    if (!conversation) {
      const { data: newConvo, error: convoInsertErr } = await supabase
        .from("conversations")
        .insert({
          title: "BillyBot chat",
          profile_id: profileId,
        })
        .select()
        .single();

      if (convoInsertErr) throw convoInsertErr;
      conversation = newConvo;
    }

    const conversationId = conversation.id;

    // ---------------------------
    // 2. Special case: load history
    // ---------------------------
    if (message === "__LOAD_HISTORY__") {
      const { data: history, error: histErr } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (histErr) throw histErr;

      return NextResponse.json({
        conversation_id: conversationId,
        messages: history ?? [],
      });
    }

    // ---------------------------
    // 3. Insert user message
    // ---------------------------
    const { error: userMsgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    if (userMsgErr) throw userMsgErr;

    // ---------------------------
    // 4. Load history for n8n
    // ---------------------------
    const { data: history, error: histErr } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (histErr) throw histErr;

    // ---------------------------
    // 5. Send to n8n AI agent
    // ---------------------------
    const n8nRes = await fetch(n8nWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        history,
        profile_id: profileId,
      }),
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text();
      console.error("n8n error", n8nRes.status, text);
      throw new Error("n8n webhook failed");
    }

    const botData = await n8nRes.json();
    const botReply =
      typeof botData.reply === "string"
        ? botData.reply
        : "BillyBot didn’t reply.";

    // ---------------------------
    // 6. Insert bot reply
    // ---------------------------
    const { error: botMsgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: botReply,
    });

    if (botMsgErr) throw botMsgErr;

    return NextResponse.json({ conversation_id: conversationId, reply: botReply });
  } catch (err: unknown) {
    console.error("Chat route error:", err);
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
