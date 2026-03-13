"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import InviteForm from "@/app/team/components/InviteForm";
import TeamMemberList from "@/app/team/components/TeamMemberList";
import HelpSection from "@/app/requests/HelpSection";
import type { TeamInvite, TeamMember } from "@/types/team";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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
  tagline: string;
  monthlyLabel: string;
  annualLabel: string;
  bullets: string[];
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

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
    tagline: "The one man band",
    monthlyLabel: "£149/mo",
    annualLabel: "£1,490/yr",
    bullets: [
      "Just you — no fitters needed",
      "AI chat assistant",
      "Instant quote generation with your branding",
      "Job & customer management",
      "Email integration — AI reads emails & drafts replies",
      "Mobile app",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "The established flooring business",
    monthlyLabel: "£249/mo",
    annualLabel: "£2,490/yr",
    bullets: [
      "Everything in Starter",
      "You + up to 4 fitters",
      "Diary & AI scheduling",
      "Assign jobs to your fitters",
      "Fitter mobile app — they see their jobs, nothing else",
      "Push notifications to fitters when booked",
      "Supplier price management",
    ],
  },
  {
    key: "team",
    name: "Team",
    tagline: "The serious operation",
    monthlyLabel: "£499/mo",
    annualLabel: "£4,990/yr",
    bullets: [
      "Everything in Pro",
      "Unlimited fitters, managers & estimators",
      "Multiple manager logins",
      "Estimator accounts — full quoting, no admin",
      "Dedicated onboarding call with Steve",
      "Priority support",
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

/* ------------------------------------------------------------------ */
/*  Tab config                                                         */
/* ------------------------------------------------------------------ */

const TABS = ["profile", "billing", "integrations", "team", "security", "support"] as const;
type AccountTab = (typeof TABS)[number];

const TAB_LABELS: Record<AccountTab, string> = {
  profile: "Profile",
  billing: "Billing",
  integrations: "Integrations",
  team: "Team",
  security: "Security",
  support: "Support",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function isBusinessProfileComplete(profile: { [K in keyof ClientProfile]?: ClientProfile[K] | null } | null) {
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

function getDaysAgoLabel(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  /* --- Tab from URL query (?tab=billing) --- */
  const [tab, setTab] = useState<AccountTab>(() => {
    if (typeof window === "undefined") return "profile";
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as AccountTab;
    return t && TABS.includes(t) ? t : "profile";
  });

  const switchTab = useCallback((t: AccountTab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === "profile") url.searchParams.delete("tab");
    else url.searchParams.set("tab", t);
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router]);

  /* --- State: profile --- */
  const [profile, setProfile] = useState<ClientProfile>(EMPTY_PROFILE);
  const [userEmail, setUserEmail] = useState<string>("");
  const [authProvider, setAuthProvider] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  /* --- State: accounting --- */
  const [accountingSystem, setAccountingSystem] = useState<string | null>(null);
  const [accountingStatusLoaded, setAccountingStatusLoaded] = useState(false);

  /* --- State: email --- */
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailAccountsLoading, setEmailAccountsLoading] = useState(true);
  const [emailAccountsError, setEmailAccountsError] = useState<string | null>(null);
  const [emailActionTarget, setEmailActionTarget] = useState<string | null>(null);

  /* --- State: billing --- */
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

  /* --- State: password --- */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  /* --- State: team --- */
  const [userRole, setUserRole] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);

  /* --- State: invoice settings --- */
  const [invoiceVatNumber, setInvoiceVatNumber] = useState("");
  const [invoiceCompanyReg, setInvoiceCompanyReg] = useState("");
  const [invoiceBankName, setInvoiceBankName] = useState("");
  const [invoiceSortCode, setInvoiceSortCode] = useState("");
  const [invoiceAccountNumber, setInvoiceAccountNumber] = useState("");
  const [invoicePaymentTerms, setInvoicePaymentTerms] = useState("Payment due within 30 days");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceSuccess, setInvoiceSuccess] = useState<string | null>(null);

  /* --- State: requests --- */
  const [requestText, setRequestText] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  /* --- State: voice profile --- */
  const [vpStatus, setVpStatus] = useState<"none" | "generating" | "ready" | "error">("none");
  const [vpText, setVpText] = useState<string>("");
  const [vpEditText, setVpEditText] = useState<string>("");
  const [vpGeneratedAt, setVpGeneratedAt] = useState<string | null>(null);
  const [vpEmailCount, setVpEmailCount] = useState<number | null>(null);
  const [vpManualOverride, setVpManualOverride] = useState(false);
  const [vpLoading, setVpLoading] = useState(true);
  const [vpEditing, setVpEditing] = useState(false);
  const [vpSaving, setVpSaving] = useState(false);
  const [vpRegenerating, setVpRegenerating] = useState(false);
  const [vpExpanded, setVpExpanded] = useState(false);
  const [vpError, setVpError] = useState<string | null>(null);
  const [vpSuccess, setVpSuccess] = useState<string | null>(null);

  /* --- State: social accounts --- */
  const [socialAccounts, setSocialAccounts] = useState<Array<{
    id: string;
    platform: string;
    platform_page_name: string | null;
    status: string;
    effective_status: string;
    last_post_at: string | null;
  }>>([]);
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialActionTarget, setSocialActionTarget] = useState<string | null>(null);
  const [socialAutoPost, setSocialAutoPost] = useState(false);

  /* ------------------------------------------------------------------ */
  /*  Data loading                                                       */
  /* ------------------------------------------------------------------ */

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
          "accounting_system, stripe_status, stripe_plan_tier, stripe_plan_billing, stripe_subscription_id, stripe_price_id, stripe_id, business_name, contact_name, phone, address_line1, address_line2, city, postcode, country, is_onboarded, user_role, invoice_vat_number, invoice_company_reg, invoice_bank_name, invoice_sort_code, invoice_account_number, invoice_payment_terms, invoice_notes"
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
      setUserRole((clientData as { user_role?: string } | null)?.user_role ?? "owner");

      if (!clientData || !isBusinessProfileComplete(clientData)) {
        router.push("/account/setup");
        return;
      }

      setProfile({
        ...EMPTY_PROFILE,
        business_name: clientData.business_name ?? "",
        contact_name: clientData.contact_name ?? "",
        phone: clientData.phone ?? "",
        address_line1: clientData.address_line1 ?? "",
        address_line2: clientData.address_line2 ?? "",
        city: clientData.city ?? "",
        postcode: clientData.postcode ?? "",
        country: clientData.country ?? "",
        is_onboarded: clientData.is_onboarded ?? false,
      });

      const cd = clientData as Record<string, unknown>;
      setInvoiceVatNumber((cd.invoice_vat_number as string) ?? "");
      setInvoiceCompanyReg((cd.invoice_company_reg as string) ?? "");
      setInvoiceBankName((cd.invoice_bank_name as string) ?? "");
      setInvoiceSortCode((cd.invoice_sort_code as string) ?? "");
      setInvoiceAccountNumber((cd.invoice_account_number as string) ?? "");
      setInvoicePaymentTerms((cd.invoice_payment_terms as string) ?? "Payment due within 30 days");
      setInvoiceNotes((cd.invoice_notes as string) ?? "");

      // Fetch social_auto_post separately (column may not be in generated types yet)
      const { data: autoPostData } = await supabase
        .from("clients")
        .select("id" as string)
        .eq("id", userData.user.id)
        .maybeSingle();
      setSocialAutoPost(!!(autoPostData as Record<string, unknown> | null)?.social_auto_post);
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
      switchTab("billing");
      router.replace(url.pathname + "?tab=billing");
    }
  }, [loadProfile, router, switchTab]);

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

  /* --- Load voice profile --- */
  const loadVoiceProfile = useCallback(async () => {
    setVpLoading(true);
    setVpError(null);
    try {
      const res = await fetch("/api/voice-profile");
      if (!res.ok) throw new Error("Unable to load voice profile");
      const json = (await res.json()) as {
        data?: {
          voice_profile?: string | null;
          voice_profile_status?: string | null;
          voice_profile_generated_at?: string | null;
          voice_profile_email_count?: number | null;
          voice_profile_manual_override?: boolean | null;
        } | null;
      };
      const d = json.data;
      setVpStatus((d?.voice_profile_status as "none" | "generating" | "ready" | "error") ?? "none");
      setVpText(d?.voice_profile ?? "");
      setVpEditText(d?.voice_profile ?? "");
      setVpGeneratedAt(d?.voice_profile_generated_at ?? null);
      setVpEmailCount(d?.voice_profile_email_count ?? null);
      setVpManualOverride(d?.voice_profile_manual_override ?? false);
    } catch (err) {
      setVpError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to load voice profile"
      );
    } finally {
      setVpLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoiceProfile();
  }, [loadVoiceProfile]);

  /* --- Load social accounts --- */
  const loadSocialAccounts = useCallback(async () => {
    setSocialLoading(true);
    setSocialError(null);
    try {
      const res = await fetch("/api/social/accounts");
      if (!res.ok) throw new Error("Unable to load social accounts");
      const data = (await res.json()) as { data?: typeof socialAccounts };
      setSocialAccounts(data?.data ?? []);
    } catch (err) {
      setSocialError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to load social accounts"
      );
    } finally {
      setSocialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSocialAccounts();
  }, [loadSocialAccounts]);

  function handleSocialConnect(platform: "facebook" | "linkedin") {
    window.location.href = `/api/social/${platform}/start`;
  }

  async function handleSocialDisconnect(accountId: string) {
    setSocialActionTarget(accountId);
    try {
      const res = await fetch("/api/social/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      if (!res.ok) throw new Error("Unable to disconnect account");
      await loadSocialAccounts();
    } catch (err) {
      setSocialError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to disconnect account"
      );
    } finally {
      setSocialActionTarget(null);
    }
  }

  async function handleAutoPostToggle() {
    const newValue = !socialAutoPost;
    setSocialAutoPost(newValue);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      await supabase
        .from("clients")
        .update({ social_auto_post: newValue } as Record<string, unknown>)
        .eq("id", userData.user.id);
    } catch {
      setSocialAutoPost(!newValue); // revert on error
    }
  }

  const loadTeamData = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const res = await fetch("/api/team/members");
      if (res.status === 403) { setTeamLoading(false); return; }
      if (!res.ok) throw new Error("Unable to load team data");
      const data = (await res.json()) as { members?: TeamMember[]; invites?: TeamInvite[] };
      setTeamMembers(data.members ?? []);
      setTeamInvites(data.invites ?? []);
    } catch (err) {
      setTeamError(err && typeof err === "object" && "message" in err ? String((err as { message?: string }).message) : "Unable to load team");
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userRole === "owner" || userRole === "manager") {
      void loadTeamData();
    }
  }, [userRole, loadTeamData]);

  /* ------------------------------------------------------------------ */
  /*  Handlers                                                           */
  /* ------------------------------------------------------------------ */

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

  async function handleInvoiceSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInvoiceError(null);
    setInvoiceSuccess(null);
    setInvoiceSaving(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        router.push("/auth/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("clients")
        .update({
          invoice_vat_number: invoiceVatNumber || null,
          invoice_company_reg: invoiceCompanyReg || null,
          invoice_bank_name: invoiceBankName || null,
          invoice_sort_code: invoiceSortCode || null,
          invoice_account_number: invoiceAccountNumber || null,
          invoice_payment_terms: invoicePaymentTerms || null,
          invoice_notes: invoiceNotes || null,
        } as Record<string, unknown>)
        .eq("id", userData.user.id);

      if (updateError) throw updateError;
      setInvoiceSuccess("Invoice settings saved.");
    } catch (err) {
      setInvoiceError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save invoice settings"
      );
    } finally {
      setInvoiceSaving(false);
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

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    const message = requestText.trim();
    if (!message) {
      setRequestError("Please enter a request before submitting.");
      return;
    }

    setRequestSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setRequestError("Unable to verify your session. Please sign in again.");
        return;
      }

      const { error: insertError } = await supabase.from("requests").insert({
        user_id: user.id,
        message,
      });

      if (insertError) throw insertError;

      setRequestSuccess("Request submitted. Thank you.");
      setRequestText("");
    } catch (err) {
      setRequestError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to submit request. Please try again."
      );
    } finally {
      setRequestSubmitting(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Voice profile handlers                                             */
  /* ------------------------------------------------------------------ */

  async function handleVpRegenerate() {
    setVpRegenerating(true);
    setVpError(null);
    setVpSuccess(null);
    try {
      const res = await fetch("/api/voice-profile/generate", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Unable to regenerate voice profile");
      }
      setVpStatus("generating");
      setVpManualOverride(false);
      setVpSuccess("Voice profile generation started. This may take a minute.");
    } catch (err) {
      setVpError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to regenerate voice profile"
      );
    } finally {
      setVpRegenerating(false);
    }
  }

  async function handleVpSave() {
    const trimmed = vpEditText.trim();
    if (!trimmed) {
      setVpError("Voice profile cannot be empty.");
      return;
    }
    setVpSaving(true);
    setVpError(null);
    setVpSuccess(null);
    try {
      const res = await fetch("/api/voice-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_profile: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { voice_profile?: string; voice_profile_manual_override?: boolean };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Unable to save voice profile");
      }
      setVpText(json.data?.voice_profile ?? trimmed);
      setVpManualOverride(true);
      setVpEditing(false);
      setVpSuccess("Voice profile saved.");
    } catch (err) {
      setVpError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to save voice profile"
      );
    } finally {
      setVpSaving(false);
    }
  }

  function getVpStatusBadge(): StatusBadge {
    switch (vpStatus) {
      case "ready":
        return { label: vpGeneratedAt ? `Ready (updated ${getDaysAgoLabel(vpGeneratedAt)})` : "Ready", bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" };
      case "generating":
        return { label: "Generating...", bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" };
      case "error":
        return { label: "Error", bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" };
      default:
        return { label: "Not generated", bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.08)" };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Derived                                                            */
  /* ------------------------------------------------------------------ */

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

  const showTeamTab = userRole === "owner" || userRole === "manager";
  const visibleTabs = TABS.filter((t) => t !== "team" || showTeamTab);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="page-container">
      {/* ── Page header ── */}
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

      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", gap: "4px", borderBottom: "1px solid rgba(148,163,184,0.1)",
        paddingBottom: "0", flexWrap: "wrap", marginBottom: "24px",
      }}>
        {visibleTabs.map((t) => {
          const active = tab === t;
          return (
            <button
              type="button"
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: active ? 700 : 500,
                color: active ? "#f1f5f9" : "#64748b",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #38bdf8" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: "-1px",
                transition: "color 0.15s ease",
              }}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/*  PROFILE TAB                                                     */}
      {/* ================================================================ */}
      {tab === "profile" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Identity card */}
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

          {/* Business Information */}
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
                    <input id="business_name" className="chat-input" value={profile.business_name} onChange={(e) => updateField("business_name", e.target.value)} required disabled={saving || loading} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="contact_name">Contact name</label>
                    <input id="contact_name" className="chat-input" value={profile.contact_name} onChange={(e) => updateField("contact_name", e.target.value)} required disabled={saving || loading} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label" htmlFor="phone">Phone</label>
                    <input id="phone" className="chat-input" value={profile.phone} onChange={(e) => updateField("phone", e.target.value)} required disabled={saving || loading} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="country">Country</label>
                    <input id="country" className="chat-input" value={profile.country} onChange={(e) => updateField("country", e.target.value)} required disabled={saving || loading} />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="address_line1">Address line 1</label>
                  <input id="address_line1" className="chat-input" value={profile.address_line1} onChange={(e) => updateField("address_line1", e.target.value)} required disabled={saving || loading} />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="address_line2">Address line 2</label>
                  <input id="address_line2" className="chat-input" value={profile.address_line2 ?? ""} onChange={(e) => updateField("address_line2", e.target.value)} disabled={saving || loading} />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label" htmlFor="city">City</label>
                    <input id="city" className="chat-input" value={profile.city} onChange={(e) => updateField("city", e.target.value)} required disabled={saving || loading} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="postcode">Postcode</label>
                    <input id="postcode" className="chat-input" value={profile.postcode} onChange={(e) => updateField("postcode", e.target.value)} required disabled={saving || loading} />
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

          {/* Invoice Settings */}
          <div className="card" style={{ padding: "24px 28px" }}>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Invoice Settings</h2>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>These details appear on your PDF invoices.</p>
            </div>

            {!loading && !error ? (
              <form onSubmit={handleInvoiceSettingsSave} className="form-stack">
                {invoiceSuccess && (
                  <p style={{ fontSize: "13px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
                    {invoiceSuccess}
                  </p>
                )}
                {invoiceError && (
                  <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
                    {invoiceError}
                  </p>
                )}

                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label" htmlFor="invoice_vat_number">VAT number</label>
                    <input id="invoice_vat_number" className="chat-input" value={invoiceVatNumber} onChange={(e) => setInvoiceVatNumber(e.target.value)} placeholder="e.g. GB 123 4567 89" disabled={invoiceSaving || loading} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="invoice_company_reg">Company reg number</label>
                    <input id="invoice_company_reg" className="chat-input" value={invoiceCompanyReg} onChange={(e) => setInvoiceCompanyReg(e.target.value)} placeholder="e.g. 12345678" disabled={invoiceSaving || loading} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label" htmlFor="invoice_bank_name">Bank name</label>
                    <input id="invoice_bank_name" className="chat-input" value={invoiceBankName} onChange={(e) => setInvoiceBankName(e.target.value)} placeholder="e.g. Barclays" disabled={invoiceSaving || loading} />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="invoice_sort_code">Sort code</label>
                    <input id="invoice_sort_code" className="chat-input" value={invoiceSortCode} onChange={(e) => setInvoiceSortCode(e.target.value)} placeholder="e.g. 20-00-00" disabled={invoiceSaving || loading} />
                  </div>
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="invoice_account_number">Account number</label>
                  <input id="invoice_account_number" className="chat-input" value={invoiceAccountNumber} onChange={(e) => setInvoiceAccountNumber(e.target.value)} placeholder="e.g. 12345678" disabled={invoiceSaving || loading} />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="invoice_payment_terms">Payment terms</label>
                  <input id="invoice_payment_terms" className="chat-input" value={invoicePaymentTerms} onChange={(e) => setInvoicePaymentTerms(e.target.value)} placeholder="Payment due within 30 days" disabled={invoiceSaving || loading} />
                </div>

                <div className="form-field">
                  <label className="form-label" htmlFor="invoice_notes">Invoice footer notes</label>
                  <textarea id="invoice_notes" className="chat-input" value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="e.g. Thank you for your business" rows={3} style={{ resize: "vertical", minHeight: "60px" }} disabled={invoiceSaving || loading} />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={invoiceSaving || loading}>
                    {invoiceSaving ? "Saving…" : "Save invoice settings"}
                  </button>
                </div>
              </form>
            ) : null}
          </div>

          {/* Legal */}
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
      ) : null}

      {/* ================================================================ */}
      {/*  BILLING TAB                                                     */}
      {/* ================================================================ */}
      {tab === "billing" ? (
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
                <button className={`billing-toggle-btn ${billingCycle === "monthly" ? "is-active" : ""}`} onClick={() => setBillingCycle("monthly")} disabled={!!billingActionTarget} type="button">
                  Monthly
                </button>
                <button className={`billing-toggle-btn ${billingCycle === "annual" ? "is-active" : ""}`} onClick={() => setBillingCycle("annual")} disabled={!!billingActionTarget} type="button">
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
                        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>{plan.tagline}</p>
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
                        <button className="btn btn-primary" onClick={() => void handleStartSubscription(plan)} disabled={!!billingActionTarget || !isPlanAvailable}>
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
      ) : null}

      {/* ================================================================ */}
      {/*  INTEGRATIONS TAB                                                */}
      {/* ================================================================ */}
      {tab === "integrations" ? (
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
                        <button className="btn btn-primary" onClick={() => handleEmailConnect(key)} disabled={isActionLoading}>
                          {isActionLoading
                            ? "Working…"
                            : key === "google"
                            ? connected ? "Reconnect Gmail" : "Connect Gmail"
                            : connected ? "Reconnect Outlook" : "Connect Outlook"}
                        </button>
                      )}
                      {connected && (
                        <button className="btn btn-secondary" onClick={() => handleEmailDisconnect(key, account?.id)} disabled={isActionLoading}>
                          {isActionLoading ? "Working…" : "Disconnect"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: "1px", background: "rgba(148,163,184,0.1)", margin: "24px 0" }} />

          {/* Social Media */}
          <div style={{ marginBottom: "24px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>
              Social Media
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: "0 0 12px 0" }}>
              Connect your social accounts to auto-generate posts from showcase photos.
            </p>

            {socialLoading && (
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>Loading social accounts...</p>
            )}
            {socialError && (
              <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
                {socialError}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { platform: "facebook" as const, label: "Facebook / Instagram", comingSoon: false },
                { platform: "linkedin" as const, label: "LinkedIn", comingSoon: true },
              ].map(({ platform, label, comingSoon }) => {
                if (comingSoon) {
                  return (
                    <div key={platform} className="linked-account-badge">
                      <div className="linked-account-badge-left">
                        <div className="linked-account-badge-text">
                          <p className="linked-account-badge-title">{label}</p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                            <span
                              style={{
                                display: "inline-flex", alignItems: "center", padding: "3px 8px",
                                borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                                background: "rgba(56,189,248,0.12)", color: "#38bdf8",
                                border: "1px solid rgba(56,189,248,0.25)",
                              }}
                            >
                              Coming Soon
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                const accounts = socialAccounts.filter((a) =>
                  platform === "facebook"
                    ? a.platform === "facebook" || a.platform === "instagram"
                    : a.platform === platform
                );
                const connected = accounts.some((a) => a.effective_status === "connected");
                const needsReauth = accounts.some((a) => a.effective_status === "needs_reauth");
                const pageNames = accounts
                  .filter((a) => a.platform_page_name)
                  .map((a) => a.platform_page_name)
                  .join(", ");

                const statusBadge = connected
                  ? { label: "Connected", bg: "rgba(52,211,153,0.12)", text: "#34d399", border: "rgba(52,211,153,0.25)" }
                  : needsReauth
                  ? { label: "Reconnect required", bg: "rgba(248,113,113,0.12)", text: "#f87171", border: "rgba(248,113,113,0.25)" }
                  : { label: "Not connected", bg: "rgba(255,255,255,0.05)", text: "rgba(255,255,255,0.5)", border: "rgba(255,255,255,0.08)" };

                const isActionLoading = accounts.some((a) => socialActionTarget === a.id) || socialLoading;

                return (
                  <div key={platform} className="linked-account-badge">
                    <div className="linked-account-badge-left">
                      <div className="linked-account-badge-text">
                        <p className="linked-account-badge-title">{label}</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", padding: "3px 8px",
                              borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                              background: statusBadge.bg, color: statusBadge.text,
                              border: `1px solid ${statusBadge.border}`,
                            }}
                          >
                            {statusBadge.label}
                          </span>
                          {connected && pageNames && (
                            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", margin: 0 }}>
                              {pageNames}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {(!connected || needsReauth) && (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleSocialConnect(platform)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? "Working..." : connected ? `Reconnect ${label}` : `Connect ${label}`}
                        </button>
                      )}
                      {connected && accounts.length > 0 && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            const fbAccount = accounts.find((a) => a.platform === platform || (platform === "facebook" && a.platform === "facebook"));
                            if (fbAccount) void handleSocialDisconnect(fbAccount.id);
                          }}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? "Working..." : "Disconnect"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auto-post toggle */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: "16px", padding: "12px 16px",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(148,163,184,0.1)",
              borderRadius: "10px",
            }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0 }}>Auto-post</p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
                  Skip approval queue — publish showcase posts automatically
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAutoPostToggle()}
                style={{
                  width: "44px", height: "24px", borderRadius: "12px", border: "none",
                  background: socialAutoPost ? "#34d399" : "rgba(148,163,184,0.2)",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  position: "absolute", top: "2px",
                  left: socialAutoPost ? "22px" : "2px",
                  width: "20px", height: "20px", borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                }} />
              </button>
            </div>
          </div>

          <div style={{ height: "1px", background: "rgba(148,163,184,0.1)", margin: "24px 0" }} />

          {/* Voice Profile */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>
                Voice Profile
              </p>
              {!vpLoading && (
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", padding: "3px 8px",
                    borderRadius: "999px", fontSize: "11px", fontWeight: 700,
                    background: getVpStatusBadge().bg, color: getVpStatusBadge().text,
                    border: `1px solid ${getVpStatusBadge().border}`,
                    ...(vpStatus === "generating" ? { animation: "pulse 2s ease-in-out infinite" } : {}),
                  }}
                >
                  {getVpStatusBadge().label}
                </span>
              )}
              {vpManualOverride && vpStatus === "ready" && (
                <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                  (manually edited)
                </span>
              )}
            </div>

            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", margin: "0 0 12px 0" }}>
              BillyBot learns your email style from your sent emails. Need at least 10 sent emails to generate.
            </p>

            {vpLoading && (
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "12px" }}>Loading voice profile...</p>
            )}

            {vpError && (
              <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
                {vpError}
              </p>
            )}

            {vpSuccess && (
              <p style={{ fontSize: "13px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
                {vpSuccess}
              </p>
            )}

            {!vpLoading && (
              <>
                {/* Voice profile text area */}
                <div style={{ marginBottom: "12px" }}>
                  {vpEditing ? (
                    <textarea
                      className="chat-input"
                      value={vpEditText}
                      onChange={(e) => setVpEditText(e.target.value)}
                      rows={10}
                      style={{ resize: "vertical", minHeight: "120px", fontSize: "13px", lineHeight: "1.6" }}
                      disabled={vpSaving}
                    />
                  ) : (
                    <div
                      onClick={() => { if (vpText && vpText.length > 300) setVpExpanded((v) => !v); }}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(148,163,184,0.1)",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        fontSize: "13px",
                        color: vpText ? "#cbd5e1" : "#64748b",
                        lineHeight: "1.6",
                        whiteSpace: "pre-wrap",
                        maxHeight: !vpExpanded && vpText && vpText.length > 300 ? "120px" : "none",
                        overflow: "hidden",
                        cursor: vpText && vpText.length > 300 ? "pointer" : "default",
                        transition: "max-height 0.3s ease",
                        position: "relative",
                      }}
                    >
                      {vpText || "No voice profile yet"}
                      {!vpExpanded && vpText && vpText.length > 300 && (
                        <div style={{
                          position: "absolute", bottom: 0, left: 0, right: 0, height: "40px",
                          background: "linear-gradient(transparent, rgba(15,23,42,0.95))",
                          display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "4px",
                        }}>
                          <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 600 }}>Click to expand</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {vpEmailCount !== null && vpEmailCount > 0 && (
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "0 0 12px 0" }}>
                    Generated from {vpEmailCount} sent email{vpEmailCount !== 1 ? "s" : ""}
                  </p>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {!vpEditing ? (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={handleVpRegenerate}
                        disabled={vpRegenerating || vpStatus === "generating"}
                      >
                        {vpRegenerating || vpStatus === "generating" ? "Generating..." : "Regenerate"}
                      </button>
                      {vpText && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => { setVpEditText(vpText); setVpEditing(true); setVpError(null); setVpSuccess(null); }}
                        >
                          Edit
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={handleVpSave}
                        disabled={vpSaving}
                      >
                        {vpSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => { setVpEditing(false); setVpEditText(vpText); setVpError(null); }}
                        disabled={vpSaving}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ================================================================ */}
      {/*  TEAM TAB                                                        */}
      {/* ================================================================ */}
      {tab === "team" && showTeamTab ? (
        <div className="card" style={{ padding: "24px 28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Team</h2>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
              Invite fitters, managers, and estimators to your BillyBot account.
            </p>
          </div>

          {teamLoading && <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "16px" }}>Loading team…</p>}
          {teamError && (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px" }}>
              {teamError}
            </p>
          )}

          {!teamLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
                  Invite a team member
                </p>
                <InviteForm />
              </div>

              {(teamMembers.length > 0 || teamInvites.length > 0) ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                      Team members
                    </p>
                    {teamMembers.filter(m => m.invite_status !== "revoked").length > 0 && (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
                        {teamMembers.filter(m => m.invite_status !== "revoked").length}
                      </span>
                    )}
                    {teamInvites.length > 0 && (
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.2)" }}>
                        {teamInvites.length} pending
                      </span>
                    )}
                  </div>
                  <TeamMemberList members={teamMembers} pendingInvites={teamInvites} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* ================================================================ */}
      {/*  SECURITY TAB                                                    */}
      {/* ================================================================ */}
      {tab === "security" ? (
        <div className="card" style={{ padding: "24px 28px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Password &amp; Security</h2>
            <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Change your password to keep your account secure.</p>
          </div>

          <form onSubmit={handleChangePassword} className="form-stack">
            {authProvider === "email" ? (
              <div className="form-field">
                <label className="form-label" htmlFor="current_password">Current password (optional)</label>
                <input id="current_password" type="password" className="chat-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" disabled={passwordSaving} />
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
                <input id="new_password" type="password" className="chat-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} disabled={passwordSaving} />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="confirm_new_password">Confirm new password</label>
                <input id="confirm_new_password" type="password" className="chat-input" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} disabled={passwordSaving} />
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
              <button className="btn btn-primary" type="submit" disabled={passwordSaving || (authProvider === "email" && !userEmail)}>
                {passwordSaving ? "Updating…" : "Change password"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* ================================================================ */}
      {/*  SUPPORT TAB                                                     */}
      {/* ================================================================ */}
      {tab === "support" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Feature requests */}
          <div className="card" style={{ padding: "24px 28px" }}>
            <div style={{ marginBottom: "16px" }}>
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>Feature Requests</h2>
              <p style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                Tell us what you&apos;d like BillyBot to improve or add next.
              </p>
            </div>

            <form className="form-stack" onSubmit={handleRequestSubmit}>
              <div className="form-field">
                <textarea
                  className="chat-input"
                  placeholder="Describe your request…"
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  rows={4}
                  style={{ resize: "vertical", minHeight: "100px" }}
                />
              </div>

              {requestError && (
                <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
                  {requestError}
                </p>
              )}

              {requestSuccess && (
                <p style={{ fontSize: "13px", color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
                  {requestSuccess}
                </p>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={requestSubmitting}>
                  {requestSubmitting ? "Submitting…" : "Submit request"}
                </button>
              </div>
            </form>
          </div>

          {/* Help / support */}
          <HelpSection />
        </div>
      ) : null}
    </div>
  );
}
