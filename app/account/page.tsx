"use client";

import React, { useState } from "react";

export default function AccountPage() {
  const [error, setError] = useState("");

  async function handleManage() {
    setError("");
    try {
      const res = await fetch("/api/billing/manage", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Unable to start billing portal session. Please try again.");
      }
    } catch (err) {
      setError("Unable to start billing portal session. Please try again.");
    }
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Account &amp; Billing</h1>
          <p className="section-subtitle">
            Manage your subscription and billing details.
          </p>
        </div>
      </div>

      <div className="card stack">
        <p className="section-subtitle">
          Access your subscription settings, update payment methods, and view
          invoices through the Stripe billing portal.
        </p>

        <button className="btn btn-primary" onClick={handleManage}>
          Manage Subscription
        </button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
