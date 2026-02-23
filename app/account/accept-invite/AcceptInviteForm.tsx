"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Props = {
  inviteToken: string;
  email: string;
  name: string;
};

export default function AcceptInviteForm({ inviteToken, email, name }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      // Auto sign-in so they don't have to log in manually
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        // Account was created — just send them to login as fallback
        router.push("/auth/login");
        return;
      }

      router.push("/chat");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="field-group">
        <label className="field-label" htmlFor="invite-name">
          Name
        </label>
        <input
          id="invite-name"
          type="text"
          value={name}
          disabled
          className="chat-input w-full opacity-60 cursor-not-allowed"
        />
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="invite-email">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          disabled
          className="chat-input w-full opacity-60 cursor-not-allowed"
        />
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="invite-password">
          Password
        </label>
        <input
          id="invite-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="chat-input w-full"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="invite-confirm">
          Confirm password
        </label>
        <input
          id="invite-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat your password"
          className="chat-input w-full"
          required
          autoComplete="new-password"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full"
      >
        {submitting ? "Creating account…" : "Create account & join"}
      </button>
    </form>
  );
}
