import "server-only";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getValidAccessToken } from "@/lib/email/tokens";

const GMAIL_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailAccount = {
  id: string;
  client_id: string;
  provider: "google";
  email_address: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  gmail_history_id: string | null;
};

export type GmailMessagePayload = {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{ filename: string; mimeType: string; base64: string }>;
};

type GmailHeader = { name: string; value: string };

type GmailMessagePart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string };
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type GmailHistoryResponse = {
  historyId?: string;
  history?: Array<{ messages?: Array<{ id: string }> }>;
};

type GmailWatchResponse = {
  historyId?: string;
};

function decodeBase64Url(data?: string): string {
  if (!data) {
    return "";
  }

  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function normalizeToBase64(data?: string): string {
  if (!data) {
    return "";
  }

  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64").toString("base64");
}

function parseAddressList(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getHeader(headers: GmailHeader[] | undefined, name: string) {
  if (!headers) {
    return "";
  }

  const header = headers.find(
    (item) => item.name.toLowerCase() === name.toLowerCase()
  );

  return header?.value ?? "";
}

async function getGmailAccessToken(account: GmailAccount) {
  return getValidAccessToken(account);
}

export async function startGmailWatch(account: GmailAccount) {
  if (account.gmail_history_id) {
    return account.gmail_history_id;
  }

  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    throw new Error("GOOGLE_PUBSUB_TOPIC is required");
  }

  const accessToken = await getGmailAccessToken(account);
  const response = await fetch(`${GMAIL_BASE_URL}/watch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topicName,
      labelIds: ["INBOX"],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to start Gmail watch");
  }

  const data = (await response.json()) as GmailWatchResponse;
  const historyId = data.historyId ?? null;

  if (historyId) {
    const serviceClient = createEmailServiceClient();
    await serviceClient
      .from("email_accounts")
      .update({ gmail_history_id: historyId })
      .eq("id", account.id);
  }

  return historyId;
}

export async function listGmailHistory(
  account: GmailAccount,
  startHistoryId: string
) {
  const accessToken = await getGmailAccessToken(account);
  const url = new URL(`${GMAIL_BASE_URL}/history`);
  url.searchParams.set("startHistoryId", startHistoryId);
  url.searchParams.set("historyTypes", "messageAdded");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Gmail history");
  }

  const data = (await response.json()) as GmailHistoryResponse;
  const messageIds = new Set<string>();
  data.history?.forEach((historyItem) => {
    historyItem.messages?.forEach((message) => {
      if (message.id) {
        messageIds.add(message.id);
      }
    });
  });

  return {
    historyId: data.historyId ?? startHistoryId,
    messageIds: Array.from(messageIds),
  };
}

async function fetchGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
) {
  const response = await fetch(
    `${GMAIL_BASE_URL}/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Gmail attachment");
  }

  const data = (await response.json()) as { data?: string };
  return normalizeToBase64(data.data);
}

async function collectAttachments(
  accessToken: string,
  messageId: string,
  parts: GmailMessagePart[]
) {
  const attachments: Array<{
    filename: string;
    mimeType: string;
    base64: string;
  }> = [];

  const queue = [...parts];
  while (queue.length > 0) {
    const part = queue.shift();
    if (!part) {
      continue;
    }

    if (part.parts) {
      queue.push(...part.parts);
    }

    if (part.filename && part.body?.attachmentId) {
      const base64 = await fetchGmailAttachment(
        accessToken,
        messageId,
        part.body.attachmentId
      );

      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        base64,
      });
    }
  }

  return attachments;
}

function extractBodies(part?: GmailMessagePart) {
  let bodyText = "";
  let bodyHtml = "";

  if (!part) {
    return { bodyText, bodyHtml };
  }

  const queue: GmailMessagePart[] = [part];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (current.parts) {
      queue.push(...current.parts);
    }

    if (current.mimeType === "text/plain" && current.body?.data && !bodyText) {
      bodyText = decodeBase64Url(current.body.data);
    }

    if (current.mimeType === "text/html" && current.body?.data && !bodyHtml) {
      bodyHtml = decodeBase64Url(current.body.data);
    }
  }

  if (!bodyText && part.body?.data) {
    bodyText = decodeBase64Url(part.body.data);
  }

  return { bodyText, bodyHtml };
}

export async function fetchGmailMessagePayload(
  account: GmailAccount,
  messageId: string
): Promise<GmailMessagePayload> {
  const accessToken = await getGmailAccessToken(account);
  const response = await fetch(`${GMAIL_BASE_URL}/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Gmail message");
  }

  const message = (await response.json()) as GmailMessage;
  const payload = message.payload;
  const headers = payload?.headers ?? [];

  const from = getHeader(headers, "From");
  const to = parseAddressList(getHeader(headers, "To"));
  const cc = parseAddressList(getHeader(headers, "Cc"));
  const subject = getHeader(headers, "Subject");
  const receivedAt = message.internalDate
    ? new Date(Number(message.internalDate)).toISOString()
    : new Date().toISOString();

  const { bodyText, bodyHtml } = extractBodies(payload);
  const attachments = payload?.parts
    ? await collectAttachments(accessToken, message.id, payload.parts)
    : [];

  return {
    from,
    to,
    cc,
    subject,
    receivedAt,
    bodyText,
    bodyHtml,
    attachments,
  };
}
