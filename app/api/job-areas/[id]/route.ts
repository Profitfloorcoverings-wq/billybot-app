import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";
import { parseDimensionExpr } from "@/lib/jobs/parseDimensionExpr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const { data: existing } = await supabaseAdmin
      .from("job_areas")
      .select("id")
      .eq("id", id)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: "Area not found" }, { status: 404 });

    // Build update object from provided fields
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const stringFields = ["building", "floor", "name", "dimension_expr", "flooring_type", "product_spec", "prep_notes", "notes"] as const;
    for (const field of stringFields) {
      if (field in body) {
        update[field] = body[field]?.trim() || null;
      }
    }

    if ("qty" in body) update.qty = body.qty ?? 1;
    if ("sort_order" in body) update.sort_order = body.sort_order ?? 0;
    if ("source" in body) update.source = body.source || "manual";
    if ("job_file_id" in body) update.job_file_id = body.job_file_id || null;

    // Re-parse dimension expression if it changed
    if ("dimension_expr" in body) {
      const expr = body.dimension_expr?.trim();
      if (expr) {
        const parsed = parseDimensionExpr(expr);
        update.m2_calculated = parsed.ok ? parsed.m2 : null;
      } else {
        update.m2_calculated = null;
      }
    }

    const { data: area, error } = await supabaseAdmin
      .from("job_areas")
      .update(update)
      .eq("id", id)
      .eq("client_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ area });
  } catch (err) {
    console.error("[job-areas PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const { error } = await supabaseAdmin
      .from("job_areas")
      .delete()
      .eq("id", id)
      .eq("client_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[job-areas DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
