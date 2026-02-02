export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  sendGmailReply,
  sendMicrosoftReply,
  type ProviderSendResult,
} from "@/lib/email/send";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getValidAccessToken } from "@/lib/email/tokens";
import { getUserFromCookies } from "@/utils/supabase/auth";

type SendEmailRequest = {
  account_id?: string;
  client_id?: string;
  reply_to_email_event_id?: string;
  job_id?: string;
  body?: string;
  subject_override?: string;
};

type InboundEmailEvent = {
  id: string;
  account_id: string;
  client_id: string;
  provider: "google" | "microsoft";
  provider_message_id: string | null;
  provider_thread_id: string | null;
  from_email: string | null;
  subject: string | null;
  meta: Record<string, unknown> | null;
};

type EmailAccount = {
  id: string;
  client_id: string;
  provider: "google" | "microsoft";
  email_address: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
};

function isInternalAuthorized(request: NextRequest) {
  const expected = process.env.INTERNAL_JOBS_TOKEN;
  if (!expected) {
    return false;
  }

  const token = request.headers.get("x-internal-token");
  return token === expected;
}

function buildReplySubject(subject: string | null, override?: string | null) {
  if (override) {
    return override;
  }

  const normalized = subject?.trim() ?? "";
  if (!normalized) {
    return "Re:";
  }

  if (/^re:/i.test(normalized)) {
    return normalized;
  }

  return `Re: ${normalized}`;
}

function extractStringField(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

async function insertOutboundEvent(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  payload: {
    accountId: string;
    clientId: string;
    provider: "google" | "microsoft";
    providerMessageId: string | null;
    providerThreadId: string | null;
    fromEmail: string | null;
    toEmail: string;
    subject: string;
    body: string;
    status: "processed" | "error";
    queueStatus: "processed" | "error";
    errorMessage?: string;
    meta: Record<string, unknown>;
  }
) {
  const now = new Date().toISOString();
  const { error } = await serviceClient.from("email_events").insert({
    account_id: payload.accountId,
    client_id: payload.clientId,
    provider: payload.provider,
    direction: "outbound",
    provider_message_id: payload.providerMessageId,
    provider_thread_id: payload.providerThreadId,
    from_email: payload.fromEmail,
    to_emails: [payload.toEmail],
    subject: payload.subject,
    body_text: payload.body,
    body_html: null,
    received_at: now,
    status: payload.status,
    queue_status: payload.queueStatus,
    processed_at: payload.status === "processed" ? now : null,
    error: payload.errorMessage ?? null,
    meta: payload.meta,
  });

  if (error) {
    throw new Error("Failed to insert outbound email event");
  }
}

async function updateJobAndConversation(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  inbound: InboundEmailEvent
) {
  const meta = inbound.meta ?? {};
  const jobId = extractStringField(meta.job_id);
  const conversationId = extractStringField(meta.conversation_id);
  const now = new Date().toISOString();

  if (jobId) {
    const { error } = await serviceClient
      .from("jobs")
      .update({ last_activity_at: now })
      .eq("id", jobId);
    if (error) {
      throw new Error("Failed to update job activity");
    }
  }

  if (conversationId) {
    const { error } = await serviceClient
      .from("conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);
    if (error) {
      throw new Error("Failed to update conversation activity");
    }
  }
}

export async function POST(request: NextRequest) {
  let payload: SendEmailRequest;
  try {
    payload = (await request.json()) as SendEmailRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const accountId = payload.account_id?.trim();
  const clientId = payload.client_id?.trim();
  const replyToEventId = payload.reply_to_email_event_id?.trim();
  const jobId = payload.job_id?.trim();
  const body = payload.body?.trim();
  const subjectOverride = payload.subject_override?.trim() ?? null;

  if (!accountId || !clientId || !body) {
    return NextResponse.json({ error: "missing_required_fields" }, { status: 400 });
  }

  if (!replyToEventId && !jobId) {
    return NextResponse.json({ error: "missing_reply_target" }, { status: 400 });
  }

  const internalAuth = isInternalAuthorized(request);
  if (!internalAuth) {
    const user = await getUserFromCookies();
    if (!user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (user.id !== clientId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const serviceClient = createEmailServiceClient();

  const inboundQuery = replyToEventId
    ? serviceClient
        .from("email_events")
        .select(
          "id, account_id, client_id, provider, provider_message_id, provider_thread_id, from_email, subject, meta"
        )
        .eq("id", replyToEventId)
        .eq("account_id", accountId)
        .eq("client_id", clientId)
        .maybeSingle<InboundEmailEvent>()
    : serviceClient
        .from("email_events")
        .select(
          "id, account_id, client_id, provider, provider_message_id, provider_thread_id, from_email, subject, meta"
        )
        .eq("account_id", accountId)
        .eq("client_id", clientId)
        .eq("direction", "inbound")
        .filter("meta->>job_id", "eq", jobId ?? "")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<InboundEmailEvent>();

  const { data: inbound, error: inboundError } = await inboundQuery;

  if (inboundError) {
    console.error("Failed to load inbound email event", {
      accountId,
      clientId,
    });
    return NextResponse.json({ error: "inbound_lookup_failed" }, { status: 500 });
  }

  if (!inbound) {
    return NextResponse.json({ error: "inbound_not_found" }, { status: 404 });
  }

  if (inbound.provider !== "google" && inbound.provider !== "microsoft") {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  if (!inbound.provider_message_id) {
    return NextResponse.json(
      { error: "missing_provider_message_id" },
      { status: 400 }
    );
  }

  if (inbound.provider === "google" && !inbound.provider_thread_id) {
    return NextResponse.json(
      { error: "missing_provider_thread_id" },
      { status: 400 }
    );
  }

  if (!inbound.from_email) {
    return NextResponse.json({ error: "missing_from_email" }, { status: 400 });
  }

  const subject = buildReplySubject(inbound.subject, subjectOverride);
  const metaJobId =
    jobId ?? extractStringField((inbound.meta ?? {}).job_id);

  const { data: account, error: accountError } = await serviceClient
    .from("email_accounts")
    .select(
      "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes"
    )
    .eq("id", accountId)
    .eq("client_id", clientId)
    .eq("provider", inbound.provider)
    .maybeSingle<EmailAccount>();

  if (accountError) {
    console.error("Failed to load email account", {
      accountId,
      clientId,
      provider: inbound.provider,
    });
    return NextResponse.json({ error: "account_lookup_failed" }, { status: 500 });
  }

  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  let sendResult: ProviderSendResult;

  try {
    const accessToken = await getValidAccessToken(account);
    if (inbound.provider === "google") {
      sendResult = await sendGmailReply({
        accessToken,
        toEmail: inbound.from_email,
        subject,
        body,
        threadId: inbound.provider_thread_id!,
      });
    } else {
      sendResult = await sendMicrosoftReply({
        accessToken,
        mailbox: account.email_address,
        messageId: inbound.provider_message_id,
        body,
      });
    }

    await insertOutboundEvent(serviceClient, {
      accountId,
      clientId,
      provider: inbound.provider,
      providerMessageId: sendResult.providerMessageId,
      providerThreadId: inbound.provider_thread_id,
      fromEmail: account.email_address,
      toEmail: inbound.from_email,
      subject,
      body,
      status: "processed",
      queueStatus: "processed",
      meta: {
        in_reply_to: inbound.provider_message_id,
        provider_result: sendResult.providerResult,
        ...(metaJobId ? { job_id: metaJobId } : {}),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "email_send_failed";
    try {
      await insertOutboundEvent(serviceClient, {
        accountId,
        clientId,
        provider: inbound.provider,
        providerMessageId: null,
        providerThreadId: inbound.provider_thread_id,
        fromEmail: account.email_address,
        toEmail: inbound.from_email,
        subject,
        body,
        status: "error",
        queueStatus: "error",
        errorMessage: message,
        meta: {
          in_reply_to: inbound.provider_message_id,
          ...(metaJobId ? { job_id: metaJobId } : {}),
        },
      });
    } catch {
      // ignore secondary failure
    }

    console.error("Failed to send reply", {
      accountId,
      clientId,
      provider: inbound.provider,
      message,
    });
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  try {
    await updateJobAndConversation(serviceClient, inbound);
  } catch (error) {
    console.warn("Failed to update job/conversation state", {
      accountId,
      clientId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }

  return NextResponse.json({ ok: true });
}
