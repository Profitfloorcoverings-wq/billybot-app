export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  ensureMicrosoftSubscription,
  type MicrosoftAccount,
} from "@/lib/email/microsoft";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

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

  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();
  const { data: accounts, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, ms_subscription_id, ms_subscription_expires_at"
    )
    .eq("client_id", user.id)
    .eq("provider", "microsoft");

  if (error) {
    console.error("Microsoft subscribe query failed");
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  let hadFailure = false;
  let failureMessage = "";
  for (const account of (accounts ?? []) as MicrosoftAccount[]) {
    try {
      await ensureMicrosoftSubscription(account);
    } catch (error) {
      hadFailure = true;
      if (!failureMessage) {
        failureMessage =
          error instanceof Error
            ? error.message
            : "Unknown subscription error";
      }
    }
  }

  if (hadFailure) {
    console.error("Microsoft subscribe failed", {
      message: failureMessage || "Unknown subscription error",
    });
    return NextResponse.json({ error: "subscription_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
