export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { JOB_STATUS_FILTERS } from "@/app/jobs/constants";
import JobsList from "@/app/jobs/components/JobsList";
import { getJobsForCurrentTenant } from "@/lib/jobs/jobQueries";

type JobsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const debugEnabled = searchParams?.debug === "1";
  const searchValue =
    typeof searchParams?.search === "string" ? searchParams.search : "";
  const statusValue =
    typeof searchParams?.status === "string" ? searchParams.status : "all";

  const { user, userError, jobs, jobsError } = await getJobsForCurrentTenant(statusValue);

  if (!user && !debugEnabled) {
    redirect("/auth/login");
  }

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
        <JobsList
          jobs={jobs}
          jobsError={jobsError?.message ?? null}
          initialSearch={searchValue}
          initialStatus={statusValue}
          debugEnabled={debugEnabled}
          statusOptions={JOB_STATUS_FILTERS}
        />
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
