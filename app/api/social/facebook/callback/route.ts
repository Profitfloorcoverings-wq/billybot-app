export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { encryptToken } from "@/lib/email/crypto";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromCookies } from "@/utils/supabase/auth";

type FacebookTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
};

type FacebookPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
};

type FacebookPagesResponse = {
  data?: FacebookPage[];
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
  const stateCookie = request.cookies.get("bb_fb_oauth_state")?.value;

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

  const clientId = process.env.FACEBOOK_APP_ID;
  const clientSecret = process.env.FACEBOOK_APP_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    return redirectToError("missing_config");
  }

  const redirectUri = new URL("/api/social/facebook/callback", appUrl).toString();

  // Exchange code for short-lived token
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const tokenResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams.toString()}`
  );

  if (!tokenResponse.ok) {
    return redirectToError("token_exchange_failed");
  }

  const tokenData = (await tokenResponse.json()) as FacebookTokenResponse;

  if (!tokenData.access_token) {
    return redirectToError("missing_access_token");
  }

  // Exchange for long-lived token
  const longLivedParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: tokenData.access_token,
  });

  const longLivedResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?${longLivedParams.toString()}`
  );

  let accessToken = tokenData.access_token;
  let expiresIn = tokenData.expires_in ?? 3600;

  if (longLivedResponse.ok) {
    const longLivedData = (await longLivedResponse.json()) as FacebookTokenResponse;
    if (longLivedData.access_token) {
      accessToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in ?? 5184000; // ~60 days
    }
  }

  // Fetch user's Pages
  const pagesResponse = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
  );

  if (!pagesResponse.ok) {
    return redirectToError("pages_fetch_failed");
  }

  const pagesData = (await pagesResponse.json()) as FacebookPagesResponse;
  const pages = pagesData.data ?? [];

  if (pages.length === 0) {
    return redirectToError("no_pages");
  }

  const serviceClient = createEmailServiceClient() as unknown as { from: (t: string) => any };

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Store each Page as a social_account (Facebook)
  // Use the first page's long-lived Page token (which never expires if app is live)
  for (const page of pages) {
    const pageTokenEnc = encryptToken(page.access_token);

    await serviceClient
      .from("social_accounts")
      .upsert(
        {
          client_id: user.id,
          platform: "facebook",
          platform_user_id: null,
          platform_page_id: page.id,
          platform_page_name: page.name,
          access_token_enc: pageTokenEnc,
          refresh_token_enc: null,
          token_expires_at: expiresAt,
          scopes: ["pages_manage_posts", "pages_read_engagement"],
          status: "connected",
          last_error: null,
        } as Record<string, unknown>,
        { onConflict: "client_id,platform,platform_page_id" }
      );

    // Auto-detect Instagram Business account linked to this Page
    if (page.instagram_business_account?.id) {
      // The page token works for Instagram too
      await serviceClient
        .from("social_accounts")
        .upsert(
          {
            client_id: user.id,
            platform: "instagram",
            platform_user_id: page.instagram_business_account.id,
            platform_page_id: page.id,
            platform_page_name: `${page.name} (Instagram)`,
            access_token_enc: pageTokenEnc,
            refresh_token_enc: null,
            token_expires_at: expiresAt,
            scopes: ["instagram_basic", "instagram_content_publish"],
            status: "connected",
            last_error: null,
          } as Record<string, unknown>,
          { onConflict: "client_id,platform,platform_page_id" }
        );
    }
  }

  const response = NextResponse.redirect(
    buildRedirectUrl("/account", { tab: "integrations", social_connected: "facebook" })
  );
  response.cookies.set("bb_fb_oauth_state", "", {
    httpOnly: true,
    secure: true,
    maxAge: 0,
    path: "/",
  });

  return response;
}
