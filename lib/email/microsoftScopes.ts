export const MICROSOFT_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
] as const;

export type MicrosoftOAuthScope = (typeof MICROSOFT_OAUTH_SCOPES)[number];
