"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type ClientFlags = {
  is_verified_accuracy_warning?: boolean;
  is_onboarded?: boolean;
};

export default function VerificationWarningPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStatus() {
      setLoading(true);
      setError(null);
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          router.replace("/auth/login");
          return;
        }

        const { data: flags, error: profileError } = await supabase
          .from("clients")
          .select("is_verified_accuracy_warning, is_onboarded")
          .eq("id", userData.user.id)
          .maybeSingle<ClientFlags>();

        if (profileError) {
          throw profileError;
        }

        if (!flags?.is_onboarded) {
          router.replace("/account/setup");
          return;
        }

        if (flags.is_verified_accuracy_warning) {
          router.replace("/chat");
        }
      } catch (err) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load verification status"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadStatus();
  }, [router, supabase]);

  const acknowledgeWarning = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        router.replace("/auth/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("clients")
        .update({ is_verified_accuracy_warning: true })
        .eq("id", userData.user.id);

      if (updateError) {
        throw updateError;
      }

      router.replace("/chat");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save confirmation"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="card stack gap-4">
        <h1 className="section-title">Accuracy warning</h1>
        <p className="section-subtitle">
          BillyBot automates quoting, calculations and messaging using AI.
        </p>
        <p className="section-subtitle">
          You must check every quote for accuracy. BillyBot is not liable for incorrect pricing
          or job data.
        </p>
        <p className="section-subtitle">
          Confirm you understand to continue.
        </p>

        {error ? (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            className="btn btn-primary"
            onClick={() => void acknowledgeWarning()}
            disabled={loading || saving}
          >
            {saving ? "Saving…" : "I Understand"}
          </button>
          {loading ? <p className="text-sm text-[var(--muted)]">Checking status…</p> : null}
        </div>
      </div>
    </div>
  );
}
