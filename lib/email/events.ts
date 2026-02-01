import "server-only";

import { createEmailServiceClient } from "@/lib/email/serviceClient";

export type EmailEventRecord = {
  id: string;
  processed_at: string | null;
  status: string | null;
};

export type EmailEventInitResult = {
  eventId: string;
  shouldProcess: boolean;
};

type EmailEventPayload = {
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  bodyText: string;
  bodyHtml: string;
  attachments: Array<{ filename: string; mimeType: string; base64: string }>;
};

export async function initEmailEvent(
  account: { id: string; client_id: string; provider: "google" | "microsoft" },
  providerMessageId: string,
  receivedAt: string,
  providerThreadId?: string | null
): Promise<EmailEventInitResult> {
  if (!providerThreadId) {
    console.warn("Email event missing provider thread id", {
      accountId: account.id,
      provider: account.provider,
      providerMessageId,
    });
  }

  const serviceClient = createEmailServiceClient();
  const { data: existing, error: existingError } = await serviceClient
    .from("email_events")
    .select("id, processed_at, status")
    .eq("account_id", account.id)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle<EmailEventRecord>();

  if (existingError) {
    throw new Error("Failed to read email event");
  }

  if (existing) {
    if (existing.processed_at) {
      return { eventId: existing.id, shouldProcess: false };
    }

    const { error: updateError } = await serviceClient
      .from("email_events")
      .update({
        status: "received",
        received_at: receivedAt,
        provider_thread_id: providerThreadId ?? null,
        error: null,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error("Failed to update email event");
    }

    return { eventId: existing.id, shouldProcess: true };
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from("email_events")
    .insert({
      account_id: account.id,
      client_id: account.client_id,
      provider: account.provider,
      provider_message_id: providerMessageId,
      provider_thread_id: providerThreadId ?? null,
      received_at: receivedAt,
      status: "received",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    if (insertError.code === "23505") {
      return { eventId: "", shouldProcess: false };
    }
    throw new Error("Failed to insert email event");
  }
  if (!inserted) {
    throw new Error("Failed to insert email event");
  }

  return { eventId: inserted.id, shouldProcess: true };
}

export async function markEmailEventProcessed(
  eventId: string,
  payload?: EmailEventPayload
) {
  const serviceClient = createEmailServiceClient();
  const { error } = await serviceClient
    .from("email_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      error: null,
      ...(payload
        ? {
            from_email: payload.from,
            to_emails: payload.to,
            cc_emails: payload.cc,
            subject: payload.subject,
            body_text: payload.bodyText,
            body_html: payload.bodyHtml,
            attachments: payload.attachments.map((attachment) => ({
              filename: attachment.filename,
              mime_type: attachment.mimeType,
              base64: attachment.base64,
            })),
            received_at: payload.receivedAt,
          }
        : {}),
    })
    .eq("id", eventId);

  if (error) {
    throw new Error("Failed to mark email event processed");
  }
}

export async function markEmailEventError(eventId: string, message: string) {
  const serviceClient = createEmailServiceClient();
  const { error } = await serviceClient
    .from("email_events")
    .update({
      status: "error",
      error: message,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error("Failed to mark email event error");
  }
}

export async function sendToN8n(payload: unknown) {
  const webhookUrl = process.env.N8N_EMAIL_INGEST_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("N8N_EMAIL_INGEST_WEBHOOK_URL is required");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to forward email to n8n");
  }
}
