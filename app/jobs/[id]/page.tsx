export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import JobStatusBadge from "@/app/jobs/components/JobStatusBadge";
import ProviderBadge from "@/app/jobs/components/ProviderBadge";
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
  outbound_email_subject?: string | null;
  outbound_email_body?: string | null;
  email_event_id?: string | null;
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
  status?: string | null;
  queue_status?: string | null;
  attempts?: number | null;
  last_error?: string | null;
  attachments?: unknown[] | null;
  provider_thread_id?: string | null;
  provider_message_id?: string | null;
};

type Quote = {
  id: string;
  quote_reference?: string | null;
  pdf_url?: string | null;
  created_at?: string | null;
  status?: string | null;
  version?: number | null;
  job_ref?: string | null;
};

type AttachmentSummary = {
  name: string;
  type: string;
  sizeLabel?: string | null;
};

type StatusProgress = {
  label: string;
  nextStep: string;
  percent: number;
};

type JobDetailPageProps = {
  params: { id?: string | string[] };
  searchParams?: Record<string, string | string[] | undefined>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_PROGRESS: Array<{
  keys: string[];
  percent: number;
  nextStep: string;
  label: string;
}> = [
  {
    keys: ["new", "created", "open"],
    percent: 15,
    nextStep: "Review the request and confirm key details with the customer.",
    label: "New",
  },
  {
    keys: ["in_progress", "active", "working"],
    percent: 45,
    nextStep: "Update the customer with progress and confirm timelines.",
    label: "In progress",
  },
  {
    keys: ["awaiting_info", "waiting", "on_hold"],
    percent: 55,
    nextStep: "Waiting on information. Follow up if it has been more than 24h.",
    label: "Waiting",
  },
  {
    keys: ["quoted", "quote_sent", "quote"],
    percent: 70,
    nextStep: "Quote sent. Prompt for approval or propose adjustments.",
    label: "Quoted",
  },
  {
    keys: ["won", "completed", "closed_won", "done"],
    percent: 100,
    nextStep: "Job won. Schedule delivery and close out the work.",
    label: "Won",
  },
  {
    keys: ["lost", "closed_lost", "cancelled", "canceled"],
    percent: 100,
    nextStep: "Job closed as lost. Archive or reopen if needed.",
    label: "Lost",
  },
];

function normalizeParamId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function getStatusProgress(status?: string | null): StatusProgress {
  const normalized = normalizeStatus(status);
  const match = STATUS_PROGRESS.find((entry) => entry.keys.includes(normalized));
  if (match) {
    return {
      label: match.label,
      nextStep: match.nextStep,
      percent: match.percent,
    };
  }

  return {
    label: humanizeStatus(status),
    nextStep: "Review the job details and decide the next action.",
    percent: 25,
  };
}

function getJobSummary(details?: string | null) {
  const cleaned = stripHtml(details ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "No summary captured yet.";
  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 220)}…`;
}

function formatEmailList(value?: string[] | null) {
  if (!value || value.length === 0) return "—";
  return value.join(", ");
}

function formatBytes(bytes?: number | null) {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getAttachmentSummary(attachments?: unknown[] | null): AttachmentSummary[] {
  if (!attachments || !Array.isArray(attachments)) return [];

  return attachments.map((item, index) => {
    const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const name =
      (record.filename as string | undefined) ||
      (record.name as string | undefined) ||
      `Attachment ${index + 1}`;
    const type =
      (record.mime_type as string | undefined) ||
      (record.content_type as string | undefined) ||
      (record.type as string | undefined) ||
      "Unknown";
    const sizeLabel = formatBytes(record.size as number | undefined);

    return { name, type, sizeLabel };
  });
}

function CopyIdChip({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
      <span className="uppercase tracking-[0.2em]">Job ID</span>
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-[var(--muted)] break-anywhere">
        {id}
      </span>
      <button
        type="button"
        className="btn btn-secondary h-7 px-3 text-[10px] uppercase tracking-[0.2em] opacity-80"
        title="Copy job ID"
      >
        Copy
      </button>
    </div>
  );
}

async function getDebugFlagFromHeaders() {
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

async function getJobIdFromHeaders() {
  const headerList = await headers();
  const url =
    headerList.get("x-url") ??
    headerList.get("next-url") ??
    headerList.get("referer") ??
    "";
  if (!url) return "";

  try {
    const parsed = new URL(url, "http://localhost");
    const pathname = parsed.pathname;
    if (!pathname.startsWith("/jobs/")) return "";
    const parts = pathname.split("/").filter(Boolean);
    return parts[1] ?? "";
  } catch {
    return "";
  }
}

export default async function JobDetailPage({ params, searchParams }: JobDetailPageProps) {
  const supabase = await createServerClient();
  const debugEnabled =
    searchParams?.debug === "1" || (await getDebugFlagFromHeaders());
  const paramsId = normalizeParamId(params?.id);
  const headerId = paramsId ? "" : await getJobIdFromHeaders();
  const jobId = String(paramsId || headerId);
  const isValidJobId = UUID_RE.test(jobId);

  if (!isValidJobId) {
    return (
      <div className="container">
        <div className="empty-state stack items-center">
          <h3 className="section-title">Invalid job id</h3>
          <p className="section-subtitle">
            The job link is invalid. Return to the Jobs list and try again.
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
                  params,
                  params_id: params?.id ?? null,
                  header_id: headerId || null,
                  jobId,
                  isValidJobId,
                  job_found: false,
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

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    if (!debugEnabled) {
      redirect("/auth/login");
    }

    return (
      <div className="container">
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

  if (jobError) {
    return (
      <div className="container">
        <div className="empty-state stack items-center">
          <h3 className="section-title">Unable to load job</h3>
          <p className="section-subtitle">
            There was an issue loading this job. Please try again shortly.
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
                  user_id: user.id,
                  job_error: {
                    message: jobError.message,
                    code: "code" in jobError ? jobError.code : null,
                  },
                  job_found: false,
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

  if (!jobData) {
    return (
      <div className="container">
        <div className="empty-state stack items-center">
          <h3 className="section-title">Job not found</h3>
          <p className="section-subtitle">
            We couldn&apos;t find this job or you don&apos;t have access to it.
          </p>
          <Link href="/jobs" className="btn btn-primary">
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  let quotes: Quote[] = [];
  let emailEvent: EmailEvent | null = null;
  let emailFallback = "none";
  let quoteFallback = "none";

  const { data: directQuotes } = await supabase
    .from("quotes")
    .select("id, quote_reference, pdf_url, created_at, status, version, job_ref")
    .eq("client_id", user.id)
    .eq("job_ref", jobData.id)
    .order("created_at", { ascending: false });

  quotes = directQuotes ?? [];

  if (quotes.length) {
    quoteFallback = "job_ref";
  }

  if (!quotes.length) {
    const { data: fallbackQuotes } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, created_at, status, version, job_ref")
      .eq("client_id", user.id)
      .ilike("job_details", `%${jobData.id}%`)
      .order("created_at", { ascending: false });

    quotes = fallbackQuotes ?? [];
    if (quotes.length) {
      quoteFallback = "job_details";
    }
  }

  if (jobData.email_event_id) {
    const { data } = await supabase
      .from("email_events")
      .select(
        "id, direction, from_email, to_emails, cc_emails, subject, body_text, body_html, received_at, created_at, status, queue_status, attempts, last_error, attachments, provider_thread_id, provider_message_id"
      )
      .eq("client_id", user.id)
      .eq("id", jobData.email_event_id)
      .maybeSingle<EmailEvent>();

    emailEvent = data ?? null;
    if (emailEvent) {
      emailFallback = "email_event_id";
    }
  }

  if (!emailEvent && jobData.provider_thread_id) {
    let query = supabase
      .from("email_events")
      .select(
        "id, direction, from_email, to_emails, cc_emails, subject, body_text, body_html, received_at, created_at, status, queue_status, attempts, last_error, attachments, provider_thread_id, provider_message_id"
      )
      .eq("client_id", user.id)
      .eq("provider_thread_id", jobData.provider_thread_id)
      .order("received_at", { ascending: false })
      .limit(1);

    if (jobData.provider) {
      query = query.eq("provider", jobData.provider);
    }

    const { data } = await query;
    emailEvent = data?.[0] ?? null;

    if (emailEvent) {
      emailFallback = "provider_thread_id";
    }
  }

  if (!emailEvent && jobData.customer_email) {
    const { data } = await supabase
      .from("email_events")
      .select(
        "id, direction, from_email, to_emails, cc_emails, subject, body_text, body_html, received_at, created_at, status, queue_status, attempts, last_error, attachments, provider_thread_id, provider_message_id"
      )
      .eq("client_id", user.id)
      .eq("direction", "inbound")
      .ilike("from_email", jobData.customer_email)
      .order("received_at", { ascending: false })
      .limit(1);

    emailEvent = data?.[0] ?? null;

    if (emailEvent) {
      emailFallback = "customer_email";
    }
  }

  const jobTitle = jobData.title?.trim() || "Job";
  const customerName = jobData.customer_name?.trim() || "Unknown customer";
  const customerEmail = jobData.customer_email?.trim() || "";
  const customerPhone = jobData.customer_phone?.trim() || "";
  const jobDetails = jobData.job_details?.trim() || "";
  const lastActivityLabel = formatRelativeTime(jobData.last_activity_at);
  const lastActivityExact = formatTimestamp(jobData.last_activity_at);
  const chatHref = jobData.conversation_id
    ? `/chat?conversation_id=${jobData.conversation_id}`
    : "/chat";
  const statusProgress = getStatusProgress(jobData.status);
  const jobSummary = getJobSummary(jobDetails);
  const hasDraft = Boolean(jobData.outbound_email_subject || jobData.outbound_email_body);
  const emailAttachments = getAttachmentSummary(emailEvent?.attachments);
  const emailBody =
    emailEvent?.body_text?.trim() ||
    stripHtml(emailEvent?.body_html)?.trim() ||
    "";
  const emailPreview = emailBody ? emailBody.slice(0, 280) : "No email body available.";
  const emailReceivedAt = emailEvent?.received_at ?? emailEvent?.created_at ?? null;
  const emailReceivedLabel = formatRelativeTime(emailReceivedAt);
  const emailReceivedExact = formatTimestamp(emailReceivedAt);

  const latestQuotePdf = quotes.find((q) => q.pdf_url)?.pdf_url ?? null;
  const createdAtLabel = formatTimestamp(jobData.created_at);

  return (
    <div className="page-container stack gap-8">
      {/* ── Hero Header ── */}
      <div className="stack gap-4">
        <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white transition-colors">
          &larr; Back to Jobs
        </Link>

        <div className="stack gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
            {jobTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <JobStatusBadge status={jobData.status} />
            <span className="text-base font-semibold text-white">{customerName}</span>
            <span className="text-sm text-[var(--muted)]" title={lastActivityExact}>
              {lastActivityLabel}
            </span>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-3">
          {customerPhone ? (
            <a href={`tel:${customerPhone}`} className="btn btn-primary h-11 px-5">
              Call {customerPhone}
            </a>
          ) : null}
          {customerEmail ? (
            <a href={`mailto:${customerEmail}`} className="btn btn-secondary h-11 px-5">
              Email
            </a>
          ) : null}
          <Link
            href={chatHref}
            className={`btn btn-secondary h-11 px-5 ${
              jobData.conversation_id ? "" : "pointer-events-none opacity-50"
            }`}
            title={
              jobData.conversation_id
                ? "Open the related conversation"
                : "No conversation linked yet"
            }
          >
            View Conversation
          </Link>
          {latestQuotePdf ? (
            <a
              href={latestQuotePdf}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary h-11 px-5"
            >
              Open Latest Quote
            </a>
          ) : null}
          {hasDraft ? (
            <Link href="#draft" className="btn btn-secondary h-11 px-5">
              Review Draft
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Debug panel (only with ?debug=1) ── */}
      {debugEnabled ? (
        <div className="card">
          <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap">
            {JSON.stringify(
              {
                params,
                params_id: params?.id ?? null,
                header_id: headerId || null,
                jobId,
                isValidJobId,
                job_id: jobData.id ?? null,
                user_id: user.id,
                job_query_error: null,
                job_found: true,
                conversation_id: jobData.conversation_id ?? null,
                provider: jobData.provider ?? null,
                provider_thread_id: jobData.provider_thread_id ?? null,
                email_fallback: emailFallback,
                quote_fallback: quoteFallback,
              },
              null,
              2
            )}
          </pre>
        </div>
      ) : null}

      {/* ── Progress Card ── */}
      <div className="card stack gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="stack gap-1">
            <div className="flex items-center gap-2">
              <JobStatusBadge status={jobData.status} />
              <span className="text-sm font-semibold text-white">{statusProgress.label}</span>
            </div>
          </div>
          <span className="text-sm font-semibold text-[var(--accent1)]">
            {statusProgress.percent}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--accent1)] transition-all duration-300"
            style={{ width: `${statusProgress.percent}%` }}
          />
        </div>
        <p className="text-sm text-[var(--muted)]">
          <span className="font-semibold text-white">Next step:</span>{" "}
          {statusProgress.nextStep}
        </p>
      </div>

      {/* ── At a Glance (two-column) ── */}
      <section className="stack gap-4">
        <h2 className="section-title text-lg">At a glance</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left — Customer & Site */}
          <div className="card stack gap-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Customer &amp; Site
            </h3>

            <div className="stack gap-3">
              <p className="text-lg font-bold text-white">{customerName}</p>

              {/* Phone — prominent */}
              {customerPhone ? (
                <a
                  href={`tel:${customerPhone}`}
                  className="inline-flex items-center gap-2 text-base font-semibold text-[var(--accent1)] hover:text-white transition-colors"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {customerPhone}
                </a>
              ) : (
                <span className="text-sm text-[var(--muted)]">No phone on file</span>
              )}

              {/* Email */}
              {customerEmail ? (
                <a
                  href={`mailto:${customerEmail}`}
                  className="inline-flex items-center gap-2 text-sm text-[var(--accent2)] hover:text-white transition-colors break-anywhere"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  {customerEmail}
                </a>
              ) : (
                <span className="text-sm text-[var(--muted)]">No email on file</span>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-white/5" />

            <div className="stack gap-2">
              <p className="text-sm font-semibold text-white">
                {jobData.site_address || "No site address yet"}
              </p>
              {jobData.postcode ? (
                <p className="text-sm text-[var(--muted)]">{jobData.postcode}</p>
              ) : null}
              {jobData.provider ? (
                <div className="mt-1">
                  <ProviderBadge provider={jobData.provider} />
                </div>
              ) : null}
            </div>
          </div>

          {/* Right — Job Summary */}
          <div className="card stack gap-5">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Job Summary
            </h3>

            <p className="text-sm leading-relaxed text-white">{jobSummary}</p>

            {/* Job notes (expandable) */}
            {jobDetails ? (
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--accent2)]">
                  Show full job notes
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                  {jobDetails}
                </pre>
              </details>
            ) : (
              <p className="text-sm text-[var(--muted)]">No detailed notes yet.</p>
            )}

            {/* Divider */}
            <div className="border-t border-white/5" />

            <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-[var(--muted)]">
              <span>Created {createdAtLabel}</span>
              <span title={lastActivityExact}>Last activity {lastActivityLabel}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quotes Section (card-based) ── */}
      <section className="stack gap-4">
        <h2 className="section-title text-lg">Quotes</h2>
        {quotes.length === 0 ? (
          <div className="card stack items-center gap-3 py-8">
            <p className="text-sm text-[var(--muted)]">No quotes linked to this job yet.</p>
          </div>
        ) : (
          <div className="stack gap-3">
            {quotes.map((quote) => {
              const label =
                quote.quote_reference?.trim() || `Quote ${quote.id.slice(0, 8)}`;
              const quoteCreated = formatTimestamp(quote.created_at);
              return (
                <div
                  key={quote.id}
                  className="card flex flex-wrap items-center justify-between gap-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tag font-mono text-[11px]">{label}</span>
                    <span className="text-xs text-[var(--muted)]">{quoteCreated}</span>
                    {quote.status ? (
                      <span className="status-pill bg-white/5 text-white/70 border border-white/10">
                        {humanizeStatus(quote.status)}
                      </span>
                    ) : null}
                  </div>
                  {quote.pdf_url ? (
                    <a
                      href={quote.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-small px-4"
                    >
                      Open PDF
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--muted)]">No PDF</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Email Thread (simplified) ── */}
      <section className="stack gap-4">
        <h2 className="section-title text-lg">Latest Email</h2>
        <div className="card stack gap-4">
          {emailEvent ? (
            <>
              <div className="stack gap-3">
                <p className="text-base font-semibold text-white">
                  {emailEvent.subject?.trim() || "(No subject)"}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
                  <span>
                    From: <span className="text-white break-anywhere">{emailEvent.from_email || "Unknown"}</span>
                  </span>
                  <span title={emailReceivedExact}>{emailReceivedLabel}</span>
                </div>
              </div>

              {/* Body preview */}
              <div className="stack gap-2">
                <p className="text-sm text-[var(--muted)] leading-relaxed line-clamp-4">
                  {emailPreview}
                </p>
                {emailBody.length > 280 ? (
                  <details className="group">
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--accent2)]">
                      Show full email
                    </summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                      {emailBody}
                    </pre>
                  </details>
                ) : null}
              </div>

              {/* Attachments */}
              {emailAttachments.length > 0 ? (
                <div className="stack gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Attachments
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {emailAttachments.map((att) => (
                      <span
                        key={`${att.name}-${att.type}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white"
                      >
                        <svg className="h-3.5 w-3.5 text-[var(--muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        {att.name}
                        {att.sizeLabel ? (
                          <span className="text-[var(--muted)]">{att.sizeLabel}</span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              <p>No email linked to this job.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Draft Reply ── */}
      {hasDraft ? (
        <section id="draft" className="stack gap-4">
          <h2 className="section-title text-lg">Draft Reply</h2>
          <div className="card stack gap-4">
            <div className="stack gap-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Subject
              </p>
              <p className="text-sm font-semibold text-white">
                {jobData.outbound_email_subject || "(No subject)"}
              </p>
            </div>
            <div className="stack gap-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Body
              </p>
              <pre className="max-h-80 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                {jobData.outbound_email_body || "No draft body available."}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" title="Copy draft content">
                Copy
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Technical Details (collapsed) ── */}
      <section className="stack gap-4">
        <details className="card group">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent2)]">
            Technical Details
          </summary>
          <div className="mt-4 stack gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="stack gap-2 text-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">IDs</p>
                <p className="text-[var(--muted)] break-anywhere">Job ID: {jobId}</p>
                <p className="text-[var(--muted)] break-anywhere">
                  Conversation: {jobData.conversation_id || "\u2014"}
                </p>
                <p className="text-[var(--muted)] break-anywhere">
                  Job thread: {jobData.job_thread_id || "\u2014"}
                </p>
                <p className="text-[var(--muted)] break-anywhere">
                  Provider message: {jobData.provider_message_id || "\u2014"}
                </p>
                <p className="text-[var(--muted)] break-anywhere">
                  Provider thread: {jobData.provider_thread_id || "\u2014"}
                </p>
                <p className="text-[var(--muted)] break-anywhere">
                  Email event: {jobData.email_event_id || "\u2014"}
                </p>
              </div>
              <div className="stack gap-2 text-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Timestamps
                </p>
                <p className="text-[var(--muted)]">
                  Created: {createdAtLabel}
                </p>
                <p className="text-[var(--muted)]">
                  Last activity: {formatTimestamp(jobData.last_activity_at)}
                </p>
              </div>
            </div>

            {/* Processing health */}
            {emailEvent ? (
              <div className="stack gap-2 text-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Processing Health
                </p>
                <div className="flex flex-wrap gap-4">
                  <span className="text-[var(--muted)]">
                    Status: <span className="text-white">{emailEvent.status ? humanizeStatus(emailEvent.status) : "\u2014"}</span>
                  </span>
                  <span className="text-[var(--muted)]">
                    Queue: <span className="text-white">{emailEvent.queue_status ? humanizeStatus(emailEvent.queue_status) : "\u2014"}</span>
                  </span>
                  <span className="text-[var(--muted)]">
                    Attempts: <span className="text-white">{emailEvent.attempts ?? 0}</span>
                  </span>
                </div>
                {emailEvent.last_error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    <p className="font-semibold">Last error</p>
                    <p className="mt-1 break-anywhere">{emailEvent.last_error}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Metadata */}
            <div className="stack gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Metadata
              </p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                {jobData.metadata
                  ? JSON.stringify(jobData.metadata, null, 2)
                  : "No metadata available."}
              </pre>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
