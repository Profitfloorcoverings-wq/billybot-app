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
  status?: string | null;
};

type FilterTab = "all" | "needs_reply" | "waiting";

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
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const needsReplyCount = conversations.filter((c) => !!c.outbound_email_body).length;
  const waitingCount = conversations.filter((c) => !c.outbound_email_body).length;

  const filtered = useMemo(() => {
    let list = conversations;

    // Filter by tab
    if (activeFilter === "needs_reply") {
      list = list.filter((c) => !!c.outbound_email_body);
    } else if (activeFilter === "waiting") {
      list = list.filter((c) => !c.outbound_email_body);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        [c.title, c.customer_name, c.customer_email]
          .some((v) => v?.toLowerCase().includes(q))
      );
    }

    // Sort: drafts pending action first, then by activity
    return [...list].sort((a, b) => {
      const aDraft = a.outbound_email_body ? 1 : 0;
      const bDraft = b.outbound_email_body ? 1 : 0;
      if (aDraft !== bDraft) return bDraft - aDraft;
      const aTime = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const bTime = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, search, activeFilter]);

  if (conversationsError) {
    return <div className="empty-state">{conversationsError}</div>;
  }

  if (!conversations.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 24px" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.4 }}>✉️</div>
        <h3 className="section-title" style={{ fontSize: "18px", marginBottom: "8px" }}>
          No conversations yet
        </h3>
        <p style={{ color: "#64748b", fontSize: "13px", maxWidth: "360px", margin: "0 auto", lineHeight: 1.6 }}>
          When BillyBot receives emails that aren&apos;t about a specific job, they&apos;ll appear here with suggested replies for you to review.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Filter tabs + search */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <FilterButton
          label="All"
          count={conversations.length}
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <FilterButton
          label="Needs reply"
          count={needsReplyCount}
          active={activeFilter === "needs_reply"}
          onClick={() => setActiveFilter("needs_reply")}
          accent
        />
        <FilterButton
          label="Waiting"
          count={waitingCount}
          active={activeFilter === "waiting"}
          onClick={() => setActiveFilter("waiting")}
        />
        <div style={{ flex: 1, minWidth: "180px", maxWidth: "320px", marginLeft: "auto" }}>
          <input
            type="text"
            placeholder="Search by name, email, subject..."
            defaultValue={initialSearch}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#f1f5f9",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {!filtered.length ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "#64748b", fontSize: "14px" }}>
          No conversations match your filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filtered.map((c, i) => {
            const title = c.title?.trim() || "No subject";
            const customerName = c.customer_name?.trim() || null;
            const customerEmail = c.customer_email || null;
            const hasDraft = !!c.outbound_email_body;
            const relativeTime = formatRelativeTime(c.last_activity_at);
            const exactTime = formatTimestamp(c.last_activity_at);
            const initials = getInitials(customerName || customerEmail || "?");
            const threadLabel = c.thread_type === "enquiry" ? "Enquiry" : "Conversation";

            return (
              <Link
                key={c.id}
                href={`/conversations/${c.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 8px",
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: "8px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Avatar */}
                <div style={{
                  width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                  background: hasDraft ? "rgba(249,115,22,0.15)" : "rgba(56,189,248,0.1)",
                  border: hasDraft ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(56,189,248,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: 700,
                  color: hasDraft ? "#fb923c" : "#38bdf8",
                }}>
                  {initials}
                </div>

                {/* Content */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{
                      fontSize: "14px", fontWeight: 600, color: "#f1f5f9",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {title}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      {customerName || customerEmail || "Unknown"}
                    </span>
                    {customerName && customerEmail && (
                      <span style={{ fontSize: "11px", color: "#475569" }}>{customerEmail}</span>
                    )}
                    <span style={{
                      fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px",
                      background: "rgba(148,163,184,0.08)", color: "#64748b",
                      textTransform: "uppercase", letterSpacing: "0.03em",
                    }}>
                      {threadLabel}
                    </span>
                  </div>
                </div>

                {/* Right side */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                  <span
                    style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap" }}
                    title={exactTime}
                  >
                    {relativeTime}
                  </span>
                  {hasDraft ? (
                    <span style={{
                      fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px",
                      background: "rgba(249,115,22,0.12)", color: "#fb923c",
                      border: "1px solid rgba(249,115,22,0.25)",
                    }}>
                      Review draft
                    </span>
                  ) : (
                    <span style={{
                      fontSize: "11px", padding: "3px 8px", borderRadius: "999px",
                      background: "rgba(148,163,184,0.06)", color: "#64748b",
                    }}>
                      No action needed
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  accent,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  const accentColor = accent && count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: active ? 700 : 500,
        background: active
          ? accentColor ? "rgba(249,115,22,0.15)" : "rgba(56,189,248,0.1)"
          : "rgba(255,255,255,0.04)",
        color: active
          ? accentColor ? "#fb923c" : "#38bdf8"
          : "#94a3b8",
        border: active
          ? accentColor ? "1px solid rgba(249,115,22,0.3)" : "1px solid rgba(56,189,248,0.2)"
          : "1px solid rgba(255,255,255,0.06)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        transition: "all 0.15s",
      }}
    >
      {label}
      <span style={{
        fontSize: "11px", fontWeight: 700,
        background: active
          ? accentColor ? "rgba(249,115,22,0.2)" : "rgba(56,189,248,0.15)"
          : "rgba(255,255,255,0.06)",
        padding: "1px 6px",
        borderRadius: "999px",
      }}>
        {count}
      </span>
    </button>
  );
}

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}
