export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import {
  sendGmailReply,
  sendGmailCompose,
  sendMicrosoftReply,
  sendMicrosoftCompose,
  type ProviderSendResult,
  type Attachment,
} from "@/lib/email/send";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getValidAccessToken } from "@/lib/email/tokens";
import { getUserFromCookies } from "@/utils/supabase/auth";

type SendEmailRequest = {
  // Auth
  account_id?: string;
  client_id?: string;

  // Reply mode (existing)
  reply_to_email_event_id?: string;
  job_id?: string;

  // Compose mode (new) — set mode: "compose" and provide to_email + subject
  mode?: "reply" | "compose";
  to_email?: string;
  subject?: string;

  // Body (required for both modes)
  body?: string;
  html?: string;
  subject_override?: string;

  // Attachments — array of { url, filename } to download and attach
  attachment_urls?: Array<{ url: string; filename: string }>;
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
  if (!expected) return false;
  const token = request.headers.get("x-internal-token");
  return token === expected;
}

function buildReplySubject(subject: string | null, override?: string | null) {
  if (override) return override;
  const normalized = subject?.trim() ?? "";
  if (!normalized) return "Re:";
  if (/^re:/i.test(normalized)) return normalized;
  return `Re: ${normalized}`;
}

function extractStringField(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

async function downloadAttachments(
  urls: Array<{ url: string; filename: string }>
): Promise<Attachment[]> {
  const results: Attachment[] = [];
  for (const item of urls) {
    const res = await fetch(item.url);
    if (!res.ok) {
      console.warn(`Failed to download attachment: ${item.url} (${res.status})`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get("content-type") || guessContentType(item.filename);
    results.push({
      filename: item.filename,
      contentType,
      contentBase64: buf.toString("base64"),
    });
  }
  return results;
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
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
    meta: payload.meta as import("@/types/supabase").Json,
  });

  if (error) {
    throw new Error("Failed to insert outbound email event");
  }
}

async function updateJobActivity(
  serviceClient: ReturnType<typeof createEmailServiceClient>,
  jobId: string | null
) {
  if (!jobId) return;
  const now = new Date().toISOString();
  await serviceClient
    .from("jobs")
    .update({ last_activity_at: now })
    .eq("id", jobId);
}

export async function POST(request: NextRequest) {
  let payload: SendEmailRequest;
  try {
    payload = (await request.json()) as SendEmailRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const clientId = payload.client_id?.trim();
  const body = payload.body?.trim();
  const isCompose = payload.mode === "compose";

  if (!clientId || !body) {
    return NextResponse.json(
      { error: "missing_required_fields" },
      { status: 400 }
    );
  }

  // Auth check
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

  // ── COMPOSE MODE ──────────────────────────────────────────────────────
  if (isCompose) {
    const toEmail = payload.to_email?.trim();
    const subject = payload.subject?.trim();

    if (!toEmail || !subject) {
      return NextResponse.json(
        { error: "compose_requires_to_email_and_subject" },
        { status: 400 }
      );
    }

    // Find the user's connected email account (first active one)
    const accountId = payload.account_id?.trim();
    const accountQuery = accountId
      ? serviceClient
          .from("email_accounts")
          .select(
            "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes"
          )
          .eq("id", accountId)
          .eq("client_id", clientId)
          .eq("status", "connected")
          .maybeSingle<EmailAccount>()
      : serviceClient
          .from("email_accounts")
          .select(
            "id, client_id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes"
          )
          .eq("client_id", clientId)
          .eq("status", "connected")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle<EmailAccount>();

    const { data: account, error: accountError } = await accountQuery;

    if (accountError || !account) {
      return NextResponse.json(
        { error: "no_connected_email_account" },
        { status: 404 }
      );
    }

    const mailbox = extractStringField(account.email_address);
    if (!mailbox) {
      return NextResponse.json(
        { error: "missing_account_email" },
        { status: 400 }
      );
    }

    // Fetch the user's business name for the From header
    const { data: client } = await serviceClient
      .from("clients")
      .select("business_name, email")
      .eq("id", clientId)
      .maybeSingle();
    const fromName = (client?.business_name as string) || "BillyBot";
    const replyToEmail = (client?.email as string) || mailbox;

    // Download attachments if provided
    let attachments: Attachment[] = [];
    if (payload.attachment_urls && payload.attachment_urls.length > 0) {
      attachments = await downloadAttachments(payload.attachment_urls);
    }

    let sendResult: ProviderSendResult;
    const jobId = payload.job_id?.trim() ?? null;

    try {
      const accessToken = await getValidAccessToken(account);

      if (account.provider === "google") {
        sendResult = await sendGmailCompose({
          accessToken,
          fromName,
          toEmail,
          subject,
          body,
          html: payload.html,
          replyTo: replyToEmail,
          attachments,
        });
      } else {
        sendResult = await sendMicrosoftCompose({
          accessToken,
          mailbox,
          toEmail,
          subject,
          body,
          html: payload.html,
          attachments,
        });
      }

      await insertOutboundEvent(serviceClient, {
        accountId: account.id,
        clientId,
        provider: account.provider,
        providerMessageId: sendResult.providerMessageId,
        providerThreadId: sendResult.providerThreadId,
        fromEmail: mailbox,
        toEmail,
        subject,
        body,
        status: "processed",
        queueStatus: "processed",
        meta: {
          compose: true,
          provider_result: sendResult.providerResult,
          ...(jobId ? { job_id: jobId } : {}),
          ...(attachments.length > 0
            ? {
                attachments: attachments.map((a) => ({
                  filename: a.filename,
                  contentType: a.contentType,
                })),
              }
            : {}),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "email_send_failed";
      console.error("Failed to send compose email", {
        clientId,
        provider: account.provider,
        message,
      });
      return NextResponse.json({ error: "send_failed", detail: message }, { status: 500 });
    }

    try {
      await updateJobActivity(serviceClient, jobId);
    } catch {
      // non-critical
    }

    return NextResponse.json({ ok: true });
  }

  // ── REPLY MODE (existing) ─────────────────────────────────────────────
  const accountId = payload.account_id?.trim();
  const replyToEventId = payload.reply_to_email_event_id?.trim();
  const jobId = payload.job_id?.trim();
  const subjectOverride = payload.subject_override?.trim() ?? null;

  if (!accountId) {
    return NextResponse.json(
      { error: "missing_account_id" },
      { status: 400 }
    );
  }

  if (!replyToEventId && !jobId) {
    return NextResponse.json(
      { error: "missing_reply_target" },
      { status: 400 }
    );
  }

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
    return NextResponse.json(
      { error: "inbound_lookup_failed" },
      { status: 500 }
    );
  }

  if (!inbound) {
    return NextResponse.json(
      { error: "inbound_not_found" },
      { status: 404 }
    );
  }

  if (inbound.provider !== "google" && inbound.provider !== "microsoft") {
    return NextResponse.json(
      { error: "unsupported_provider" },
      { status: 400 }
    );
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
    return NextResponse.json(
      { error: "missing_from_email" },
      { status: 400 }
    );
  }

  const subject = buildReplySubject(inbound.subject, subjectOverride);
  const metaJobId = jobId ?? extractStringField((inbound.meta ?? {}).job_id);

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
    return NextResponse.json(
      { error: "account_lookup_failed" },
      { status: 500 }
    );
  }

  if (!account) {
    return NextResponse.json(
      { error: "account_not_found" },
      { status: 404 }
    );
  }

  const mailbox = extractStringField(account.email_address);

  if (!mailbox) {
    return NextResponse.json(
      { error: "missing_account_email" },
      { status: 400 }
    );
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
        mailbox,
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
    await updateJobActivity(serviceClient, metaJobId);
  } catch {
    // non-critical
  }

  return NextResponse.json({ ok: true });
}
