export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

import JobStatusBadge from "@/app/jobs/components/JobStatusBadge";
import {
  formatRelativeTime,
  formatTimestamp,
  humanizeStatus,
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

  let emails: EmailEvent[] = [];
  let quotes: Quote[] = [];
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

  const inboundEmails = emails.filter((email) => email.direction !== "outbound");
  const outboundEmails = emails.filter((email) => email.direction === "outbound");
  const lastInbound = inboundEmails.at(-1)?.received_at ?? inboundEmails.at(-1)?.created_at;
  const jobTitle = jobData.title?.trim() || "Untitled job";
  const jobDetails = jobData.job_details?.trim() || "";
  const chatHref = jobData.conversation_id
    ? `/chat?conversation_id=${jobData.conversation_id}`
    : "/chat";

  return (
    <div className="container stack gap-6">
      <div className="stack gap-3">
        <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
          ← Back to Jobs
        </Link>
        <div className="stack gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="section-title text-2xl">{jobTitle}</h1>
            <div className="stack items-end gap-2">
              <JobStatusBadge status={jobData.status} />
            </div>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="stack min-w-0 gap-6">
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
                <p className="text-xs text-[var(--muted)] break-anywhere">
                  {jobData.customer_email || "No email on file"}
                </p>
                <p className="text-xs text-[var(--muted)] break-anywhere">
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
              <div>
                <p className="section-subtitle">Job notes</p>
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
                  {jobDetails || "No request details captured yet."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="stack min-w-0 gap-6">
          <div className="card stack gap-4">
            <h3 className="section-title text-lg">Actions</h3>
            <Link
              href={chatHref}
              className={`btn btn-primary h-11 w-full justify-center ${
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
              className="btn btn-secondary h-11 w-full justify-center"
              disabled
              title="Quote creation is not available from this view yet"
            >
              Create quote
            </button>
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

          <div className="card stack gap-4">
            <div className="flex items-center justify-between">
              <h3 className="section-title text-lg">Email stats</h3>
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
        </div>
      </div>
    </div>
  );
}
