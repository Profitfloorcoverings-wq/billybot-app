import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/product-alerts
 * Admin-only: lists all pending product match alerts across all users.
 * Auth: x-internal-token header.
 * Query params: ?status=pending (default) | accepted | remapped | dismissed | all
 */
export async function GET(request: Request) {
  const token = request.headers.get("x-internal-token");
  if (!token || token !== process.env.INTERNAL_JOBS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  let query = supabaseAdmin
    .from("product_match_alerts")
    .select(
      `
      id,
      client_id,
      job_id,
      original_name,
      original_context,
      matched_to,
      confidence,
      match_reason,
      status,
      resolved_to,
      resolved_at,
      source,
      created_at
    `
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[admin/product-alerts] Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by original_name for the admin view
  const grouped: Record<
    string,
    {
      original_name: string;
      matched_to: string;
      confidence: number | null;
      match_reason: string | null;
      occurrences: number;
      alerts: typeof data;
    }
  > = {};

  for (const alert of data || []) {
    const key = alert.original_name.toLowerCase();
    if (!grouped[key]) {
      grouped[key] = {
        original_name: alert.original_name,
        matched_to: alert.matched_to,
        confidence: alert.confidence,
        match_reason: alert.match_reason,
        occurrences: 0,
        alerts: [],
      };
    }
    grouped[key].occurrences++;
    grouped[key].alerts.push(alert);
  }

  return NextResponse.json({
    total: data?.length ?? 0,
    groups: Object.values(grouped).sort(
      (a, b) => b.occurrences - a.occurrences
    ),
  });
}
