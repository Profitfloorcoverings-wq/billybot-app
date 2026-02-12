import "server-only";

import { createEmailServiceClient } from "@/lib/email/serviceClient";

export type EmailConnectionStatus =
  | "ok"
  | "needs_reconnect"
  | "watch_expired"
  | "subscription_expired"
  | "refresh_failed"
  | "provider_revoked"
  | "inactive";

type EmailAccountState = {
  provider: "google" | "microsoft";
  status: string | null;
  refresh_token_enc?: string | null;
  gmail_watch_expires_at?: string | null;
  ms_subscription_expires_at?: string | null;
  last_error?: string | null;
};

export function computeEmailConnectionStatus(account: EmailAccountState): EmailConnectionStatus {
  if (account.status === "disconnected") {
    return "inactive";
  }

  const lastError = (account.last_error ?? "").toLowerCase();
  if (
    /revoked|invalid_grant/.test(lastError)
  ) {
    return "provider_revoked";
  }

  if (/interaction_required|consent_required/.test(lastError)) {
    return "needs_reconnect";
  }

  if (/refresh token|token refresh failed|missing refresh token|invalid refresh token/.test(lastError)) {
    return "refresh_failed";
  }

  if (!account.refresh_token_enc && account.status === "connected") {
    return "needs_reconnect";
  }

  if (account.provider === "google" && account.gmail_watch_expires_at) {
    if (new Date(account.gmail_watch_expires_at).getTime() <= Date.now()) {
      return "watch_expired";
    }
  }

  if (account.provider === "microsoft" && account.ms_subscription_expires_at) {
    if (new Date(account.ms_subscription_expires_at).getTime() <= Date.now()) {
      return "subscription_expired";
    }
  }

  return account.status === "connected" ? "ok" : "inactive";
}

export async function markAccountStatus(
  accountId: string,
  status: string,
  lastError?: string | null,
  connectionStatus?: EmailConnectionStatus
) {
  const serviceClient = createEmailServiceClient();
  await serviceClient
    .from("email_accounts")
    .update({
      status,
      ...(lastError !== undefined
        ? {
            last_error: lastError,
            last_error_at: lastError ? new Date().toISOString() : null,
          }
        : {}),
      ...(connectionStatus ? { email_connection_status: connectionStatus } : {}),
    })
    .eq("id", accountId);
}
