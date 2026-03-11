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

  // Status counts for badges
  const statusCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    const s = (j.status ?? "unknown").toLowerCase().replace(/\s+/g, "_");
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const activeCount = jobs.filter((j) => {
    const s = (j.status ?? "").toLowerCase().replace(/\s+/g, "_");
    return !["completed", "archived", "lost", "merged"].includes(s);
  }).length;

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Jobs</h1>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
              Track every active job, email thread, and quote in one place.
            </p>
          </div>
          {jobs.length > 0 && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <StatBadge value={jobs.length} label="Total" color="#38bdf8" />
              <StatBadge value={activeCount} label="Active" color="#34d399" />
              {(statusCounts["quoted"] ?? 0) > 0 && (
                <StatBadge value={statusCounts["quoted"]!} label="Quoted" color="#a78bfa" />
              )}
              {(statusCounts["new"] ?? 0) > 0 && (
                <StatBadge value={statusCounts["new"]!} label="New" color="#fbbf24" />
              )}
            </div>
          )}
        </div>
      </header>

      <div className="card" style={{ padding: "20px" }}>
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
          <pre style={{ fontSize: "12px", color: "#64748b", whiteSpace: "pre-wrap" }}>
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

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: `${color}11`, border: `1px solid ${color}26`,
      borderRadius: "10px", padding: "6px 14px", textAlign: "center" as const,
      minWidth: "56px",
    }}>
      <p style={{ fontSize: "18px", fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}
