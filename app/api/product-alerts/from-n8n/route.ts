import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AlertPayload = {
  original_name: string;
  matched_to: string;
  confidence?: number;
  match_reason?: string;
  source?: "estimator" | "chat" | "quote_builder";
  original_context?: string;
};

type RequestBody = {
  client_id: string;
  job_id?: string;
  alerts: AlertPayload[];
};

/**
 * POST /api/product-alerts/from-n8n
 * Called by N8N when unknown products are encountered during quote generation.
 * Auth: X-BillyBot-Secret header.
 */
export async function POST(request: Request) {
  try {
    const secret =
      request.headers.get("X-BillyBot-Secret") ||
      request.headers.get("x-billybot-secret") ||
      request.headers.get("x-n8n-secret");
    if (!secret || secret !== process.env.N8N_SHARED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const { client_id, job_id, alerts } = body;

    if (!client_id || !alerts?.length) {
      return NextResponse.json(
        { error: "client_id and alerts[] required" },
        { status: 400 }
      );
    }

    const rows = alerts.map((a) => ({
      client_id,
      job_id: job_id || null,
      original_name: a.original_name,
      original_context: a.original_context || null,
      matched_to: a.matched_to,
      confidence: a.confidence ?? null,
      match_reason: a.match_reason || null,
      source: a.source || "estimator",
    }));

    const { data, error } = await supabaseAdmin
      .from("product_match_alerts")
      .insert(rows)
      .select("id, original_name, matched_to");

    if (error) {
      console.error("[product-alerts/from-n8n] Insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Notify admin via push notification if configured
    const adminPushToken = process.env.ADMIN_PUSH_TOKEN;
    if (adminPushToken) {
      const names = alerts.map((a) => a.original_name).join(", ");
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: adminPushToken,
            title: "New unknown product",
            body: `${names} — mapped to ${alerts[0].matched_to}`,
            data: { type: "product_alert" },
          }),
        });
      } catch (pushErr) {
        console.error("[product-alerts/from-n8n] Push notify failed:", pushErr);
      }
    }

    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  } catch (err) {
    console.error("[product-alerts/from-n8n] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
