"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

export default function AcceptTermsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();

        if (userError || !userData?.user) {
          router.push("/auth/login");
          return;
        }

        const { data: clientProfile, error: clientError } = await supabase
          .from("clients")
          .select("is_onboarded, terms_accepted")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (clientError) {
          throw clientError;
        }

        if (!clientProfile?.is_onboarded) {
          router.push("/account/setup");
          return;
        }

        if (clientProfile?.terms_accepted) {
          router.push("/chat");
          return;
        }
      } catch (err) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load your account"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!accepted) {
      setError("You must accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        router.push("/auth/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: "1.0",
        })
        .eq("id", userData.user.id);

      if (updateError) {
        throw updateError;
      }

      router.push("/chat");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save your acceptance"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg1)] text-[var(--text)] px-4 py-12 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="card stack gap-6">
          <div className="stack gap-1">
            <h1 className="section-title">Accept our terms</h1>
            <p className="section-subtitle">
              Please review and accept our Terms of Service and Privacy Policy to continue.
            </p>
          </div>

          {error ? (
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="stack gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                disabled={loading || saving}
              />
              <span className="text-sm text-[var(--text-secondary)]">
                I have read and agree to the
                {" "}
                <Link href="/legal/terms" className="text-[var(--primary)] underline">
                  Terms of Service
                </Link>
                {" "}and{" "}
                <Link href="/legal/privacy" className="text-[var(--primary)] underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || saving}
            >
              {saving ? "Saving..." : "Accept and continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
