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
  customer_phone?: string | null;
  status?: string | null;
  last_activity_at?: string | null;
  postcode?: string | null;
  thread_type?: string | null;
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

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

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
      const postcode = job.postcode?.toLowerCase() || "";
      return [title, customer, email, postcode].some((value) => value.includes(query));
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

      {/* Count */}
      {hasJobs && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 4px", padding: "0 2px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Showing {filteredJobs.length} of {jobs.length} jobs
          </span>
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch("")}
              style={{ fontSize: "12px", color: "#f87171", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              Clear search
            </button>
          )}
        </div>
      )}

      <div className="table-card scrollable-table" style={{ marginTop: "4px" }}>
        <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
          {showError && <div className="empty-state">{jobsError}</div>}

          {!showError && !hasJobs && (
            <div className="empty-state" style={{ textAlign: "center", padding: "56px 24px" }}>
              <div style={{ fontSize: "36px", opacity: 0.3, marginBottom: "12px" }}>📋</div>
              <h3 className="section-title" style={{ fontSize: "17px", marginBottom: "6px" }}>No jobs yet</h3>
              <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px", maxWidth: "360px", margin: "0 auto 16px" }}>
                Jobs appear automatically when a new email thread arrives or you create one in chat.
              </p>
              <Link href="/chat" className="btn btn-primary">
                Go to Chat
              </Link>
            </div>
          )}

          {!showError && hasJobs && !hasFilteredJobs && (
            <div className="empty-state" style={{ padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", opacity: 0.3, marginBottom: "8px" }}>🔍</div>
              <p style={{ color: "#64748b", fontSize: "14px" }}>No jobs match your search.</p>
            </div>
          )}

          {!showError && hasFilteredJobs && (
            <table className="data-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(15,23,42,0.98)" }}>
                <tr>
                  <th style={{ width: "300px" }}>Job</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Last Activity</th>
                  <th className="sticky-cell" style={{ textAlign: "right" }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const id = job.id;
                  const title = job.title?.trim() || "Untitled job";
                  const customer = job.customer_name?.trim() || "Unknown customer";
                  const email = job.customer_email?.trim() || "";
                  const lastActivityLabel = formatRelativeTime(job.last_activity_at);
                  const lastActivityExact = formatTimestamp(job.last_activity_at);
                  const initials = getInitials(customer);
                  const isConversation = job.thread_type === "conversation" || job.thread_type === "enquiry";
                  const detailHref = isConversation ? `/conversations/${id}` : `/jobs/${id}`;

                  return (
                    <tr key={id} style={{ cursor: "pointer" }} onClick={() => window.location.href = detailHref}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                            background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "13px", fontWeight: 700, color: "#38bdf8",
                          }}>
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <Link
                              href={detailHref}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {title}
                            </Link>
                            {job.postcode && (
                              <span style={{ fontSize: "11px", color: "#475569" }}>{job.postcode}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "14px", color: "#e2e8f0" }}>{customer}</span>
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: "12px", color: "#38bdf8", textDecoration: "none", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}
                              title={`Email ${email}`}
                            >
                              {email}
                            </a>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#475569" }}>—</span>
                          )}
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
                      <td className="sticky-cell">
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <Link
                            href={detailHref}
                            onClick={(e) => e.stopPropagation()}
                            className="btn btn-secondary"
                            style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "999px" }}
                          >
                            View
                          </Link>
                        </div>
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
