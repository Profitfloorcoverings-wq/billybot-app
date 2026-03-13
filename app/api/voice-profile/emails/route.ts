import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getValidAccessToken } from "@/lib/email/tokens";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type SentEmail = {
  subject: string;
  body_text: string;
  to_emails: string[];
  from_email: string;
  sent_at: string;
};

/**
 * Called by N8N to fetch sent emails from the user's connected email account
 * (Gmail or Microsoft) for voice profile generation.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-billybot-secret");
    if (secret !== process.env.N8N_SHARED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile_id } = (await req.json()) as { profile_id: string };
    if (!profile_id) {
      return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find connected email account
    const { data: accounts } = await supabase
      .from("email_accounts")
      .select("id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, status")
      .eq("client_id", profile_id)
      .eq("status", "connected")
      .limit(1);

    const account = accounts?.[0];
    if (!account) {
      return NextResponse.json({ emails: [], reason: "no_connected_account" });
    }

    const accessToken = await getValidAccessToken(account as Parameters<typeof getValidAccessToken>[0]);

    let emails: SentEmail[] = [];

    if (account.provider === "google") {
      emails = await fetchGmailSentEmails(accessToken, 30);
    } else if (account.provider === "microsoft") {
      emails = await fetchMicrosoftSentEmails(accessToken, 30);
    }

    return NextResponse.json({ emails, provider: account.provider, count: emails.length });
  } catch (err: unknown) {
    console.error("VOICE_PROFILE EMAILS ERROR:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error", emails: [] },
      { status: 500 }
    );
  }
}

async function fetchGmailSentEmails(accessToken: string, limit: number): Promise<SentEmail[]> {
  // List messages from SENT folder
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=SENT&maxResults=${limit}&q=larger:50`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    throw new Error(`Gmail list failed: ${listRes.status}`);
  }

  const listData = (await listRes.json()) as { messages?: { id: string }[] };
  const messageIds = listData.messages ?? [];

  // Fetch each message (batch of up to 30)
  const emails: SentEmail[] = [];
  const fetches = messageIds.slice(0, limit).map(async (m) => {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!msgRes.ok) return null;
    return msgRes.json();
  });

  const results = await Promise.allSettled(fetches);

  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value) continue;
    const msg = result.value as GmailMessage;
    const headers = msg.payload?.headers ?? [];

    const subject = headers.find((h: GmailHeader) => h.name.toLowerCase() === "subject")?.value ?? "";
    const to = headers.find((h: GmailHeader) => h.name.toLowerCase() === "to")?.value ?? "";
    const from = headers.find((h: GmailHeader) => h.name.toLowerCase() === "from")?.value ?? "";
    const date = headers.find((h: GmailHeader) => h.name.toLowerCase() === "date")?.value ?? "";

    const bodyText = extractGmailBodyText(msg.payload);
    if (!bodyText || bodyText.trim().length < 30) continue;

    emails.push({
      subject,
      body_text: bodyText.substring(0, 2000),
      to_emails: to.split(",").map((e: string) => e.trim()),
      from_email: from,
      sent_at: date,
    });
  }

  return emails;
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};
type GmailMessage = {
  payload: GmailPart & { headers?: GmailHeader[] };
};

function extractGmailBodyText(payload: GmailPart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractGmailBodyText(part);
      if (text) return text;
    }
  }

  return "";
}

async function fetchMicrosoftSentEmails(accessToken: string, limit: number): Promise<SentEmail[]> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=${limit}&$select=subject,body,toRecipients,from,sentDateTime&$orderby=sentDateTime desc&$filter=body/contentType eq 'text'`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.body-content-type="text"',
      },
    }
  );

  if (!res.ok) {
    // Retry without filter (some accounts don't support it)
    const res2 = await fetch(
      `https://graph.microsoft.com/v1.0/me/mailFolders/sentitems/messages?$top=${limit}&$select=subject,body,toRecipients,from,sentDateTime&$orderby=sentDateTime desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Prefer: 'outlook.body-content-type="text"',
        },
      }
    );
    if (!res2.ok) {
      throw new Error(`Microsoft sent mail failed: ${res2.status}`);
    }
    const data = (await res2.json()) as MicrosoftMailResponse;
    return parseMicrosoftEmails(data);
  }

  const data = (await res.json()) as MicrosoftMailResponse;
  return parseMicrosoftEmails(data);
}

type MicrosoftMailMessage = {
  subject?: string;
  body?: { content?: string; contentType?: string };
  toRecipients?: { emailAddress?: { address?: string } }[];
  from?: { emailAddress?: { address?: string } };
  sentDateTime?: string;
};

type MicrosoftMailResponse = {
  value?: MicrosoftMailMessage[];
};

function parseMicrosoftEmails(data: MicrosoftMailResponse): SentEmail[] {
  const emails: SentEmail[] = [];
  for (const msg of data.value ?? []) {
    const bodyText = msg.body?.content ?? "";
    if (bodyText.trim().length < 30) continue;

    emails.push({
      subject: msg.subject ?? "",
      body_text: bodyText.substring(0, 2000),
      to_emails: (msg.toRecipients ?? []).map((r) => r.emailAddress?.address ?? "").filter(Boolean),
      from_email: msg.from?.emailAddress?.address ?? "",
      sent_at: msg.sentDateTime ?? "",
    });
  }
  return emails;
}
