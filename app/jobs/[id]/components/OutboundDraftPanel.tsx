"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  jobId: string;
  initialSubject: string | null;
  initialBody: string | null;
};

export default function OutboundDraftPanel({ jobId, initialSubject, initialBody }: Props) {
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [dismissed, setDismissed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save draft on change (debounced 1.5s)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("idle");
    saveTimer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await fetch(`/api/jobs/${jobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outbound_email_subject: subject, outbound_email_body: body }),
        });
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("idle");
      }
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body]);

  async function handleSend() {
    setSendState("sending");
    try {
      const res = await fetch(`/api/jobs/${jobId}/send-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) {
        setSendState("error");
        setTimeout(() => setSendState("idle"), 3000);
        return;
      }
      setSendState("sent");
    } catch {
      setSendState("error");
      setTimeout(() => setSendState("idle"), 3000);
    }
  }

  if (dismissed || sendState === "sent") {
    return (
      <div style={{
        background: "rgba(52,211,153,0.08)",
        border: "1px solid rgba(52,211,153,0.25)",
        borderRadius: "14px",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "14px",
        color: "#34d399",
        fontWeight: 600,
      }}>
        <span>✓</span>
        {sendState === "sent" ? "Email sent successfully." : "Draft dismissed."}
      </div>
    );
  }

  return (
    <section style={{
      background: "linear-gradient(135deg, rgba(249,115,22,0.08) 0%, rgba(249,115,22,0.03) 100%)",
      border: "1px solid rgba(249,115,22,0.3)",
      borderRadius: "14px",
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>✉️</span>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#fb923c", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Draft reply ready
            </p>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>
              BillyBot wrote this — review and send, or edit first
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "16px", padding: "4px", lineHeight: 1 }}
          aria-label="Dismiss draft"
        >
          ×
        </button>
      </div>

      {/* Subject */}
      <div>
        <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(249,115,22,0.25)",
            background: "rgba(15,23,42,0.6)",
            color: "#f1f5f9",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Body */}
      <div>
        <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "6px" }}>
          Body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(249,115,22,0.25)",
            background: "rgba(15,23,42,0.6)",
            color: "#e2e8f0",
            fontSize: "13px",
            lineHeight: 1.65,
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", color: "#475569" }}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : ""}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{
              padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
              background: "rgba(148,163,184,0.1)", color: "#94a3b8",
              border: "1px solid rgba(148,163,184,0.2)", cursor: "pointer",
            }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sendState === "sending" || !body.trim()}
            style={{
              padding: "8px 20px", borderRadius: "8px", fontSize: "13px", fontWeight: 700,
              background: sendState === "error" ? "#f87171" : sendState === "sending" ? "rgba(249,115,22,0.4)" : "#fb923c",
              color: "#0f172a",
              border: "none", cursor: sendState === "sending" ? "not-allowed" : "pointer",
            }}
          >
            {sendState === "sending" ? "Sending…" : sendState === "error" ? "Failed — retry?" : "Send email ↗"}
          </button>
        </div>
      </div>
    </section>
  );
}
