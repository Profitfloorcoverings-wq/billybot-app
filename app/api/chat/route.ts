import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nWebhook = process.env.N8N_WEBHOOK_URL!;

// Dev fallback (pre-login)
const DEV_PROFILE_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Try to get auth user (works once you add login)
    const {
      data: { user },
    } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const profileId = user?.id ?? DEV_PROFILE_ID;

    // 2. Find or create conversation
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

    // 3. Special case: load history
    if (message === "__LOAD_HISTORY__") {
      const { data: history, error: histErr } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (histErr) throw histErr;

      return NextResponse.json({ messages: history ?? [] });
    }

    // 4. Insert user message
    const { error: userMsgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
    });

    if (userMsgErr) throw userMsgErr;

    // 5. Load full history for n8n
    const { data: history, error: histErr } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (histErr) throw histErr;

    // 6. Send to n8n
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

    // 7. Insert bot message
    const { error: botMsgErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: botReply,
    });

    if (botMsgErr) throw botMsgErr;

    // 8. Return reply
    return NextResponse.json({ reply: botReply });
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
