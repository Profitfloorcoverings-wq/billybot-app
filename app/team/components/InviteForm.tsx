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
    <div className="card p-6 max-w-lg">
      {success ? (
        <div className="text-sm text-green-400 bg-green-400/10 rounded-lg px-4 py-3 mb-4">
          Invite sent! They&apos;ll receive an email with a link to join.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="field-group">
            <label className="field-label" htmlFor="invite-name">
              Name
            </label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ben Smith"
              className="chat-input w-full"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="invite-role">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="chat-input w-full"
            >
              <option value="fitter">Fitter</option>
              <option value="estimator">Estimator</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="invite-email">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ben@example.com"
            className="chat-input w-full"
            required
          />
        </div>

        {error ? (
          <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
        ) : null}

        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? "Sending…" : "Send invite"}
        </button>
      </form>
    </div>
  );
}
