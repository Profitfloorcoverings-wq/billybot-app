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
  const [accountingSystem, setAccountingSystem] = useState<string | null>(null);
  const [accountingStatusLoaded, setAccountingStatusLoaded] = useState(false);

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

        const { data: accountingData, error: accountingError } = await supabase
          .from("clients")
          .select("accounting_system")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (accountingError) {
          throw accountingError;
        }

        setAccountingSystem(accountingData?.accounting_system ?? null);

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
        setAccountingStatusLoaded(true);
      }
    }

    void loadProfile();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

  const isSageConnected = accountingSystem === "sage";
  const isXeroConnected = accountingSystem === "xero";
  const isQuickBooksConnected = accountingSystem === "quickbooks";
  const providerConfigs: {
    key: "sage" | "xero" | "quickbooks";
    label: string;
    connected: boolean;
  }[] = [
    { key: "sage", label: "Sage", connected: isSageConnected },
    { key: "xero", label: "Xero", connected: isXeroConnected },
    { key: "quickbooks", label: "QuickBooks", connected: isQuickBooksConnected },
  ];

  return (
    <div className="page-container stack gap-6">
      <div className="section-header">
        <div className="stack gap-1">
          <h1 className="section-title">Account</h1>
          <p className="section-subtitle">Manage your profile and sign out.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Profile Information</h2>
          <p className="section-subtitle">Your account identity and onboarding status.</p>
        </div>

        <div className="inline-flex items-center rounded-full px-3 py-1 text-xs bg-white/10 text-white/80 w-fit">
          {profile.is_onboarded ? "Onboarded" : "Not onboarded"}
        </div>

        {loading ? <p className="section-subtitle">Loading account…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

        {!loading && !error ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="stack gap-1">
              <p className="section-subtitle">Email</p>
              <p className="text-base font-semibold">{userEmail || "—"}</p>
            </div>
            <div className="stack gap-1">
              <p className="section-subtitle">User ID</p>
              <p className="text-sm font-mono break-all">{userId}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Business Information</h2>
          <p className="section-subtitle">Update the details used across your quotes.</p>
        </div>

        {!loading && !error ? (
          <form onSubmit={handleSubmit} className="stack gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <label className="field-label" htmlFor="business_name">
                  Business name
                </label>
                <input
                  id="business_name"
                  className="input-fluid"
                  value={profile.business_name}
                  onChange={(e) => updateField("business_name", e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="contact_name">
                  Contact name
                </label>
                <input
                  id="contact_name"
                  className="input-fluid"
                  value={profile.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <label className="field-label" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  className="input-fluid"
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="country">
                  Country
                </label>
                <input
                  id="country"
                  className="input-fluid"
                  value={profile.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="address_line1">
                Address line 1
              </label>
              <input
                id="address_line1"
                className="input-fluid"
                value={profile.address_line1}
                onChange={(e) => updateField("address_line1", e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="address_line2">
                Address line 2
              </label>
              <input
                id="address_line2"
                className="input-fluid"
                value={profile.address_line2}
                onChange={(e) => updateField("address_line2", e.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <label className="field-label" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  className="input-fluid"
                  value={profile.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  required
                />
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="postcode">
                  Postcode
                </label>
                <input
                  id="postcode"
                  className="input-fluid"
                  value={profile.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Linked Accounts</h2>
          <p className="section-subtitle">
            Connect your accounting software so BillyBot can create quotes inside your system.
          </p>
        </div>

        <div className="stack gap-3">
          {providerConfigs.map((provider) => (
            <div key={provider.key} className="linked-account-badge">
              <div className="linked-account-badge-left">
                <div className="linked-account-badge-text">
                  <p className="linked-account-badge-title">{provider.label}</p>
                  <p className="linked-account-badge-sub">
                    {!accountingStatusLoaded
                      ? "Loading..."
                      : provider.connected
                      ? "Connected"
                      : "Not connected"}
                  </p>
                </div>
              </div>

              <button
                className="btn btn-primary"
                disabled={!accountingStatusLoaded || provider.connected}
                onClick={() => handleConnect(provider.key)}
              >
                {!accountingStatusLoaded
                  ? "Loading..."
                  : provider.connected
                  ? "Connected"
                  : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Subscription</h2>
          <p className="section-subtitle">Manage your billing and plan details.</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex items-center rounded-full px-3 py-1 text-xs bg-white/10 text-white/80">
            Premium access
          </div>
        </div>

        <button onClick={handleManageBilling} disabled={loadingPortal} className="btn btn-primary w-full">
          {loadingPortal ? "Loading…" : "Manage subscription"}
        </button>
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Legal</h2>
          <p className="section-subtitle">Important documents for using BillyBot.</p>
        </div>

        <div className="stack gap-3">
          <Link href="/legal/terms" className="flex items-center justify-between">
            <span className="font-semibold">Terms of Service</span>
            <span className="section-subtitle">View</span>
          </Link>
          <Link href="/legal/privacy" className="flex items-center justify-between">
            <span className="font-semibold">Privacy Policy</span>
            <span className="section-subtitle">View</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
