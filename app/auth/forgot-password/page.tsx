"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const genericSuccessMessage = "If that email exists, we’ve sent a reset link.";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const sanitizedEmail = email.trim().toLowerCase();

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      setSuccessMessage(genericSuccessMessage);
    } catch {
      setError("We couldn’t send the reset email right now. Please check the email and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container min-h-screen">
      <div className="flex flex-1 items-center justify-center">
        <div className="card stack gap-6 w-full max-w-md mx-auto">
          <div className="stack gap-1">
            <h1 className="section-title">Forgot password</h1>
            <p className="section-subtitle">Enter your email and we’ll send you a reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className="stack gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input-fluid"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {error ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="text-sm text-emerald-200 bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-3">
                {successMessage}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Sending reset link…" : "Send reset link"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--muted)]">
            <Link href="/auth/login" className="text-[var(--brand1)] hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
