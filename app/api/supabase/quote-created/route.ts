import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    // Ignore optional signature header
    void req.headers.get("x-supabase-signature");

    // Supabase payload formats: record | new | raw
    const payload = await req.json();
    const quotePayload = payload?.record ?? payload?.new ?? payload;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---------------------------
    // 1. Extract quote fields
    // ---------------------------
    const quoteId = quotePayload?.id;

    if (!quoteId) {
      return NextResponse.json({ error: "Missing quote id" }, { status: 400 });
    }

    // Fetch full quote row to ensure all fields exist
    const { data: quoteRow, error: quoteFetchErr } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, client_id")
      .eq("id", quoteId)
      .limit(1)
      .single();

    if (quoteFetchErr) throw quoteFetchErr;

    const quoteReference = quoteRow?.quote_reference;
    const pdfUrl = quoteRow?.pdf_url;
    const clientid = quoteRow?.client_id;

    if (!pdfUrl || !quoteReference || !clientid) {
      return NextResponse.json(
        { error: "Missing quote fields" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 2. Find conversation
    // ---------------------------
    const { data: conversation, error: convoErr } = await supabase
      .from("conversations")
      .select("id")
      .eq("profile_id", clientid)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (convoErr) {
      if (convoErr.code === "PGRST116") {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      throw convoErr;
    }

    // ---------------------------
    // 3. Prevent duplicate insert
    // ---------------------------
    const { data: existingMessage, error: existingErr } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("quote_reference", quoteReference)
      .limit(1)
      .maybeSingle();

    if (existingErr) throw existingErr;

    if (existingMessage) {
      return NextResponse.json({ status: "ok" });
    }

    // ---------------------------
    // 4. Insert new quote message
    // ---------------------------
    const { error: insertErr } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      profile_id: clientid,
      role: "assistant",
      type: "quote",
      content: pdfUrl,
      quote_reference: quoteReference,
    });

    if (insertErr) throw insertErr;

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("QUOTE WEBHOOK ERROR:", err);
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
