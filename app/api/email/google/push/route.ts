export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import {
  fetchGmailMessagePayload,
  listGmailHistory,
  type GmailAccount,
} from "@/lib/email/gmail";
import {
  initEmailEvent,
  markEmailEventError,
  markEmailEventProcessed,
  sendToN8n,
} from "@/lib/email/events";

type PubSubPushBody = {
  message?: {
    data?: string;
  };
};

type GmailHistoryPushPayload = {
  emailAddress?: string;
  historyId?: string;
};

function isAuthorized(request: NextRequest) {
  const expected = process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN;
  if (!expected) {
    return true;
  }

  const token =
    request.nextUrl.searchParams.get("token") ??
    request.headers.get("x-goog-channel-token") ??
    request.headers.get("x-goog-resource-token");

  return token === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PubSubPushBody;
  const data = body.message?.data;

  if (!data) {
    return NextResponse.json({ ok: true });
  }

  let payload: GmailHistoryPushPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  } catch (error) {
    console.error("Failed to decode Gmail push payload", error);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const emailAddress = payload.emailAddress;
  const historyId = payload.historyId;

  if (!emailAddress || !historyId) {
    return NextResponse.json({ ok: true });
  }

  const serviceClient = createEmailServiceClient();
  const { data: account, error } = await serviceClient
    .from("email_accounts")
    .select(
      "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, gmail_history_id"
    )
    .eq("provider", "google")
    .eq("email_address", emailAddress)
    .maybeSingle<GmailAccount>();

  if (error || !account) {
    console.error("Gmail push account lookup failed", error);
    return NextResponse.json({ ok: true });
  }

  if (!account.gmail_history_id) {
    await serviceClient
      .from("email_accounts")
      .update({ gmail_history_id: historyId })
      .eq("id", account.id);
    return NextResponse.json({ ok: true });
  }

  try {
    const history = await listGmailHistory(account, account.gmail_history_id);
    await serviceClient
      .from("email_accounts")
      .update({ gmail_history_id: history.historyId })
      .eq("id", account.id);

    for (const messageId of history.messageIds) {
      try {
        const message = await fetchGmailMessagePayload(account, messageId);
        const { eventId, shouldProcess } = await initEmailEvent(
          {
            id: account.id,
            client_id: account.client_id,
            provider: "google",
          },
          messageId,
          message.receivedAt,
          null
        );

        if (!shouldProcess) {
          continue;
        }

        const payloadToSend = {
          account_id: account.id,
          provider: "google",
          provider_message_id: messageId,
          from: message.from,
          to: message.to,
          cc: message.cc,
          subject: message.subject,
          received_at: message.receivedAt,
          body_text: message.bodyText,
          body_html: message.bodyHtml,
          attachments: message.attachments.map((attachment) => ({
            filename: attachment.filename,
            mime_type: attachment.mimeType,
            base64: attachment.base64,
          })),
        };

        await sendToN8n(payloadToSend);
        await markEmailEventProcessed(eventId);
      } catch (messageError) {
        console.error("Failed to process Gmail message", messageError);
        const errorMessage =
          messageError instanceof Error
            ? messageError.message
            : "Unknown Gmail processing error";
        const { data: existing } = await serviceClient
          .from("email_events")
          .select("id")
          .eq("account_id", account.id)
          .eq("provider_message_id", messageId)
          .maybeSingle<{ id: string }>();

        if (existing?.id) {
          await markEmailEventError(existing.id, errorMessage);
        }
      }
    }
  } catch (historyError) {
    console.error("Failed to process Gmail history", historyError);
    await serviceClient
      .from("email_accounts")
      .update({ gmail_history_id: historyId })
      .eq("id", account.id);
  }

  return NextResponse.json({ ok: true });
}
