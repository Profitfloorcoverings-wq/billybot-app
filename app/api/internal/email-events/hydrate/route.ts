export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { markEmailEventError, markEmailEventProcessed } from "@/lib/email/events";
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
  email_event_id: string;
  status: "processed" | "skipped" | "error";
  job_id?: string;
  conversation_id?: string;
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

function resolveLimit(rawLimit: unknown) {
  const parsed = Number(rawLimit ?? 25);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(Math.trunc(parsed), 100);
}

function getMetaRecord(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }
  return meta as Record<string, unknown>;
}

async function ensureConversation(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  clientId: string,
  receivedAt: string
) {
  const { data: existingConversation, error: existingError } = await serviceClient
    .from("conversations")
    .select("id")
    .eq("profile_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingConversation?.id) {
    return existingConversation.id;
  }

  const newConversationId = crypto.randomUUID();
  const { error: insertError } = await serviceClient
    .from("conversations")
    .insert({
      id: newConversationId,
      profile_id: clientId,
      client_id: clientId,
      last_message_at: receivedAt,
    });

  if (insertError) {
    throw insertError;
  }

  return newConversationId;
}

async function ensureJob(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  clientId: string,
  provider: string,
  providerThreadId: string,
  receivedAt: string
) {
  const { data: existingJob, error: existingError } = await serviceClient
    .from("jobs")
    .select("id")
    .eq("client_id", clientId)
    .eq("profile_id", clientId)
    .eq("provider", provider)
    .eq("provider_thread_id", providerThreadId)
    .maybeSingle<{ id: string }>();

  if (existingError && existingError.code !== "PGRST116") {
    throw existingError;
  }

  if (existingJob?.id) {
    return existingJob.id;
  }

  const newJobId = crypto.randomUUID();
  const { error: insertError } = await serviceClient.from("jobs").insert({
    id: newJobId,
    profile_id: clientId,
    client_id: clientId,
    provider,
    provider_thread_id: providerThreadId,
    last_activity_at: receivedAt,
  });

  if (insertError) {
    throw insertError;
  }

  return newJobId;
}

async function updateEmailEventMeta(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  event: EmailEventRecord,
  metaUpdates: Record<string, unknown>,
  extraUpdates: Record<string, unknown> = {}
) {
  const currentMeta = getMetaRecord(event.meta);
  const nextMeta = { ...currentMeta, ...metaUpdates };
  const payload = { meta: nextMeta, ...extraUpdates };
  const { error } = await serviceClient
    .from("email_events")
    .update(payload)
    .eq("id", event.id);

  if (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
  };
  const limit = resolveLimit(body?.limit);
  const serviceClient = createEmailServiceClient();
  const statusesToProcess = ["received", "queued", "processing"];

  const { data: events, error: eventsError } = await serviceClient
    .from("email_events")
    .select("*")
    .in("status", statusesToProcess)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (eventsError) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const eventList = (events ?? []) as EmailEventRecord[];
  const eventIds = eventList.map((event) => event.id).filter(Boolean);

  if (eventIds.length > 0) {
    const { error: claimError } = await serviceClient
      .from("email_events")
      .update({ status: "processing" })
      .in("id", eventIds)
      .in("status", statusesToProcess);

    if (claimError) {
      return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    }
  }

  const results: EmailEventResult[] = [];
  let processed = 0;
  let errors = 0;

  for (const event of eventList) {
    const result: EmailEventResult = {
      email_event_id: event.id,
      status: "error",
    };

    try {
      if (event.provider !== "microsoft") {
        const errorMessage = "unsupported_provider";
        await markEmailEventError(event.id, errorMessage);
        await updateEmailEventMeta(
          serviceClient,
          event,
          { error: errorMessage, failed_at: new Date().toISOString() },
          typeof event.attempts === "number"
            ? { attempts: event.attempts + 1 }
            : {}
        );
        result.status = "error";
        result.error = errorMessage;
        errors += 1;
        results.push(result);
        continue;
      }

      const { data: account, error: accountError } = await serviceClient
        .from("email_accounts")
        .select(
          "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes, ms_subscription_id, ms_subscription_expires_at"
        )
        .eq("id", event.account_id)
        .maybeSingle<MicrosoftAccount>();

      if (accountError || !account) {
        throw new Error("email_account_not_found");
      }

      const payload = await fetchMicrosoftMessagePayload(
        account,
        event.provider_message_id
      );
      const receivedAt = payload.receivedAt ?? new Date().toISOString();
      const subject = payload.subject || "(no subject)";
      const threadId =
        payload.threadId ?? event.provider_thread_id ?? event.provider_message_id;

      const clientId = event.client_id;
      if (!clientId) {
        throw new Error("missing_client_id");
      }

      const conversationId = await ensureConversation(
        serviceClient,
        clientId,
        receivedAt
      );
      const jobId = await ensureJob(
        serviceClient,
        clientId,
        event.provider ?? "microsoft",
        threadId,
        receivedAt
      );

      const { data: existingMessage, error: existingMessageError } =
        await serviceClient
          .from("messages")
          .select("id")
          .eq("profile_id", clientId)
          .eq("metadata->>provider_message_id", event.provider_message_id)
          .maybeSingle<{ id: string }>();

      if (existingMessageError) {
        throw existingMessageError;
      }

      if (!existingMessage?.id) {
        const metadataBase = {
          provider: event.provider,
          provider_message_id: event.provider_message_id,
          provider_thread_id: threadId,
          from_email: payload.from,
          subject,
          received_at: receivedAt,
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
          role: "user",
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

        if (insertError) {
          throw insertError;
        }
      }

      const { error: jobUpdateError } = await serviceClient
        .from("jobs")
        .update({ last_activity_at: receivedAt })
        .eq("id", jobId);

      if (jobUpdateError) {
        throw jobUpdateError;
      }

      const { error: conversationUpdateError } = await serviceClient
        .from("conversations")
        .update({ last_message_at: receivedAt })
        .eq("id", conversationId);

      if (conversationUpdateError) {
        throw conversationUpdateError;
      }

      const processedAt = new Date().toISOString();
      await markEmailEventProcessed(event.id, processedAt);
      await updateEmailEventMeta(
        serviceClient,
        event,
        {
          job_id: jobId,
          conversation_id: conversationId,
          processed_at: processedAt,
        },
        { provider_thread_id: threadId }
      );

      result.status = existingMessage?.id ? "skipped" : "processed";
      result.job_id = jobId;
      result.conversation_id = conversationId;
      processed += 1;
    } catch (processingError) {
      const errorMessage =
        processingError instanceof Error
          ? processingError.message
          : "email_event_processing_failed";
      await markEmailEventError(event.id, errorMessage);
      await updateEmailEventMeta(
        serviceClient,
        event,
        { error: errorMessage, failed_at: new Date().toISOString() },
        typeof event.attempts === "number"
          ? { attempts: event.attempts + 1 }
          : {}
      );
      result.status = "error";
      result.error = errorMessage;
      errors += 1;
    }

    results.push(result);
  }

  return NextResponse.json({
    ok: true,
    processed,
    errors,
    results,
  });
}
