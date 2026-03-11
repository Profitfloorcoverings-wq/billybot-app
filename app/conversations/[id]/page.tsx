export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import EmailThread from "@/app/jobs/[id]/components/EmailThread";
import OutboundDraftPanel from "@/app/jobs/[id]/components/OutboundDraftPanel";
import { getJobBundle } from "@/lib/jobs/getJobBundle";
import { getJobByIdForCurrentTenant } from "@/lib/jobs/jobQueries";
import { formatTimestamp } from "@/app/jobs/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return (
      <div className="page-container">
        <div className="empty-state stack items-center">
          <h2 className="section-title">Invalid link</h2>
          <Link href="/conversations" className="btn btn-primary">Back to Conversations</Link>
        </div>
      </div>
    );
  }

  const { user, job, currentClientId } = await getJobByIdForCurrentTenant(id);

  if (!user) redirect("/auth/login");

  if (!job || !currentClientId) {
    return (
      <div className="page-container">
        <div className="empty-state stack items-center">
          <h2 className="section-title">Not found</h2>
          <Link href="/conversations" className="btn btn-primary">Back to Conversations</Link>
        </div>
      </div>
    );
  }

  const bundle = await getJobBundle({ job, currentClientId });

  if (!bundle) {
    return (
      <div className="page-container">
        <div className="empty-state stack items-center">
          <h2 className="section-title">Not found</h2>
          <Link href="/conversations" className="btn btn-primary">Back to Conversations</Link>
        </div>
      </div>
    );
  }

  const { emailThread } = bundle;
  const hasDraft = !!(job.outbound_email_subject || job.outbound_email_body);
  const customerName = job.customer_name?.trim() || null;
  const customerEmail = job.customer_email || null;
  const sender = customerName || customerEmail || "Unknown sender";
  const subject = job.title || "No subject";
  const initials = getInitials(sender);
  const threadLabel = job.thread_type === "enquiry" ? "Enquiry" : "Conversation";
  const emailCount = emailThread.length;
  const lastActivity = formatTimestamp(job.last_activity_at);

  return (
    <div className="page-container" style={{ maxWidth: "900px" }}>
      {/* Back nav */}
      <Link
        href="/conversations"
        style={{
          fontSize: "13px", color: "#64748b", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: "6px",
          marginBottom: "16px", padding: "4px 0",
        }}
      >
        <span style={{ fontSize: "16px" }}>←</span> Back to Conversations
      </Link>

      {/* Header card */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%", flexShrink: 0,
            background: hasDraft ? "rgba(249,115,22,0.15)" : "rgba(56,189,248,0.1)",
            border: hasDraft ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(56,189,248,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px", fontWeight: 700,
            color: hasDraft ? "#fb923c" : "#38bdf8",
          }}>
            {initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 6px" }}>
              {subject}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", color: "#e2e8f0", fontWeight: 500 }}>{sender}</span>
              {customerName && customerEmail && (
                <span style={{ fontSize: "13px", color: "#64748b" }}>{customerEmail}</span>
              )}
            </div>

            {/* Meta row */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "12px" }}>
              <MetaPill label="Type" value={threadLabel} />
              <MetaPill label="Emails" value={String(emailCount)} />
              <MetaPill label="Last activity" value={lastActivity} />
              {job.customer_phone && <MetaPill label="Phone" value={job.customer_phone} />}
              {hasDraft && (
                <span style={{
                  fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "6px",
                  background: "rgba(249,115,22,0.12)", color: "#fb923c",
                  border: "1px solid rgba(249,115,22,0.25)",
                  display: "inline-flex", alignItems: "center", gap: "5px",
                }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fb923c" }} />
                  Draft reply ready
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Draft reply — prominent if present */}
      {hasDraft && (
        <div style={{ marginBottom: "16px" }}>
          <OutboundDraftPanel
            jobId={id}
            initialSubject={job.outbound_email_subject ?? null}
            initialBody={job.outbound_email_body ?? null}
          />
        </div>
      )}

      {/* Email thread */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Email Thread
          </h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            {emailCount} {emailCount === 1 ? "email" : "emails"}
          </span>
        </div>
        {emailThread.length ? (
          <EmailThread emailThread={emailThread} />
        ) : (
          <div style={{ textAlign: "center", padding: "40px 24px" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.3 }}>📭</div>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              No emails in this thread yet. They&apos;ll appear here once BillyBot processes them.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      fontSize: "12px", color: "#94a3b8", display: "inline-flex", alignItems: "center", gap: "4px",
    }}>
      <span style={{ color: "#475569", fontWeight: 500 }}>{label}:</span> {value}
    </span>
  );
}
