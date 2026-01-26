export const runtime = "nodejs";

import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

import { MICROSOFT_OAUTH_SCOPES } from "@/lib/email/microsoftScopes";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenant = process.env.MICROSOFT_TENANT_ID;

  if (!appUrl || !clientId || !tenant) {
    console.log("[microsoft oauth env]", {
      hasClientId: !!process.env.MICROSOFT_CLIENT_ID,
      hasClientSecret: !!process.env.MICROSOFT_CLIENT_SECRET,
      hasTenant: !!process.env.MICROSOFT_TENANT,
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
    });
    return NextResponse.json(
      { error: "Missing Microsoft OAuth configuration" },
      { status: 500 }
    );
  }

  try {
    const state = randomBytes(24).toString("base64url");
    const redirectUri = new URL("/api/email/microsoft/callback", appUrl).toString();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: MICROSOFT_OAUTH_SCOPES.join(" "),
      state,
    } satisfies Record<string, string>);

    const authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("bb_microsoft_oauth_state", state, {
      httpOnly: true,
      secure: true,
      maxAge: 60 * 10,
      path: "/",
    });

    return response;
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : JSON.stringify(err);
    console.error(
      "[microsoft oauth start error]",
      errorMessage ?? "Unknown error"
    );
    throw err;
  }
}
