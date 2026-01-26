export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { renewMicrosoftSubscription, type MicrosoftAccount } from "@/lib/email/microsoft";

function isAuthorized(request: NextRequest) {
  const expected =
    process.env.INTERNAL_CRON_SECRET ??
    process.env.MICROSOFT_WEBHOOK_VALIDATION_TOKEN;

  if (!expected) {
    return false;
  }

  const token = request.headers.get("x-internal-token");
  return token === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();
  const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, ms_subscription_id, ms_subscription_expires_at"
    )
    .eq("provider", "microsoft")
    .lte("ms_subscription_expires_at", cutoff);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const results: Array<{ accountId: string; status: string }> = [];

  for (const account of (accounts ?? []) as MicrosoftAccount[]) {
    try {
      await renewMicrosoftSubscription(account);
      results.push({ accountId: account.id, status: "renewed" });
    } catch (renewError) {
      console.error("Failed to renew Microsoft subscription", renewError);
      results.push({ accountId: account.id, status: "error" });
    }
  }

  return NextResponse.json({ ok: true, results });
}
