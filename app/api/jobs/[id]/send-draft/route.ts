export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { sendGmailReply, sendMicrosoftReply } from "@/lib/email/send";
import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getValidAccessToken } from "@/lib/email/tokens";
import { getUserFromCookies } from "@/utils/supabase/auth";

type InboundEmailEvent = {
  id: string;
  account_id: string;
  provider: "google" | "microsoft";
  provider_message_id: string | null;
  provider_thread_id: string | null;
  from_email: string | null;
  subject: string | null;
};

type EmailAccount = {
  id: string;
  provider: "google" | "microsoft";
  email_address: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: string | null;
  scopes: string[] | null;
};

type JobRecord = {
  id: string;
  client_id: string;
  email_event_id: string | null;
  outbound_email_subject: string | null;
  outbound_email_body: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  // Allow optional body override from the request
  let bodyOverride: string | null = null;
  let subjectOverride: string | null = null;
  try {
    const payload = (await request.json()) as { body?: string; subject?: string };
    bodyOverride = payload.body?.trim() || null;
    subjectOverride = payload.subject?.trim() || null;
  } catch {
    // no body is fine
  }

  const serviceClient = createEmailServiceClient();

  // Fetch job
  const { data: job, error: jobError } = await serviceClient
    .from("jobs")
    .select("id, client_id, email_event_id, outbound_email_subject, outbound_email_body")
    .eq("id", jobId)
    .eq("client_id", user.id)
    .maybeSingle<JobRecord>();

  if (jobError || !job) {
    return NextResponse.json({ error: "job_not_found" }, { status: 404 });
  }

  const body = bodyOverride ?? job.outbound_email_body;
  const subject = subjectOverride ?? job.outbound_email_subject;

  if (!body) {
    return NextResponse.json({ error: "no_draft_body" }, { status: 400 });
  }

  if (!job.email_event_id) {
    return NextResponse.json({ error: "no_email_event" }, { status: 400 });
  }

  // Fetch the inbound email event
  const { data: inbound, error: inboundError } = await serviceClient
    .from("email_events")
    .select("id, account_id, provider, provider_message_id, provider_thread_id, from_email, subject")
    .eq("id", job.email_event_id)
    .eq("client_id", user.id)
    .maybeSingle<InboundEmailEvent>();

  if (inboundError || !inbound) {
    return NextResponse.json({ error: "email_event_not_found" }, { status: 404 });
  }

  if (!inbound.from_email) {
    return NextResponse.json({ error: "missing_recipient" }, { status: 400 });
  }

  if (!inbound.provider_message_id) {
    return NextResponse.json({ error: "missing_provider_message_id" }, { status: 400 });
  }

  // Fetch email account for tokens
  const { data: account, error: accountError } = await serviceClient
    .from("email_accounts")
    .select("id, provider, email_address, access_token_enc, refresh_token_enc, expires_at, scopes")
    .eq("id", inbound.account_id)
    .eq("client_id", user.id)
    .maybeSingle<EmailAccount>();

  if (accountError || !account) {
    return NextResponse.json({ error: "email_account_not_found" }, { status: 404 });
  }

  // Build reply subject
  const replySubject = subject?.trim() || (
    inbound.subject && !/^re:/i.test(inbound.subject.trim())
      ? `Re: ${inbound.subject}`
      : (inbound.subject ?? "Re:")
  );

  try {
    const accessToken = await getValidAccessToken(account);
    const now = new Date().toISOString();

    if (inbound.provider === "google") {
      if (!inbound.provider_thread_id) {
        return NextResponse.json({ error: "missing_thread_id" }, { status: 400 });
      }
      await sendGmailReply({
        accessToken,
        toEmail: inbound.from_email,
        subject: replySubject,
        body,
        threadId: inbound.provider_thread_id,
      });
    } else {
      await sendMicrosoftReply({
        accessToken,
        mailbox: account.email_address ?? "",
        messageId: inbound.provider_message_id,
        body,
      });
    }

    // Record the outbound email event
    await serviceClient.from("email_events").insert({
      account_id: inbound.account_id,
      client_id: user.id,
      provider: inbound.provider,
      direction: "outbound",
      provider_thread_id: inbound.provider_thread_id,
      from_email: account.email_address,
      to_emails: [inbound.from_email],
      subject: replySubject,
      body_text: body,
      body_html: null,
      received_at: now,
      status: "processed",
      queue_status: "processed",
      meta: { in_reply_to: inbound.provider_message_id, job_id: jobId },
    });

    // Clear the draft from the job
    await serviceClient
      .from("jobs")
      .update({
        outbound_email_subject: null,
        outbound_email_body: null,
        last_activity_at: now,
      })
      .eq("id", jobId)
      .eq("client_id", user.id);

  } catch (err) {
    console.error("[send-draft] send failed", err);
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
