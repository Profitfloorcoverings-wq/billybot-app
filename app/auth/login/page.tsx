"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { loginAction } from "./actions";

type LoginState = {
  error: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Logging in…" : "Log in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, {
    error: null,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-xl">
        <div className="card stack gap-6">
          <div className="stack gap-1 text-center">
            <h1 className="section-title">Welcome back</h1>
            <p className="section-subtitle">Log in to continue chatting</p>
          </div>

          <form action={formAction} className="stack gap-4">
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

            {state.error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {state.error}
              </div>
            )}

            <SubmitButton />
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
