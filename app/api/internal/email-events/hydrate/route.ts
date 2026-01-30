[12:32, 1/30/2026] Steve: export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { markEmailEventError, markEmailEventProcessed } from "@/lib/email/events";
import { fetchGoogleMessagePayload, type GmailAccount } from "@/lib/email/gmail";
import {
fetchMicrosoftMessagePayload,
type MicrosoftAccount,
} from "@/lib/email/microsoft";
import { createEmailServiceClient } from "@/lib/email/serviceClient";

type EmailEventRecord = {
id: string;
account_id: string;
client_id: string;
provider: string | null;
provider_message_id: string;
provider_thread_id: string | null;
received_at: string | null;
status: string | null;
meta?: unknown;
attempts?: number | null;
};

type EmailEventResult = {
email_event_id: s…
[12:32, 1/30/2026] Steve: ts
const body = (await request.json().catch(() => ({}))) as { limit?: number };
const limit = resolveLimit(body?.limit);

const serviceClient = createEmailServiceClient();

// Atomically claim a batch of email events to avoid duplicate processing.
const { data: claimed, error: claimError } = await serviceClient.rpc(
"claim_email_events",
{ p_limit: limit }
);

if (claimError) {
console.error("claim_email_events failed", claimError);
return NextResponse.json({ error: "claim_failed" }, { status: 500 });
}

const eventList = (claimed ?? []) as EmailEventRecord[];
if (!eventList.length) {
return NextResponse.json({ ok: true, processed: 0, errors: 0, results: [] });
}

const results: EmailEventResult[] = [];
let processed = 0;
let errors = 0;

for (const event of eventList) {
const result: EmailEventResult = { email_event_id: event.id, status: "error" };

try {
const clientId = event.client_id;
if (!clientId) throw new Error("missing_client_id");

let payload: EmailMessagePayload;

if (event.provider === "microsoft") {
const { data: account, error: accountError } = await serviceClient
.from("email_accounts")
.select(
"id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, ms_subscription_id, ms_subscription_expires_at"
)
.eq("id", event.account_id)
.maybeSingle<MicrosoftAccount>();

if (accountError || !account) throw new Error("email_account_not_found");
payload = await fetchMicrosoftMessagePayload(account, event.provider_message_id);
} else if (event.provider === "google") {
const { data: account, error: accountError } = await serviceClient
.from("email_accounts")
.select(
"id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, gmail_history_id"
)
.eq("id", event.account_id)
.maybeSingle<GmailAccount>();

if (accountError || !account) throw new Error("email_account_not_found");
payload = await fetchGoogleMessagePayload(account, event.provider_message_id);
} else {
// Don’t poison the queue for other providers.
const processedAt = new Date().toISOString();
await markEmailEventProcessed(event.id, processedAt);
await updateEmailEventMeta(serviceClient, event, {
skipped: true,
reason: "unsupported_provider",
processed_at: processedAt,
});

results.push({ email_event_id: event.id, status: "skipped" });
continue;
}

const receivedAt = payload.receivedAt ?? new Date().toISOString();
const subject = payload.subject || "(no subject)";
const threadId =
payload.threadId ?? event.provider_thread_id ?? event.provider_message_id;

const conversationId = await ensureConversation(serviceClient, clientId, receivedAt);
const jobId = await ensureJob(
serviceClient,
clientId,
event.provider ?? "unknown",
threadId,
receivedAt
);

// Idempotency guard (best-effort)
const { data: existingMessage, error: existingMessageError } = await serviceClient
.from("messages")
.select("id")
.eq("profile_id", clientId)
.eq("metadata->>provider_message_id", event.provider_message_id)
.maybeSingle<{ id: string }>();

if (existingMessageError) throw existingMessageError;

if (!existingMessage?.id) {
const metadataBase = {
provider: event.provider,
provider_message_id: event.provider_message_id,
provider_thread_id: threadId,
from_email: payload.from,
subject,
received_at: receivedAt,
job_id: jobId,
conversation_id: conversationId,
};

const systemMessage = {
conversation_id: conversationId,
profile_id: clientId,
role: "system",
type: "email_event",
content: `New email received: ${subject}`,
created_at: receivedAt,
metadata: metadataBase,
};

const customerMessage = {
conversation_id: conversationId,
profile_id: clientId,
role: "customer",
type: "email",
content: payload.bodyText ?? "",
created_at: receivedAt,
metadata: {
...metadataBase,
to: payload.to,
cc: payload.cc,
body_html: payload.bodyHtml || null,
},
};

const { error: insertError } = await serviceClient
.from("messages")
.insert([systemMessage, customerMessage]);

if (insertError) throw insertError;
}


[12:32, 1/30/2026] Steve: ts
const { error: jobUpdateError } = await serviceClient
.from("jobs")
.update({ last_activity_at: receivedAt })
.eq("id", jobId);

if (jobUpdateError) throw jobUpdateError;

const { error: conversationUpdateError } = await serviceClient
.from("conversations")
.update({ last_message_at: receivedAt })
.eq("id", conversationId);

if (conversationUpdateError) throw conversationUpdateError;

const processedAt = new Date().toISOString();
await markEmailEventProcessed(event.id, processedAt);
await updateEmailEventMeta(
serviceClient,
event,
{ job_id: jobId, conversation_id: conversationId, processed_at: processedAt },
{ provider_thread_id: threadId }
);

result.status = existingMessage?.id ? "skipped" : "processed";
result.job_id = jobId;
result.conversation_id = conversationId;
processed += 1;
} catch (err) {
const errorMessage =
err instanceof Error ? err.message : "email_event_processing_failed";

await markEmailEventError(event.id, errorMessage);
await updateEmailEventMeta(
serviceClient,
event,
{ error: errorMessage, failed_at: new Date().toISOString() },
typeof event.attempts === "number" ? { attempts: event.attempts + 1 } : {}
);

result.status = "error";
result.error = errorMessage;
errors += 1;
}

results.push(result);
}

return NextResponse.json({ ok: true, processed, errors, results });
}
