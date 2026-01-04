"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";

// Store session in cookies for SSR awareness (non-blocking)
function persistSession(session: Session | null) {
  if (!session) return;

  const maxAge = session.expires_at
    ? Math.max(session.expires_at - Math.floor(Date.now() / 1000), 3600)
    : 3600 * 24 * 7;

  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  const cookieSettings = `Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`;

  document.cookie = `sb-access-token=${session.access_token}; ${cookieSettings}`;

  if (session.refresh_token) {
    document.cookie = `sb-refresh-token=${session.refresh_token}; ${cookieSettings}`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      if (data.session) {
        persistSession(data.session);
        router.replace("/chat");
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        persistSession(session);
        router.replace("/chat");
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // Save session locally
      persistSession(data.session ?? null);
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
    <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="card stack gap-6">
          <div className="stack gap-1 text-center">
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
