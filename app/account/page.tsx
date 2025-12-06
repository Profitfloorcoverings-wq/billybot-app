"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type ClientProfile = {
  business_name?: string | null;
  email?: string | null;
};

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setError(null);
      setLoading(true);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error(userError?.message || "No user found");
        }

        setUserEmail(userData.user.email ?? "");

        const { data, error: clientError } = await supabase
          .from("clients")
          .select("business_name, email")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (clientError) {
          throw clientError;
        }

        setProfile(data ?? null);
      } catch (err) {
        setError(
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load account"
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [supabase]);

  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "GET" });
    router.push("/auth/login");
  };

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Account</h1>
          <p className="section-subtitle">Manage your profile and sign out.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="card stack">
        {loading ? <p className="section-subtitle">Loading account…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {!loading && !error ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="stack">
              <p className="section-subtitle">Email</p>
              <p className="text-lg font-semibold text-white">{userEmail || "—"}</p>
            </div>
            <div className="stack">
              <p className="section-subtitle">Business name</p>
              <p className="text-lg font-semibold text-white">
                {profile?.business_name || "Not set"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
