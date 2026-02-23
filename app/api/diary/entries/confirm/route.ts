/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";
import { confirmDiaryEntrySideEffects } from "@/lib/diary/confirmSideEffects";
import type { DiaryConfirmationPayload, DiaryEntry } from "@/types/diary";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Resolve business_id
  const { data: profile } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();

  const businessId =
    (profile as any)?.user_role !== "owner" && (profile as any)?.parent_client_id
      ? (profile as any).parent_client_id as string
      : userId;

  const body = await req.json();
  const { entry_id, confirmation_data } = body as {
    entry_id?: string;
    confirmation_data?: DiaryConfirmationPayload;
  };

  if (!entry_id) {
    return NextResponse.json({ error: "entry_id is required" }, { status: 400 });
  }

  // Verify entry belongs to business and is pending
  const { data: existing } = await (supabase as any)
    .from("diary_entries")
    .select("id, status")
    .eq("id", entry_id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if ((existing as any).status === "confirmed") {
    return NextResponse.json({ error: "Entry is already confirmed" }, { status: 400 });
  }

  if ((existing as any).status === "cancelled") {
    return NextResponse.json({ error: "Cannot confirm a cancelled entry" }, { status: 400 });
  }

  // Build update from confirmation_data
  const updates: Record<string, unknown> = { status: "confirmed" };

  if (confirmation_data) {
    if (confirmation_data.title) updates.title = confirmation_data.title;
    if (confirmation_data.entry_type) updates.entry_type = confirmation_data.entry_type;
    if (confirmation_data.start_datetime) updates.start_datetime = confirmation_data.start_datetime;
    if (confirmation_data.end_datetime) updates.end_datetime = confirmation_data.end_datetime;
    updates.customer_name = confirmation_data.customer_name ?? null;
    updates.customer_email = confirmation_data.customer_email ?? null;
    updates.customer_phone = confirmation_data.customer_phone ?? null;
    updates.job_address = confirmation_data.job_address ?? null;
    updates.postcode = confirmation_data.postcode ?? null;
    updates.notes = confirmation_data.notes ?? null;
    if (confirmation_data.job_id !== undefined) updates.job_id = confirmation_data.job_id ?? null;
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("diary_entries")
    .update(updates)
    .eq("id", entry_id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("[diary/confirm] update error", updateError);
    return NextResponse.json({ error: "Failed to confirm entry" }, { status: 500 });
  }

  const fitterIds =
    confirmation_data?.fitter_ids && Array.isArray(confirmation_data.fitter_ids)
      ? confirmation_data.fitter_ids
      : [];

  await confirmDiaryEntrySideEffects(updated as DiaryEntry, fitterIds);

  return NextResponse.json({ success: true, entry: updated });
}
