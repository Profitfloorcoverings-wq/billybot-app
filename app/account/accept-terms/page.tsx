"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { acceptTerms } from "./actions";

const TERMS_SECTIONS = [
  {
    title: "Introduction and Acceptance of Terms",
    body:
      "These Terms of Service govern your access to and use of BillyBot, an AI " +
      "automation platform built to help tradespeople manage quoting, " +
      "messaging, and workflow tasks. By using BillyBot, you agree to these " +
      "terms and any additional policies referenced here.",
  },
  {
    title: "Description of Service",
    body:
      "BillyBot provides an AI-powered quoting assistant, automation tools, " +
      "customer messaging, and related features designed to streamline your " +
      "operations. The service may integrate with third-party platforms to " +
      "send messages, generate quotes, and automate routine tasks.",
  },
  {
    title: "No Guarantee of Accuracy of AI Outputs",
    body:
      "BillyBot uses AI to generate content such as quotes, responses, and " +
      "recommendations. AI outputs may contain errors, omissions, or " +
      "outdated information. BillyBot does not guarantee the accuracy, " +
      "completeness, or suitability of any AI-generated content.",
  },
  {
    title: "User Responsibility",
    body:
      "You must review and verify all AI-generated quotes, prices, job " +
      "details, and messages before sharing them with customers or taking " +
      "action. BillyBot is an assistive tool. You hold final responsibility " +
      "for ensuring the accuracy of all outputs and for any decisions made " +
      "using the service.",
  },
  {
    title: "Liability Limitation",
    body:
      "BillyBot cannot be held responsible for financial loss, lost revenue, " +
      "reputational damage, or other harm resulting from inaccurate quotes, " +
      "automation errors, or misuse of the service. To the fullest extent " +
      "permitted by law, BillyBot disclaims all liability for any indirect, " +
      "incidental, consequential, or special damages. You accept all risks " +
      "associated with relying on AI-generated outputs and automations.",
  },
  {
    title: "Billing and Subscription Terms",
    body:
      "Access to certain features may require a paid subscription. Fees, " +
      "billing cycles, and payment methods will be presented during checkout " +
      "or within your account settings. By subscribing, you authorize " +
      "recurring charges until you cancel. Applicable taxes may be added.",
  },
  {
    title: "Cancellation and Refunds",
    body:
      "You may cancel your subscription at any time through your account " +
      "settings. Cancellations take effect at the end of the current billing " +
      "period. Unless required by law, fees already paid are non-refundable. " +
      "Any exceptions will be stated at the point of purchase or in your " +
      "plan details.",
  },
  {
    title: "Data Usage",
    body:
      "To provide the service, BillyBot may process customer details, " +
      "project information, messages, and operational data you supply. Data " +
      "handling practices are described in our Privacy Policy. You are " +
      "responsible for ensuring you have the right to share any data you " +
      "submit.",
  },
  {
    title: "Prohibited Actions",
    body:
      "You agree not to misuse the service, including by attempting to " +
      "access other users' data, reverse-engineering the platform, sending " +
      "spam or unlawful messages, or using BillyBot in violation of " +
      "applicable laws and regulations.",
  },
  {
    title: "Termination",
    body:
      "We may suspend or terminate your access if you violate these terms or " +
      "misuse the service. You may also terminate your account at any time " +
      "through your settings. Upon termination, your right to use BillyBot " +
      "ends, but any payment obligations accrued before termination remain " +
      "due.",
  },
  {
    title: "Governing Law",
    body:
      "These terms are governed by the laws of the United Kingdom, without " +
      "regard to conflict of law principles. Any disputes will be subject to " +
      "the exclusive jurisdiction of the courts of the United Kingdom.",
  },
  {
    title: "Contact Information",
    body: "If you have questions about these terms, please contact the BillyBot team at support@billybot.com.",
  },
];

const PRIVACY_SECTIONS = [
  {
    title: "What Personal Data We Collect",
    body:
      "We collect account details (name, email, company), authentication " +
      "information, billing details, and any customer or project " +
      "information you provide while using BillyBot.",
  },
  {
    title: "How Supabase and Stripe Are Used",
    body:
      "Supabase is used for authentication, database storage, and managing " +
      "user sessions. Stripe processes payments and stores billing-related " +
      "information necessary to complete transactions.",
  },
  {
    title: "Messages, Quotes, and Storage",
    body:
      "Messages, quotes, and related job details you enter are stored to " +
      "provide the AI assistant, automation, and communication features. " +
      "This data helps generate responses, draft quotes, and keep history " +
      "for your account.",
  },
  {
    title: "Cookies and Sessions",
    body:
      "We use cookies and session data to keep you signed in, secure your " +
      "account, and remember preferences. Some cookies may be necessary for " +
      "core functionality such as authentication.",
  },
  {
    title: "Why We Collect Data",
    body:
      "Data is collected to operate BillyBot, deliver AI-driven quotes and " +
      "automations, process payments, improve product performance, and " +
      "provide customer support.",
  },
  {
    title: "How We Protect User Data",
    body:
      "We employ industry-standard security measures, including encryption " +
      "in transit, access controls, and monitoring. Access to your data is " +
      "limited to authorized personnel and necessary service providers.",
  },
  {
    title: "Your Rights Under UK GDPR",
    body:
      "Users in the United Kingdom have rights to access, correct, delete, " +
      "or restrict processing of their personal data. You may also object to " +
      "certain processing or request data portability. Contact us to " +
      "exercise these rights.",
  },
  {
    title: "Data Retention",
    body:
      "We retain personal data for as long as necessary to provide the " +
      "service, comply with legal obligations, resolve disputes, and " +
      "enforce agreements. Data may be archived or deleted when no longer " +
      "needed.",
  },
  {
    title: "Third-Party Services",
    body:
      "We rely on third-party providers such as Supabase for hosting and " +
      "authentication, and Stripe for payments. These providers process data " +
      "under their own privacy practices and agreements with us.",
  },
  {
    title: "Contact Information",
    body:
      "For questions about this Privacy Policy or to submit a data request, " +
      "contact support@billybot.com.",
  },
];

export default function AcceptTermsPage() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSeedRetry, setNeedsSeedRetry] = useState(false);
  const [seedContext, setSeedContext] = useState<{ clientId: string; profileId: string } | null>(
    null
  );
  const [accepted, setAccepted] = useState(false);
  const [activeDoc, setActiveDoc] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    setLastUpdated(
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    );
  }, []);

  useEffect(() => {
    if (!activeDoc) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [activeDoc]);

  async function seedBasePrices(clientId: string, profileId: string) {
    const response = await fetch("/api/seed-base-supplier-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, profile_id: profileId }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error ?? "Unable to seed starter prices");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNeedsSeedRetry(false);

    if (!accepted) {
      setError("You must accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setSaving(true);

    try {
      const { clientId, profileId } = await acceptTerms();
      setSeedContext({ clientId, profileId });

      try {
        await seedBasePrices(clientId, profileId);
      } catch (seedError) {
        setNeedsSeedRetry(true);
        throw seedError;
      }

      router.replace("/app/chat");
      // Refresh to force guards to read the latest onboarding flags.
      router.refresh();
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
            <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3 stack gap-3">
              <p>{error}</p>
              {needsSeedRetry && seedContext ? (
                <button
                  type="button"
                  className="btn btn-secondary w-fit"
                  onClick={async () => {
                    setSaving(true);
                    setError(null);
                    try {
                      await seedBasePrices(seedContext.clientId, seedContext.profileId);
                      setNeedsSeedRetry(false);
                      router.replace("/app/chat");
                      // Refresh to force guards to read the latest onboarding flags.
                      router.refresh();
                    } catch (retryError) {
                      setError(
                        retryError && typeof retryError === "object" && "message" in retryError
                          ? String((retryError as { message?: string }).message)
                          : "Unable to seed starter prices"
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                >
                  {saving ? "Retrying..." : "Retry"}
                </button>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="stack gap-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                disabled={saving}
              />
              <span className="text-sm text-[var(--text-secondary)]">
                I have read and agree to the{" "}
                <Link
                  href="/legal/terms"
                  className="text-[var(--primary)] underline"
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveDoc("terms");
                  }}
                  aria-haspopup="dialog"
                >
                  Terms of Service
                </Link>{" "}and{" "}
                <Link
                  href="/legal/privacy"
                  className="text-[var(--primary)] underline"
                  onClick={(event) => {
                    event.preventDefault();
                    setActiveDoc("privacy");
                  }}
                  aria-haspopup="dialog"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Accept and continue"}
            </button>
          </form>
        </div>
      </div>

      {activeDoc ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)] text-[var(--text)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {activeDoc === "terms" ? "Terms of Service" : "Privacy Policy"}
              </h2>
              <button type="button" className="btn btn-secondary" onClick={() => setActiveDoc(null)}>
                Close
              </button>
            </div>
            <div className="h-[70vh] overflow-y-auto px-6 py-5 text-sm text-[var(--muted)]">
              <div className="stack gap-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Last updated: {lastUpdated}
                </p>
                {(activeDoc === "terms" ? TERMS_SECTIONS : PRIVACY_SECTIONS).map((section) => (
                  <section key={section.title} className="stack gap-2">
                    <h3 className="text-base font-semibold text-[var(--text)]">{section.title}</h3>
                    <p>{section.body}</p>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
