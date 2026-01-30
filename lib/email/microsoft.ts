import "server-only";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getValidAccessToken } from "@/lib/email/tokens";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const SUBSCRIPTION_TTL_MS = 2 * 24 * 60 * 60 * 1000;

export type MicrosoftAccount = {
  id: string;
  client_id: string;
  provider: "microsoft";
  email_address: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
  ms_subscription_id: string | null;
  ms_subscription_expires_at: string | null;
};

export type MicrosoftMessagePayload = {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  threadId: string | null;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{ filename: string; mimeType: string; base64: string }>;
};

type MicrosoftMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string } }>;
  receivedDateTime?: string;
  conversationId?: string;
  body?: { contentType?: string; content?: string };
  bodyPreview?: string;
};

type MicrosoftAttachment = {
  "@odata.type"?: string;
  name?: string;
  contentType?: string;
  contentBytes?: string;
};

type GraphError = Error & { status?: number };

function parseRecipients(
  recipients?: Array<{ emailAddress?: { address?: string } }>
) {
  return (recipients ?? [])
    .map((recipient) => recipient.emailAddress?.address)
    .filter((address): address is string => Boolean(address));
}

async function graphRequest(
  accessToken: string,
  path: string,
  options: RequestInit = {}
) {
  const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const error = new Error(
      `Microsoft Graph request failed (${response.status})`
    ) as GraphError;
    error.status = response.status;
    throw error;
  }

  return response;
}

async function markMicrosoftAccountError(accountId: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Microsoft subscription error";
  const serviceClient = createEmailServiceClient();
  await serviceClient
    .from("email_accounts")
    .update({ status: "error", last_error: message })
    .eq("id", accountId);
}

function getMicrosoftClientState() {
  return (
    process.env.MICROSOFT_CLIENT_STATE_TOKEN ??
    process.env.MICROSOFT_WEBHOOK_VALIDATION_TOKEN
  );
}

export async function ensureMicrosoftSubscription(
  account: MicrosoftAccount
): Promise<{ id: string; expiresAt: string }> {
  const clientState = getMicrosoftClientState();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required");
  }

  const expiresAt = account.ms_subscription_expires_at
    ? new Date(account.ms_subscription_expires_at).getTime()
    : 0;
  const shouldRenew =
    !account.ms_subscription_id || expiresAt <= Date.now();

  if (!shouldRenew) {
    return {
      id: account.ms_subscription_id!,
      expiresAt: account.ms_subscription_expires_at ?? new Date(expiresAt).toISOString(),
    };
  }

  try {
    const accessToken = await getValidAccessToken(account);
    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_TTL_MS
    ).toISOString();

    const body = {
      changeType: "created",
      notificationUrl: `${appUrl}/api/email/microsoft/notify`,
      resource: "me/mailFolders('Inbox')/messages",
      expirationDateTime,
      ...(clientState ? { clientState } : {}),
    };

    const response = await graphRequest(accessToken, "/subscriptions", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as {
      id?: string;
      expirationDateTime?: string;
    };

    if (!data.id) {
      throw new Error("Microsoft subscription response missing id");
    }

    const serviceClient = createEmailServiceClient();
    const expiresAt = data.expirationDateTime ?? expirationDateTime;
    await serviceClient
      .from("email_accounts")
      .update({
        ms_subscription_id: data.id,
        ms_subscription_expires_at: expiresAt,
        status: "connected",
        last_error: null,
      })
      .eq("id", account.id);

    console.info("Microsoft subscription created", {
      accountId: account.id,
      subscriptionId: data.id,
    });

    return { id: data.id, expiresAt };
  } catch (error) {
    await markMicrosoftAccountError(account.id, error);
    throw error;
  }
}

export async function renewMicrosoftSubscription(
  account: MicrosoftAccount
): Promise<{ id: string; expiresAt: string }> {
  if (!account.ms_subscription_id) {
    return ensureMicrosoftSubscription(account);
  }

  const accessToken = await getValidAccessToken(account);
  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_TTL_MS).toISOString();

  try {
    const response = await graphRequest(
      accessToken,
      `/subscriptions/${account.ms_subscription_id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ expirationDateTime }),
      }
    );

    const data = (await response.json()) as { expirationDateTime?: string };
    const expiresAt = data.expirationDateTime ?? expirationDateTime;
    const serviceClient = createEmailServiceClient();
    await serviceClient
      .from("email_accounts")
      .update({
        ms_subscription_expires_at: expiresAt,
        status: "connected",
        last_error: null,
      })
      .eq("id", account.id);

    console.info("Microsoft subscription renewed", {
      accountId: account.id,
      subscriptionId: account.ms_subscription_id,
    });

    return { id: account.ms_subscription_id, expiresAt };
  } catch (error) {
    const graphError = error as GraphError;
    if (graphError.status === 404 || graphError.status === 410) {
      console.warn("Microsoft subscription expired; recreating", {
        accountId: account.id,
        subscriptionId: account.ms_subscription_id,
      });
      const serviceClient = createEmailServiceClient();
      await serviceClient
        .from("email_accounts")
        .update({
          ms_subscription_id: null,
          ms_subscription_expires_at: null,
        })
        .eq("id", account.id);

      return ensureMicrosoftSubscription({
        ...account,
        ms_subscription_id: null,
        ms_subscription_expires_at: null,
      });
    }

    await markMicrosoftAccountError(account.id, error);
    throw error;
  }
}

export async function fetchMicrosoftMessagePayload(
  account: MicrosoftAccount,
  messageId: string
): Promise<MicrosoftMessagePayload> {
  const accessToken = await getValidAccessToken(account);
  const messageResponse = await graphRequest(
    accessToken,
    `/me/messages/${messageId}?$select=subject,from,toRecipients,ccRecipients,receivedDateTime,body,bodyPreview,conversationId`
  );

  const message = (await messageResponse.json()) as MicrosoftMessage;
  const attachmentsResponse = await graphRequest(
    accessToken,
    `/me/messages/${messageId}/attachments`
  );

  const attachmentsJson = (await attachmentsResponse.json()) as {
    value?: MicrosoftAttachment[];
  };

  const attachments = (attachmentsJson.value ?? [])
    .filter((attachment) => attachment["@odata.type"] === "#microsoft.graph.fileAttachment")
    .map((attachment) => ({
      filename: attachment.name ?? "attachment",
      mimeType: attachment.contentType ?? "application/octet-stream",
      base64: attachment.contentBytes ?? "",
    }));

  const contentType = message.body?.contentType?.toLowerCase();
  const bodyHtml = contentType === "html" ? message.body?.content ?? "" : "";
  const bodyText =
    contentType === "text"
      ? message.body?.content ?? ""
      : message.bodyPreview ?? "";

  return {
    from: message.from?.emailAddress?.address ?? "",
    to: parseRecipients(message.toRecipients),
    cc: parseRecipients(message.ccRecipients),
    subject: message.subject ?? "",
    receivedAt: message.receivedDateTime ?? new Date().toISOString(),
    threadId: message.conversationId ?? null,
    bodyText,
    bodyHtml,
    attachments,
  };
}
