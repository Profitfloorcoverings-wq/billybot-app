export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import {
  fetchMicrosoftMessagePayload,
  type MicrosoftAccount,
} from "@/lib/email/microsoft";
import {
  initEmailEvent,
  markEmailEventError,
  markEmailEventProcessed,
  sendToN8n,
} from "@/lib/email/events";

type MicrosoftNotification = {
  subscriptionId?: string;
  clientState?: string;
  resourceData?: {
    id?: string;
  };
};

type MicrosoftNotificationBody = {
  value?: MicrosoftNotification[];
};

function validateClientState(notification: MicrosoftNotification) {
  const expected =
    process.env.MICROSOFT_CLIENT_STATE_TOKEN ??
    process.env.MICROSOFT_WEBHOOK_VALIDATION_TOKEN;
  if (!expected) {
    return true;
  }

  return notification.clientState === expected;
}

function handleValidation(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (!validationToken) {
    return null;
  }

  return new NextResponse(validationToken, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function GET(request: NextRequest) {
  const validationResponse = handleValidation(request);
  if (validationResponse) {
    return validationResponse;
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const validationResponse = handleValidation(request);
  if (validationResponse) {
    return validationResponse;
  }

  const body = (await request.json()) as MicrosoftNotificationBody;
  const notifications = body.value ?? [];
  let hadFailure = false;
  let hadInvalidClientState = false;

  console.info("Microsoft notification received", {
    count: notifications.length,
  });

  const serviceClient = createEmailServiceClient();

  for (const notification of notifications) {
    if (!validateClientState(notification)) {
      hadInvalidClientState = true;
      continue;
    }

    const subscriptionId = notification.subscriptionId;
    const messageId = notification.resourceData?.id;

    if (!subscriptionId || !messageId) {
      continue;
    }

    const { data: account, error } = await serviceClient
      .from("email_accounts")
      .select(
        "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, ms_subscription_id, ms_subscription_expires_at"
      )
      .eq("provider", "microsoft")
      .eq("ms_subscription_id", subscriptionId)
      .maybeSingle<MicrosoftAccount>();

    if (error || !account) {
      hadFailure = true;
      continue;
    }

    try {
      const message = await fetchMicrosoftMessagePayload(account, messageId);
      const { eventId, shouldProcess } = await initEmailEvent(
        {
          id: account.id,
          client_id: account.client_id,
          provider: "microsoft",
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
        provider: "microsoft",
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
      hadFailure = true;
      const errorMessage =
        messageError instanceof Error
          ? messageError.message
          : "Unknown Microsoft processing error";
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

  if (hadInvalidClientState || hadFailure) {
    console.error("Microsoft notification processing failed", {
      clientStateMismatch: hadInvalidClientState,
      messageProcessingFailed: hadFailure,
    });
  }

  return NextResponse.json({ ok: true });
}
