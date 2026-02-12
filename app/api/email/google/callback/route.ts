export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { encryptToken } from "@/lib/email/crypto";
import { startGmailWatch, type GmailAccount } from "@/lib/email/gmail";
import { GOOGLE_GMAIL_SCOPES, parseScopeString } from "@/lib/email/scopes";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

function buildRedirectUrl(path: string, query?: Record<string, string>) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required");
  }

  const url = new URL(path, appUrl);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return url.toString();
}

function redirectToError(reason: string) {
  return NextResponse.redirect(
    buildRedirectUrl("/account", { email_error: reason })
  );
}

export async function GET(request: NextRequest) {
  const stateParam = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("bb_google_oauth_state")?.value;

  if (!stateParam || !stateCookie || stateParam !== stateCookie) {
    return redirectToError("state_mismatch");
  }

  const oauthError = request.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectToError("oauth_error");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return redirectToError("missing_code");
  }

  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.redirect(
      buildRedirectUrl("/auth", { message: "login_required" })
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return redirectToError("missing_config");
  }

  const redirectUri = new URL("/api/email/google/callback", appUrl).toString();

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    return redirectToError("token_exchange_failed");
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return redirectToError("missing_access_token");
  }

  const profileResponse = await fetch(GOOGLE_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    return redirectToError("profile_fetch_failed");
  }

  const profile = (await profileResponse.json()) as GmailProfileResponse;
  const emailAddress = profile.emailAddress;

  if (!emailAddress) {
    return redirectToError("missing_email");
  }

  const serviceClient = createEmailServiceClient();

  const { data: existingAccount } = await serviceClient
    .from("email_accounts")
    .select("refresh_token_enc")
    .eq("client_id", user.id)
    .eq("provider", "google")
    .eq("email_address", emailAddress)
    .maybeSingle();

  const accessTokenEnc = encryptToken(accessToken);
  const refreshTokenEnc = tokenData.refresh_token
    ? encryptToken(tokenData.refresh_token)
    : existingAccount?.refresh_token_enc ?? null;

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const scopes = parseScopeString(tokenData.scope, GOOGLE_GMAIL_SCOPES);

  const { data: account, error } = await serviceClient
    .from("email_accounts")
    .upsert(
      {
        client_id: user.id,
        provider: "google",
        email_address: emailAddress,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        expires_at: expiresAt,
        scopes,
        status: "connected",
        last_error: null,
      },
      { onConflict: "client_id,provider,email_address" }
    )
    .select(
      "id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, gmail_history_id, gmail_watch_expires_at, gmail_last_push_at, last_success_at"
    )
    .maybeSingle<GmailAccount>();

  if (error || !account) {
    return redirectToError("db_write_failed");
  }

  try {
    await startGmailWatch(account, { force: true });
  } catch (watchError) {
    console.error("Failed to start Gmail watch", watchError);
  }

  const response = NextResponse.redirect(
    buildRedirectUrl("/account", { email_connected: "google" })
  );
  response.cookies.set("bb_google_oauth_state", "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: "/",
  });

  return response;
}
