export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { startGmailWatch, type GmailAccount } from "@/lib/email/gmail";
import {
  ensureMicrosoftSubscription,
  type MicrosoftAccount,
} from "@/lib/email/microsoft";
import { createEmailServiceClient } from "@/lib/email/serviceClient";

type WatchdogAccount = {
  id: string;
  client_id: string;
  provider: "google" | "microsoft";
  email_address: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  status: string | null;
  last_error: string | null;
  last_error_at: string | null;
  gmail_history_id: string | null;
  gmail_watch_expires_at: string | null;
  gmail_last_push_at: string | null;
  ms_subscription_id: string | null;
  ms_subscription_expires_at: string | null;
  ms_last_push_at: string | null;
  last_success_at: string | null;
};

const STALE_WINDOW_MS = 6 * 60 * 60 * 1000;
const RENEW_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECOVERY_BACKOFF_MS = 30 * 60 * 1000;

function isAuthorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOBS_TOKEN;
  if (!expected) {
    return false;
  }

  const token = request.headers.get("x-internal-token");
  return token === expected;
}

function isStale(value: string | null | undefined, cutoffMs: number) {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() <= cutoffMs;
}

function shouldRecoverFromStaleSignals(
  lastPushAt: string | null | undefined,
  lastSuccessAt: string | null | undefined,
  staleCutoffMs: number
) {
  return isStale(lastPushAt, staleCutoffMs) && isStale(lastSuccessAt, staleCutoffMs);
}

function getAuthFailureStatus(message: string) {
  const lower = message.toLowerCase();

  if (/revoked|invalid_grant/.test(lower)) {
    return "provider_revoked" as const;
  }

  if (/missing refresh token|invalid refresh token|refresh token|token refresh failed/.test(lower)) {
    return "refresh_failed" as const;
  }

  if (/interaction_required|consent_required|unauthorized|invalid_token/.test(lower)) {
    return "needs_reconnect" as const;
  }

  return null;
}

function getHealthyConnectionStatus(refreshToken: string | null | undefined) {
  return refreshToken ? "ok" : "needs_reconnect";
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();
  const now = Date.now();
  const staleCutoffMs = now - STALE_WINDOW_MS;
  const renewCutoffIso = new Date(now + RENEW_WINDOW_MS).toISOString();

  const { data: accounts, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, status, last_error, last_error_at, gmail_history_id, gmail_watch_expires_at, gmail_last_push_at, ms_subscription_id, ms_subscription_expires_at, ms_last_push_at, last_success_at"
    )
    .eq("status", "connected")
    .in("provider", ["google", "microsoft"]);

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const results: Array<{ accountId: string; provider: string; action: string; status: string }> = [];

  for (const raw of accounts ?? []) {
    const account = raw as WatchdogAccount;

    const inBackoff =
      account.last_error_at &&
      now - new Date(account.last_error_at).getTime() < RECOVERY_BACKOFF_MS;
    if (inBackoff) {
      results.push({
        accountId: account.id,
        provider: account.provider,
        action: "recover",
        status: "skipped_backoff",
      });
      continue;
    }

    const gmailNeedsRenew =
      account.provider === "google" &&
      Boolean(!account.gmail_watch_expires_at || account.gmail_watch_expires_at <= renewCutoffIso);

    const microsoftNeedsRenew =
      account.provider === "microsoft" &&
      Boolean(
        !account.ms_subscription_expires_at ||
          account.ms_subscription_expires_at <= renewCutoffIso
      );

    const gmailStaleFailure =
      account.provider === "google" &&
      shouldRecoverFromStaleSignals(
        account.gmail_last_push_at,
        account.last_success_at,
        staleCutoffMs
      );

    const microsoftStaleFailure =
      account.provider === "microsoft" &&
      shouldRecoverFromStaleSignals(
        account.ms_last_push_at,
        account.last_success_at,
        staleCutoffMs
      );

    try {
      if (gmailNeedsRenew || gmailStaleFailure) {
        const healthyStatus = getHealthyConnectionStatus(account.refresh_token_enc);
        await startGmailWatch(account as GmailAccount, { force: true });
        await serviceClient
          .from("email_accounts")
          .update({
            email_connection_status: healthyStatus,
            last_error: null,
            last_error_at: null,
          })
          .eq("id", account.id);

        results.push({
          accountId: account.id,
          provider: account.provider,
          action: "gmail_rewatch",
          status: "recovered",
        });
        continue;
      }

      if (microsoftNeedsRenew || microsoftStaleFailure) {
        const healthyStatus = getHealthyConnectionStatus(account.refresh_token_enc);
        await ensureMicrosoftSubscription(account as MicrosoftAccount, { force: true });
        await serviceClient
          .from("email_accounts")
          .update({
            email_connection_status: healthyStatus,
            last_error: null,
            last_error_at: null,
          })
          .eq("id", account.id);

        results.push({
          accountId: account.id,
          provider: account.provider,
          action: "ms_resubscribe",
          status: "recovered",
        });
      }
    } catch (recoveryError) {
      const message =
        recoveryError instanceof Error
          ? recoveryError.message
          : "Unknown watchdog recovery error";

      const authFailureStatus = getAuthFailureStatus(message);

      await serviceClient
        .from("email_accounts")
        .update({
          status: "connected",
          last_error: message,
          last_error_at: new Date().toISOString(),
          ...(authFailureStatus
            ? { email_connection_status: authFailureStatus }
            : {}),
        })
        .eq("id", account.id);

      results.push({
        accountId: account.id,
        provider: account.provider,
        action: "recover",
        status: authFailureStatus ? "failed_auth" : "failed_transient",
      });
    }
  }

  // Retry failed/stuck email events
  let retryCount = 0;
  let retryErrors = 0;

  try {
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

    // Find events that errored (under retry limit) or stuck in 'received' for 5+ min
    const { data: retryEvents } = await serviceClient
      .from("email_events")
      .select("id, status, attempts")
      .or(
        `and(status.eq.error,or(attempts.is.null,attempts.lt.3)),and(status.eq.received,created_at.lt.${fiveMinutesAgo})`
      )
      .limit(50);

    if (retryEvents && retryEvents.length > 0) {
      const retryIds = retryEvents.map((e: { id: string }) => e.id);

      const { error: resetError } = await serviceClient
        .from("email_events")
        .update({ status: "received" })
        .in("id", retryIds);

      if (resetError) {
        retryErrors = retryIds.length;
      } else {
        retryCount = retryIds.length;

        // Trigger hydrate to pick up the reset events
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
        const internalToken = process.env.INTERNAL_JOBS_TOKEN;
        if (appUrl && internalToken) {
          fetch(`${appUrl}/api/internal/email-events/hydrate?limit=${retryCount}`, {
            method: "POST",
            headers: { "x-internal-token": internalToken },
          }).catch(() => {
            // Fire-and-forget — hydrate will pick them up on next run regardless
          });
        }
      }
    }
  } catch {
    // Don't let retry failures break the watchdog response
  }

  return NextResponse.json({
    ok: true,
    total: results.length,
    results,
    retry: { reset: retryCount, errors: retryErrors },
  });
}
