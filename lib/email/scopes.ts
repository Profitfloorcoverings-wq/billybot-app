export const GOOGLE_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export type GoogleGmailScope = (typeof GOOGLE_GMAIL_SCOPES)[number];

export function parseScopeString(
  scopeString: string | null | undefined,
  fallback: readonly string[] = []
): string[] {
  const scopes = (scopeString ?? "")
    .split(" ")
    .map((scope) => scope.trim())
    .filter(Boolean);

  if (scopes.length > 0) {
    return Array.from(new Set(scopes));
  }

  return Array.from(new Set(fallback));
}
