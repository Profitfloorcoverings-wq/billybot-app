export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

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
  customer_name?: string | null;
};

type JobDetailPageProps = {
  params: { id?: string | string[] };
  searchParams?: Record<string, string | string[] | undefined>;
};

type Attachment = {
  url: string;
  name?: string;
};

type ActivityItem = {
  id: string;
  label: string;
  timestamp: string | null;
  icon: string;
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

function HealthLight({ tone, label }: { tone: "green" | "amber" | "red"; label: string }) {
  return (
    <div className={`bb-health bb-health-${tone}`} title={label}>
      <span className="bb-health-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function JobCommandBar({
  title,
  subtitle,
  statusLabel,
  healthTone,
  healthLabel,
  primaryActions,
}: {
  title: string;
  subtitle: string;
  statusLabel: string;
  healthTone: "green" | "amber" | "red";
  healthLabel: string;
  primaryActions: React.ReactNode;
}) {
  return (
    <div className="bb-commandbar -mx-4 px-4 py-4">
      <div className="container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="stack gap-1">
          <h1 className="section-title text-2xl sm:text-3xl">{title}</h1>
          <p className="text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className="bb-pill">{statusLabel}</span>
          <HealthLight tone={healthTone} label={healthLabel} />
          <div className="flex flex-wrap gap-2">{primaryActions}</div>
        </div>
      </div>
    </div>
  );
}

function JobKpiStrip({
  inboundCount,
  outboundCount,
  sparkline,
  lastActivityLabel,
  lastActivityTone,
  quoteStatus,
  blockersCount,
}: {
  inboundCount: number;
  outboundCount: number;
  sparkline: number[];
  lastActivityLabel: string;
  lastActivityTone: "green" | "amber" | "red";
  quoteStatus: string;
  blockersCount: number;
}) {
  const blockersTone = blockersCount === 0 ? "green" : blockersCount > 2 ? "red" : "amber";
  const toneClass = (tone: "green" | "amber" | "red") =>
    tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-rose-300";

  return (
    <div className="bb-kpi-grid">
      <div className="bb-kpi bb-surface-hover">
        <div className="stack gap-1">
          <p className="bb-kpi-label">Emails</p>
          <p className="bb-kpi-value">
            {inboundCount} in / {outboundCount} out
          </p>
        </div>
        <div className="flex items-end gap-1">
          {sparkline.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="h-8 w-1.5 rounded-full bg-white/10"
              style={{ height: `${Math.max(20, value * 10)}px` }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <div className="bb-kpi bb-surface-hover">
        <div className="stack gap-1">
          <p className="bb-kpi-label">Last activity</p>
          <p className={`text-lg font-semibold ${toneClass(lastActivityTone)}`}>
            {lastActivityLabel}
          </p>
        </div>
        <span className="text-2xl">⏱️</span>
      </div>
      <div className="bb-kpi bb-surface-hover">
        <div className="stack gap-1">
          <p className="bb-kpi-label">Quote status</p>
          <p className="bb-kpi-value">{quoteStatus}</p>
        </div>
        <span className="text-2xl">🧾</span>
      </div>
      <div className="bb-kpi bb-surface-hover">
        <div className="stack gap-1">
          <p className="bb-kpi-label">Blockers</p>
          <p className={`text-lg font-semibold ${toneClass(blockersTone)}`}>
            {blockersCount}
          </p>
        </div>
        <span className="text-2xl">🚧</span>
      </div>
    </div>
  );
}

function JobNextActions({
  items,
  ready,
  chatHref,
}: {
  items: { id: string; label: string; requestHref: string; addHref: string }[];
  ready: boolean;
  chatHref: string;
}) {
  return (
    <div className="bb-surface stack gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title text-lg">What&apos;s next</h2>
        {ready ? <span className="bb-pill">Ready to quote</span> : null}
      </div>
      {ready ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">
            All critical details are captured. You can move straight to quoting.
          </p>
          <Link href={chatHref} className="bb-btn bb-btn-primary">
            Create quote
          </Link>
        </div>
      ) : (
        <div className="stack gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="bb-next-item sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2 text-sm text-white">
                <span className="h-2 w-2 rounded-full bg-amber-300" aria-hidden="true" />
                <span>{item.label}</span>
              </div>
              <div className="bb-next-actions">
                <Link href={item.requestHref} className="bb-btn bb-btn-secondary">
                  Request from customer
                </Link>
                <Link href={item.addHref} className="bb-btn bb-btn-primary">
                  Add now
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobSummaryCard({
  customerName,
  customerEmail,
  customerPhone,
  siteAddress,
  postcode,
  jobType,
  jobNotes,
}: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  siteAddress: string;
  postcode: string;
  jobType: string;
  jobNotes: string;
}) {
  return (
    <div className="bb-surface stack gap-4 p-5" id="job-summary">
      <h2 className="section-title text-lg">Job summary</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="stack gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Customer</p>
          <p className="text-sm font-semibold text-white">{customerName}</p>
          <p className="text-xs text-[var(--muted)] break-anywhere">{customerEmail}</p>
          <p className="text-xs text-[var(--muted)] break-anywhere">{customerPhone}</p>
        </div>
        <div className="stack gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Site</p>
          <p className="text-sm font-semibold text-white">{siteAddress}</p>
          <p className="text-xs text-[var(--muted)]">{postcode}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Job type
        </span>
        <span className="text-sm font-semibold text-white">{jobType}</span>
      </div>
      <details className="bb-inset p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--accent2)]">
          Job notes
        </summary>
        <p className="mt-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
          {jobNotes}
        </p>
      </details>
    </div>
  );
}

function JobAttachmentsGallery({
  attachments,
  requestHref,
}: {
  attachments: Attachment[];
  requestHref: string;
}) {
  return (
    <div className="bb-surface stack gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title text-lg">Attachments</h2>
        <Link href={requestHref} className="bb-btn bb-btn-secondary">
          Request photos
        </Link>
      </div>
      {attachments.length === 0 ? (
        <div className="empty-state">
          <p>No photos/docs yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {attachments.map((attachment) => (
            <a
              key={attachment.url}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="bb-inset bb-surface-hover group relative overflow-hidden"
            >
              <img
                src={attachment.url}
                alt={attachment.name ?? "Attachment"}
                className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white">
                {attachment.name ?? "Attachment"}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function JobPipelineStage({
  stages,
  activeIndex,
}: {
  stages: string[];
  activeIndex: number;
}) {
  return (
    <div className="bb-surface stack gap-4 p-5">
      <h2 className="section-title text-lg">Pipeline stage</h2>
      <div className="stack gap-3">
        {stages.map((stage, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <div key={stage} className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  active
                    ? "bg-emerald-400"
                    : complete
                      ? "bg-emerald-400/50"
                      : "bg-white/10"
                }`}
                aria-hidden="true"
              />
              <span className={active ? "text-white font-semibold" : "text-[var(--muted)]"}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobRecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <div className="bb-surface stack gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title text-lg">Recent activity</h2>
        <span className="text-xs text-[var(--muted)]">Last 5</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-state">No recent activity yet.</div>
      ) : (
        <div className="stack gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-white">{item.label}</span>
              </div>
              <span className="text-xs text-[var(--muted)]">
                {formatRelativeTime(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JobCommsStats({
  inbound,
  outbound,
  waitingOn,
  responseRatio,
}: {
  inbound: number;
  outbound: number;
  waitingOn: string;
  responseRatio: string;
}) {
  return (
    <div className="bb-surface stack gap-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="section-title text-lg">Comms & stats</h2>
        <span className="text-xs text-[var(--muted)]">Email activity</span>
      </div>
      <div className="stack gap-3">
        <StatRow label="Inbound" value={inbound} />
        <StatRow label="Outbound" value={outbound} />
        <StatRow label="Response ratio" value={responseRatio} />
        <StatRow label="Waiting on" value={waitingOn} />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-[var(--accent2)]"
          style={{ width: `${Math.min(100, Math.round((outbound / Math.max(1, inbound)) * 100))}%` }}
        />
      </div>
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
      .select("id, quote_reference, pdf_url, created_at, status, job_ref, customer_name")
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
  const lastOutbound = outboundEmails.at(-1)?.received_at ?? outboundEmails.at(-1)?.created_at;
  const jobTitle = jobData.title?.trim() || "Untitled job";
  const jobDetails = jobData.job_details?.trim() || "No request details captured yet.";
  const chatHref = jobData.conversation_id
    ? `/chat?conversation_id=${jobData.conversation_id}`
    : "/chat";

  const customerName = jobData.customer_name || "Unknown customer";
  const customerEmail = jobData.customer_email || "No email on file";
  const customerPhone = jobData.customer_phone || "No phone on file";
  const siteAddress = jobData.site_address || "No site address yet";
  const postcode = jobData.postcode || "—";
  const jobType = jobDetails.toLowerCase().includes("floor")
    ? "Flooring"
    : jobDetails.toLowerCase().includes("paint")
      ? "Painting"
      : "General job";

  const attachmentCandidates = jobData.metadata?.attachments;
  const attachments: Attachment[] = Array.isArray(attachmentCandidates)
    ? attachmentCandidates
        .map((item) => {
          if (typeof item === "string") {
            return { url: item };
          }
          if (item && typeof item === "object" && "url" in item) {
            const url = String(item.url);
            const name = "name" in item ? String(item.name) : undefined;
            return { url, name };
          }
          return null;
        })
        .filter((value): value is Attachment => Boolean(value?.url))
    : [];

  const blockers = [
    !jobData.site_address ? "Need site address" : null,
    !jobData.postcode ? "Need postcode" : null,
    !jobData.customer_phone ? "Need customer phone" : null,
    !jobData.job_details ? "Need job notes" : null,
    attachments.length === 0 ? "Need photos or documents" : null,
  ].filter((value): value is string => Boolean(value));

  const blockersWithActions = blockers.map((item) => ({
    id: item.toLowerCase().replace(/\s+/g, "-"),
    label: item,
    requestHref: chatHref,
    addHref: "#job-summary",
  }));

  const statusLabel = humanizeStatus(jobData.status) || "New";
  const timelineDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });
  const sparkline = timelineDays.map((day) =>
    emails.filter((email) => (email.received_at ?? email.created_at ?? "").startsWith(day))
      .length
  );

  const lastActivityTimestamp = jobData.last_activity_at ?? lastInbound ?? lastOutbound;
  const lastActivityLabel = formatRelativeTime(lastActivityTimestamp);
  const lastActivityMs = lastActivityTimestamp
    ? Date.now() - new Date(lastActivityTimestamp).getTime()
    : null;
  const lastActivityTone =
    lastActivityMs === null
      ? "amber"
      : lastActivityMs > 1000 * 60 * 60 * 72
        ? "red"
        : lastActivityMs > 1000 * 60 * 60 * 48
          ? "amber"
          : "green";

  const latestEmail = emails.at(-1);
  const waitingOn =
    latestEmail?.direction === "outbound" ? "Customer" : latestEmail ? "You" : "Unknown";
  const responseRatio = `${outboundEmails.length}/${Math.max(1, inboundEmails.length)}`;

  const recentActivity: ActivityItem[] = [
    ...emails.map((email) => ({
      id: `email-${email.id}`,
      label:
        email.direction === "outbound"
          ? `Outbound email • ${email.subject ?? "Sent"}`
          : `Inbound email • ${email.subject ?? "Received"}`,
      timestamp: email.received_at ?? email.created_at ?? null,
      icon: email.direction === "outbound" ? "📤" : "📥",
    })),
    ...quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      label: quote.quote_reference ? `Quote ${quote.quote_reference}` : "Quote updated",
      timestamp: quote.created_at ?? null,
      icon: "🧾",
    })),
  ]
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  const quoteStatus = quotes[0]?.status
    ? humanizeStatus(quotes[0]?.status)
    : quotes.length
      ? "Draft"
      : "None";

  const statusStages = ["New", "Gathering info", "Quoting", "Sent", "Won/Lost"];
  const normalizedStatus = (jobData.status ?? "").toLowerCase();
  const statusStageIndex = normalizedStatus.includes("won") || normalizedStatus.includes("lost")
    ? 4
    : normalizedStatus.includes("quote")
      ? 2
      : normalizedStatus.includes("sent")
        ? 3
        : normalizedStatus.includes("wait")
          ? 1
          : 0;

  const healthTone =
    blockers.length > 2 || lastActivityTone === "red"
      ? "red"
      : blockers.length > 0 || lastActivityTone === "amber"
        ? "amber"
        : "green";
  const healthLabel =
    healthTone === "green"
      ? "Healthy"
      : healthTone === "amber"
        ? "Needs attention"
        : "At risk";

  const primaryQuote = quotes[0];
  const primaryQuoteHref = primaryQuote?.pdf_url ?? `/quotes?job=${jobId}`;

  return (
    <div className="pb-10">
      <JobCommandBar
        title={jobTitle}
        subtitle={`${customerName} • ${postcode}`}
        statusLabel={statusLabel}
        healthTone={healthTone}
        healthLabel={`Health: ${healthLabel}`}
        primaryActions={
          <>
            {quotes.length === 0 ? (
              <Link href={chatHref} className="bb-btn bb-btn-primary">
                Create quote
              </Link>
            ) : (
              <Link href={primaryQuoteHref} className="bb-btn bb-btn-primary">
                View quote
              </Link>
            )}
            <Link href={chatHref} className="bb-btn bb-btn-secondary">
              {jobData.conversation_id ? "View conversation" : "Message customer"}
            </Link>
          </>
        }
      />

      <div className="container stack gap-6 pt-6">
        <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
          ← Back to Jobs
        </Link>

        <JobKpiStrip
          inboundCount={inboundEmails.length}
          outboundCount={outboundEmails.length}
          sparkline={sparkline}
          lastActivityLabel={lastActivityLabel}
          lastActivityTone={lastActivityTone}
          quoteStatus={quoteStatus}
          blockersCount={blockers.length}
        />

        <JobNextActions
          items={blockersWithActions}
          ready={blockers.length === 0}
          chatHref={chatHref}
        />

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
            <JobSummaryCard
              customerName={customerName}
              customerEmail={customerEmail}
              customerPhone={customerPhone}
              siteAddress={siteAddress}
              postcode={postcode}
              jobType={jobType}
              jobNotes={jobDetails}
            />

            <JobAttachmentsGallery attachments={attachments} requestHref={chatHref} />

            <div className="bb-surface stack gap-4 p-5">
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

          <div className="stack min-w-0 gap-6">
            <JobPipelineStage stages={statusStages} activeIndex={statusStageIndex} />
            <JobRecentActivity items={recentActivity} />
            <JobCommsStats
              inbound={inboundEmails.length}
              outbound={outboundEmails.length}
              waitingOn={waitingOn}
              responseRatio={responseRatio}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
