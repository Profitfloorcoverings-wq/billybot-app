/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function getOwnerBusinessId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("clients")
    .select("user_role")
    .eq("id", userId)
    .maybeSingle();

  if ((data as any)?.user_role === "owner") return userId;
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const businessId = await getOwnerBusinessId(supabase, userId);
  if (!businessId) {
    return NextResponse.json({ error: "Only owners can manage team members" }, { status: 403 });
  }

  const body = await req.json();
  const { role, invite_status } = body as { role?: string; invite_status?: string };

  if (role && !["manager", "fitter", "estimator"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (invite_status && !["accepted", "revoked"].includes(invite_status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (role) updates.role = role;
  if (invite_status) updates.invite_status = invite_status;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await (supabase as any)
    .from("team_members")
    .update(updates)
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) {
    console.error("[team/members/[id]] patch error", error);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }

  return NextResponse.json({ success: true, member: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const businessId = await getOwnerBusinessId(supabase, userId);
  if (!businessId) {
    return NextResponse.json({ error: "Only owners can remove team members" }, { status: 403 });
  }

  const { error } = await (supabase as any)
    .from("team_members")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) {
    console.error("[team/members/[id]] delete error", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
