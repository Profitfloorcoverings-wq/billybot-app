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

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Conversations</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              General email threads that aren&apos;t linked to a specific job.
            </p>
          </div>
          {conversations.length > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "6px 14px",
              borderRadius: "999px", fontSize: "13px", fontWeight: 700,
              background: "rgba(148,163,184,0.1)", color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.25)",
            }}>
              {conversations.length} {conversations.length === 1 ? "thread" : "threads"}
            </span>
          )}
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
