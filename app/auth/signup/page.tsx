"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        throw signUpError;
      }

      const user = data?.user;

      if (!user) {
        throw new Error("Signup succeeded but no user was returned.");
      }

      const { error: insertError } = await supabase.from("clients").insert({
        id: user.id,
        business_name: businessName,
        email,
        phone,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        throw insertError;
      }

      if (typeof window !== "undefined" && typeof (window as Window & { fbq?: (...args: unknown[]) => void }).fbq === "function") {
        (window as Window & { fbq?: (...args: unknown[]) => void }).fbq!("track", "Lead", { currency: "GBP", value: 0 });
      }
      router.push("/post-onboard");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to sign up"
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
            <h1 className="section-title">Create your BillyBot account</h1>
            <p className="section-subtitle">Sign up to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="stack gap-4">
            <div className="field-group">
              <label className="field-label" htmlFor="business_name">
                Business name
              </label>
              <input
                id="business_name"
                className="input-fluid"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="BillyBot Builders"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="phone">
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                className="input-fluid"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07700 900123"
                required
              />
            </div>

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

            <div className="field-group">
              <label className="field-label" htmlFor="password">
                Password
              </label>
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

            {error ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {error}
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--muted)]">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[var(--brand1)] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
