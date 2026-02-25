"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatRelativeTime, formatTimestamp } from "@/app/jobs/utils";

type Conversation = {
  id: string;
  title?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  thread_type?: string | null;
  last_activity_at?: string | null;
};

type ConversationsListProps = {
  conversations: Conversation[];
  conversationsError: string | null;
  initialSearch: string;
};

export default function ConversationsList({
  conversations,
  conversationsError,
  initialSearch,
}: ConversationsListProps) {
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const query = search.toLowerCase();
    return conversations.filter((c) => {
      const title = c.title?.toLowerCase() || "";
      const customer = c.customer_name?.toLowerCase() || "";
      const email = c.customer_email?.toLowerCase() || "";
      return [title, customer, email].some((v) => v.includes(query));
    });
  }, [conversations, search]);

  const hasItems = conversations.length > 0;
  const hasFiltered = filtered.length > 0;

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search conversations..."
          defaultValue={initialSearch}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "360px",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#f1f5f9",
            fontSize: "14px",
            outline: "none",
          }}
        />
      </div>

      <div className="table-card scrollable-table">
        <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
          {conversationsError && (
            <div className="empty-state">{conversationsError}</div>
          )}

          {!conversationsError && !hasItems && (
            <div className="empty-state" style={{ textAlign: "center", padding: "40px 24px" }}>
              <h3 className="section-title" style={{ fontSize: "18px", marginBottom: "8px" }}>
                No conversations yet
              </h3>
              <p className="section-subtitle">
                General email threads that aren't linked to a job will appear here.
              </p>
            </div>
          )}

          {!conversationsError && hasItems && !hasFiltered && (
            <div className="empty-state">No conversations match your search.</div>
          )}

          {!conversationsError && hasFiltered && (
            <table className="data-table">
              <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(15,23,42,0.98)" }}>
                <tr>
                  <th>Subject</th>
                  <th>From</th>
                  <th>Type</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const title = c.title?.trim() || "No subject";
                  const customer = c.customer_name?.trim() || "Unknown";
                  const lastActivityLabel = formatRelativeTime(c.last_activity_at);
                  const lastActivityExact = formatTimestamp(c.last_activity_at);
                  const typeLabel = c.thread_type === "enquiry" ? "Enquiry" : "Conversation";
                  const typeColor = c.thread_type === "enquiry" ? "#f59e0b" : "#94a3b8";

                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/jobs/${c.id}`}
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
                            title={c.customer_email || undefined}
                          >
                            {c.customer_email || "—"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "3px 10px", borderRadius: "999px",
                          fontSize: "12px", fontWeight: 600,
                          background: `${typeColor}18`,
                          color: typeColor,
                          border: `1px solid ${typeColor}30`,
                        }}>
                          {typeLabel}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#64748b" }} title={lastActivityExact}>
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
