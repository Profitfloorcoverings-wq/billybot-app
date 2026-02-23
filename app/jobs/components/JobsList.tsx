"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatRelativeTime, formatTimestamp } from "@/app/jobs/utils";
import JobStatusBadge from "@/app/jobs/components/JobStatusBadge";
import JobsFilters from "@/app/jobs/components/JobsFilters";

type Job = {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  last_activity_at?: string | null;
};

type StatusOption = {
  label: string;
  value: string;
};

type JobsListProps = {
  jobs: Job[];
  jobsError: string | null;
  initialSearch: string;
  initialStatus: string;
  debugEnabled?: boolean;
  statusOptions: StatusOption[];
};

export default function JobsList({
  jobs,
  jobsError,
  initialSearch,
  initialStatus,
  debugEnabled = false,
  statusOptions,
}: JobsListProps) {
  const [search, setSearch] = useState(initialSearch);

  const filteredJobs = useMemo(() => {
    if (!search.trim()) return jobs;
    const query = search.toLowerCase();
    return jobs.filter((job) => {
      const title = job.title?.toLowerCase() || "";
      const customer = job.customer_name?.toLowerCase() || "";
      const email = job.customer_email?.toLowerCase() || "";
      return [title, customer, email].some((value) => value.includes(query));
    });
  }, [jobs, search]);

  const hasJobs = jobs.length > 0;
  const hasFilteredJobs = filteredJobs.length > 0;
  const showError = !!jobsError;

  return (
    <>
      <JobsFilters
        initialSearch={initialSearch}
        initialStatus={initialStatus}
        debugEnabled={debugEnabled}
        statusOptions={statusOptions}
        onSearchChange={setSearch}
      />

      <div className="table-card scrollable-table" style={{ marginTop: "8px" }}>
        <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
          {showError && <div className="empty-state">{jobsError}</div>}

          {!showError && !hasJobs && (
            <div className="empty-state" style={{ textAlign: "center", padding: "40px 24px" }}>
              <h3 className="section-title" style={{ fontSize: "18px", marginBottom: "8px" }}>No jobs yet</h3>
              <p className="section-subtitle" style={{ marginBottom: "16px" }}>
                Jobs appear once a new request or email thread arrives.
              </p>
              <Link href="/requests" className="btn btn-primary">
                Submit a request
              </Link>
            </div>
          )}

          {!showError && hasJobs && !hasFilteredJobs && (
            <div className="empty-state">No jobs match your search.</div>
          )}

          {!showError && hasFilteredJobs && (
            <table className="data-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(15,23,42,0.98)" }}>
                <tr>
                  <th>Title</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
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
                          style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", textDecoration: "none" }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                        >
                          {title}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "14px", color: "#e2e8f0" }}>{customer}</span>
                          <span
                            style={{ fontSize: "12px", color: "#64748b", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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
                        <span
                          style={{ fontSize: "12px", color: "#64748b" }}
                          title={lastActivityExact}
                        >
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
    </>
  );
}
