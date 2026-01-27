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

type EmailAccountStatus = "connected" | "needs_reauth" | "error" | "disconnected";

type EmailAccount = {
  id: string;
  provider: "google" | "microsoft";
  email_address: string | null;
  status: EmailAccountStatus | null;
  last_error: string | null;
  gmail_history_id: string | null;
  ms_subscription_id: string | null;
  ms_subscription_expires_at: string | null;
  created_at: string;
  updated_at: string;
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

function isBusinessProfileComplete(profile: ClientProfile | null) {
  if (!profile) return false;
  return Boolean(
    profile.is_onboarded ||
      (profile.business_name &&
        profile.contact_name &&
        profile.phone &&
        profile.address_line1 &&
        profile.city &&
        profile.postcode &&
        profile.country)
  );
}

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
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(true);
  const [emailAccountsError, setEmailAccountsError] = useState<string | null>(null);
  const [emailActionTarget, setEmailActionTarget] = useState<string | null>(null);

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

        if (!clientData || !isBusinessProfileComplete(clientData)) {
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

  async function loadEmailAccounts() {
    setEmailAccountsLoading(true);
    setEmailAccountsError(null);

    try {
      const res = await fetch("/api/email/accounts");
      if (!res.ok) {
        throw new Error("Unable to load email accounts");
      }
      const data = (await res.json()) as { data?: EmailAccount[] };
      setEmailAccounts(data?.data ?? []);
    } catch (err) {
      setEmailAccountsError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to load email accounts"
      );
    } finally {
      setEmailAccountsLoading(false);
    }
  }

  useEffect(() => {
    void loadEmailAccounts();
  }, []);

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

      const { error: upsertError } = await supabase
        .from("clients")
        .update({
          ...profile,
        })
        .eq("id", userData.user.id);

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

  function handleEmailConnect(provider: "google" | "microsoft") {
    const url =
      provider === "google"
        ? "/api/email/google/connect"
        : "/api/email/microsoft/connect";
    window.location.href = url;
  }

  async function handleEmailDisconnect(provider: "google" | "microsoft", accountId?: string) {
    setEmailActionTarget(accountId ?? provider);
    try {
      const res = await fetch("/api/email/accounts/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, account_id: accountId }),
      });

      if (!res.ok) {
        throw new Error("Unable to disconnect email account");
      }

      await loadEmailAccounts();
    } catch (err) {
      setEmailAccountsError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to disconnect email account"
      );
    } finally {
      setEmailActionTarget(null);
    }
  }

  function getStatusConfig(status?: EmailAccountStatus | null) {
    switch (status) {
      case "connected":
        return { label: "Connected", className: "bg-emerald-500/15 text-emerald-200" };
      case "needs_reauth":
        return { label: "Needs reauth", className: "bg-amber-500/15 text-amber-200" };
      case "error":
        return { label: "Error", className: "bg-red-500/15 text-red-200" };
      case "disconnected":
      default:
        return { label: "Not connected", className: "bg-white/5 text-white/70" };
    }
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

  const googleAccount = emailAccounts.find((account) => account.provider === "google") ?? null;
  const microsoftAccount =
    emailAccounts.find((account) => account.provider === "microsoft") ?? null;
  const googleAccounts = emailAccounts.filter((account) => account.provider === "google");
  const microsoftAccounts = emailAccounts.filter((account) => account.provider === "microsoft");

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
          <h2 className="section-title">Email Accounts</h2>
          <p className="section-subtitle">
            Connect your email so BillyBot can read inbound enquiries.
          </p>
          <p className="text-sm text-white/70">
            You can connect more than one inbox. BillyBot will read enquiries from all connected
            accounts.
          </p>
        </div>

        {emailAccountsLoading ? <p className="section-subtitle">Loading email accounts…</p> : null}
        {emailAccountsError ? <p className="text-sm text-red-400">{emailAccountsError}</p> : null}

        <div className="stack gap-3">
          {[
            { key: "google" as const, label: "Gmail", account: googleAccount, accounts: googleAccounts },
            {
              key: "microsoft" as const,
              label: "Outlook",
              account: microsoftAccount,
              accounts: microsoftAccounts,
            },
          ].map(({ key, label, accounts }) => {
            const connectedAccounts = accounts.filter((item) => item.status === "connected");
            const connectedCount = connectedAccounts.length;
            const providerStatus =
              connectedCount > 0
                ? "connected"
                : accounts.some((item) => item.status === "needs_reauth")
                ? "needs_reauth"
                : accounts.some((item) => item.status === "error")
                ? "error"
                : "disconnected";
            const statusConfig =
              accounts.length > 0 ? getStatusConfig(providerStatus) : getStatusConfig("disconnected");
            const isActionLoading = emailActionTarget === key || emailAccountsLoading;
            const hasAccounts = accounts.length > 0;
            const shouldReconnect = hasAccounts && providerStatus !== "connected";
            const shouldDisconnect = hasAccounts;
            const displayEmail =
              connectedCount > 1
                ? `Multiple connected (${connectedCount})`
                : connectedAccounts[0]?.email_address ?? null;
            const errorMessage =
              accounts.find((item) => item.status === "error")?.last_error ??
              accounts.find((item) => item.status === "needs_reauth")?.last_error ??
              null;

            return (
              <div key={key} className="linked-account-badge">
                <div className="linked-account-badge-left">
                  <div className="linked-account-badge-text">
                    <p className="linked-account-badge-title">{label}</p>
                    <div className="stack gap-1">
                      <div className={`tag ${statusConfig.className}`} aria-live="polite">
                        {statusConfig.label}
                      </div>
                      {displayEmail && providerStatus === "connected" ? (
                        <p className="text-sm text-white/80">{displayEmail}</p>
                      ) : null}
                      {providerStatus !== "connected" && errorMessage ? (
                        <p className="text-xs text-white/60">{errorMessage.slice(0, 140)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!hasAccounts ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleEmailConnect(key)}
                      disabled={isActionLoading}
                    >
                      {isActionLoading
                        ? "Working..."
                        : key === "google"
                        ? "Connect Gmail"
                        : "Connect Outlook"}
                    </button>
                  ) : null}
                  {shouldReconnect ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleEmailConnect(key)}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? "Working..." : "Reconnect"}
                    </button>
                  ) : null}
                  {shouldDisconnect ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        handleEmailDisconnect(key, connectedAccounts[0]?.id ?? accounts[0]?.id)
                      }
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? "Working..." : "Disconnect"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Subscription</h2>
          <p className="section-subtitle">Manage your billing and plan details.</p>
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
