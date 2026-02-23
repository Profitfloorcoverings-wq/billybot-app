/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";
import { confirmDiaryEntrySideEffects } from "@/lib/diary/confirmSideEffects";
import type { DiaryEntry } from "@/types/diary";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function resolveBusinessId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();
  if ((data as any)?.user_role !== "owner" && (data as any)?.parent_client_id) {
    return (data as any).parent_client_id as string;
  }
  return userId;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const businessId = await resolveBusinessId(supabase, userId);

  const { data: entry, error } = await (supabase as any)
    .from("diary_entries")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const businessId = await resolveBusinessId(supabase, userId);

  // Only owner/manager can update
  const { data: profile } = await supabase
    .from("clients")
    .select("user_role")
    .eq("id", userId)
    .maybeSingle();

  if ((profile as any)?.user_role === "fitter") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Verify entry belongs to business
  const { data: existing } = await (supabase as any)
    .from("diary_entries")
    .select("id, status, entry_type, customer_name, start_datetime")
    .eq("id", id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const allowedFields = [
    "title",
    "entry_type",
    "status",
    "start_datetime",
    "end_datetime",
    "customer_name",
    "customer_email",
    "customer_phone",
    "job_address",
    "postcode",
    "notes",
    "job_id",
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from("diary_entries")
    .update(updates)
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (updateError || !updated) {
    console.error("[diary/entries/[id]] PATCH error", updateError);
    return NextResponse.json({ error: "Failed to update entry" }, { status: 500 });
  }

  // If transitioning to confirmed, run side effects
  if (updates.status === "confirmed" && (existing as any).status !== "confirmed") {
    const fitterIds = Array.isArray(body.fitter_ids) ? (body.fitter_ids as string[]) : [];
    await confirmDiaryEntrySideEffects(updated as DiaryEntry, fitterIds);
  }

  return NextResponse.json({ success: true, entry: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Only owners can delete
  const { data: profile } = await supabase
    .from("clients")
    .select("user_role")
    .eq("id", userId)
    .maybeSingle();

  if ((profile as any)?.user_role !== "owner") {
    return NextResponse.json({ error: "Only owners can delete diary entries" }, { status: 403 });
  }

  const { error } = await (supabase as any)
    .from("diary_entries")
    .delete()
    .eq("id", id)
    .eq("business_id", userId);

  if (error) {
    console.error("[diary/entries/[id]] DELETE error", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
