import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.LINKEDIN_CLIENT_ID;

  if (!appUrl || !clientId) {
    return NextResponse.json(
      { error: "Missing LinkedIn OAuth configuration" },
      { status: 500 }
    );
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL("/api/social/linkedin/callback", appUrl).toString();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: LINKEDIN_SCOPES.join(" "),
    state,
  });

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("bb_li_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
