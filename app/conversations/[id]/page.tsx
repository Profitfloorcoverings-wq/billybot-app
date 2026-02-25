export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import EmailThread from "@/app/jobs/[id]/components/EmailThread";
import OutboundDraftPanel from "@/app/jobs/[id]/components/OutboundDraftPanel";
import { getJobBundle } from "@/lib/jobs/getJobBundle";
import { getJobByIdForCurrentTenant } from "@/lib/jobs/jobQueries";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const sender = job.customer_name || job.customer_email || "Unknown sender";
  const subject = job.title || "No subject";

  return (
    <div className="page-container">

      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <Link
          href="/conversations"
          style={{ fontSize: "13px", color: "#64748b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "12px" }}
        >
          ← Conversations
        </Link>
        <h1 className="section-title" style={{ marginBottom: "4px" }}>{subject}</h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          {sender}
          {job.customer_email && job.customer_name ? (
            <span style={{ color: "#475569" }}> · {job.customer_email}</span>
          ) : null}
        </p>
      </div>

      {/* Draft reply */}
      {hasDraft && (
        <div style={{ marginBottom: "20px" }}>
          <OutboundDraftPanel
            jobId={id}
            initialSubject={job.outbound_email_subject ?? null}
            initialBody={job.outbound_email_body ?? null}
          />
        </div>
      )}

      {/* Email thread */}
      <div className="card" style={{ padding: "0" }}>
        {emailThread.length ? (
          <EmailThread emailThread={emailThread} />
        ) : (
          <div className="empty-state" style={{ padding: "40px 24px", textAlign: "center" }}>
            <p className="section-subtitle">No email thread found for this conversation.</p>
          </div>
        )}
      </div>

    </div>
  );
}
