import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nWebhook = process.env.N8N_WEBHOOK_URL!;

// Dev fallback (pre-login)
const DEV_PROFILE_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

type MessageRow = {
  id: number;
  role: "user" | "assistant";
  content: string;
  type?: string | null;
  quote_reference?: string | null;
  conversation_id: string;
  created_at?: string;
};

type ChatRequest = {
  message?: string;
  profile_id?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequest;
    const { message, profile_id: incomingProfileId } = body;

    if (!message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const profileId = incomingProfileId || DEV_PROFILE_ID;

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

    const conversationId: string = conversation.id;

    if (message === "__LOAD_HISTORY__") {
      const { data: history, error: histErr } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (histErr) throw histErr;

      return NextResponse.json({
        conversation_id: conversationId,
        messages: (history as MessageRow[] | null) ?? [],
      });
    }

    const { data: insertedUser, error: userMsgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        type: "text",
        content: message,
        profile_id: profileId,
      })
      .select()
      .single();

    if (userMsgErr) throw userMsgErr;

    const { data: history, error: histErr } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (histErr) throw histErr;

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

    const botData = (await n8nRes.json()) as { reply?: string };
    const botReply =
      typeof botData.reply === "string"
        ? botData.reply
        : "BillyBot didn’t reply.";

    const { data: assistantMessage, error: botMsgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        type: "text",
        content: botReply,
        profile_id: profileId,
      })
      .select()
      .single();

    if (botMsgErr) throw botMsgErr;

    return NextResponse.json({
      reply: botReply,
      conversation_id: conversationId,
      userMessage: insertedUser as MessageRow,
      assistantMessage: assistantMessage as MessageRow,
    });
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
