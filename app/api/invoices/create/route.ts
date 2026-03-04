import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const invoiceWebhook = process.env.N8N_INVOICE_WEBHOOK_URL;

type LineItem = {
  id?: string;
  type?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
};

type RequestBody = {
  conversation_id: string;
  quote_id?: string;
  lines: LineItem[];
  invoice_type: "full" | "deposit";
  deposit_percentage?: number | null;
  billing_email?: string;
  billing_address?: string;
};

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!invoiceWebhook) {
      return NextResponse.json({ error: "Invoice webhook not configured" }, { status: 500 });
    }

    const user = await getUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    const { conversation_id, quote_id, lines, invoice_type, deposit_percentage, billing_email, billing_address } = body;

    if (!conversation_id || !lines?.length) {
      return NextResponse.json({ error: "Missing conversation_id or lines" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch VAT setting
    const { data: pricing } = await supabase
      .from("pricing_settings")
      .select("vat_registered")
      .eq("profile_id", user.id)
      .maybeSingle();

    const vatRegistered = pricing?.vat_registered ?? false;

    // Resolve customer info + reverse_charge from quote/job/customer
    let customerName: string | null = null;
    let customerEmail: string | null = billing_email ?? null;
    let reverseCharge = false;

    if (quote_id) {
      const { data: quote } = await supabase
        .from("quotes")
        .select("customer_name, customer_email, job_id")
        .eq("id", quote_id)
        .eq("client_id", user.id)
        .maybeSingle();

      if (quote) {
        customerName = quote.customer_name ?? null;
        customerEmail = customerEmail ?? quote.customer_email ?? null;

        if (quote.job_id) {
          const { data: job } = await supabase
            .from("jobs")
            .select("reverse_charge, customer_email")
            .eq("id", quote.job_id)
            .maybeSingle();

          if (job) {
            reverseCharge = (job as { reverse_charge?: boolean }).reverse_charge ?? false;
            customerEmail = customerEmail ?? (job.customer_email as string | null) ?? null;
          }
        }
      }
    }

    const n8nRes = await fetch(invoiceWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BillyBot-Secret": process.env.N8N_SHARED_SECRET ?? "",
      },
      body: JSON.stringify({
        profile_id: user.id,
        quote_id: quote_id ?? null,
        conversation_id,
        lines,
        invoice_type,
        deposit_percentage: invoice_type === "deposit" ? (deposit_percentage ?? 50) : null,
        billing_email: customerEmail,
        billing_address: billing_address ?? null,
        reverse_charge: reverseCharge,
        vat_registered: vatRegistered,
        customer_name: customerName,
        customer_email: customerEmail,
      }),
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text();
      console.error("N8N invoice webhook failed:", n8nRes.status, errText);
      return NextResponse.json({ error: "Failed to trigger invoice creation" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("INVOICE CREATE API ERROR:", err);
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
