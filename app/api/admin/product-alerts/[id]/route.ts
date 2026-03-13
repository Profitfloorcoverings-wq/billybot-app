import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ResolveBody = {
  status: "accepted" | "remapped" | "dismissed";
  resolved_to?: string;
};

/**
 * PATCH /api/admin/product-alerts/[id]
 * Admin-only: resolve a product match alert.
 * Auth: x-internal-token header.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get("x-internal-token");
  if (!token || token !== process.env.INTERNAL_JOBS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as ResolveBody;

  if (!["accepted", "remapped", "dismissed"].includes(body.status)) {
    return NextResponse.json(
      { error: "status must be accepted, remapped, or dismissed" },
      { status: 400 }
    );
  }

  if (body.status === "remapped" && !body.resolved_to) {
    return NextResponse.json(
      { error: "resolved_to required when status is remapped" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    status: body.status,
    resolved_at: new Date().toISOString(),
  };
  if (body.resolved_to) {
    update.resolved_to = body.resolved_to;
  }

  const { data, error } = await supabaseAdmin
    .from("product_match_alerts")
    .update(update)
    .eq("id", id)
    .select("id, status, resolved_to, resolved_at")
    .single();

  if (error) {
    console.error("[admin/product-alerts] Update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alert: data });
}

/**
 * PATCH all alerts with same original_name (bulk resolve).
 * POST /api/admin/product-alerts/[id]?bulk=true
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.headers.get("x-internal-token");
  if (!token || token !== process.env.INTERNAL_JOBS_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as ResolveBody;

  // First get the alert to find original_name
  const { data: alert, error: fetchErr } = await supabaseAdmin
    .from("product_match_alerts")
    .select("original_name")
    .eq("id", id)
    .single();

  if (fetchErr || !alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    status: body.status,
    resolved_at: new Date().toISOString(),
  };
  if (body.resolved_to) {
    update.resolved_to = body.resolved_to;
  }

  // Update all pending alerts with the same original_name
  const { data, error } = await supabaseAdmin
    .from("product_match_alerts")
    .update(update)
    .ilike("original_name", alert.original_name)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("[admin/product-alerts] Bulk update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
}
