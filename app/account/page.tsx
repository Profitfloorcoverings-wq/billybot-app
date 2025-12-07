"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

type ClientProfile = {
  business_name: string;
  contact_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  postcode: string;
  country: string;
  is_onboarded: boolean;
};

const EMPTY_PROFILE: ClientProfile = {
  business_name: "",
  contact_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  postcode: "",
  country: "",
  is_onboarded: false,
};

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [isSageConnected, setIsSageConnected] = useState(false);
  const [isXeroConnected, setIsXeroConnected] = useState(false);
  const [isQuickBooksConnected, setIsQuickBooksConnected] = useState(false);

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

        setUserId(userData.user.id);
        setUserEmail(userData.user.email ?? "");

        const [{ data: sage }, { data: xero }, { data: quickbooks }] =
          await Promise.all([
            supabase
              .from("sage_connections")
              .select("id")
              .eq("user_id", userData.user.id)
              .maybeSingle(),
            supabase
              .from("xero_connections")
              .select("id")
              .eq("user_id", userData.user.id)
              .maybeSingle(),
            supabase
              .from("quickbooks_connections")
              .select("id")
              .eq("user_id", userData.user.id)
              .maybeSingle(),
          ]);

        setIsSageConnected(Boolean(sage?.id));
        setIsXeroConnected(Boolean(xero?.id));
        setIsQuickBooksConnected(Boolean(quickbooks?.id));

        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select(
            "business_name, contact_name, phone, address_line1, address_line2, city, postcode, country, is_onboarded"
          )
          .eq("id", userData.user.id)
          .maybeSingle();

        if (clientError) {
          throw clientError;
        }

        if (!clientData || clientData.is_onboarded === false) {
          router.push("/account/setup");
          return;
        }

        setProfile({ ...EMPTY_PROFILE, ...clientData, is_onboarded: true });
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
  }, [router, supabase]);

  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "GET" });
    router.push("/auth/login");
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        router.push("/auth/login");
        return;
      }

      const { error: upsertError } = await supabase.from("clients").upsert({
        id: userData.user.id,
        ...profile,
        is_onboarded: true,
      });

      if (upsertError) {
        throw upsertError;
      }

      setSuccess("Profile updated successfully");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to update profile"
      );
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof ClientProfile, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  function handleConnect(service: "sage" | "xero" | "quickbooks") {
    if (!userId) return;

    const url = `https://tradiebrain.app.n8n.cloud/webhook/start-oauth?service=${service}&user_id=${userId}`;
    window.location.href = url;
  }

  async function handleManageBilling() {
    try {
      setLoadingPortal(true);

      const res = await fetch("/api/billing/manage", {
        method: "POST",
      });

      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("Unable to open billing portal.");
      }
    } catch (err) {
      console.error("Billing portal error:", err);
      alert("Error opening billing portal.");
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <div className="page-container space-y-8">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Account</h1>
          <p className="section-subtitle">Manage your profile and sign out.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 shadow-lg shadow-indigo-500/10 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Profile Information</h2>
              <p className="section-subtitle">Your account identity and onboarding status.</p>
            </div>
            <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 border border-emerald-500/30">
              {profile.is_onboarded ? "Onboarded" : "Not onboarded"}
            </div>
          </div>

          {loading ? <p className="section-subtitle">Loading account…</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? (
            <p className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
              {success}
            </p>
          ) : null}

          {!loading && !error ? (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="stack">
                <p className="section-subtitle">Email</p>
                <p className="text-lg font-semibold text-white">{userEmail || "—"}</p>
              </div>

              <div className="stack">
                <p className="section-subtitle">User ID</p>
                <p className="text-sm font-mono text-white/80 break-all">{userId}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="card p-6 shadow-lg shadow-indigo-500/10 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Business Information</h2>
              <p className="section-subtitle">Update the details used across your quotes.</p>
            </div>
            <div className="text-xs rounded-full bg-white/5 px-3 py-1 border border-white/10 text-white/70">
              Editable
            </div>
          </div>

          {!loading && !error ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white" htmlFor="business_name">
                    Business name
                  </label>
                  <input
                    id="business_name"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    value={profile.business_name}
                    onChange={(e) => updateField("business_name", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white" htmlFor="contact_name">
                    Contact name
                  </label>
                  <input
                    id="contact_name"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    value={profile.contact_name}
                    onChange={(e) => updateField("contact_name", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    value={profile.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white" htmlFor="country">
                    Country
                  </label>
                  <input
                    id="country"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    value={profile.country}
                    onChange={(e) => updateField("country", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white" htmlFor="address_line1">
                  Address line 1
                </label>
                <input
                  id="address_line1"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  value={profile.address_line1}
                  onChange={(e) => updateField("address_line1", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-white" htmlFor="address_line2">
                  Address line 2
                </label>
                <input
                  id="address_line2"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  value={profile.address_line2}
                  onChange={(e) => updateField("address_line2", e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white" htmlFor="city">
                    City
                  </label>
                  <input
                    id="city"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    value={profile.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white" htmlFor="postcode">
                    Postcode
                  </label>
                  <input
                    id="postcode"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    value={profile.postcode}
                    onChange={(e) => updateField("postcode", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="btn btn-primary px-6 py-3 text-base shadow-[0_10px_30px_-12px_rgba(99,102,241,0.7)]"
                  disabled={saving || loading}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>

      <div className="card p-6 shadow-lg shadow-indigo-500/10 border border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Linked Accounts</h2>
            <p className="section-subtitle">
              Connect your accounting software so BillyBot can create quotes directly inside your system.
            </p>
          </div>
        </div>

        <div className="grid gap-4 mt-6 md:grid-cols-3">
          {["sage", "xero", "quickbooks"].map((service) => {
            const isConnected =
              service === "sage"
                ? isSageConnected
                : service === "xero"
                ? isXeroConnected
                : isQuickBooksConnected;

            const label =
              service === "sage" ? "Sage" : service === "xero" ? "Xero" : "QuickBooks";

            return (
              <div
                key={service}
                className="card p-4 bg-gradient-to-b from-white/5 to-white/[0.02] border border-white/10 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-lg font-bold text-indigo-200">
                    {label.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-white">{label}</h3>
                    <p className={`text-sm ${isConnected ? "text-emerald-300" : "text-white/60"}`}>
                      {isConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-primary px-4 py-2 text-sm shadow-[0_10px_30px_-12px_rgba(99,102,241,0.7)]"
                  onClick={() => handleConnect(service as "sage" | "xero" | "quickbooks")}
                >
                  {isConnected ? "Reconnect" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6 shadow-lg shadow-indigo-500/10 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Subscription</h2>
              <p className="section-subtitle">Manage your billing and plan details.</p>
            </div>
            <div className="text-xs rounded-full bg-indigo-500/15 px-3 py-1 border border-indigo-500/30 text-indigo-100">
              Premium access
            </div>
          </div>

          <button
            onClick={handleManageBilling}
            disabled={loadingPortal}
            className="btn btn-primary w-full py-4 text-base shadow-[0_20px_60px_-20px_rgba(99,102,241,0.9)]"
          >
            {loadingPortal ? "Loading…" : "Manage subscription"}
          </button>
        </div>

        <div className="card p-6 shadow-lg shadow-indigo-500/10 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title">Legal</h2>
              <p className="section-subtitle">Important documents for using BillyBot.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/terms"
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white transition hover:border-indigo-400 hover:text-indigo-100 hover:underline"
            >
              <span className="font-semibold">Terms of Service</span>
              <span className="text-sm text-white/60">View</span>
            </Link>
            <Link
              href="/privacy"
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white transition hover:border-indigo-400 hover:text-indigo-100 hover:underline"
            >
              <span className="font-semibold">Privacy Policy</span>
              <span className="text-sm text-white/60">View</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
