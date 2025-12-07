"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "billybot_safety_banner_dismissed";

export default function SafetyBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setDismissed(stored === "true");
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <div className="card mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="stack gap-2">
        <p className="section-title text-lg">AI accuracy and safety warning</p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          BillyBot uses AI to assist with quoting and job details. Always verify all prices,
          calculations, materials, and outputs. You are responsible for the final accuracy
          before sending quotes to customers.
        </p>
      </div>
      <button
        type="button"
        className="btn btn-secondary self-start"
        aria-label="Dismiss safety warning"
        onClick={() => {
          setDismissed(true);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, "true");
          }
        }}
      >
        ×
      </button>
    </div>
  );
}
