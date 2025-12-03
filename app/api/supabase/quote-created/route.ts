import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const record = payload?.record ?? payload?.new ?? payload?.data?.new ?? payload;

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

    const { data: conversation, error: conversationErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", client_id)
      .maybeSingle();

    if (conversationErr) throw conversationErr;
    const conversationId = conversation?.id ?? null;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Could not resolve conversation for quote" },
        { status: 404 }
      );
    }

    const { error: insertErr } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      type: "quote",
      content: pdf_url,
      quote_reference,
    });

    if (insertErr) throw insertErr;

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
