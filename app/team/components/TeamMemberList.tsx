"use client";

import { useState } from "react";

import type { TeamInvite, TeamMember } from "@/types/team";

type Props = {
  members: TeamMember[];
  pendingInvites: TeamInvite[];
};

const roleColours: Record<string, { bg: string; text: string; border: string }> = {
  manager: { bg: "rgba(59,130,246,0.15)", text: "#93c5fd", border: "rgba(59,130,246,0.3)" },
  fitter:  { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.3)" },
  estimator: { bg: "rgba(168,85,247,0.12)", text: "#c084fc", border: "rgba(168,85,247,0.3)" },
};

const statusColours: Record<string, { bg: string; text: string; border: string }> = {
  accepted: { bg: "rgba(34,197,94,0.12)",  text: "#4ade80", border: "rgba(34,197,94,0.25)" },
  revoked:  { bg: "rgba(239,68,68,0.10)",  text: "#f87171", border: "rgba(239,68,68,0.25)" },
  pending:  { bg: "rgba(245,158,11,0.10)", text: "#fbbf24", border: "rgba(245,158,11,0.25)" },
};

function RoleBadge({ role }: { role: string }) {
  const c = roleColours[role] ?? { bg: "rgba(255,255,255,0.06)", text: "#94a3b8", border: "rgba(148,163,184,0.2)" };
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = statusColours[status] ?? { bg: "rgba(255,255,255,0.06)", text: "#94a3b8", border: "rgba(148,163,184,0.2)" };
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: "999px",
      fontSize: "11px",
      fontWeight: 700,
      letterSpacing: "0.04em",
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function TeamMemberList({ members: initialMembers, pendingInvites }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(memberId: string) {
    setActionId(memberId);
    setError(null);
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_status: "revoked" }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to revoke member.");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, invite_status: "revoked" } : m))
      );
    } catch {
      setError("Network error.");
    } finally {
      setActionId(null);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setActionId(memberId);
    setError(null);
    try {
      const res = await fetch(`/api/team/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to update role.");
        return;
      }
      setMembers((prev) =>
        prev.map((m) => {
          if (m.id === memberId) {
            return { ...m, role: newRole as TeamMember["role"] };
          }
          return m;
        })
      );
    } catch {
      setError("Network error.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error ? (
        <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "12px 16px", margin: 0 }}>
          {error}
        </p>
      ) : null}

      {members.length > 0 ? (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const rc = roleColours[m.role] ?? { bg: "rgba(255,255,255,0.06)", text: "#94a3b8", border: "rgba(148,163,184,0.2)" };
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600, color: "#f1f5f9" }}>{m.name ?? "—"}</td>
                    <td style={{ color: "#64748b", fontSize: "13px" }}>{m.email ?? m.invite_email}</td>
                    <td>
                      {m.invite_status === "revoked" ? (
                        <RoleBadge role={m.role} />
                      ) : (
                        <select
                          value={m.role}
                          disabled={actionId === m.id}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            padding: "3px 8px",
                            borderRadius: "999px",
                            border: `1px solid ${rc.border}`,
                            background: rc.bg,
                            color: rc.text,
                            cursor: "pointer",
                            outline: "none",
                            opacity: actionId === m.id ? 0.6 : 1,
                          }}
                        >
                          <option value="fitter">Fitter</option>
                          <option value="estimator">Estimator</option>
                          <option value="manager">Manager</option>
                        </select>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={m.invite_status} />
                    </td>
                    <td style={{ color: "#64748b", fontSize: "13px" }}>
                      {m.accepted_at
                        ? new Date(m.accepted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td>
                      {m.invite_status !== "revoked" ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(m.id)}
                          disabled={actionId === m.id}
                          style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#f87171",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 0",
                            opacity: actionId === m.id ? 0.5 : 1,
                          }}
                        >
                          {actionId === m.id ? "Revoking…" : "Revoke"}
                        </button>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#475569" }}>Revoked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {pendingInvites.length > 0 ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#475569" }}>
              Pending invites
            </span>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
              {pendingInvites.length}
            </span>
          </div>
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: "#f1f5f9" }}>{inv.name}</td>
                    <td style={{ color: "#64748b", fontSize: "13px" }}>{inv.invite_email}</td>
                    <td>
                      <RoleBadge role={inv.role} />
                    </td>
                    <td style={{ color: "#64748b", fontSize: "13px" }}>
                      {new Date(inv.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
