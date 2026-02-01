"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { JOB_STATUS_FILTERS } from "@/app/jobs/constants";
import JobStatusBadge from "@/app/jobs/components/JobStatusBadge";
import ProviderBadge from "@/app/jobs/components/ProviderBadge";
import { formatRelativeTime, formatTimestamp, normalizeStatus } from "@/app/jobs/utils";
import { createClient } from "@/utils/supabase/client";

type Job = {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  provider?: string | null;
  last_activity_at?: string | null;
};

export default function JobsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quotesByJob, setQuotesByJob] = useState<Set<string>>(new Set());
  const [quoteRefs, setQuoteRefs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => {
      async function loadJobs() {
        setLoading(true);
        setError(null);

        try {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          const clientId = userData?.user?.id;

          if (userError || !clientId) {
            throw new Error(userError?.message || "Unable to find your account");
          }

          let query = supabase
            .from("jobs")
            .select(
              "id, title, customer_name, customer_email, status, provider, last_activity_at"
            )
            .eq("client_id", clientId)
            .order("last_activity_at", { ascending: false });

          const trimmedSearch = search.trim();
          if (trimmedSearch) {
            const escaped = trimmedSearch.replace(/,/g, "");
            query = query.or(
              `title.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`
            );
          }

          if (status !== "all") {
            const normalized = normalizeStatus(status);
            const pattern =
              normalized === "awaiting_info" ? "awaiting%info" : normalized;
            query = query.ilike("status", pattern);
          }

          const { data, error: jobsError } = await query;

          if (jobsError) {
            throw jobsError;
          }

          const list = data ?? [];
          if (active) {
            setJobs(list);
          }

          const jobIds = list.map((job) => job.id);
          const jobTitles = list
            .map((job) => job.title?.trim())
            .filter((title): title is string => Boolean(title));

          const nextQuoteIds = new Set<string>();
          const nextQuoteRefs = new Set<string>();

          if (jobIds.length > 0) {
            const { data: quotesById } = await supabase
              .from("quotes")
              .select("id, job_id")
              .in("job_id", jobIds)
              .eq("client_id", clientId);

            quotesById?.forEach((quote) => {
              if (quote.job_id) nextQuoteIds.add(quote.job_id);
            });
          }

          if (jobTitles.length > 0) {
            const { data: quotesByRef } = await supabase
              .from("quotes")
              .select("id, job_ref")
              .in("job_ref", jobTitles)
              .eq("client_id", clientId);

            quotesByRef?.forEach((quote) => {
              if (quote.job_ref) nextQuoteRefs.add(quote.job_ref);
            });
          }

          if (active) {
            setQuotesByJob(nextQuoteIds);
            setQuoteRefs(nextQuoteRefs);
          }
        } catch (err) {
          if (active) {
            setError(
              err && typeof err === "object" && "message" in err
                ? String((err as { message?: string }).message)
                : "Unable to load jobs"
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      }

      void loadJobs();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [supabase, search, status]);

  const hasJobs = jobs.length > 0;

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
        <div className="stack md:row md:items-end md:justify-between gap-3">
          <div className="stack flex-1">
            <p className="section-subtitle">Search</p>
            <input
              className="input-fluid"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by job title, customer name, or email"
            />
          </div>
          <div className="stack min-w-[200px]">
            <p className="section-subtitle">Status</p>
            <select
              className="input-fluid"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {JOB_STATUS_FILTERS.map((filter) => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-card scrollable-table">
          <div className="relative w-full max-h-[70vh] overflow-y-auto">
            {loading && <div className="empty-state">Loading jobs…</div>}
            {error && !loading && <div className="empty-state">{error}</div>}

            {!loading && !error && !hasJobs && (
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

            {!loading && !error && hasJobs && (
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-[var(--card)]">
                  <tr>
                    <th>Title</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Provider</th>
                    <th>Last activity</th>
                    <th>Has quote</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => {
                    const title = job.title?.trim() || "Untitled job";
                    const customer = job.customer_name?.trim() || "Unknown customer";
                    const lastActivityLabel = formatRelativeTime(job.last_activity_at);
                    const lastActivityExact = formatTimestamp(job.last_activity_at);
                    const hasQuote =
                      quotesByJob.has(job.id) ||
                      (job.title ? quoteRefs.has(job.title) : false);

                    return (
                      <tr key={job.id}>
                        <td>
                          <Link
                            href={`/jobs/${job.id}`}
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
                          <ProviderBadge provider={job.provider} />
                        </td>
                        <td>
                          <span className="text-xs text-[var(--muted)]" title={lastActivityExact}>
                            {lastActivityLabel}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${
                              hasQuote
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                : "border-white/10 bg-white/5 text-white/50"
                            }`}
                            title={hasQuote ? "Quote attached" : "No quote yet"}
                          >
                            {hasQuote ? "✓" : "—"}
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
    </div>
  );
}
