import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const customQuoteWebhook = process.env.N8N_CUSTOM_QUOTE_WEBHOOK;

type LineItem = {
  id: string;
  type: "labour" | "materials" | "extra";
  description: string;
  quantity: number;
  unit: "m2" | "m" | "sheet" | "unit" | "flat";
  unit_price: number;
  total: number;
  product_ref?: string;
  price_source?: "mid_range" | "supplier" | "manual";
};

type RequestBody = {
  conversation_id: string;
  lines: LineItem[];
};

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (!customQuoteWebhook) {
      return NextResponse.json({ error: "Custom quote webhook not configured" }, { status: 500 });
    }

    const user = await getUserFromRequest(req);
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    const { conversation_id, lines } = body;

    if (!conversation_id || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Missing conversation_id or lines" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pricing settings and client profile in parallel
    const [pricingResult, clientResult] = await Promise.all([
      supabase
        .from("pricing_settings")
        .select("vat_registered")
        .eq("profile_id", user.id)
        .maybeSingle(),
      supabase
        .from("clients")
        .select("business_name, accounting_system")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const vatRegistered = pricingResult.data?.vat_registered ?? false;
    const businessName = clientResult.data?.business_name ?? "";
    const accountingSystem = clientResult.data?.accounting_system ?? "none";

    // POST to N8N custom quote workflow
    const n8nRes = await fetch(customQuoteWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BillyBot-Secret": process.env.N8N_SHARED_SECRET ?? "",
      },
      body: JSON.stringify({
        profile_id: user.id,
        conversation_id,
        lines,
        vat_registered: vatRegistered,
        business_name: businessName,
        accounting_system: accountingSystem,
      }),
    });

    if (!n8nRes.ok) {
      const errText = await n8nRes.text();
      console.error("N8N custom quote webhook failed:", n8nRes.status, errText);
      return NextResponse.json({ error: "Failed to trigger quote generation" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("CUSTOM QUOTE API ERROR:", err);
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
