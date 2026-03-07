import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDimensionExpr } from "@/lib/jobs/parseDimensionExpr";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AreaInput = {
  building?: string;
  floor?: string;
  name: string;
  dimension_expr?: string;
  qty?: number;
  flooring_type?: string;
  product_spec?: string;
  prep_notes?: string;
  source?: string;
  job_file_id?: string;
  notes?: string;
};

type EstimatorPayload = {
  job_id: string;
  client_id: string;
  areas: AreaInput[];
  replace_existing?: boolean;
};

/**
 * POST /api/job-areas/from-estimator
 * Called by N8N to bulk-insert areas extracted from tender documents.
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

    const body = (await request.json()) as EstimatorPayload;
    const { job_id, client_id, areas, replace_existing } = body;

    if (!job_id || !client_id || !areas?.length) {
      return NextResponse.json(
        { error: "job_id, client_id, and areas[] required" },
        { status: 400 }
      );
    }

    // If replace_existing, delete previous ai_extracted rows for this job
    if (replace_existing) {
      await supabaseAdmin
        .from("job_areas")
        .delete()
        .eq("job_id", job_id)
        .eq("client_id", client_id)
        .eq("source", "ai_extracted");
    }

    // Build rows with parsed m2
    const rows = areas.map((area, i) => {
      let m2_calculated: number | null = null;
      if (area.dimension_expr?.trim()) {
        const parsed = parseDimensionExpr(area.dimension_expr);
        if (parsed.ok) m2_calculated = parsed.m2;
      }

      return {
        job_id,
        client_id,
        building: area.building?.trim() || null,
        floor: area.floor?.trim() || null,
        name: area.name?.trim() || `Area ${i + 1}`,
        dimension_expr: area.dimension_expr?.trim() || null,
        m2_calculated,
        qty: area.qty ?? 1,
        flooring_type: area.flooring_type || null,
        product_spec: area.product_spec?.trim() || null,
        prep_notes: area.prep_notes?.trim() || null,
        source: area.source || "ai_extracted",
        job_file_id: area.job_file_id || null,
        notes: area.notes?.trim() || null,
        sort_order: i,
      };
    });

    const { data: inserted, error } = await supabaseAdmin
      .from("job_areas")
      .insert(rows)
      .select();

    if (error) {
      console.error("[job-areas/from-estimator insert]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ areas: inserted, count: inserted?.length ?? 0 });
  } catch (err) {
    console.error("[job-areas/from-estimator POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
