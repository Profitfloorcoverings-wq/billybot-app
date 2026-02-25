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
  outbound_email_body?: string | null;
};

export default function ConversationsList({
  conversations,
  conversationsError,
  initialSearch,
}: {
  conversations: Conversation[];
  conversationsError: string | null;
  initialSearch: string;
}) {
  const [search, setSearch] = useState(initialSearch);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      [c.title, c.customer_name, c.customer_email]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [conversations, search]);

  if (conversationsError) {
    return <div className="empty-state">{conversationsError}</div>;
  }

  if (!conversations.length) {
    return (
      <div className="empty-state" style={{ textAlign: "center", padding: "48px 24px" }}>
        <h3 className="section-title" style={{ fontSize: "18px", marginBottom: "8px" }}>
          No conversations yet
        </h3>
        <p className="section-subtitle">
          General email threads that aren&apos;t linked to a job will appear here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Search..."
          defaultValue={initialSearch}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "320px",
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

      {!filtered.length ? (
        <div className="empty-state">No conversations match your search.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((c, i) => {
            const title = c.title?.trim() || "No subject";
            const customer = c.customer_name?.trim() || c.customer_email || "Unknown";
            const hasDraft = !!c.outbound_email_body;
            const relativeTime = formatRelativeTime(c.last_activity_at);
            const exactTime = formatTimestamp(c.last_activity_at);

            return (
              <Link
                key={c.id}
                href={`/jobs/${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                  padding: "14px 4px",
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                    {hasDraft && (
                      <span
                        title="Draft reply pending"
                        style={{
                          width: "7px", height: "7px", borderRadius: "50%",
                          background: "#fb923c", flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{
                      fontSize: "14px", fontWeight: 600, color: "#f1f5f9",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {title}
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{customer}</span>
                </div>

                <span
                  style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap", flexShrink: 0 }}
                  title={exactTime}
                >
                  {relativeTime}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
