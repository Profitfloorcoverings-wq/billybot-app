import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase DB webhooks for this project are not signed; ignore any signature headers.
export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are not configured" },
        { status: 500 }
      );
    }

    // Ignore optional signature header
    void req.headers.get("x-supabase-signature");

    // Parse Supabase payload in all possible formats
    const payload = await req.json();
    const record =
      payload?.record ??
      payload?.new ??
      payload?.data?.new ??
      payload;

    const id = record?.id as string | undefined;
    const quote_reference = record?.quote_reference as string | undefined;
    const pdf_url = record?.pdf_url as string | undefined;
    const client_id = record?.client_id as string | undefined;

    if (!id || !quote_reference || !pdf_url || !client_id) {
      return NextResponse.json(
        { error: "Missing id, quote_reference, pdf_url, or client_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find conversation using profile_id (client_id from webhook)
    const { data: conversation, error: conversationErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("profile_id", client_id)
      .maybeSingle();

    if (conversationErr) throw conversationErr;

    const conversationId = conversation?.id ?? null;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation not found for client" },
        { status: 404 }
      );
    }

    // Avoid duplicate quote messages when Supabase webhooks fire more than once
    const { data: existingMessage, error: existingErr } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("quote_reference", quote_reference)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingMessage) {
      const { error: updateErr } = await supabase
        .from("messages")
        .update({ content: pdf_url, role: "assistant", type: "quote" })
        .eq("id", existingMessage.id);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        type: "quote",
        content: pdf_url,
        quote_reference
      });

      if (insertErr) throw insertErr;
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("Quote webhook error:", err);
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
