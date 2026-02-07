import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { GOOGLE_GMAIL_SCOPES } from "@/lib/email/scopes";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!appUrl || !clientId) {
    return NextResponse.json(
      { error: "Missing Google OAuth configuration" },
      { status: 500 }
    );
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL("/api/email/google/callback", appUrl).toString();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("bb_google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
