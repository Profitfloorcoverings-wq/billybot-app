import { NextRequest, NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

type SocialAccountRow = {
  id: string;
  platform: string;
  platform_page_id: string | null;
  platform_page_name: string | null;
  platform_user_id: string | null;
  status: string;
  last_error: string | null;
  last_post_at: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();

  const { data, error } = await (serviceClient as unknown as { from: (t: string) => any })
    .from("social_accounts")
    .select(
      "id, platform, platform_page_id, platform_page_name, platform_user_id, status, last_error, last_post_at, token_expires_at, created_at, updated_at"
    )
    .eq("client_id", user.id)
    .neq("status", "disconnected")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accounts = ((data ?? []) as SocialAccountRow[]).map((account) => {
    let effectiveStatus = account.status;
    if (
      account.status === "connected" &&
      account.token_expires_at &&
      new Date(account.token_expires_at) < new Date()
    ) {
      effectiveStatus = "needs_reauth";
    }
    return { ...account, effective_status: effectiveStatus };
  });

  return NextResponse.json({ data: accounts });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { account_id?: string; platform?: string };
  const { account_id, platform } = body;

  if (!account_id && !platform) {
    return NextResponse.json({ error: "account_id or platform required" }, { status: 400 });
  }

  const serviceClient = createEmailServiceClient();
  const db = serviceClient as unknown as { from: (t: string) => any };

  let query = db
    .from("social_accounts")
    .update({ status: "disconnected", updated_at: new Date().toISOString() })
    .eq("client_id", user.id);

  if (account_id) {
    query = query.eq("id", account_id);
  } else if (platform) {
    query = query.eq("platform", platform);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
