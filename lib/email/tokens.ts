import "server-only";

import { decryptToken, encryptToken } from "@/lib/email/crypto";
import { createEmailServiceClient } from "@/lib/email/serviceClient";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

type EmailAccount = {
  id: string;
  provider: "google" | "microsoft";
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
};

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

type MicrosoftRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function isExpiringSoon(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - Date.now() <= REFRESH_BUFFER_MS;
}

async function refreshGoogleToken(
  account: EmailAccount,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth credentials");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error("Google token refresh failed");
  }

  const data = (await response.json()) as GoogleRefreshResponse;
  if (!data.access_token) {
    throw new Error("Google refresh response missing access token");
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : account.expires_at;

  return { accessToken: data.access_token, expiresAt };
}

async function refreshMicrosoftToken(
  account: EmailAccount,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID;

  if (!clientId || !clientSecret || !tenant) {
    throw new Error("Missing Microsoft OAuth credentials");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const scope = account.scopes?.join(" ");
  if (scope) {
    params.set("scope", scope);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error("Microsoft token refresh failed");
  }

  const data = (await response.json()) as MicrosoftRefreshResponse;
  if (!data.access_token) {
    throw new Error("Microsoft refresh response missing access token");
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : account.expires_at;

  return { accessToken: data.access_token, expiresAt };
}

export async function getValidAccessToken(account: EmailAccount) {
  if (!account.access_token_enc) {
    throw new Error("Missing access token");
  }

  const accessToken = decryptToken(account.access_token_enc);
  if (!isExpiringSoon(account.expires_at)) {
    return accessToken;
  }

  if (!account.refresh_token_enc) {
    throw new Error("Missing refresh token");
  }

  const refreshToken = decryptToken(account.refresh_token_enc);
  const refreshed =
    account.provider === "google"
      ? await refreshGoogleToken(account, refreshToken)
      : await refreshMicrosoftToken(account, refreshToken);

  const serviceClient = createEmailServiceClient();
  const { error } = await serviceClient
    .from("email_accounts")
    .update({
      access_token_enc: encryptToken(refreshed.accessToken),
      expires_at: refreshed.expiresAt,
    })
    .eq("id", account.id);

  if (error) {
    throw new Error("Failed to persist refreshed access token");
  }

  return refreshed.accessToken;
}
