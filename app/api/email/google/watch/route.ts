export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { startGmailWatch, type GmailAccount } from "@/lib/email/gmail";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

type WatchResponse = {
  ok: true;
  updated: Array<{
    id: string;
    email_address: string;
    gmail_history_id: string | null;
  }>;
};

function isAuthorized(request: NextRequest) {
  const expected = process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN;
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
      "id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, gmail_history_id, gmail_watch_expires_at, gmail_last_push_at, last_success_at"
    )
    .eq("client_id", user.id)
    .eq("provider", "google")
    .returns<GmailAccount[]>();

  if (error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const updated = await Promise.all(
    accounts.map(async (account) => {
      const watch = await startGmailWatch(account);
      const historyId = watch.historyId;
      const { data: refreshed } = await serviceClient
        .from("email_accounts")
        .select("id, email_address, gmail_history_id")
        .eq("id", account.id)
        .maybeSingle<{
          id: string;
          email_address: string;
          gmail_history_id: string | null;
        }>();

      if (historyId && refreshed && refreshed.gmail_history_id !== historyId) {
        await serviceClient
          .from("email_accounts")
          .update({ gmail_history_id: historyId })
          .eq("id", account.id);
        return {
          ...refreshed,
          gmail_history_id: historyId,
        };
      }

      return {
        id: account.id,
        email_address: account.email_address,
        gmail_history_id: historyId ?? account.gmail_history_id ?? null,
      };
    })
  );

  return NextResponse.json({ ok: true, updated } satisfies WatchResponse);
}
