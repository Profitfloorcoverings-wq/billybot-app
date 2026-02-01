export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { JOB_STATUS_OPTIONS } from "@/app/jobs/constants";
import JobStatusBadge from "@/app/jobs/components/JobStatusBadge";
import ProviderBadge from "@/app/jobs/components/ProviderBadge";
import TimelineItem from "@/app/jobs/components/TimelineItem";
import {
  formatRelativeTime,
  formatTimestamp,
  humanizeStatus,
  normalizeStatus,
  stripHtml,
  JOB_SELECT,
} from "@/app/jobs/utils";
import { createServerClient } from "@/utils/supabase/server";

type Job = {
  id: string;
  title?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  site_address?: string | null;
  postcode?: string | null;
  provider?: string | null;
  provider_thread_id?: string | null;
  last_activity_at?: string | null;
  conversation_id?: string | null;
  job_details?: string | null;
  created_at?: string | null;
  provider_message_id?: string | null;
  metadata?: Record<string, unknown> | null;
  job_thread_id?: string | null;
  client_id?: string | null;
  profile_id?: string | null;
};

type EmailEvent = {
  id: string;
  direction?: "inbound" | "outbound" | null;
  from_email?: string | null;
  to_emails?: string[] | null;
  cc_emails?: string[] | null;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  received_at?: string | null;
  created_at?: string | null;
};

type Quote = {
  id: string;
  quote_reference?: string | null;
  pdf_url?: string | null;
  created_at?: string | null;
  status?: string | null;
  job_id?: string | null;
  job_ref?: string | null;
};

type Message = {
  id: string | number;
  role?: string | null;
  content?: string | null;
  created_at?: string | null;
};

type TimelineEntry = {
  id: string;
  type: "email" | "chat" | "quote";
  title: string;
  subtitle?: string | null;
  preview?: string | null;
  body?: string | null;
  timestamp?: string | null;
  pdfUrl?: string | null;
};

type JobDetailPageProps = {
  params: { id: string };
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function getDebugFlag() {
  const headerList = await headers();
  const url =
    headerList.get("x-url") ??
    headerList.get("next-url") ??
    headerList.get("referer") ??
    "";
  if (!url) return false;

  try {
    const parsed = new URL(url, "http://localhost");
    return parsed.searchParams.get("debug") === "1";
  } catch {
    return false;
  }
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const supabase = await createServerClient();
  const debugEnabled = await getDebugFlag();
  const jobId = params?.id;

  if (!jobId || !isUuid(jobId)) {
    return notFound();
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    if (!debugEnabled) {
      redirect("/auth/login");
    }

    return (
      <div className="page-container">
        <div className="empty-state">Not signed in.</div>
        <div className="card mt-4">
          <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap">
            {JSON.stringify(
              {
                user_error: userError?.message ?? null,
                node_env: process.env.NODE_ENV ?? null,
                supabase_url_host: process.env.NEXT_PUBLIC_SUPABASE_URL
                  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
                  : null,
              },
              null,
              2
            )}
          </pre>
        </div>
      </div>
    );
  }

  const { data: jobData, error: jobError } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", jobId)
    .eq("client_id", user.id)
    .single<Job>();

  if (jobError || !jobData) {
    return (
      <div className="page-container">
        <div className="empty-state stack items-center">
          <h3 className="section-title">Job not found</h3>
          <p className="section-subtitle">
            We couldn&apos;t load this job. It may have been removed or you may not
            have access.
          </p>
          <Link href="/jobs" className="btn btn-primary">
            Back to Jobs
          </Link>
        </div>
        {debugEnabled ? (
          <div className="card mt-4">
            <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap">
              {JSON.stringify(
                {
                  jobId,
                  job_error: jobError?.message ?? null,
                },
                null,
                2
              )}
            </pre>
          </div>
        ) : null}
      </div>
    );
  }

  let emails: EmailEvent[] = [];
  let quotes: Quote[] = [];
  let messages: Message[] = [];

  if (jobData.id) {
    const { data: emailData } = await supabase
      .from("email_events")
      .select(
        "id, direction, from_email, to_emails, cc_emails, subject, body_text, body_html, received_at, created_at"
      )
      .eq("client_id", user.id)
      .eq("job_id", jobData.id)
      .order("received_at", { ascending: true });

    emails = emailData ?? [];
  }

  if (!emails.length && jobData.provider && jobData.provider_thread_id) {
    const { data: fallbackEmails } = await supabase
      .from("email_events")
      .select(
        "id, direction, from_email, to_emails, cc_emails, subject, body_text, body_html, received_at, created_at"
      )
      .eq("client_id", user.id)
      .eq("provider", jobData.provider)
      .eq("provider_thread_id", jobData.provider_thread_id)
      .order("received_at", { ascending: true });

    emails = fallbackEmails ?? [];
  }

  if (jobData.conversation_id && isUuid(jobData.conversation_id)) {
    const { data: messageData } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("profile_id", user.id)
      .eq("conversation_id", jobData.conversation_id)
      .order("created_at", { ascending: true });

    messages = messageData ?? [];
  }

  if (jobData.id) {
    const { data: quoteData } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, created_at, status, job_id, job_ref")
      .eq("client_id", user.id)
      .eq("job_id", jobData.id)
      .order("created_at", { ascending: false });

    quotes = quoteData ?? [];
  }

  if (!quotes.length && jobData.title) {
    const { data: fallbackQuotes } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, created_at, status, job_id, job_ref")
      .eq("client_id", user.id)
      .eq("job_ref", jobData.title)
      .order("created_at", { ascending: false });

    quotes = fallbackQuotes ?? [];
  }

  const timeline: TimelineEntry[] = [];

  emails.forEach((email) => {
    const directionLabel = email.direction === "outbound" ? "Outbound" : "Inbound";
    const from = email.from_email ?? "Unknown sender";
    const to = email.to_emails?.join(", ") ?? "Unknown recipient";
    const subtitle = `${directionLabel} · ${from} → ${to}`;
    const timestamp = email.received_at ?? email.created_at ?? null;
    const bodyText = email.body_text?.trim();
    const bodyHtml = stripHtml(email.body_html);
    const preview = bodyText || bodyHtml;
    const body = [bodyText, bodyText && bodyHtml ? "" : null, bodyHtml]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join("\n\n");

    timeline.push({
      id: `email-${email.id}`,
      type: "email",
      title: email.subject?.trim() || "Email update",
      subtitle,
      preview: preview ? preview.slice(0, 200) : null,
      body: body || null,
      timestamp,
    });
  });

  messages.forEach((message) => {
    const role = message.role ?? "user";
    timeline.push({
      id: `chat-${message.id}`,
      type: "chat",
      title: `${role.toString().toUpperCase()} message`,
      subtitle: "Chat conversation",
      preview: message.content?.trim().slice(0, 200) ?? null,
      body: message.content?.trim() ?? null,
      timestamp: message.created_at ?? null,
    });
  });

  quotes.forEach((quote) => {
    timeline.push({
      id: `quote-${quote.id}`,
      type: "quote",
      title: quote.quote_reference ? `Quote ${quote.quote_reference}` : "Quote created",
      subtitle: quote.status ? `Status: ${humanizeStatus(quote.status)}` : null,
      preview: quote.pdf_url ? "Quote PDF available" : "Quote ready",
      body: quote.pdf_url ?? null,
      timestamp: quote.created_at ?? null,
      pdfUrl: quote.pdf_url ?? null,
    });
  });

  timeline.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return aTime - bTime;
  });

  const inboundEmails = emails.filter((email) => email.direction !== "outbound");
  const outboundEmails = emails.filter((email) => email.direction === "outbound");
  const lastInbound = inboundEmails.at(-1)?.received_at ?? inboundEmails.at(-1)?.created_at;
  const jobTitle = jobData.title?.trim() || "Untitled job";
  const jobDetails = jobData.job_details?.trim() || "";
  const lastActivityLabel = formatRelativeTime(jobData.last_activity_at);
  const lastActivityExact = formatTimestamp(jobData.last_activity_at);
  const chatHref = jobData.conversation_id
    ? `/chat?conversation_id=${jobData.conversation_id}`
    : "/chat";

  return (
    <div className="page-container stack gap-6">
      <div className="card stack gap-2">
        <h1 className="section-title">Job Detail</h1>
        <p className="text-xs text-[var(--muted)]">ID: {jobId}</p>
        <p className="text-sm text-white">{jobData.title?.trim() || "Untitled job"}</p>
        <p className="text-sm text-[var(--muted)]">
          {jobData.customer_name || "Unknown customer"}
        </p>
      </div>

      <div className="section-header items-start">
        <div className="stack gap-2">
          <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
            ← Back to Jobs
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="section-title">{jobTitle}</h1>
            <JobStatusBadge status={jobData.status} />
          </div>
          <p className="text-xs text-[var(--muted)]" title={lastActivityExact}>
            Last activity {lastActivityLabel}
          </p>
        </div>
        <div className="stack items-end gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Status</p>
          <select
            className="input-fluid"
            defaultValue={normalizeStatus(jobData.status)}
            disabled
            title="Status updates are currently read-only."
          >
            {JOB_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {debugEnabled ? (
        <div className="card">
          <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap">
            {JSON.stringify(
              {
                jobId,
                job_id: jobData.id ?? null,
                conversation_id: jobData.conversation_id ?? null,
                provider: jobData.provider ?? null,
                provider_thread_id: jobData.provider_thread_id ?? null,
              },
              null,
              2
            )}
          </pre>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="stack gap-6">
          <div className="card stack gap-4">
            <div className="stack gap-1">
              <h2 className="section-title text-lg">Overview</h2>
              <p className="section-subtitle">Customer and request details.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="stack gap-1">
                <p className="section-subtitle">Customer</p>
                <p className="text-sm text-white">{jobData.customer_name || "Unknown"}</p>
                <p className="text-xs text-[var(--muted)]">
                  {jobData.customer_email || "—"}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {jobData.customer_phone || "—"}
                </p>
              </div>
              <div className="stack gap-1">
                <p className="section-subtitle">Site</p>
                <p className="text-sm text-white">{jobData.site_address || "—"}</p>
                <p className="text-xs text-[var(--muted)]">{jobData.postcode || "—"}</p>
              </div>
            </div>
            <div className="stack gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ProviderBadge provider={jobData.provider} />
                {jobData.provider_thread_id ? (
                  <span className="text-xs text-[var(--muted)]">
                    Thread {jobData.provider_thread_id}
                  </span>
                ) : null}
              </div>
              <div>
                <p className="section-subtitle">Job details</p>
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">
                  {jobDetails || "No request details captured yet."}
                </p>
              </div>
            </div>
          </div>

          <div className="card stack gap-4">
            <div className="stack gap-1">
              <h2 className="section-title text-lg">Timeline</h2>
              <p className="section-subtitle">
                Emails, chat messages, and quotes in chronological order.
              </p>
            </div>
            {timeline.length === 0 ? (
              <div className="empty-state">No activity yet.</div>
            ) : (
              <div className="stack gap-3">
                {timeline.map((item) => {
                  if (item.type === "email") {
                    return (
                      <TimelineItem
                        key={item.id}
                        icon="✉️"
                        title={item.title}
                        subtitle={item.subtitle}
                        timestamp={item.timestamp}
                        preview={item.preview}
                      >
                        {item.body || "No email body captured."}
                      </TimelineItem>
                    );
                  }

                  if (item.type === "chat") {
                    return (
                      <TimelineItem
                        key={item.id}
                        icon="💬"
                        title={item.title}
                        subtitle={item.subtitle}
                        timestamp={item.timestamp}
                        preview={item.preview}
                      >
                        {item.body || "No message content."}
                      </TimelineItem>
                    );
                  }

                  return (
                    <TimelineItem
                      key={item.id}
                      icon="📄"
                      title={item.title}
                      subtitle={item.subtitle}
                      timestamp={item.timestamp}
                      preview={item.preview}
                    >
                      {item.pdfUrl ? (
                        <a
                          href={item.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-[var(--accent2)] underline"
                        >
                          Open quote PDF
                        </a>
                      ) : (
                        "Quote created without a PDF link."
                      )}
                    </TimelineItem>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="stack gap-6">
          <div className="card stack gap-3">
            <h3 className="section-title text-lg">Actions</h3>
            <Link
              href={chatHref}
              className={`btn btn-secondary w-full justify-center ${
                jobData.conversation_id ? "" : "pointer-events-none opacity-60"
              }`}
              title={
                jobData.conversation_id
                  ? "Open the related conversation"
                  : "No conversation linked to this job yet"
              }
            >
              View conversation
            </Link>
            <button
              className="btn btn-primary w-full justify-center"
              disabled
              title="Quote creation is not available from this view yet"
            >
              Create quote
            </button>
          </div>

          <div className="card stack gap-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-lg">Quotes</h3>
              <span className="text-xs text-[var(--muted)]">{quotes.length} total</span>
            </div>
            {quotes.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No quotes linked to this job yet.
              </p>
            ) : (
              <div className="stack gap-3">
                {quotes.map((quote) => {
                  const label = quote.quote_reference
                    ? `Quote ${quote.quote_reference}`
                    : "Quote";
                  const createdAt = formatTimestamp(quote.created_at);
                  return (
                    <div key={quote.id} className="surface p-3 stack gap-1">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-[var(--muted)]">{createdAt}</p>
                      {quote.status ? (
                        <span className="text-xs text-[var(--muted)]">
                          Status: {humanizeStatus(quote.status)}
                        </span>
                      ) : null}
                      {quote.pdf_url ? (
                        <a
                          href={quote.pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[var(--accent2)] underline"
                        >
                          Open PDF
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card stack gap-3">
            <h3 className="section-title text-lg">Emails</h3>
            <div className="metric-grid">
              <div className="metric">
                <p className="metric-label">Inbound</p>
                <p className="metric-value">{inboundEmails.length}</p>
              </div>
              <div className="metric">
                <p className="metric-label">Outbound</p>
                <p className="metric-value">{outboundEmails.length}</p>
              </div>
              <div className="metric">
                <p className="metric-label">Last inbound</p>
                <p className="metric-value text-base" title={formatTimestamp(lastInbound)}>
                  {formatRelativeTime(lastInbound)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
