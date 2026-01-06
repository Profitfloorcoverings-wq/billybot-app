"use client";

import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const HELP_WEBHOOK_URL = "https://tradiebrain.app.n8n.cloud/webhook/help";

export default function HelpSection() {
  const supabase = useMemo(() => createClient(), []);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const body = message.trim();

    if (!body) {
      setError("Please tell us how we can help before sending.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Unable to verify your session. Please sign in again.");
        return;
      }

      const response = await fetch(HELP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profile_id: user.id,
          body,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to send your message right now.");
      }

      setSuccess("Sent — we’ll get back to you shortly.");
      setMessage("");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Something went wrong. Please try again shortly."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card stack">
      <div className="stack">
        <h2 className="section-title">Help</h2>
        <p className="section-subtitle">
          Requests are for feature ideas or improvements you’d like to see in BillyBot.
        </p>
        <p className="section-subtitle">
          Help is for when you need support right now or something isn’t working.
        </p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="stack text-sm font-medium">
          How can we help?
          <textarea
            className="w-full min-h-[140px] resize-none"
            placeholder="Let us know what’s going on…"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>

        {error ? <p className="text-sm font-medium text-red-300">{error}</p> : null}

        {success ? (
          <p className="text-sm font-medium text-emerald-300">{success}</p>
        ) : null}

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Sending..." : "Send to Support"}
          </button>
        </div>
      </form>
    </div>
  );
}
