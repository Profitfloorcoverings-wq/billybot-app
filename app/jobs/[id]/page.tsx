export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import { JOB_STATUS_OPTIONS } from "@/app/jobs/constants";
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
  params: { id?: string | string[] };
  searchParams?: Record<string, string | string[] | undefined>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeParamId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function CopyIdChip({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
      <span className="uppercase tracking-[0.2em]">Job ID</span>
      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-[var(--muted)]">
        {id}
      </span>
      <button
        type="button"
        className="btn btn-secondary h-7 px-3 text-[10px] uppercase tracking-[0.2em] opacity-80"
        disabled
        title="Copy support will be enabled in a future update."
      >
        Copy
      </button>
    </div>
  );
}

function StatRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-white" title={hint ?? undefined}>
        {value}
      </span>
    </div>
  );
}

function TimelineEntryCard({ entry }: { entry: TimelineEntry }) {
  const icon = entry.type === "email" ? "✉️" : entry.type === "chat" ? "💬" : "📄";
  const timestamp = formatTimestamp(entry.timestamp);
  const hasBody = Boolean(entry.body || entry.pdfUrl);

  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-lg">{icon}</span>
          <div className="stack gap-1">
            <p className="text-sm font-semibold text-white">{entry.title}</p>
            {entry.subtitle ? (
              <p className="text-xs text-[var(--muted)]">{entry.subtitle}</p>
            ) : null}
          </div>
        </div>
        <span className="text-xs text-[var(--muted)]">{timestamp}</span>
      </div>
      {entry.preview ? (
        <p className="mt-3 text-sm text-[var(--muted)] line-clamp-2 break-words">
          {entry.preview}
        </p>
      ) : null}
      {hasBody ? (
        <details className="group mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-[var(--accent2)]">
            View details
          </summary>
          <div className="mt-2 text-sm text-[var(--muted)] whitespace-pre-wrap break-words">
            {entry.pdfUrl ? (
              <a
                href={entry.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[var(--accent2)] underline"
              >
                Open quote PDF
              </a>
            ) : (
              entry.body || "No additional details available."
            )}
          </div>
        </details>
      ) : null}
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
      <div className="page-container">
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

  if (jobError) {
    return (
      <div className="page-container">
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
      <div className="page-container">
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

  let emails: EmailEvent[] = [];
  let quotes: Quote[] = [];
  let messages: Message[] = [];
  let emailFallback = "none";
  let quoteFallback = "none";

  if (jobData.provider && jobData.provider_thread_id) {
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
    emailFallback = "provider_thread_id";
  }

  if (jobData.conversation_id && UUID_RE.test(jobData.conversation_id)) {
    const { data: messageData } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("profile_id", user.id)
      .eq("conversation_id", jobData.conversation_id)
      .order("created_at", { ascending: true });

    messages = messageData ?? [];
  }

  if (jobData.title) {
    const { data: fallbackQuotes } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, created_at, status, job_ref")
      .eq("client_id", user.id)
      .eq("job_ref", jobData.title)
      .order("created_at", { ascending: false });

    quotes = fallbackQuotes ?? [];
    if (quotes.length) {
      quoteFallback = "job_ref";
    }
  }

  if (!quotes.length && jobData.customer_email) {
    const { data: fallbackQuotes } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, created_at, status, job_ref, customer_name")
      .eq("client_id", user.id)
      .ilike("customer_email", jobData.customer_email)
      .order("created_at", { ascending: false });

    quotes = fallbackQuotes ?? [];
    if (quotes.length) {
      quoteFallback = "customer_email";
    }
  }

  if (!quotes.length && jobData.customer_name) {
    const { data: fallbackQuotes } = await supabase
      .from("quotes")
      .select("id, quote_reference, pdf_url, created_at, status, job_ref, customer_name")
      .eq("client_id", user.id)
      .ilike("customer_name", `%${jobData.customer_name}%`)
      .order("created_at", { ascending: false });

    quotes = fallbackQuotes ?? [];
    if (quotes.length) {
      quoteFallback = "customer_name";
    }
  }

  const timeline: TimelineEntry[] = [];

  emails.forEach((email) => {
    const directionLabel = email.direction === "outbound" ? "Outbound" : "Inbound";
    const from = email.from_email ?? "Unknown sender";
    const to = email.to_emails?.join(", ") ?? "Unknown recipient";
    const subtitle = `${directionLabel} · ${from} → ${to}`;
    const timestamp = email.received_at ?? email.created_at ?? null;
    const subject = email.subject?.trim();
    const bodyText = email.body_text?.trim();
    const bodyHtml = stripHtml(email.body_html);
    const preview = [subject, bodyText || bodyHtml].filter(Boolean).join(" — ");
    const body = [bodyText, bodyText && bodyHtml ? "" : null, bodyHtml]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join("\n\n");

    timeline.push({
      id: `email-${email.id}`,
      type: "email",
      title: `Email · ${directionLabel}`,
      subtitle,
      preview: preview ? preview.slice(0, 200) : null,
      body: body || null,
      timestamp,
    });
  });

  messages.forEach((message) => {
    const role = message.role ?? "user";
    const roleLabel =
      role.toString().toLowerCase() === "assistant" ? "Assistant" : "User";
    timeline.push({
      id: `chat-${message.id}`,
      type: "chat",
      title: `Chat · ${roleLabel}`,
      subtitle: "Conversation update",
      preview: message.content?.trim().slice(0, 200) ?? null,
      body: message.content?.trim() ?? null,
      timestamp: message.created_at ?? null,
    });
  });

  quotes.forEach((quote) => {
    timeline.push({
      id: `quote-${quote.id}`,
      type: "quote",
      title: quote.quote_reference ? `Quote ${quote.quote_reference}` : "Quote update",
      subtitle: quote.status ? humanizeStatus(quote.status) : "Quote activity",
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
    <div className="page-container mx-auto w-full max-w-6xl stack gap-6">
      <div className="stack gap-4">
        <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
          ← Back to Jobs
        </Link>
        <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="stack gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">{jobTitle}</h1>
              <JobStatusBadge status={jobData.status} />
            </div>
            <div className="stack gap-1 text-sm text-[var(--muted)]">
              <p className="text-base text-white">
                {jobData.customer_name || "Unknown customer"}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span>{jobData.customer_email || "No email on file"}</span>
                <span>{jobData.customer_phone || "No phone on file"}</span>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)]" title={lastActivityExact}>
              Last activity {lastActivityLabel}
            </p>
            <CopyIdChip id={jobId} />
          </div>
          <div className="stack items-start gap-2 lg:items-end">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Status
            </span>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="stack gap-6">
          <div className="card stack gap-4">
            <div className="stack gap-1">
              <h2 className="section-title text-lg">Overview</h2>
              <p className="section-subtitle">Customer and job details.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="stack gap-2">
                <p className="section-subtitle">Customer</p>
                <p className="text-sm font-semibold text-white">
                  {jobData.customer_name || "Unknown"}
                </p>
                <p className="text-xs text-[var(--muted)] break-words">
                  {jobData.customer_email || "No email on file"}
                </p>
                <p className="text-xs text-[var(--muted)] break-words">
                  {jobData.customer_phone || "No phone on file"}
                </p>
              </div>
              <div className="stack gap-2">
                <p className="section-subtitle">Site</p>
                <p className="text-sm font-semibold text-white">
                  {jobData.site_address || "No site address yet"}
                </p>
                <p className="text-xs text-[var(--muted)]">{jobData.postcode || "—"}</p>
              </div>
            </div>
            <div className="stack gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ProviderBadge provider={jobData.provider} />
              </div>
              <div>
                <p className="section-subtitle">Job notes</p>
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap break-words">
                  {jobDetails || "No request details captured yet."}
                </p>
              </div>
              {(jobData.provider_thread_id || jobData.conversation_id) && (
                <details className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--muted)]">
                    Technical IDs
                  </summary>
                  <div className="mt-2 stack gap-1 text-xs text-[var(--muted)] break-words">
                    {jobData.provider_thread_id ? (
                      <span>Provider thread: {jobData.provider_thread_id}</span>
                    ) : null}
                    {jobData.conversation_id ? (
                      <span>Conversation: {jobData.conversation_id}</span>
                    ) : null}
                  </div>
                </details>
              )}
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
                {timeline.map((item) => (
                  <TimelineEntryCard key={item.id} entry={item} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack gap-6">
          <div className="card stack gap-4">
            <h3 className="section-title text-lg">Actions</h3>
            <Link
              href={chatHref}
              className={`btn btn-primary w-full justify-center ${
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
              className="btn btn-secondary w-full justify-center"
              disabled
              title="Quote creation is not available from this view yet"
            >
              Create quote
            </button>
          </div>

          <div className="card stack gap-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-lg">Quick stats</h3>
              <span className="text-xs text-[var(--muted)]">Email activity</span>
            </div>
            <div className="stack gap-3">
              <StatRow label="Inbound" value={inboundEmails.length} />
              <StatRow label="Outbound" value={outboundEmails.length} />
              <StatRow
                label="Last inbound"
                value={formatRelativeTime(lastInbound)}
                hint={formatTimestamp(lastInbound)}
              />
            </div>
          </div>

          <div className="card stack gap-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-lg">Linked quotes</h3>
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
                    <div
                      key={quote.id}
                      className="rounded-xl border border-white/5 bg-white/5 p-3 stack gap-1"
                    >
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
        </div>
      </div>
    </div>
  );
}
