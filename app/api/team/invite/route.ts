/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nTeamInviteWebhook = process.env.N8N_TEAM_INVITE_WEBHOOK_URL;
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.billybot.ai";

export async function POST(req: Request) {
  const user = await getUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify caller is owner or manager
  const { data: callerProfile } = await supabase
    .from("clients")
    .select("user_role")
    .eq("id", user.id)
    .maybeSingle();

  const callerRole: string = (callerProfile as any)?.user_role ?? "owner";
  if (callerRole !== "owner" && callerRole !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Determine the business_id (owners are their own business_id; managers look up their business)
  let businessId = user.id;
  if (callerRole === "manager") {
    const { data: memberRow } = await (supabase as any)
      .from("team_members")
      .select("business_id")
      .eq("member_id", user.id)
      .eq("invite_status", "accepted")
      .maybeSingle();
    if (!memberRow) {
      return NextResponse.json({ error: "Business not found" }, { status: 400 });
    }
    businessId = (memberRow as any).business_id as string;
  }

  const body = await req.json();
  const { name, email, role } = body as { name?: string; email?: string; role?: string };

  if (!name || !email || !role) {
    return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
  }
  if (!["manager", "fitter", "estimator"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data: invite, error: insertError } = await (supabase as any)
    .from("team_invites")
    .insert({
      business_id: businessId,
      invite_email: email.toLowerCase().trim(),
      name: name.trim(),
      role,
      invited_by: user.id,
    })
    .select("id, invite_token")
    .single();

  if (insertError) {
    console.error("[team/invite] insert error", insertError);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  const inviteLink = `${appUrl}/account/accept-invite?token=${(invite as any).invite_token}`;

  // Fire N8N webhook to send branded email (non-blocking)
  if (n8nTeamInviteWebhook) {
    fetch(n8nTeamInviteWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_id: (invite as any).id,
        business_id: businessId,
        invite_email: email.toLowerCase().trim(),
        name: name.trim(),
        role,
        invite_link: inviteLink,
        invited_by: user.id,
        business_name: user.business_name,
      }),
    }).catch((err) => console.error("[team/invite] N8N webhook error", err));
  }

  return NextResponse.json({ success: true, invite_id: (invite as any).id });
}
