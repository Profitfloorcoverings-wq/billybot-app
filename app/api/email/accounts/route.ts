import { NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

export async function GET() {
  const user = await getUserFromCookies();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();

  const { data, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, provider, email_address, status, last_error, gmail_history_id, ms_subscription_id, ms_subscription_expires_at, created_at, updated_at"
    )
    .eq("client_id", user.id)
    .in("provider", ["google", "microsoft"])
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
