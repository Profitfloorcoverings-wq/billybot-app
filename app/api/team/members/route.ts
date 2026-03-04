import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import type { TeamInvite, TeamMember } from "@/types/team";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  const cookieStore = await cookies();

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", user.id)
    .maybeSingle();

  const userRole: string = profile?.user_role ?? "owner";

  if (userRole !== "owner" && userRole !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let businessId = user.id;
  if (userRole === "manager" && profile?.parent_client_id) {
    businessId = profile.parent_client_id;
  }

  // Fetch team members
  const { data: rawMembers } = await supabase
    .from("team_members")
    .select("id, business_id, member_id, role, invite_email, invite_status, created_at, accepted_at, invited_by")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  const members: TeamMember[] = (rawMembers ?? []) as TeamMember[];

  // Enrich with client names
  if (members.length > 0) {
    const memberIds = members.map((m) => m.member_id);
    const { data: clientProfiles } = await supabase
      .from("clients")
      .select("id, business_name, email")
      .in("id", memberIds);

    const profileMap = new Map((clientProfiles ?? []).map((p) => [p.id, p]));
    members.forEach((m) => {
      const p = profileMap.get(m.member_id);
      if (p) {
        m.name = p.business_name ?? null;
        m.email = p.email ?? null;
      }
    });
  }

  // Fetch pending invites
  const { data: rawInvites } = await supabase
    .from("team_invites")
    .select("id, invite_email, name, role, expires_at, used_at, created_at")
    .eq("business_id", businessId)
    .is("used_at", null)
    .order("created_at", { ascending: false });

  const invites: TeamInvite[] = (rawInvites ?? []).map((inv) => ({
    ...inv,
    invite_token: "",
    business_id: businessId,
    invited_by: user.id,
  }));

  return NextResponse.json({ members, invites, userRole });
}
