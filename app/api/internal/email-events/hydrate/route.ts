export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  fetchGmailMessagePayload,
  type GmailAccount,
} from "@/lib/email/gmail";
import {
  fetchMicrosoftMessagePayload,
  type MicrosoftAccount,
} from "@/lib/email/microsoft";
import { createEmailServiceClient } from "@/lib/email/serviceClient";

type EmailPayload = {
  provider: "microsoft" | "google";
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

type EmailEventClaim = {
  id: string;
  account_id: string;
  client_id: string;
  provider: "microsoft" | "google";
  provider_message_id: string;
  provider_thread_id: string | null;
  attempts: number | null;
};

type HydrateResult = {
  eventId: string;
  status: "processed" | "error";
  error?: string;
};

function isAuthorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOBS_TOKEN;
  if (!expected) {
    return false;
  }

  const token = request.headers.get("x-internal-token");
  return token === expected;
}

function getLimit(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("limit");
  const parsed = param ? Number.parseInt(param, 10) : 25;
  if (Number.isNaN(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(parsed, 200);
}

async function resolveConversationId(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  profileId: string
) {
  const { data: existing, error } = await serviceClient
    .from("conversations")
    .select("id")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error("Failed to read conversations");
  }

  if (existing?.id) {
    return existing.id;
  }

  const conversationId = crypto.randomUUID();
  const { error: insertError } = await serviceClient
    .from("conversations")
    .insert({
      id: conversationId,
      profile_id: profileId,
      created_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error("Failed to create conversation");
  }

  return conversationId;
}

async function resolveJobId(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  profileId: string,
  provider: "microsoft" | "google",
  providerThreadId: string | null
) {
  const { data: existing, error } = await serviceClient
    .from("jobs")
    .select("id")
    .eq("profile_id", profileId)
    .eq("provider", provider)
    .eq("provider_thread_id", providerThreadId)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new Error("Failed to read jobs");
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from("jobs")
    .insert({
      profile_id: profileId,
      provider,
      provider_thread_id: providerThreadId,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted?.id) {
    throw new Error("Failed to create job");
  }

  return inserted.id;
}

async function markEventProcessed(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  eventId: string,
  providerThreadId: string | null,
  meta: Record<string, unknown>
) {
  const { error } = await serviceClient
    .from("email_events")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      provider_thread_id: providerThreadId,
      error: null,
      meta,
    })
    .eq("id", eventId);

  if (error) {
    throw new Error("Failed to mark email event processed");
  }
}

async function markEventError(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  event: EmailEventClaim,
  message: string
) {
  const { error } = await serviceClient
    .from("email_events")
    .update({
      status: "error",
      error: message,
      attempts: (event.attempts ?? 0) + 1,
      meta: {
        failed_at: new Date().toISOString(),
        error: message,
      },
    })
    .eq("id", event.id);

  if (error) {
    throw new Error("Failed to mark email event error");
  }
}

async function fetchPayload(
  account: GmailAccount | MicrosoftAccount,
  provider: "microsoft" | "google",
  messageId: string
): Promise<EmailPayload> {
  if (provider === "google") {
    const payload = await fetchGmailMessagePayload(
      account as GmailAccount,
      messageId
    );
    return { provider, ...payload };
  }

  const payload = await fetchMicrosoftMessagePayload(
    account as MicrosoftAccount,
    messageId
  );
  return { provider, ...payload };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = getLimit(request);
  const serviceClient = createEmailServiceClient();

  const { data: claimed, error } = await serviceClient.rpc("claim_email_events", {
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  const events = (claimed ?? []) as EmailEventClaim[];
  const results: HydrateResult[] = [];
  let processed = 0;
  let errors = 0;

  for (const event of events) {
    try {
      const { data: account, error: accountError } = await serviceClient
        .from("email_accounts")
        .select(
          "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes"
        )
        .eq("id", event.account_id)
        .maybeSingle<GmailAccount | MicrosoftAccount>();

      if (accountError || !account) {
        throw new Error("Email account not found");
      }

      const payload = await fetchPayload(
        account,
        event.provider,
        event.provider_message_id
      );

      const providerThreadId =
        payload.threadId ?? event.provider_thread_id ?? null;

      const conversationId = await resolveConversationId(
        serviceClient,
        event.client_id
      );
      const jobId = await resolveJobId(
        serviceClient,
        event.client_id,
        event.provider,
        providerThreadId
      );

      const { data: existingMessage, error: existingError } =
        await serviceClient
          .from("messages")
          .select("id")
          .eq("profile_id", event.client_id)
          .filter(
            "metadata->>provider_message_id",
            "eq",
            event.provider_message_id
          )
          .maybeSingle<{ id: string }>();

      if (existingError) {
        throw new Error("Failed to check existing messages");
      }

      const receivedAt = payload.receivedAt ?? new Date().toISOString();
      const metadata = {
        provider: event.provider,
        provider_message_id: event.provider_message_id,
        provider_thread_id: providerThreadId,
        from_email: payload.from,
        subject: payload.subject,
        received_at: receivedAt,
        job_id: jobId,
        conversation_id: conversationId,
        ...(payload.bodyHtml ? { body_html: payload.bodyHtml } : {}),
      };

      if (!existingMessage?.id) {
        const now = new Date().toISOString();
        const { error: insertError } = await serviceClient
          .from("messages")
          .insert([
            {
              profile_id: event.client_id,
              conversation_id: conversationId,
              role: "system",
              type: "email_event",
              content: payload.subject || "Email event received",
              metadata,
              created_at: now,
            },
            {
              profile_id: event.client_id,
              conversation_id: conversationId,
              role: "customer",
              type: "email",
              content: payload.bodyText,
              metadata,
              created_at: now,
            },
          ]);

        if (insertError) {
          throw new Error("Failed to insert messages");
        }
      }

      const { error: jobUpdateError } = await serviceClient
        .from("jobs")
        .update({ last_activity_at: receivedAt })
        .eq("id", jobId);

      if (jobUpdateError) {
        throw new Error("Failed to update job activity");
      }

      const { error: conversationUpdateError } = await serviceClient
        .from("conversations")
        .update({ last_message_at: receivedAt })
        .eq("id", conversationId);

      if (conversationUpdateError) {
        throw new Error("Failed to update conversation activity");
      }

      await markEventProcessed(serviceClient, event.id, providerThreadId, {
        job_id: jobId,
        conversation_id: conversationId,
        processed_at: new Date().toISOString(),
      });

      results.push({ eventId: event.id, status: "processed" });
      processed += 1;
    } catch (eventError) {
      const message =
        eventError instanceof Error
          ? eventError.message
          : "Email hydration failed";

      try {
        await markEventError(serviceClient, event, message);
      } catch {
        // ignore secondary failure
      }

      results.push({ eventId: event.id, status: "error", error: message });
      errors += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    results,
  });
}
