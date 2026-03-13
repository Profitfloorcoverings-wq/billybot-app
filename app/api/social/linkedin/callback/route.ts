export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { encryptToken } from "@/lib/email/crypto";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

type LinkedInTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

type LinkedInProfileResponse = {
  sub?: string;
  name?: string;
};

function buildRedirectUrl(path: string, query?: Record<string, string>) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required");

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
    buildRedirectUrl("/account", { tab: "integrations", social_error: reason })
  );
}

export async function GET(request: NextRequest) {
  const stateParam = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("bb_li_oauth_state")?.value;

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

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return redirectToError("missing_config");
  }

  const redirectUri = new URL("/api/social/linkedin/callback", appUrl).toString();

  // Exchange code for token
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenResponse.ok) {
    return redirectToError("token_exchange_failed");
  }

  const tokenData = (await tokenResponse.json()) as LinkedInTokenResponse;
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return redirectToError("missing_access_token");
  }

  // Fetch profile via OpenID userinfo
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileResponse.ok) {
    return redirectToError("profile_fetch_failed");
  }

  const profile = (await profileResponse.json()) as LinkedInProfileResponse;
  const linkedInUserId = profile.sub;
  const displayName = profile.name ?? "LinkedIn";

  if (!linkedInUserId) {
    return redirectToError("missing_profile_id");
  }

  const serviceClient = createEmailServiceClient() as unknown as { from: (t: string) => any };

  const accessTokenEnc = encryptToken(accessToken);
  const refreshTokenEnc = tokenData.refresh_token
    ? encryptToken(tokenData.refresh_token)
    : null;

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  const { error } = await serviceClient
    .from("social_accounts")
    .upsert(
      {
        client_id: user.id,
        platform: "linkedin",
        platform_user_id: linkedInUserId,
        platform_page_id: linkedInUserId,
        platform_page_name: displayName,
        access_token_enc: accessTokenEnc,
        refresh_token_enc: refreshTokenEnc,
        token_expires_at: expiresAt,
        scopes: ["openid", "profile", "w_member_social"],
        status: "connected",
        last_error: null,
      } as Record<string, unknown>,
      { onConflict: "client_id,platform,platform_page_id" }
    );

  if (error) {
    return redirectToError("db_write_failed");
  }

  const response = NextResponse.redirect(
    buildRedirectUrl("/account", { tab: "integrations", social_connected: "linkedin" })
  );
  response.cookies.set("bb_li_oauth_state", "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: "/",
  });

  return response;
}
