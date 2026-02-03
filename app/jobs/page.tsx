export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import { JOB_STATUS_FILTERS } from "@/app/jobs/constants";
import JobStatusBadge from "@/app/jobs/components/JobStatusBadge";
import JobsFilters from "@/app/jobs/components/JobsFilters";
import { formatRelativeTime, formatTimestamp, normalizeStatus, JOB_SELECT } from "@/app/jobs/utils";
import { createServerClient } from "@/utils/supabase/server";

type Job = {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  last_activity_at?: string | null;
};

type JobsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const supabase = await createServerClient();
  const debugEnabled = searchParams?.debug === "1";
  const searchValue =
    typeof searchParams?.search === "string" ? searchParams.search : "";
  const statusValue =
    typeof searchParams?.status === "string" ? searchParams.status : "all";

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user && !debugEnabled) {
    redirect("/auth/login");
  }

  let jobsError: { message?: string } | null = null;
  let jobs: Job[] = [];

  if (user) {
    let query = supabase
      .from("jobs")
      .select(JOB_SELECT)
      .eq("client_id", user.id)
      .order("last_activity_at", { ascending: false });

    const trimmedSearch = searchValue.trim();
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/,/g, "");
      query = query.or(
        `title.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`
      );
    }

    if (statusValue !== "all") {
      const normalized = normalizeStatus(statusValue);
      const pattern = normalized === "awaiting_info" ? "awaiting%info" : normalized;
      query = query.ilike("status", pattern);
    }

    const { data, error } = await query;
    if (error) {
      jobsError = { message: error.message };
    } else {
      jobs = data ?? [];
    }
  }

  const hasJobs = jobs.length > 0;
  const showEmpty = !jobsError && !hasJobs;
  const showError = !!jobsError;

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Jobs</h1>
          <p className="section-subtitle">
            Track every active job, email thread, and quote in one place.
          </p>
        </div>
      </div>

      <div className="card stack gap-4">
        <JobsFilters
          initialSearch={searchValue}
          initialStatus={statusValue}
          debugEnabled={debugEnabled}
          statusOptions={JOB_STATUS_FILTERS}
        />

        <div className="table-card scrollable-table">
          <div className="relative w-full max-h-[70vh] overflow-y-auto">
            {showError && <div className="empty-state">{jobsError?.message}</div>}

            {showEmpty && (
              <div className="empty-state stack items-center">
                <h3 className="section-title">No jobs yet</h3>
                <p className="section-subtitle">
                  Jobs appear once a new request or email thread arrives.
                </p>
                <Link href="/requests" className="btn btn-primary">
                  Submit a request
                </Link>
              </div>
            )}

            {!showError && hasJobs && (
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-[var(--card)]">
                  <tr>
                    <th>Title</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const id = job.id;
                    const title = job.title?.trim() || "Untitled job";
                    const customer = job.customer_name?.trim() || "Unknown customer";
                    const lastActivityLabel = formatRelativeTime(job.last_activity_at);
                    const lastActivityExact = formatTimestamp(job.last_activity_at);

                    return (
                      <tr key={id}>
                        <td>
                          <Link
                            href={`/jobs/${id}`}
                            className="text-[15px] font-semibold text-white hover:underline"
                          >
                            {title}
                          </Link>
                        </td>
                        <td>
                          <div className="stack gap-1">
                            <span className="text-sm text-[var(--muted)]">
                              {customer}
                            </span>
                            <span
                              className="text-xs text-[var(--muted)] truncate max-w-[220px]"
                              title={job.customer_email || undefined}
                            >
                              {job.customer_email || "—"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td>
                          <span className="text-xs text-[var(--muted)]" title={lastActivityExact}>
                            {lastActivityLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {debugEnabled ? (
        <div className="card">
          <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap">
            {JSON.stringify(
              {
                user_id: user?.id ?? null,
                user_email: user?.email ?? null,
                user_error: userError?.message ?? null,
                node_env: process.env.NODE_ENV ?? null,
                supabase_url_host: process.env.NEXT_PUBLIC_SUPABASE_URL
                  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
                  : null,
                jobs_filter_key: "client_id",
                jobs_error: jobsError?.message ?? null,
                jobs_count: jobs.length,
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
