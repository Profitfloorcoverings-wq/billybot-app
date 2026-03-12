import { NextResponse } from "next/server";

import { getUserFromCookies } from "@/utils/supabase/auth";
import { createServerClient } from "@/utils/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = await createServerClient();

  // Fetch current job + verify ownership
  const { data: job, error: fetchError } = await supabase
    .from("jobs")
    .select("id, metadata")
    .eq("id", id)
    .eq("client_id", user.id)
    .maybeSingle();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Deep-merge tender key into existing metadata
  const currentMetadata = (job.metadata as Record<string, unknown>) || {};
  const currentTender = (currentMetadata.tender as Record<string, unknown>) || {};
  const mergedTender = { ...currentTender, ...body };
  const newMetadata = { ...currentMetadata, tender: mergedTender };

  const { data: updated, error: updateError } = await supabase
    .from("jobs")
    .update({ metadata: newMetadata })
    .eq("id", id)
    .eq("client_id", user.id)
    .select("id, metadata")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Unable to update tender" }, { status: 500 });
  }

  return NextResponse.json({ tender: (updated.metadata as Record<string, unknown>).tender });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createServerClient();

  const { data: job, error } = await supabase
    .from("jobs")
    .select("id, metadata")
    .eq("id", id)
    .eq("client_id", user.id)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const metadata = (job.metadata as Record<string, unknown>) || {};
  return NextResponse.json({ tender: metadata.tender || null });
}
