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
import JobAttachmentsGalleryClient from "@/app/jobs/[id]/JobAttachmentsGalleryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

function toneToVariant(tone: "green" | "amber" | "red") {
  if (tone === "green") return "success";
  if (tone === "amber") return "warning";
  return "danger";
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
  const summaryLabel = ready
    ? "Ready to quote"
    : `${items.length} blocker${items.length === 1 ? "" : "s"} — fix these to quote`;

  return (
    <Card id="whats-next">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>What&apos;s next</CardTitle>
          <Badge variant={ready ? "success" : "secondary"}>{summaryLabel}</Badge>
        </div>
        <CardDescription>Focus on blockers to move the job forward.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        {ready ? (
          <div className="flex flex-col gap-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">Ready to quote</p>
              <p className="text-xs text-emerald-100/80">
                All critical details are captured. Send a quote now.
              </p>
            </div>
            <Button asChild>
              <Link href={chatHref}>Create quote</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm text-white">
                  <span className="text-lg" aria-hidden="true">
                    ☐
                  </span>
                  <span>{item.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild size="sm">
                    <Link href={item.requestHref}>Request</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={item.addHref}>Add now</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobFacts({
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
    <Card id="job-summary">
      <CardHeader>
        <CardTitle>Job summary</CardTitle>
        <CardDescription>Quick facts to keep the team aligned.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Customer</p>
            <div className="space-y-1 text-sm text-white">
              <span className="block">👤 {customerName}</span>
              <span className="block text-xs text-[var(--muted)] break-anywhere">
                ✉️ {customerEmail}
              </span>
              <span className="block text-xs text-[var(--muted)] break-anywhere">
                📞 {customerPhone}
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Site</p>
            <div className="space-y-1 text-sm text-white">
              <span className="block">📍 {siteAddress}</span>
              <span className="block text-xs text-[var(--muted)]">🏷️ {postcode}</span>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Job type</p>
            <p className="text-sm font-semibold text-white">🧰 {jobType}</p>
          </div>
        </div>
        <p className="text-xs text-[var(--muted)] line-clamp-2">{jobNotes}</p>
        <details className="rounded-xl border border-white/10 bg-white/5 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--accent2)]">
            Show job notes
          </summary>
          <p className="mt-3 text-sm text-[var(--muted)] whitespace-pre-wrap break-anywhere">
            {jobNotes}
          </p>
        </details>
      </CardContent>
    </Card>
  );
}

function JobPipelineStepper({
  stages,
  activeIndex,
}: {
  stages: string[];
  activeIndex: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pipeline stage</CardTitle>
        <CardDescription>Track progress through each phase.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const active = index === activeIndex;
            const complete = index < activeIndex;
            const isLast = index === stages.length - 1;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="flex h-5 w-5 items-center justify-center">
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
                </div>
                <div className="flex-1">
                  <span className={active ? "text-white font-semibold" : "text-[var(--muted)]"}>
                    {stage}
                  </span>
                  {!isLast ? <div className="mt-2 h-px w-full bg-white/5" /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function JobCommsActivity({
  inbound,
  outbound,
  waitingOn,
  responseRatio,
  items,
}: {
  inbound: number;
  outbound: number;
  waitingOn: string;
  responseRatio: string;
  items: ActivityItem[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comms & activity</CardTitle>
        <CardDescription>Recent activity and communication stats.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <StatRow label="Inbound" value={inbound} />
            <StatRow label="Outbound" value={outbound} />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <StatRow label="Response ratio" value={responseRatio} />
            <StatRow label="Waiting on" value={waitingOn} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>Recent activity</span>
            <span>Last 5</span>
          </div>
          {items.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-[var(--muted)]">
              No recent activity yet.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="text-white line-clamp-1">{item.label}</span>
                  </div>
                  <span className="text-xs text-[var(--muted)]">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
          <h3 className="text-lg font-semibold text-white">Invalid job id</h3>
          <p className="text-sm text-[var(--muted)]">
            The job link is invalid. Return to the Jobs list and try again.
          </p>
          <Button asChild>
            <Link href="/jobs">Back to Jobs</Link>
          </Button>
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
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-[var(--muted)]">
          Not signed in.
        </div>
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
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
          <h3 className="text-lg font-semibold text-white">Unable to load job</h3>
          <p className="text-sm text-[var(--muted)]">
            There was an issue loading this job. Please try again shortly.
          </p>
          <Button asChild>
            <Link href="/jobs">Back to Jobs</Link>
          </Button>
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
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center space-y-3">
          <h3 className="text-lg font-semibold text-white">Job not found</h3>
          <p className="text-sm text-[var(--muted)]">
            We couldn&apos;t find this job or you don&apos;t have access to it.
          </p>
          <Button asChild>
            <Link href="/jobs">Back to Jobs</Link>
          </Button>
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
  const waitingLabel = waitingOn === "Unknown" ? undefined : `Waiting on: ${waitingOn}`;
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
  const healthReason =
    blockers.length > 0
      ? `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} to resolve`
      : lastActivityTone === "red"
        ? "No recent activity in the last 72h"
        : lastActivityTone === "amber"
          ? "Activity slowing down (48h+)"
          : "On track";

  const primaryQuote = quotes[0];
  const primaryQuoteHref = primaryQuote?.pdf_url ?? `/quotes?job=${jobId}`;

  return (
    <div className="pb-10">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pt-6">
        <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
          ← Back to Jobs
        </Link>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">{jobTitle}</h1>
              <p className="text-sm text-[var(--muted)]">
                {customerName} • {customerEmail}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Stage: {statusLabel}</Badge>
              <Badge variant={toneToVariant(healthTone)} title={healthReason}>
                Health: {healthLabel}
              </Badge>
              {waitingLabel ? <Badge variant="outline">{waitingLabel}</Badge> : null}
              <Badge variant="secondary">Blockers: {blockers.length}</Badge>
              <Badge variant="secondary">Last: {lastActivityLabel}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {quotes.length === 0 ? (
              <Button asChild>
                <Link href={chatHref}>Create quote</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={primaryQuoteHref}>View quote</Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href={chatHref}>
                {jobData.conversation_id ? "View conversation" : "Message customer"}
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="#whats-next">Request info</Link>
            </Button>
          </div>
        </div>

        {debugEnabled ? (
          <Card>
            <CardHeader>
              <CardTitle>Debug</CardTitle>
              <CardDescription>Job fetch and routing metadata.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
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
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,320px)]">
          <div className="space-y-6">
            <JobNextActions
              items={blockersWithActions}
              ready={blockers.length === 0}
              chatHref={chatHref}
            />

            <JobCommsActivity
              inbound={inboundEmails.length}
              outbound={outboundEmails.length}
              waitingOn={waitingOn}
              responseRatio={responseRatio}
              items={recentActivity}
            />
          </div>

          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <JobFacts
              customerName={customerName}
              customerEmail={customerEmail}
              customerPhone={customerPhone}
              siteAddress={siteAddress}
              postcode={postcode}
              jobType={jobType}
              jobNotes={jobDetails}
            />

            <JobAttachmentsGalleryClient attachments={attachments} requestHref={chatHref} />

            <JobPipelineStepper stages={statusStages} activeIndex={statusStageIndex} />

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle>Linked quotes</CardTitle>
                    <CardDescription>Quoted outcomes for this job.</CardDescription>
                  </div>
                  <span className="text-xs text-[var(--muted)]">{quotes.length} total</span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
                {quotes.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No quotes linked to this job yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {quotes.map((quote) => {
                      const label = quote.quote_reference
                        ? `Quote ${quote.quote_reference}`
                        : "Quote";
                      const createdAt = formatTimestamp(quote.created_at);
                      return (
                        <div
                          key={quote.id}
                          className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1"
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
