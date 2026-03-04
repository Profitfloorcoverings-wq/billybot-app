import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RequestBody = {
  quote_id: string;
  conversation_id: string;
};

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const user = await getUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    const { quote_id, conversation_id } = body;

    if (!quote_id || !conversation_id) {
      return NextResponse.json({ error: "Missing quote_id or conversation_id" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch quote
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, quote_reference, customer_name, customer_email, job_id, lines")
      .eq("id", quote_id)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Fetch job for billing overrides
    let billingAddress: string | null = null;
    let billingEmail: string | null = quote.customer_email ?? null;

    if (quote.job_id) {
      const { data: job } = await supabase
        .from("jobs")
        .select("billing_address, billing_email, site_address, customer_email")
        .eq("id", quote.job_id)
        .maybeSingle();

      if (job) {
        billingEmail = job.billing_email ?? job.customer_email ?? billingEmail;
        billingAddress = job.billing_address ?? (job.site_address as string | null) ?? null;
      }
    }

    // Build message content
    const content = JSON.stringify({
      lines: (quote as { lines?: unknown }).lines ?? [],
      quote_id: quote.id,
      quote_reference: quote.quote_reference,
      customer_name: quote.customer_name,
      billing_email: billingEmail ?? "",
      billing_address: billingAddress ?? "",
    });

    // Insert invoice_builder message
    await supabase.from("messages").insert({
      conversation_id,
      profile_id: user.id,
      role: "assistant",
      type: "invoice_builder",
      content,
    });

    return NextResponse.json({ ok: true, conversation_id });
  } catch (err: unknown) {
    console.error("INVOICES INITIATE ERROR:", err);
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
