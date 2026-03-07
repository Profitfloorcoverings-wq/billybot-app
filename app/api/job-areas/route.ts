import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";
import { parseDimensionExpr } from "@/lib/jobs/parseDimensionExpr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_FLOORING_TYPES = [
  "carpet", "carpet_tiles", "safety_vinyl", "smooth_vinyl",
  "lvt_tiles", "whiterock", "matting", "laminate", "engineered",
  "wood", "tiles", "rubber", "resin", "other",
];

const VALID_SOURCES = ["ai_extracted", "manual", "drawing"];

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");
    if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

    // Verify job belongs to user
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { data: areas, error } = await supabaseAdmin
      .from("job_areas")
      .select("*")
      .eq("job_id", jobId)
      .eq("client_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ areas: areas ?? [] });
  } catch (err) {
    console.error("[job-areas GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { job_id, building, floor, name, dimension_expr, qty, flooring_type, product_spec, prep_notes, source, job_file_id, notes, sort_order } = body;

    if (!job_id) return NextResponse.json({ error: "job_id required" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    if (flooring_type && !VALID_FLOORING_TYPES.includes(flooring_type)) {
      return NextResponse.json({ error: "Invalid flooring_type" }, { status: 400 });
    }

    if (source && !VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    // Verify job belongs to user
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", job_id)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Parse dimension expression
    let m2_calculated: number | null = null;
    if (dimension_expr?.trim()) {
      const parsed = parseDimensionExpr(dimension_expr);
      if (parsed.ok) m2_calculated = parsed.m2;
    }

    const { data: area, error } = await supabaseAdmin
      .from("job_areas")
      .insert({
        job_id,
        client_id: user.id,
        building: building?.trim() || null,
        floor: floor?.trim() || null,
        name: name.trim(),
        dimension_expr: dimension_expr?.trim() || null,
        m2_calculated,
        qty: qty ?? 1,
        flooring_type: flooring_type || null,
        product_spec: product_spec?.trim() || null,
        prep_notes: prep_notes?.trim() || null,
        source: source || "manual",
        job_file_id: job_file_id || null,
        notes: notes?.trim() || null,
        sort_order: sort_order ?? 0,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ area });
  } catch (err) {
    console.error("[job-areas POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
