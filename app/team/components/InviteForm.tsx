"use client";

import { useState } from "react";

export default function InviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("fitter");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to send invite. Please try again.");
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setRole("fitter");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: "540px", padding: "28px 32px" }}>
      {success ? (
        <div style={{ fontSize: "13px", color: "#4ade80", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" }}>
          ✓ Invite sent — they&apos;ll receive an email with a link to join.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="invite-name">Full name</label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ben Smith"
              className="chat-input"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="invite-role">Role</label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="chat-input"
            >
              <option value="fitter">Fitter</option>
              <option value="estimator">Estimator</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="invite-email">Email address</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ben@example.com"
            className="chat-input"
            required
          />
        </div>

        {error ? (
          <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", borderRadius: "8px", padding: "10px 14px", margin: 0 }}>{error}</p>
        ) : null}

        <div>
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? "Sending…" : "Send invite"}
          </button>
        </div>
      </form>
    </div>
  );
}
