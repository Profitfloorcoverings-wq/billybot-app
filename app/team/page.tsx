import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

import InviteForm from "./components/InviteForm";
import TeamMemberList from "./components/TeamMemberList";
import type { TeamInvite, TeamMember } from "@/types/team";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function TeamPage() {
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

  if (!user) redirect("/auth/login");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", user.id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userRole: string = (profile as any)?.user_role ?? "owner";

  // Only owners and managers can access team page
  if (userRole !== "owner" && userRole !== "manager") {
    redirect("/chat");
  }

  // Determine business_id
  let businessId = user.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (userRole === "manager" && (profile as any)?.parent_client_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    businessId = (profile as any).parent_client_id as string;
  }

  // Fetch team members with client names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawMembers } = await (supabase as any)
    .from("team_members")
    .select("id, business_id, member_id, role, invite_email, invite_status, created_at, accepted_at, invited_by")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: TeamMember[] = (rawMembers ?? []) as any[];

  // Enrich with client names
  if (members.length > 0) {
    const memberIds = members.map((m) => m.member_id);
    const { data: clientProfiles } = await supabase
      .from("clients")
      .select("id, business_name, email")
      .in("id", memberIds);

    const profileMap = new Map(
      (clientProfiles ?? []).map((p) => [p.id, p])
    );
    members.forEach((m) => {
      const p = profileMap.get(m.member_id);
      if (p) {
        m.name = p.business_name ?? null;
        m.email = p.email ?? null;
      }
    });
  }

  // Fetch pending invites
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawInvites } = await (supabase as any)
    .from("team_invites")
    .select("id, invite_email, name, role, expires_at, used_at, created_at")
    .eq("business_id", businessId)
    .is("used_at", null)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invites: TeamInvite[] = ((rawInvites ?? []) as any[]).map((inv: any) => ({
    ...inv,
    invite_token: "",
    business_id: businessId,
    invited_by: user.id,
  }));

  return (
    <div className="page-container">
      <header className="section-header">
        <h1 className="section-title">Team</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Invite fitters, managers and estimators to your BillyBot account.
        </p>
      </header>

      <div className="space-y-8 mt-6">
        <section>
          <h2 className="text-base font-semibold text-[var(--text)] mb-4">Invite a team member</h2>
          <InviteForm />
        </section>

        {members.length > 0 || invites.length > 0 ? (
          <section>
            <h2 className="text-base font-semibold text-[var(--text)] mb-4">
              Team members ({members.length})
            </h2>
            <TeamMemberList members={members} pendingInvites={invites} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
