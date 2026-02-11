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
  className: string;
};

function getPlanLabel(tier?: string | null) {
  const normalized = (tier ?? "").toLowerCase();
  if (normalized in PLAN_LABELS) {
    return PLAN_LABELS[normalized as PlanKey];
  }
  return "—";
}

function getBillingLabel(billing?: string | null) {
  const normalized = (billing ?? "").toLowerCase();
  if (normalized === "month") return BILLING_LABELS.monthly;
  if (normalized === "year") return BILLING_LABELS.annual;
  if (normalized in BILLING_LABELS) {
    return BILLING_LABELS[normalized as BillingCycle];
  }
  return "—";
}

function getStripeStatusBadge(status?: string | null): StatusBadge {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return { label: "Active", className: "bg-emerald-500/15 text-emerald-200" };
    case "trialing":
      return { label: "Trialing", className: "bg-emerald-500/15 text-emerald-200" };
    case "past_due":
      return { label: "Past due", className: "bg-amber-500/15 text-amber-200" };
    case "canceled":
      return { label: "Canceled", className: "bg-red-500/15 text-red-200" };
    case "none":
    default:
      return { label: "Not subscribed", className: "bg-white/5 text-white/70" };
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

      if (clientError) {
        throw clientError;
      }

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
      setBillingError(null);

      const res = await fetch("/api/billing/manage", {
        method: "POST",
      });

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

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Unable to open billing portal.");
      }

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

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout.");
      }

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
      setPasswordError("Can’t load your email — refresh and try again.");
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

        if (reauthError) {
          throw new Error("Current password is incorrect.");
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

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

  const isConnected = (account: EmailAccount | null) =>
    !!account && account.status === "connected";

  function getCyclePriceIds(plan: PlanConfig) {
    return PRICE_MAP[plan.key];
  }

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

    if (!ids.monthly) {
      missing.push(MISSING_PRICE_LABELS[plan.key].monthly);
    }

    if (!ids.annual) {
      missing.push(MISSING_PRICE_LABELS[plan.key].annual);
    }

    return missing;
  });

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
            Connect your inbox so BillyBot can read enquiries automatically.
          </p>
        </div>

        {emailAccountsLoading ? <p className="section-subtitle">Loading email accounts…</p> : null}
        {emailAccountsError ? <p className="text-sm text-red-400">{emailAccountsError}</p> : null}

        <div className="stack gap-3">
          {[
            { key: "google" as const, label: "Gmail", account: googleAccount },
            {
              key: "microsoft" as const,
              label: "Outlook",
              account: microsoftAccount,
            },
          ].map(({ key, label, account }) => {
            const connected = isConnected(account);
            const statusConfig = connected
              ? getStatusConfig("connected")
              : getStatusConfig("disconnected");
            const isActionLoading = emailActionTarget === key || emailAccountsLoading;

            return (
              <div key={key} className="linked-account-badge">
                <div className="linked-account-badge-left">
                  <div className="linked-account-badge-text">
                    <p className="linked-account-badge-title">{label}</p>
                    <div className="stack gap-1">
                      <div className={`tag ${statusConfig.className}`} aria-live="polite">
                        {statusConfig.label}
                      </div>
                      {connected && account?.email_address ? (
                        <p className="text-sm text-white/80">{account.email_address}</p>
                      ) : null}
                      {!connected && account?.last_error ? (
                        <p className="text-xs text-white/60">{account.last_error.slice(0, 140)}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!connected ? (
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
                  {connected ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleEmailDisconnect(key, account?.id)}
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
          <h2 className="section-title">Plan & Billing</h2>
          <p className="section-subtitle">Choose your plan or manage your existing subscription.</p>
        </div>

        {billingSuccess ? <p className="text-sm text-emerald-300">{billingSuccess}</p> : null}

        {isSubscriber && !showPlanOptions ? (
          <div className="subscription-summary stack gap-3">
            <div className="row flex-wrap gap-2">
              <div className={`tag ${statusBadge.className}`}>{statusBadge.label}</div>
              <span className="text-sm text-white/70">
                Plan: {planLabel} ({billingLabel})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleManageBilling}
                disabled={loadingPortal}
                className="btn btn-primary"
              >
                {loadingPortal ? "Loading…" : "Manage subscription"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowPlanOptions(true)}
                disabled={loadingPortal}
              >
                Change plan
              </button>
            </div>
          </div>
        ) : (
          <div className="stack gap-4">
            <div className="row flex-wrap gap-2">
              <div className={`tag ${statusBadge.className}`}>{statusBadge.label}</div>
              {isSubscriber ? (
                <span className="text-sm text-white/70">
                  Current plan: {planLabel} ({billingLabel})
                </span>
              ) : null}
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
                const activePriceId =
                  billingCycle === "monthly" ? cyclePriceIds.monthly : cyclePriceIds.annual;
                const isPlanAvailable = Boolean(activePriceId);
                const isPopular = plan.key === "pro";

                return (
                  <div
                    key={plan.key}
                    className={`pricing-card ${isPopular ? "is-popular" : ""}`}
                  >
                    <div className="pricing-card-header stack gap-2">
                      <div className="row justify-between flex-wrap gap-2">
                        <h3 className="text-lg font-semibold">{plan.name}</h3>
                        {isPopular ? (
                          <span className="tag bg-white/10 text-white/80">Most popular</span>
                        ) : null}
                      </div>
                      <div className="stack gap-1">
                        <p className="pricing-card-price">
                          {billingCycle === "monthly" ? plan.monthlyLabel : plan.annualLabel}
                        </p>
                        <p className="text-xs text-white/60">
                          {billingCycle === "monthly" ? "Billed monthly" : "Billed annually"}
                        </p>
                      </div>
                    </div>

                    <ul className="pricing-card-list">
                      {plan.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>

                    <div className="pricing-card-cta stack gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => void handleStartSubscription(plan)}
                        disabled={!!billingActionTarget || !isPlanAvailable}
                      >
                        {isWorking ? "Working..." : "Start subscription"}
                      </button>
                      {!isPlanAvailable ? (
                        <p className="text-xs text-white/60">
                          Plan unavailable (billing not configured)
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="row flex-wrap items-center justify-between gap-2">
              <p className="section-subtitle">Cancel anytime | No contract</p>
              {isSubscriber ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowPlanOptions(false)}
                  type="button"
                >
                  Hide plans
                </button>
              ) : null}
            </div>
          </div>
        )}

        {process.env.NODE_ENV !== "production" ? (
          <p className="billing-debug text-xs text-white/50">
            Debug — stripe_status: {stripeStatus ?? "null"}, stripe_plan_tier:{" "}
            {stripePlanTier ?? "null"}, stripe_plan_billing: {stripePlanBilling ?? "null"},
            stripe_subscription_id: {stripeSubscriptionId ?? "null"}, stripe_price_id:{" "}
            {stripePriceId ?? "null"}, stripe_id: {stripeId ?? "null"}, missing price_ids:{" "}
            {missingPriceIds.length ? missingPriceIds.join(", ") : "none"}
          </p>
        ) : null}

        {billingError ? <p className="text-sm text-red-400">{billingError}</p> : null}
      </div>

      <div className="card stack gap-4">
        <div className="stack gap-1">
          <h2 className="section-title">Password &amp; Security</h2>
          <p className="section-subtitle">Change your password to keep your account secure.</p>
        </div>

        <form onSubmit={handleChangePassword} className="stack gap-4">
          {authProvider === "email" ? (
            <div className="field-group">
              <label className="field-label" htmlFor="current_password">
                Current password (optional)
              </label>
              <input
                id="current_password"
                type="password"
                className="input-fluid"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <p className="text-xs text-white/60">
                For extra security, enter your current password to confirm.
              </p>
            </div>
          ) : (
            <p className="text-xs text-white/60">
              You signed in with Google/Microsoft. Set a password to enable email + password
              login too.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="field-group">
              <label className="field-label" htmlFor="new_password">
                New password
              </label>
              <input
                id="new_password"
                type="password"
                className="input-fluid"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="confirm_new_password">
                Confirm new password
              </label>
              <input
                id="confirm_new_password"
                type="password"
                className="input-fluid"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          </div>

          {authProvider === "email" && !userEmail ? (
            <p className="text-xs text-red-400">Can’t load your email — refresh and try again.</p>
          ) : null}
          {passwordError ? <p className="text-sm text-red-400">{passwordError}</p> : null}
          {passwordSuccess ? <p className="text-sm text-emerald-300">{passwordSuccess}</p> : null}

          <div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={passwordSaving || (authProvider === "email" && !userEmail)}
            >
              {passwordSaving ? "Updating..." : "Change password"}
            </button>
          </div>
        </form>
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
