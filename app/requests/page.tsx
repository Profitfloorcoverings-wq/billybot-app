"use client";

import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

export default function RequestsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [requestText, setRequestText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const message = requestText.trim();

    if (!message) {
      setError("Please enter a request before submitting.");
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

      const { error: insertError } = await supabase.from("requests").insert({
        user_id: user.id,
        message,
      });

      if (insertError) {
        throw insertError;
      }

      setSuccess("Request submitted. Thank you.");
      setRequestText("");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to submit request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-container standard page container">
      <h1 className="section-title">Requests</h1>
      <p className="section-subtitle">
        Tell us what you'd like BillyBot to improve or add next.
      </p>

      <div className="card">
        <form className="stack" onSubmit={handleSubmit}>
          <textarea
            className="w-full min-h-[140px] resize-none"
            placeholder="Describe your request…"
            value={requestText}
            onChange={(event) => setRequestText(event.target.value)}
          />

          {error ? (
            <p className="text-sm font-medium text-red-300">{error}</p>
          ) : null}

          {success ? (
            <p className="text-sm font-medium text-emerald-300">{success}</p>
          ) : null}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
