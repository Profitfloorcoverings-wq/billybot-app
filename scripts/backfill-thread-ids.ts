import "server-only";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import {
  fetchGmailMessagePayload,
  type GmailAccount,
} from "@/lib/email/gmail";
import {
  fetchMicrosoftMessagePayload,
  type MicrosoftAccount,
} from "@/lib/email/microsoft";

type EmailEventRow = {
  id: string;
  account_id: string;
  provider: "google" | "microsoft";
  provider_message_id: string;
};

async function fetchAccount(
  accountId: string,
  provider: "google" | "microsoft"
) {
  const serviceClient = createEmailServiceClient();
  const selection =
    provider === "google"
      ? "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, gmail_history_id"
      : "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, ms_subscription_id, ms_subscription_expires_at";

  const { data, error } = await serviceClient
    .from("email_accounts")
    .select(selection)
    .eq("id", accountId)
    .eq("provider", provider)
    .maybeSingle<GmailAccount | MicrosoftAccount>();

  if (error || !data) {
    throw new Error("Failed to load email account");
  }

  return data;
}

async function backfillProvider(provider: "google" | "microsoft") {
  const serviceClient = createEmailServiceClient();
  const { data: events, error } = await serviceClient
    .from("email_events")
    .select("id, account_id, provider, provider_message_id")
    .eq("provider", provider)
    .is("provider_thread_id", null)
    .not("provider_message_id", "is", null)
    .limit(200)
    .returns<EmailEventRow[]>();

  if (error) {
    throw new Error("Failed to query email events");
  }

  if (!events?.length) {
    console.info(`No ${provider} events to backfill.`);
    return;
  }

  for (const event of events) {
    try {
      const account = await fetchAccount(event.account_id, provider);
      const payload =
        provider === "google"
          ? await fetchGmailMessagePayload(
              account as GmailAccount,
              event.provider_message_id
            )
          : await fetchMicrosoftMessagePayload(
              account as MicrosoftAccount,
              event.provider_message_id
            );

      if (!payload.threadId) {
        console.warn("Missing provider thread id during backfill", {
          provider,
          eventId: event.id,
          providerMessageId: event.provider_message_id,
        });
        continue;
      }

      const { error: updateError } = await serviceClient
        .from("email_events")
        .update({ provider_thread_id: payload.threadId })
        .eq("id", event.id);

      if (updateError) {
        throw new Error("Failed to update email event");
      }

      console.info("Backfilled provider thread id", {
        provider,
        eventId: event.id,
      });
    } catch (error) {
      console.error("Failed to backfill email event", {
        provider,
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function run() {
  await backfillProvider("google");
  await backfillProvider("microsoft");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
