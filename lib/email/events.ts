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

export async function initEmailEvent(
  accountId: string,
  providerMessageId: string,
  receivedAt: string
): Promise<EmailEventInitResult> {
  const serviceClient = createEmailServiceClient();
  const { data: existing, error: existingError } = await serviceClient
    .from("email_events")
    .select("id, processed_at, status")
    .eq("account_id", accountId)
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
      account_id: accountId,
      provider_message_id: providerMessageId,
      received_at: receivedAt,
      status: "received",
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted) {
    throw new Error("Failed to insert email event");
  }

  return { eventId: inserted.id, shouldProcess: true };
}

export async function markEmailEventProcessed(eventId: string) {
  const serviceClient = createEmailServiceClient();
  const { error } = await serviceClient
    .from("email_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      error: null,
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
