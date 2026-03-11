export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import ConversationsList from "@/app/conversations/components/ConversationsList";
import { getConversationsForCurrentTenant } from "@/lib/jobs/jobQueries";

type ConversationsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ConversationsPage({ searchParams }: ConversationsPageProps) {
  const searchValue =
    typeof searchParams?.search === "string" ? searchParams.search : "";

  const { user, jobs: conversations, jobsError } = await getConversationsForCurrentTenant();

  if (!user) {
    redirect("/auth/login");
  }

  const needsActionCount = conversations.filter((c) => !!(c as { outbound_email_body?: string | null }).outbound_email_body).length;

  return (
    <div className="page-container">
      <header style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title" style={{ marginBottom: "4px" }}>Conversations</h1>
            <p style={{ color: "#64748b", fontSize: "13px", margin: 0, lineHeight: 1.5 }}>
              Email threads that aren&apos;t linked to a job. BillyBot drafts replies for you to review.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {needsActionCount > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px",
                borderRadius: "999px", fontSize: "13px", fontWeight: 700,
                background: "rgba(249,115,22,0.12)", color: "#fb923c",
                border: "1px solid rgba(249,115,22,0.3)",
                animation: "pulse-soft 2s ease-in-out infinite",
              }}>
                <span style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: "#fb923c",
                }} />
                {needsActionCount} {needsActionCount === 1 ? "needs" : "need"} your review
              </span>
            )}
            {conversations.length > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "8px 16px",
                borderRadius: "999px", fontSize: "13px", fontWeight: 600,
                background: "rgba(148,163,184,0.08)", color: "#94a3b8",
                border: "1px solid rgba(148,163,184,0.15)",
              }}>
                {conversations.length} {conversations.length === 1 ? "thread" : "threads"}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: "20px" }}>
        <ConversationsList
          conversations={conversations}
          conversationsError={jobsError?.message ?? null}
          initialSearch={searchValue}
        />
      </div>
    </div>
  );
}
