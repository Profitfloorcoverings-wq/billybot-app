export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { renewMicrosoftSubscription, type MicrosoftAccount } from "@/lib/email/microsoft";

function isAuthorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOBS_TOKEN;

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
  const cutoff = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, status, last_error, ms_subscription_id, ms_subscription_expires_at, ms_last_push_at, last_success_at"
    )
    .eq("provider", "microsoft")
    .not("ms_subscription_id", "is", null)
    .lte("ms_subscription_expires_at", cutoff);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const results: Array<{ accountId: string; status: string }> = [];
  let renewed = 0;
  let recreated = 0;
  let failed = 0;

  for (const account of (accounts ?? []) as MicrosoftAccount[]) {
    try {
      const result = await renewMicrosoftSubscription(account);
      if (result.id !== account.ms_subscription_id) {
        recreated += 1;
        results.push({ accountId: account.id, status: "recreated" });
      } else {
        renewed += 1;
        results.push({ accountId: account.id, status: "renewed" });
      }
    } catch (renewError) {
      console.error("Failed to renew Microsoft subscription", renewError);
      failed += 1;
      results.push({ accountId: account.id, status: "error" });
    }
  }

  return NextResponse.json({
    ok: true,
    summary: {
      total: results.length,
      renewed,
      recreated,
      failed,
    },
    results,
  });
}
