"use client";

import { useState } from "react";

import type { TeamInvite, TeamMember } from "@/types/team";

type Props = {
  members: TeamMember[];
  pendingInvites: TeamInvite[];
};

const roleBadge: Record<string, string> = {
  manager: "bg-blue-500/20 text-blue-300",
  fitter: "bg-cyan-500/20 text-cyan-300",
  estimator: "bg-purple-500/20 text-purple-300",
};

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
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
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
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium">{m.name ?? "—"}</td>
                  <td className="text-[var(--muted)] text-sm">{m.email ?? m.invite_email}</td>
                  <td>
                    <select
                      value={m.role}
                      disabled={actionId === m.id || m.invite_status === "revoked"}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-md border-0 bg-transparent ${roleBadge[m.role] ?? ""}`}
                    >
                      <option value="fitter">Fitter</option>
                      <option value="estimator">Estimator</option>
                      <option value="manager">Manager</option>
                    </select>
                  </td>
                  <td>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                        m.invite_status === "accepted"
                          ? "bg-green-500/20 text-green-300"
                          : m.invite_status === "revoked"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {m.invite_status}
                    </span>
                  </td>
                  <td className="text-[var(--muted)] text-sm">
                    {m.accepted_at
                      ? new Date(m.accepted_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    {m.invite_status !== "revoked" ? (
                      <button
                        type="button"
                        onClick={() => handleRevoke(m.id)}
                        disabled={actionId === m.id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {actionId === m.id ? "…" : "Revoke"}
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">Revoked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pendingInvites.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--muted)] mb-2 uppercase tracking-wider">
            Pending invites
          </h3>
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
                    <td className="font-medium">{inv.name}</td>
                    <td className="text-[var(--muted)] text-sm">{inv.invite_email}</td>
                    <td>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${roleBadge[inv.role] ?? ""}`}>
                        {inv.role}
                      </span>
                    </td>
                    <td className="text-[var(--muted)] text-sm">
                      {new Date(inv.expires_at).toLocaleDateString()}
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
