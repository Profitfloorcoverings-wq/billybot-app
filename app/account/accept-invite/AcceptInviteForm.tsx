"use client";

import { useState } from "react";

const IOS_APP_URL = "https://apps.apple.com/gb/app/billybot/id6758058400";

type Props = {
  inviteToken: string;
  email: string;
  name: string;
};

export default function AcceptInviteForm({ inviteToken, email, name }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_token: inviteToken, password }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !data.success) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", textAlign: "center", padding: "8px 0" }}>
        <div style={{ fontSize: "48px", lineHeight: 1 }}>🎉</div>
        <div>
          <p style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "18px", marginBottom: "6px" }}>
            You&apos;re all set, {name}!
          </p>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            Your account is ready. Download the BillyBot app to get started.
          </p>
        </div>
        <a href={IOS_APP_URL} className="btn btn-primary" style={{ width: "100%", textAlign: "center", display: "block" }}>
          Download BillyBot for iPhone
        </a>
        <a href="/chat" style={{ fontSize: "13px", color: "#64748b", textDecoration: "none" }}>
          Or continue in browser →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <div className="form-field">
        <label className="form-label" htmlFor="invite-name">Your name</label>
        <input
          id="invite-name"
          type="text"
          value={name}
          disabled
          className="chat-input"
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="invite-email">Email address</label>
        <input
          id="invite-email"
          type="email"
          value={email}
          disabled
          className="chat-input"
        />
      </div>

      <div className="form-divider" />

      <div className="form-field">
        <label className="form-label" htmlFor="invite-password">Choose a password</label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="chat-input"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="invite-confirm">Confirm password</label>
        <input
          id="invite-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          className="chat-input"
          required
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", borderRadius: "8px", padding: "10px 14px", margin: 0 }}>{error}</p>
      ) : null}

      <button type="submit" disabled={submitting} className="btn btn-primary" style={{ width: "100%" }}>
        {submitting ? "Creating account…" : "Create account & join"}
      </button>
    </form>
  );
}
