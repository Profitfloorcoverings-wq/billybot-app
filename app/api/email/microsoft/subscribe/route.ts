export const runtime = "nodejs";

import { NextResponse } from "next/server";

import {
  ensureMicrosoftSubscription,
  type MicrosoftAccount,
} from "@/lib/email/microsoft";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

export async function POST() {
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
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const updated: Array<{
    accountId: string;
    subscriptionId: string;
    expiresAt: string;
    status: "ok" | "error";
  }> = [];

  for (const account of (accounts ?? []) as MicrosoftAccount[]) {
    try {
      const subscription = await ensureMicrosoftSubscription(account);
      updated.push({
        accountId: account.id,
        subscriptionId: subscription.id,
        expiresAt: subscription.expiresAt,
        status: "ok",
      });
    } catch (error) {
      console.error("Failed to ensure Microsoft subscription", error);
      updated.push({
        accountId: account.id,
        subscriptionId: account.ms_subscription_id ?? "",
        expiresAt: account.ms_subscription_expires_at ?? "",
        status: "error",
      });
    }
  }

  return NextResponse.json({ ok: true, updated });
}
