import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(_req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  // Resolve business_id
  const { data: profile } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();

  const businessId =
    profile?.user_role !== "owner" && profile?.parent_client_id
      ? profile.parent_client_id
      : userId;

  const { data: members, error } = await supabase
    .from("team_members")
    .select("id, member_id, role, invite_email, invite_status")
    .eq("business_id", businessId)
    .eq("invite_status", "accepted")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[diary/team] GET error", error);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }

  const result = members ?? [];
  if (result.length > 0) {
    const memberIds = result.map((m) => m.member_id);
    const { data: clientProfiles } = await supabase
      .from("clients")
      .select("id, business_name")
      .in("id", memberIds);

    const nameMap = new Map(
      (clientProfiles ?? []).map((c) => [c.id, c.business_name])
    );
    (result as (typeof result[number] & { name?: string | null })[]).forEach((m) => {
      m.name = nameMap.get(m.member_id) ?? m.invite_email;
    });
  }

  return NextResponse.json({ members: result });
}
