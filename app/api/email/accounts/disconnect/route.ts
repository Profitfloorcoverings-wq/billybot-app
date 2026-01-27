import { NextRequest, NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

const PROVIDERS = ["google", "microsoft"] as const;

type Provider = (typeof PROVIDERS)[number];

type DisconnectBody = {
  provider?: Provider;
};

export async function POST(request: NextRequest) {
  const user = await getUserFromCookies();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as DisconnectBody;
  const provider = body.provider;

  if (!provider || !PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const serviceClient = createEmailServiceClient();

  const updatePayload: Record<string, string | null> = {
    status: "disconnected",
    last_error: null,
    access_token_enc: null,
    refresh_token_enc: null,
    expires_at: null,
    scopes: "{}",
    gmail_history_id: null,
    ms_subscription_id: null,
    ms_subscription_expires_at: null,
  };

  const { error } = await serviceClient
    .from("email_accounts")
    .update(updatePayload)
    .eq("client_id", user.id)
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
