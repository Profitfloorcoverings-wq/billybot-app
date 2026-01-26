export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { encryptToken } from "@/lib/email/crypto";
import { MICROSOFT_OAUTH_SCOPES } from "@/lib/email/microsoftScopes";
import { parseScopeString } from "@/lib/email/scopes";
import { getUserFromCookies } from "@/utils/supabase/auth";

type MicrosoftTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

type MicrosoftProfileResponse = {
  mail?: string;
  userPrincipalName?: string;
};

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
  const stateCookie = request.cookies.get("bb_microsoft_oauth_state")?.value;

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

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !tenant || !appUrl) {
    return redirectToError("missing_config");
  }

  const redirectUri = new URL("/api/email/microsoft/callback", appUrl).toString();
  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  } satisfies Record<string, string>);

  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    return redirectToError("token_exchange_failed");
  }

  const tokenData = (await tokenResponse.json()) as MicrosoftTokenResponse;
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return redirectToError("missing_access_token");
  }

  const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!profileResponse.ok) {
    return redirectToError("profile_fetch_failed");
  }

  const profile = (await profileResponse.json()) as MicrosoftProfileResponse;
  const emailAddress = profile.mail ?? profile.userPrincipalName;

  if (!emailAddress) {
    return redirectToError("missing_email");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return redirectToError("missing_supabase_config");
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingAccount } = await serviceClient
    .from("email_accounts")
    .select("refresh_token_enc")
    .eq("client_id", user.id)
    .eq("provider", "microsoft")
    .eq("email_address", emailAddress)
    .maybeSingle();

  const accessTokenEnc = encryptToken(accessToken);
  const refreshTokenEnc = tokenData.refresh_token
    ? encryptToken(tokenData.refresh_token)
    : existingAccount?.refresh_token_enc ?? null;

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const scopes = parseScopeString(tokenData.scope, MICROSOFT_OAUTH_SCOPES);

  const { error } = await serviceClient.from("email_accounts").upsert(
    {
      client_id: user.id,
      provider: "microsoft",
      email_address: emailAddress,
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      expires_at: expiresAt,
      scopes,
      status: "connected",
      last_error: null,
    },
    { onConflict: "client_id,provider,email_address" }
  );

  if (error) {
    return redirectToError("db_write_failed");
  }

  const response = NextResponse.redirect(
    buildRedirectUrl("/account", { email_connected: "microsoft" })
  );
  response.cookies.set("bb_microsoft_oauth_state", "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: "/",
  });

  return response;
}
