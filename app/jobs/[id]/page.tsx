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

  return (
    <div className="page-container stack gap-8">
      <div className="stack gap-4">
        <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
          ← Back to Jobs
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="stack gap-3">
            <div className="stack gap-2">
              <h1 className="section-title text-2xl">{jobTitle}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                <span className="font-semibold text-white">{customerName}</span>
                <span className="tag bg-white/10 text-white/70">
                  {humanizeStatus(jobData.status)}
                </span>
                <span title={lastActivityExact}>Last activity {lastActivityLabel}</span>
              </div>
            </div>
            <CopyIdChip id={jobId} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={chatHref}
              className={`btn btn-primary h-11 px-5 justify-center ${
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
              className="btn btn-secondary h-11 px-5 justify-center"
              disabled
              title="Quote creation is not available from this view yet"
            >
              Create quote
            </button>
            {hasDraft ? (
              <Link
                href="#draft"
                className="btn btn-secondary h-11 px-5 justify-center"
              >
                Review draft email
              </Link>
            ) : null}
          </div>
        </div>
      </div>

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

      <div className="card stack gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="stack gap-1">
            <div className="flex items-center gap-2">
              <JobStatusBadge status={jobData.status} />
              <span className="text-sm text-[var(--muted)]">{statusProgress.label}</span>
            </div>
            <p className="text-sm text-[var(--muted)]">Next step</p>
            <p className="text-sm text-white">{statusProgress.nextStep}</p>
          </div>
          <div className="min-w-[220px]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Progress
            </p>
            <div className="mt-2 h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--accent1)]"
                style={{ width: `${statusProgress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">
              {statusProgress.percent}% complete
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Quotes
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{quotes.length}</p>
            <p className="text-xs text-[var(--muted)]">Linked to this job</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Latest email
            </p>
            <p className="mt-2 text-lg font-semibold text-white">{emailReceivedLabel}</p>
            <p className="text-xs text-[var(--muted)]" title={emailReceivedExact}>
              {emailEvent?.subject?.trim() || "No linked email"}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Status
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {humanizeStatus(jobData.status)}
            </p>
            <p className="text-xs text-[var(--muted)]">{lastActivityLabel}</p>
          </div>
        </div>
      </div>

      <section className="stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title text-lg">At a glance</h2>
          <p className="section-subtitle">Key customer, site, and processing details.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card stack gap-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-base">Customer</h3>
              {customerEmail ? null : (
                <span className="tag bg-amber-500/15 text-amber-200">Missing email</span>
              )}
            </div>
            <div className="stack gap-2 text-sm">
              <p className="font-semibold text-white">{customerName}</p>
              {customerEmail ? (
                <a
                  href={`mailto:${customerEmail}`}
                  className="text-[var(--accent2)] underline break-anywhere"
                >
                  {customerEmail}
                </a>
              ) : (
                <span className="text-[var(--muted)]">No email on file</span>
              )}
              <div className="flex items-center gap-2">
                {customerPhone ? (
                  <a
                    href={`tel:${customerPhone}`}
                    className="text-[var(--accent2)] underline break-anywhere"
                  >
                    {customerPhone}
                  </a>
                ) : (
                  <span className="tag bg-white/10 text-white/70">Missing phone</span>
                )}
              </div>
            </div>
          </div>

          <div className="card stack gap-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-base">Site</h3>
              {jobData.provider ? <ProviderBadge provider={jobData.provider} /> : null}
            </div>
            <div className="stack gap-2 text-sm">
              <p className="font-semibold text-white">
                {jobData.site_address || "No site address yet"}
              </p>
              <p className="text-[var(--muted)]">{jobData.postcode || "—"}</p>
              {jobData.provider_thread_id ? (
                <p className="text-xs text-[var(--muted)] break-anywhere">
                  Thread {jobData.provider_thread_id}
                </p>
              ) : (
                <span className="tag bg-white/10 text-white/70">No provider thread</span>
              )}
            </div>
          </div>

          <div className="card stack gap-3">
            <h3 className="section-title text-base">Job summary</h3>
            <p className="text-sm text-white">{jobSummary}</p>
            <div className="stack gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Job notes
              </p>
              {jobDetails ? (
                <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                  {jobDetails}
                </pre>
              ) : (
                <p className="text-sm text-[var(--muted)]">No request details captured yet.</p>
              )}
            </div>
          </div>

          <div className="card stack gap-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-base">Processing health</h3>
              {emailEvent?.status ? (
                <span className="tag bg-white/10 text-white/70">
                  {humanizeStatus(emailEvent.status)}
                </span>
              ) : null}
            </div>
            {emailEvent ? (
              <div className="stack gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Queue status</span>
                  <span className="text-white">
                    {emailEvent.queue_status ? humanizeStatus(emailEvent.queue_status) : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--muted)]">Attempts</span>
                  <span className="text-white">{emailEvent.attempts ?? 0}</span>
                </div>
                {emailEvent.last_error ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    <p className="font-semibold">Last error</p>
                    <p className="mt-1 break-anywhere">{emailEvent.last_error}</p>
                    <p className="mt-2 text-[11px] text-red-100/80">
                      Check workflow settings or retry in your email provider.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    Processing looks healthy. No recent errors detected.
                  </p>
                )}
              </div>
            ) : (
              <div className="empty-state">No processing data available yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title text-lg">Quotes</h2>
          <p className="section-subtitle">All quotes linked to this job.</p>
        </div>
        {quotes.length === 0 ? (
          <div className="card stack items-center gap-2">
            <p className="section-subtitle">No quotes linked to this job yet.</p>
            <button
              className="btn btn-secondary"
              disabled
              title="Quote creation is not available from this view yet"
            >
              Create quote
            </button>
          </div>
        ) : (
          <div className="card stack gap-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{quotes.length} total</span>
              <span>Most recent first</span>
            </div>
            <div className="table-card">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead className="sticky top-0 z-10 bg-[var(--card)]">
                    <tr>
                      <th>Quote ref</th>
                      <th>Created</th>
                      <th>Version</th>
                      <th>PDF</th>
                      <th>Status</th>
                      <th className="sticky-cell text-right" aria-label="Quote actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => {
                      const label =
                        quote.quote_reference?.trim() || `Quote ${quote.id.slice(0, 8)}`;
                      const createdLabel = formatTimestamp(quote.created_at);
                      const versionLabel =
                        typeof quote.version === "number" ? `v${quote.version}` : "—";
                      return (
                        <tr key={quote.id}>
                          <td>
                            <span className="tag font-mono text-[10px]">{label}</span>
                          </td>
                          <td>
                            <span className="text-xs text-[var(--muted)]">{createdLabel}</span>
                          </td>
                          <td>
                            <span className="text-xs text-[var(--muted)]">{versionLabel}</span>
                          </td>
                          <td>
                            {quote.pdf_url ? (
                              <a
                                href={quote.pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-[var(--accent2)] underline"
                              >
                                View PDF
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--muted)]">—</span>
                            )}
                          </td>
                          <td>
                            <span className="text-xs text-[var(--muted)]">
                              {quote.status ? humanizeStatus(quote.status) : "—"}
                            </span>
                          </td>
                          <td className="sticky-cell">
                            <div className="flex items-center justify-end">
                              {quote.pdf_url ? (
                                <a
                                  href={quote.pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-primary btn-small rounded-full px-3"
                                >
                                  Open
                                </a>
                              ) : (
                                <span className="text-xs text-[var(--muted)]">No action</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title text-lg">Latest email context</h2>
          <p className="section-subtitle">
            The most relevant email linked to this job.
          </p>
        </div>
        <div className="card stack gap-4">
          {emailEvent ? (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="stack gap-2 text-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Subject
                  </p>
                  <p className="font-semibold text-white">
                    {emailEvent.subject?.trim() || "(No subject)"}
                  </p>
                </div>
                <div className="stack gap-2 text-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Received
                  </p>
                  <p className="text-white" title={emailReceivedExact}>
                    {emailReceivedLabel}
                  </p>
                </div>
                <div className="stack gap-2 text-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    From
                  </p>
                  <p className="text-white break-anywhere">
                    {emailEvent.from_email || "Unknown sender"}
                  </p>
                </div>
                <div className="stack gap-2 text-sm">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    To / CC
                  </p>
                  <p className="text-white break-anywhere">
                    {formatEmailList(emailEvent.to_emails)}
                    {emailEvent.cc_emails?.length
                      ? ` | CC: ${formatEmailList(emailEvent.cc_emails)}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="stack gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Attachments
                </p>
                {emailAttachments.length ? (
                  <ul className="stack gap-2">
                    {emailAttachments.map((attachment) => (
                      <li
                        key={`${attachment.name}-${attachment.type}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--muted)]"
                      >
                        <span className="text-white break-anywhere">{attachment.name}</span>
                        <span>
                          {attachment.type}
                          {attachment.sizeLabel ? ` • ${attachment.sizeLabel}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--muted)]">No attachments.</p>
                )}
              </div>

              <div className="stack gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Body preview
                </p>
                <p className="text-sm text-[var(--muted)] line-clamp-3">
                  {emailPreview}
                </p>
                <details className="group">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--accent2)]">
                    Show full email
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                    {emailBody || "No email body available."}
                  </pre>
                </details>
              </div>
            </>
          ) : (
            <div className="empty-state stack gap-2">
              <p>No email linked to this job.</p>
              {jobData.provider_thread_id ? (
                <p className="text-xs text-[var(--muted)] break-anywhere">
                  Provider thread: {jobData.provider_thread_id}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>

      {hasDraft ? (
        <section id="draft" className="stack gap-4">
          <div className="stack gap-1">
            <h2 className="section-title text-lg">Draft reply ready</h2>
            <p className="section-subtitle">Outbound email draft prepared for review.</p>
          </div>
          <div className="card stack gap-4">
            <div className="stack gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Subject
              </p>
              <p className="text-sm font-semibold text-white">
                {jobData.outbound_email_subject || "(No subject)"}
              </p>
            </div>
            <div className="stack gap-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Body
              </p>
              <pre className="max-h-80 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                {jobData.outbound_email_body || "No draft body available."}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                title="Copy draft content"
              >
                Copy
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title text-lg">Secondary details</h2>
          <p className="section-subtitle">Technical metadata and IDs.</p>
        </div>
        <details className="card group">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent2)]">
            View technical details
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="stack gap-2 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">IDs</p>
              <p className="text-[var(--muted)] break-anywhere">
                Conversation: {jobData.conversation_id || "—"}
              </p>
              <p className="text-[var(--muted)] break-anywhere">
                Job thread: {jobData.job_thread_id || "—"}
              </p>
              <p className="text-[var(--muted)] break-anywhere">
                Provider message: {jobData.provider_message_id || "—"}
              </p>
              <p className="text-[var(--muted)] break-anywhere">
                Provider thread: {jobData.provider_thread_id || "—"}
              </p>
              <p className="text-[var(--muted)] break-anywhere">
                Email event: {jobData.email_event_id || "—"}
              </p>
            </div>
            <div className="stack gap-2 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Timestamps
              </p>
              <p className="text-[var(--muted)]">
                Created: {formatTimestamp(jobData.created_at)}
              </p>
              <p className="text-[var(--muted)]">
                Last activity: {formatTimestamp(jobData.last_activity_at)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Metadata
            </p>
            <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-[var(--muted)] whitespace-pre-wrap break-anywhere">
              {jobData.metadata
                ? JSON.stringify(jobData.metadata, null, 2)
                : "No metadata available."}
            </pre>
          </div>
        </details>
      </section>

    </div>
  );
}
