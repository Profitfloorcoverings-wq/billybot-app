export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getUserFromCookies } from "@/utils/supabase/auth";

export async function POST() {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_PRICING_CALIBRATE_WEBHOOK;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Calibration webhook not configured" }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: clientRow } = await supabase
    .from("clients")
    .select("accounting_system")
    .eq("id", user.id)
    .maybeSingle();

  if (!clientRow?.accounting_system) {
    return NextResponse.json({ error: "No accounting system connected" }, { status: 400 });
  }

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_id: user.id,
        accounting_system: clientRow.accounting_system,
      }),
    });

    if (!webhookRes.ok) {
      console.error("[pricing/calibrate] N8N webhook failed", webhookRes.status);
      return NextResponse.json({ error: "Webhook failed" }, { status: 502 });
    }
  } catch (err) {
    console.error("[pricing/calibrate] fetch error", err);
    return NextResponse.json({ error: "Webhook unreachable" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
