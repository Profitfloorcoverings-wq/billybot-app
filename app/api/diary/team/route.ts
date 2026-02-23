/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(_req: Request) {
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

  const { data: members, error } = await (supabase as any)
    .from("team_members")
    .select("id, member_id, role, invite_email, invite_status")
    .eq("business_id", businessId)
    .eq("invite_status", "accepted")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[diary/team] GET error", error);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }

  const result: any[] = members ?? [];
  if (result.length > 0) {
    const memberIds = result.map((m: any) => m.member_id as string);
    const { data: clientProfiles } = await supabase
      .from("clients")
      .select("id, business_name")
      .in("id", memberIds);

    const nameMap = new Map(
      ((clientProfiles as any[]) ?? []).map((c: any) => [c.id as string, c.business_name as string | null])
    );
    result.forEach((m: any) => {
      m.name = nameMap.get(m.member_id) ?? m.invite_email;
    });
  }

  return NextResponse.json({ members: result });
}
