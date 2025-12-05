"use client";

import { useCallback, useState } from "react";

const DEMO_CLIENT_ID = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

export default function AccountPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManageSubscription = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/manage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clientId: DEMO_CLIENT_ID }),
      });

      if (!response.ok) {
        throw new Error("Unable to start billing portal session. Please try again.");
      }

      const { url } = (await response.json()) as { url?: string };

      if (!url) {
        throw new Error("No billing portal URL returned. Please contact support.");
      }

      window.location.href = url;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12 text-gray-900">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Account &amp; Billing</h1>
        <p className="text-gray-600">Manage your subscription and billing details.</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-gray-700">
          Access your subscription settings, update payment methods, and view your invoices
          through the Stripe billing portal.
        </p>
        <button
          type="button"
          onClick={handleManageSubscription}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {isLoading ? "Loading..." : "Manage Subscription"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
