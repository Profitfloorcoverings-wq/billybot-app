"use client";

import Link from "next/link";
import { useState } from "react";

import { formatRelativeTime, humanizeStatus, shortId } from "./helpers";
import type { JobPageData } from "./types";

export default function JobHeader({ job, quotesCount }: { job: JobPageData["job"]; quotesCount: number }) {
  const [copied, setCopied] = useState(false);

  async function copyJobId() {
    await navigator.clipboard.writeText(job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="sticky top-0 z-20 rounded-2xl border border-white/10 bg-[#0d1527]/95 p-4 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Link href="/jobs" className="text-sm text-[var(--muted)] hover:text-white">
            ← Back to Jobs
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{job.title?.trim() || `Job ${shortId(job.id)}`}</h1>
            <span className="tag">{humanizeStatus(job.status)}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {job.customer_name || "Unknown customer"} · Last activity {formatRelativeTime(job.last_activity_at)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/quotes/new?jobId=${job.id}`} className="btn btn-primary h-10 px-4">
            {quotesCount ? "Create quote" : "Create first quote"}
          </Link>
          <Link
            href={job.conversation_id ? `/chat?conversation_id=${job.conversation_id}` : "#"}
            className={`btn btn-secondary h-10 px-4 ${job.conversation_id ? "" : "pointer-events-none opacity-50"}`}
          >
            View conversation
          </Link>
          <button type="button" className="btn btn-secondary h-10 px-4" onClick={copyJobId}>
            Copy Job ID
          </button>
        </div>
      </div>
      {copied ? <div className="toast mt-3 inline-flex">Copied</div> : null}
    </div>
  );
}
