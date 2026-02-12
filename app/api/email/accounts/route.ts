import { NextResponse } from "next/server";

import {
  computeEmailConnectionStatus,
  type EmailConnectionStatus,
} from "@/lib/email/accountState";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

type EmailAccountRow = {
  id: string;
  provider: "google" | "microsoft";
  email_address: string;
  status: string | null;
  last_error: string | null;
  gmail_history_id: string | null;
  gmail_watch_expires_at: string | null;
  gmail_last_push_at: string | null;
  ms_subscription_id: string | null;
  ms_subscription_expires_at: string | null;
  ms_last_push_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  email_connection_status: EmailConnectionStatus | null;
  refresh_token_enc?: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const user = await getUserFromCookies();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();

  const { data, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, provider, email_address, status, last_error, gmail_history_id, gmail_watch_expires_at, gmail_last_push_at, ms_subscription_id, ms_subscription_expires_at, ms_last_push_at, last_success_at, last_error_at, email_connection_status, refresh_token_enc, created_at, updated_at"
    )
    .eq("client_id", user.id)
    .in("provider", ["google", "microsoft"])
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = ((data ?? []) as EmailAccountRow[]).map((account) => ({
    ...account,
    email_connection_status:
      account.email_connection_status ?? computeEmailConnectionStatus(account),
  }));

  return NextResponse.json({ data: normalized });
}
