import "server-only";

const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

export type GmailReplyPayload = {
  accessToken: string;
  toEmail: string;
  subject: string;
  body: string;
  threadId: string;
};

export type MicrosoftReplyPayload = {
  accessToken: string;
  mailbox: string;
  messageId: string;
  body: string;
};

export type ProviderSendResult = {
  providerMessageId: string | null;
  providerThreadId: string | null;
  providerResult: Record<string, unknown>;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildPlainTextEmail(toEmail: string, subject: string, body: string) {
  return [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
}

export async function sendGmailReply(
  payload: GmailReplyPayload
): Promise<ProviderSendResult> {
  const raw = base64UrlEncode(
    buildPlainTextEmail(payload.toEmail, payload.subject, payload.body)
  );

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw, threadId: payload.threadId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gmail send failed (${response.status}): ${errorText || "unknown error"}`
    );
  }

  const data = (await response.json()) as {
    id?: string;
    threadId?: string;
  };

  return {
    providerMessageId: data.id ?? null,
    providerThreadId: data.threadId ?? payload.threadId,
    providerResult: {
      id: data.id ?? null,
      threadId: data.threadId ?? null,
    },
  };
}

export async function sendMicrosoftReply(
  payload: MicrosoftReplyPayload
): Promise<ProviderSendResult> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${payload.mailbox}/messages/${payload.messageId}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${payload.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: payload.body }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Microsoft reply failed (${response.status}): ${
        errorText || "unknown error"
      }`
    );
  }

  return {
    providerMessageId: null,
    providerThreadId: null,
    providerResult: {
      status: response.status,
    },
  };
}
