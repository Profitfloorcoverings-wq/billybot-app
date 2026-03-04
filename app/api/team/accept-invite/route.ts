import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  const body = await req.json();
  const { invite_token, password } = body as { invite_token?: string; password?: string };

  if (!invite_token || !password) {
    return NextResponse.json({ error: "invite_token and password are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  // Validate invite
  const { data: invite, error: inviteError } = await supabase
    .from("team_invites")
    .select("id, business_id, invite_email, name, role, expires_at, used_at")
    .eq("invite_token", invite_token)
    .maybeSingle();

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 400 });
  }

  if (invite.used_at) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
  }

  // Create the auth user
  const { data: authData, error: createUserError } = await supabase.auth.admin.createUser({
    email: invite.invite_email,
    password,
    email_confirm: true,
  });

  if (createUserError || !authData.user) {
    console.error("[team/accept-invite] createUser error", createUserError);
    if (createUserError?.message?.includes("already")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  const newUserId = authData.user.id;

  const { error: clientInsertError } = await supabase.from("clients").insert({
    id: newUserId,
    email: invite.invite_email,
    business_name: invite.name,
    user_role: invite.role,
    parent_client_id: invite.business_id,
    is_onboarded: true,
    terms_accepted: true,
  });

  if (clientInsertError) {
    console.error("[team/accept-invite] client insert error", clientInsertError);
    await supabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
  }

  // Insert team_members row
  const { error: memberInsertError } = await supabase
    .from("team_members")
    .insert({
      business_id: invite.business_id,
      member_id: newUserId,
      name: invite.name,
      role: invite.role,
      invite_email: invite.invite_email,
      invite_status: "accepted",
      invited_by: invite.business_id,
      accepted_at: new Date().toISOString(),
    });

  if (memberInsertError) {
    console.error("[team/accept-invite] team_members insert error", memberInsertError);
    await supabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: "Failed to set up team membership" }, { status: 500 });
  }

  // Mark invite as used
  await supabase
    .from("team_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ success: true });
}
