import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

const FACEBOOK_SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
];

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.FACEBOOK_APP_ID;

  if (!appUrl || !clientId) {
    return NextResponse.json(
      { error: "Missing Facebook OAuth configuration" },
      { status: 500 }
    );
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL("/api/social/facebook/callback", appUrl).toString();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: FACEBOOK_SCOPES.join(","),
    state,
  });

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("bb_fb_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
