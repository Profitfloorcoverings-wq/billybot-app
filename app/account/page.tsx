"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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
type EmailConnectionStatus =
  | "ok"
  | "needs_reconnect"
  | "watch_expired"
  | "subscription_expired"
  | "refresh_failed"
  | "provider_revoked"
  | "inactive";

type EmailAccount = {
  id: string;
  provider: "google" | "microsoft";
  email_address: string | null;
  status: EmailAccountStatus | null;
  last_error: string | null;
  gmail_history_id: string | null;
  ms_subscription_id: string | null;
  ms_subscription_expires_at: string | null;
  gmail_watch_expires_at?: string | null;
  gmail_last_push_at?: string | null;
  ms_last_push_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  email_connection_status?: EmailConnectionStatus | null;
  created_at: string;
  updated_at: string;
};

type BillingCycle = "monthly" | "annual";
type PlanKey = "starter" | "pro" | "team";

type PlanConfig = {
  key: PlanKey;
  name: string;
  monthlyLabel: string;
  annualLabel: string;
  bullets: string[];
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

const SUBSCRIBER_STATUSES = new Set(["active", "trialing", "past_due"]);

const PRICE_MAP: Record<PlanKey, { monthly: string; annual: string }> = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY ?? "",
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL ?? "",
  },
  pro: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? "",
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL ?? "",
  },
  team: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY ?? "",
    annual: process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_ANNUAL ?? "",
  },
};

const MISSING_PRICE_LABELS: Record<PlanKey, { monthly: string; annual: string }> = {
  starter: {
    monthly: "NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY",
    annual: "NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL",
  },
  pro: {
    monthly: "NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY",
    annual: "NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL",
  },
  team: {
    monthly: "NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY",
    annual: "NEXT_PUBLIC_STRIPE_PRICE_TEAM_ANNUAL",
  },
};

const PLAN_CONFIGS: PlanConfig[] = [
  {
    key: "starter",
    name: "Starter",
    monthlyLabel: "£79/mo",
    annualLabel: "£790/yr",
    bullets: ["1 user", "Up to 20 quotes / month"],
  },
  {
    key: "pro",
    name: "Pro",
    monthlyLabel: "£149/mo",
    annualLabel: "£1490/yr",
    bullets: ["2 users", "20–50 quotes / month", "Send quotes to customers"],
  },
  {
    key: "team",
    name: "Team",
    monthlyLabel: "£249/mo",
    annualLabel: "£2490/yr",
    bullets: [
      "Up to 5 users",
      "Unlimited quotes / month",
      "Send quotes to customers",
      "Early access to new features",
      "Built for teams & growing businesses",
    ],
  },
];

const PLAN_LABELS: Record<PlanKey, string> = {
  starter: "Starter",
  pro: "Pro",
  team: "Team",
};

const BILLING_LABELS: Record<BillingCycle, string> = {
  monthly: "Monthly",
  annual: "Annual",
};

type StatusBadge = {
  label: string;
  bg: string;
  text: string;
  border: string;
};

function getPlanLabel(tier?: string | null) {
  const normalized = (tier ?? "").toLowerCase();
  if (normalized in PLAN_LABELS) return PLAN_LABELS[normalized as PlanKey];
  return "—";
}

function getBillingLabel(billing?: string | null) {
  const normalized = (billing ?? "").toLowerCase();
  if (normalized === "month") return BILLING_LABELS.monthly;
  if (normalized === "year") return BILLING_LABELS.annual;
  if (normalized in BILLING_LABELS) return BILLING_LABELS[normalized as BillingCycle];
  return "—";
}

function getStripeStatusBadge(status?: string | null): StatusBadge {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return { label: "Active", bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" };
    case "trialing":
      return { label: "Trialing", bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" };
    case "past_due":
      return { label: "Past due", bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" };
    case "canceled":
      return { label: "Canceled", bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" };
    default:
      return { label: "Not subscribed", bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.08)" };
  }
}

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

function getConnectionStatusLabel(status?: EmailConnectionStatus | null): StatusBadge {
  switch (status) {
    case "ok":
      return { label: "Connected", bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" };
    case "watch_expired":
      return { label: "Watch expired", bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" };
    case "subscription_expired":
      return { label: "Subscription expired", bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" };
    case "refresh_failed":
      return { label: "Token refresh failed", bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" };
    case "provider_revoked":
    case "needs_reconnect":
      return { label: "Reconnect required", bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" };
    default:
      return { label: "Not connected", bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.08)" };
  }
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [userEmail, setUserEmail] = useState<string>("");
  const [authProvider, setAuthProvider] = useState<string | null>(null);
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
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);
  const [stripePlanTier, setStripePlanTier] = useState<string | null>(null);
  const [stripePlanBilling, setStripePlanBilling] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);
  const [stripePriceId, setStripePriceId] = useState<string | null>(null);
  const [stripeId, setStripeId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [billingActionTarget, setBillingActionTarget] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingSuccess, setBillingSuccess] = useState<string | null>(null);
  const [showPlanOptions, setShowPlanOptions] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        router.push("/auth/login");
        return;
      }

      const providerFromMetadata =
        userData.user.app_metadata && typeof userData.user.app_metadata.provider === "string"
          ? userData.user.app_metadata.provider
          : null;
      const providerFromIdentity =
        userData.user.identities && userData.user.identities.length > 0
          ? userData.user.identities[0]?.provider ?? null
          : null;

      setUserId(userData.user.id);
      setUserEmail(userData.user.email ?? "");
      setAuthProvider(providerFromMetadata ?? providerFromIdentity);

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select(
          "accounting_system, stripe_status, stripe_plan_tier, stripe_plan_billing, stripe_subscription_id, stripe_price_id, stripe_id, business_name, contact_name, phone, address_line1, address_line2, city, postcode, country, is_onboarded"
        )
        .eq("id", userData.user.id)
        .maybeSingle();

      if (clientError) throw clientError;

      setAccountingSystem(clientData?.accounting_system ?? null);
      setStripeStatus(clientData?.stripe_status ?? null);
      setStripePlanTier(clientData?.stripe_plan_tier ?? null);
      setStripePlanBilling(clientData?.stripe_plan_billing ?? null);
      setStripeSubscriptionId(clientData?.stripe_subscription_id ?? null);
      setStripePriceId(clientData?.stripe_price_id ?? null);
      setStripeId(clientData?.stripe_id ?? null);

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
  }, [router, supabase]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const billingResult = url.searchParams.get("billing");
    if (billingResult === "success") {
      void loadProfile();
      setBillingSuccess("Subscription updated successfully.");
      setBillingError(null);
      url.searchParams.delete("billing");
      router.replace(url.pathname);
    }
  }, [loadProfile, router]);

  async function loadEmailAccounts() {
    setEmailAccountsLoading(true);
    setEmailAccountsError(null);

    try {
      const res = await fetch("/api/email/accounts");
      if (!res.ok) throw new Error("Unable to load email accounts");
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
        .update({ ...profile })
        .eq("id", userData.user.id);

      if (upsertError) throw upsertError;

      setSuccess("Profile updated successfully.");
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
    const url = provider === "google" ? "/api/email/google/connect" : "/api/email/microsoft/connect";
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

      if (!res.ok) throw new Error("Unable to disconnect email account");

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

  async function handleManageBilling() {
    try {
      setLoadingPortal(true);
      setBillingError(null);

      const res = await fetch("/api/billing/manage", { method: "POST" });

      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        needs_plan?: boolean;
        error?: string;
      };

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (res.status === 400 && data.needs_plan) {
        setStripeStatus("none");
        setBillingError("Choose a plan to start your subscription.");
        return;
      }

      if (!res.ok || !data.url) throw new Error(data.error || "Unable to open billing portal.");

      window.location.href = data.url;
    } catch (err) {
      setBillingError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Error opening billing portal."
      );
    } finally {
      setLoadingPortal(false);
    }
  }

  function getCyclePriceIds(plan: PlanConfig) {
    return PRICE_MAP[plan.key];
  }

  async function handleStartSubscription(plan: PlanConfig) {
    const selectedCyclePriceIds = getCyclePriceIds(plan);
    const priceId = billingCycle === "monthly" ? selectedCyclePriceIds.monthly : selectedCyclePriceIds.annual;

    if (!priceId) {
      setBillingError("This plan is not available right now. Please contact support.");
      return;
    }

    const actionKey = `${plan.key}-${billingCycle}`;
    setBillingActionTarget(actionKey);
    setBillingError(null);

    try {
      const res = await fetch("/api/billing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price_id: priceId }),
      });

      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (res.status === 401) {
        router.push("/auth/login");
        return;
      }

      if (!res.ok || !data?.url) throw new Error(data?.error || "Unable to start checkout.");

      if (!/^https?:\/\//i.test(data.url)) {
        setBillingError("Invalid checkout URL received. Please try again.");
        return;
      }

      window.location.assign(data.url);
    } catch (err) {
      setBillingError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to start checkout."
      );
    } finally {
      setBillingActionTarget(null);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const isEmailProvider = authProvider === "email";

    if (isEmailProvider && !userEmail) {
      setPasswordError("Can't load your email — refresh and try again.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordSaving(true);

    try {
      if (isEmailProvider && currentPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });

        if (reauthError) throw new Error("Current password is incorrect.");
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) throw updateError;

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to update password."
      );
      setCurrentPassword("");
    } finally {
      setPasswordSaving(false);
    }
  }

  const isSageConnected = accountingSystem === "sage";
  const isXeroConnected = accountingSystem === "xero";
  const isQuickBooksConnected = accountingSystem === "quickbooks";
  const providerConfigs: { key: "sage" | "xero" | "quickbooks"; label: string; connected: boolean }[] = [
    { key: "sage", label: "Sage", connected: isSageConnected },
    { key: "xero", label: "Xero", connected: isXeroConnected },
    { key: "quickbooks", label: "QuickBooks", connected: isQuickBooksConnected },
  ];

  const googleAccount = emailAccounts.find((a) => a.provider === "google") ?? null;
  const microsoftAccount = emailAccounts.find((a) => a.provider === "microsoft") ?? null;
  const isConnected = (account: EmailAccount | null) => !!account && account.status === "connected";

  const normalizedStripeStatus = (stripeStatus ?? "").toLowerCase();
  const isSubscriber = SUBSCRIBER_STATUSES.has(normalizedStripeStatus);
  const normalizedPlanTier = (stripePlanTier ?? "").toLowerCase();
  const normalizedPlanBilling = (stripePlanBilling ?? "").toLowerCase();
  const planLabel = getPlanLabel(normalizedPlanTier);
  const billingLabel = getBillingLabel(normalizedPlanBilling);
  const statusBadge = getStripeStatusBadge(normalizedStripeStatus);

  const missingPriceIds = PLAN_CONFIGS.flatMap((plan) => {
    const ids = getCyclePriceIds(plan);
    const missing: string[] = [];
    if (!ids.monthly) missing.push(MISSING_PRICE_LABELS[plan.key].monthly);
    if (!ids.annual) missing.push(MISSING_PRICE_LABELS[plan.key].annual);
    return missing;
  });

  return (
    <div className="page-container">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Account</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Manage your profile, billing, and integrations.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {/* ── Identity card ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Your account</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Login identity and account status.</p>
        </div>

        {loading && <p style={{ fontSize: "14px", color: "#64748b" }}>Loading account…</p>}

        {error && (
          <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
            {error}
          </p>
        )}

        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "4px 10px",
                borderRadius: "999px", fontSize: "11px", fontWeight: 700, letterSpacing: "0.04em",
                background: profile.is_onboarded ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.05)",
                color: profile.is_onboarded ? "#34d399" : "rgba(255,255,255,0.5)",
                border: `1px solid ${profile.is_onboarded ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)"}`,
              }}>
                {profile.is_onboarded ? "Onboarded" : "Not onboarded"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>Email</p>
                <p style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>{userEmail || "—"}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>User ID</p>
                <p style={{ fontSize: "12px", fontFamily: "ui-monospace, 'SF Mono', monospace", color: "#94a3b8", wordBreak: "break-all", margin: 0 }}>{userId}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Business Information ─────────────────────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Business Information</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Update the details used across your quotes.</p>
        </div>

        {!loading && !error ? (
          <form onSubmit={handleSubmit} className="form-stack">
            {success && (
              <p style={{ fontSize: "13px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
                {success}
              </p>
            )}

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="business_name">Business name</label>
                <input
                  id="business_name"
                  className="chat-input"
                  value={profile.business_name}
                  onChange={(e) => updateField("business_name", e.target.value)}
                  required
                  disabled={saving || loading}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="contact_name">Contact name</label>
                <input
                  id="contact_name"
                  className="chat-input"
                  value={profile.contact_name}
                  onChange={(e) => updateField("contact_name", e.target.value)}
                  required
                  disabled={saving || loading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  className="chat-input"
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  required
                  disabled={saving || loading}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="country">Country</label>
                <input
                  id="country"
                  className="chat-input"
                  value={profile.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  required
                  disabled={saving || loading}
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="address_line1">Address line 1</label>
              <input
                id="address_line1"
                className="chat-input"
                value={profile.address_line1}
                onChange={(e) => updateField("address_line1", e.target.value)}
                required
                disabled={saving || loading}
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="address_line2">Address line 2</label>
              <input
                id="address_line2"
                className="chat-input"
                value={profile.address_line2 ?? ""}
                onChange={(e) => updateField("address_line2", e.target.value)}
                disabled={saving || loading}
              />
            </div>

            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="city">City</label>
                <input
                  id="city"
                  className="chat-input"
                  value={profile.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  required
                  disabled={saving || loading}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="postcode">Postcode</label>
                <input
                  id="postcode"
                  className="chat-input"
                  value={profile.postcode}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  required
                  disabled={saving || loading}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {/* ── Integrations ────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Integrations</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            Connect your accounting software and email inbox.
          </p>
        </div>

        {/* Accounting */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>
            Accounting
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {providerConfigs.map((provider) => (
              <div key={provider.key} className="linked-account-badge">
                <div className="linked-account-badge-left">
                  <div className="linked-account-badge-text">
                    <p className="linked-account-badge-title">{provider.label}</p>
                    <p className="linked-account-badge-sub">
                      {!accountingStatusLoaded ? "Loading…" : provider.connected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!accountingStatusLoaded || provider.connected}
                  onClick={() => handleConnect(provider.key)}
                >
                  {!accountingStatusLoaded ? "Loading…" : provider.connected ? "Connected" : "Connect"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: "1px", background: "rgba(148,163,184,0.1)", marginBottom: "24px" }} />

        {/* Email */}
        <div>
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>
            Email
          </p>

          {emailAccountsLoading && (
            <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>Loading email accounts…</p>
          )}
          {emailAccountsError && (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
              {emailAccountsError}
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { key: "google" as const, label: "Gmail", account: googleAccount },
              { key: "microsoft" as const, label: "Outlook", account: microsoftAccount },
            ].map(({ key, label, account }) => {
              const connected = isConnected(account);
              const emailStatusBadge = getConnectionStatusLabel(account?.email_connection_status);
              const isActionLoading = emailActionTarget === key || emailAccountsLoading;
              const needsReconnect =
                account?.email_connection_status === "needs_reconnect" ||
                account?.email_connection_status === "refresh_failed" ||
                account?.email_connection_status === "provider_revoked" ||
                account?.email_connection_status === "watch_expired" ||
                account?.email_connection_status === "subscription_expired";

              return (
                <div key={key} className="linked-account-badge">
                  <div className="linked-account-badge-left">
                    <div className="linked-account-badge-text">
                      <p className="linked-account-badge-title">{label}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                        <span
                          aria-live="polite"
                          style={{
                            display: "inline-flex", alignItems: "center", padding: "3px 8px",
                            borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                            background: emailStatusBadge.bg, color: emailStatusBadge.text,
                            border: `1px solid ${emailStatusBadge.border}`,
                          }}
                        >
                          {emailStatusBadge.label}
                        </span>
                        {connected && account?.email_address && (
                          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                            {account.email_address}
                          </p>
                        )}
                        {!connected && account?.last_error && (
                          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                            {account.last_error.slice(0, 140)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {(!connected || needsReconnect) && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEmailConnect(key)}
                        disabled={isActionLoading}
                      >
                        {isActionLoading
                          ? "Working…"
                          : key === "google"
                          ? connected ? "Reconnect Gmail" : "Connect Gmail"
                          : connected ? "Reconnect Outlook" : "Connect Outlook"}
                      </button>
                    )}
                    {connected && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleEmailDisconnect(key, account?.id)}
                        disabled={isActionLoading}
                      >
                        {isActionLoading ? "Working…" : "Disconnect"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Plan & Billing ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Plan &amp; Billing</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Choose a plan or manage your subscription.</p>
        </div>

        {billingSuccess && (
          <p style={{ fontSize: "13px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" }}>
            {billingSuccess}
          </p>
        )}

        {isSubscriber && !showPlanOptions ? (
          <div className="subscription-summary" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "4px 10px",
                borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                background: statusBadge.bg, color: statusBadge.text, border: `1px solid ${statusBadge.border}`,
              }}>
                {statusBadge.label}
              </span>
              <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                {planLabel} · {billingLabel}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={handleManageBilling} disabled={loadingPortal} className="btn btn-primary">
                {loadingPortal ? "Loading…" : "Manage subscription"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowPlanOptions(true)} disabled={loadingPortal}>
                Change plan
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", padding: "4px 10px",
                borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                background: statusBadge.bg, color: statusBadge.text, border: `1px solid ${statusBadge.border}`,
              }}>
                {statusBadge.label}
              </span>
              {isSubscriber && (
                <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                  Current plan: {planLabel} ({billingLabel})
                </span>
              )}
            </div>

            <div className="billing-toggle" role="group" aria-label="Billing cycle">
              <button
                className={`billing-toggle-btn ${billingCycle === "monthly" ? "is-active" : ""}`}
                onClick={() => setBillingCycle("monthly")}
                disabled={!!billingActionTarget}
                type="button"
              >
                Monthly
              </button>
              <button
                className={`billing-toggle-btn ${billingCycle === "annual" ? "is-active" : ""}`}
                onClick={() => setBillingCycle("annual")}
                disabled={!!billingActionTarget}
                type="button"
              >
                <span>Annual</span>
                <span className="billing-toggle-badge">Save 2 months</span>
              </button>
            </div>

            <div className="pricing-grid">
              {PLAN_CONFIGS.map((plan) => {
                const actionKey = `${plan.key}-${billingCycle}`;
                const isWorking = billingActionTarget === actionKey;
                const cyclePriceIds = getCyclePriceIds(plan);
                const activePriceId = billingCycle === "monthly" ? cyclePriceIds.monthly : cyclePriceIds.annual;
                const isPlanAvailable = Boolean(activePriceId);
                const isPopular = plan.key === "pro";

                return (
                  <div key={plan.key} className={`pricing-card ${isPopular ? "is-popular" : ""}`}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                        <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{plan.name}</h3>
                        {isPopular && (
                          <span style={{
                            display: "inline-flex", alignItems: "center", padding: "3px 8px",
                            borderRadius: "999px", fontSize: "10px", fontWeight: 700,
                            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                            border: "1px solid rgba(255,255,255,0.12)",
                          }}>
                            Most popular
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <p className="pricing-card-price">
                          {billingCycle === "monthly" ? plan.monthlyLabel : plan.annualLabel}
                        </p>
                        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
                          {billingCycle === "monthly" ? "Billed monthly" : "Billed annually"}
                        </p>
                      </div>
                    </div>

                    <ul className="pricing-card-list">
                      {plan.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>

                    <div className="pricing-card-cta" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        className="btn btn-primary"
                        onClick={() => void handleStartSubscription(plan)}
                        disabled={!!billingActionTarget || !isPlanAvailable}
                      >
                        {isWorking ? "Working…" : "Start subscription"}
                      </button>
                      {!isPlanAvailable && (
                        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                          Plan unavailable (billing not configured)
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
              <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Cancel anytime · No contract</p>
              {isSubscriber && (
                <button className="btn btn-secondary" onClick={() => setShowPlanOptions(false)} type="button">
                  Hide plans
                </button>
              )}
            </div>
          </div>
        )}

        {process.env.NODE_ENV !== "production" && (
          <p className="billing-debug" style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "16px" }}>
            Debug — stripe_status: {stripeStatus ?? "null"}, stripe_plan_tier: {stripePlanTier ?? "null"},
            stripe_plan_billing: {stripePlanBilling ?? "null"}, stripe_subscription_id: {stripeSubscriptionId ?? "null"},
            stripe_price_id: {stripePriceId ?? "null"}, stripe_id: {stripeId ?? "null"}, missing price_ids:{" "}
            {missingPriceIds.length ? missingPriceIds.join(", ") : "none"}
          </p>
        )}

        {billingError && (
          <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginTop: "12px" }}>
            {billingError}
          </p>
        )}
      </div>

      {/* ── Password & Security ──────────────────────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Password &amp; Security</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Change your password to keep your account secure.</p>
        </div>

        <form onSubmit={handleChangePassword} className="form-stack">
          {authProvider === "email" ? (
            <div className="form-field">
              <label className="form-label" htmlFor="current_password">Current password (optional)</label>
              <input
                id="current_password"
                type="password"
                className="chat-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                disabled={passwordSaving}
              />
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: 0 }}>
                For extra security, enter your current password to confirm.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
              You signed in with Google/Microsoft. Set a password to enable email + password login too.
            </p>
          )}

          <div className="form-row">
            <div className="form-field">
              <label className="form-label" htmlFor="new_password">New password</label>
              <input
                id="new_password"
                type="password"
                className="chat-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={passwordSaving}
              />
            </div>
            <div className="form-field">
              <label className="form-label" htmlFor="confirm_new_password">Confirm new password</label>
              <input
                id="confirm_new_password"
                type="password"
                className="chat-input"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                disabled={passwordSaving}
              />
            </div>
          </div>

          {authProvider === "email" && !userEmail && (
            <p style={{ fontSize: "13px", color: "#f87171", margin: 0 }}>
              Can&apos;t load your email — refresh and try again.
            </p>
          )}

          {passwordError && (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
              {passwordError}
            </p>
          )}

          {passwordSuccess && (
            <p style={{ fontSize: "13px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
              {passwordSuccess}
            </p>
          )}

          <div className="form-actions">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={passwordSaving || (authProvider === "email" && !userEmail)}
            >
              {passwordSaving ? "Updating…" : "Change password"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Legal ───────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: "24px 28px" }}>
        <div style={{ marginBottom: "16px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Legal</h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Important documents for using BillyBot.</p>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <Link
            href="/legal/terms"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>Terms of Service</span>
            <span style={{ fontSize: "13px", color: "#64748b" }}>View →</span>
          </Link>
          <Link
            href="/legal/privacy"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9" }}>Privacy Policy</span>
            <span style={{ fontSize: "13px", color: "#64748b" }}>View →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
