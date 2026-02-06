"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Redirect user
      window.location.assign("/post-onboard");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to log in"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container min-h-screen">
      <div className="flex flex-1 items-center justify-center">
        <div className="card stack gap-6 w-full max-w-md mx-auto">
          <div className="stack gap-1">
            <h1 className="section-title">Welcome back</h1>
            <p className="section-subtitle">Log in to continue chatting</p>
          </div>

          <form onSubmit={handleSubmit} className="stack gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="email">Email</label>
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

            <div className="field-group">
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input-fluid"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--muted)]">
            Don’t have an account?{" "}
            <Link href="/auth/signup" className="text-[var(--brand1)] hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
