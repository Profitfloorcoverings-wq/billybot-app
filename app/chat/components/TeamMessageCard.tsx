"use client";

import Link from "next/link";

type FileAttachment = {
  name: string;
  type: string;
  url: string;
};

type TeamMessageData = {
  sender_name: string;
  sender_id: string;
  sender_role: string;
  message: string;
  job_id?: string | null;
  job_title?: string | null;
  sent_at: string;
  files?: FileAttachment[];
};

type Props = {
  data: TeamMessageData;
};

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  owner:     { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  manager:   { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
  fitter:    { bg: "rgba(249,115,22,0.12)", text: "#f97316", border: "rgba(249,115,22,0.25)" },
  estimator: { bg: "rgba(34,197,94,0.12)",  text: "#4ade80", border: "rgba(34,197,94,0.25)"  },
};

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) +
    " · " +
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TeamMessageCard({ data }: Props) {
  const role = data.sender_role || "fitter";
  const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.fitter;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const isOwnerOrManager = role === "owner" || role === "manager";

  const images = (data.files ?? []).filter((f) => isImage(f.type));
  const otherFiles = (data.files ?? []).filter((f) => !isImage(f.type));

  return (
    <div style={{
      width: "min(420px, 100%)",
      borderRadius: "16px",
      border: "1px solid rgba(148,163,184,0.12)",
      borderLeft: `3px solid ${isOwnerOrManager ? "#38bdf8" : "#f97316"}`,
      background: "rgba(13,21,39,0.95)",
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}>

      {/* Header: sender name + role badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9" }}>
          {data.sender_name}
        </span>
        <span style={{
          fontSize: "10px", fontWeight: 700, padding: "2px 8px",
          borderRadius: "999px", letterSpacing: "0.06em", textTransform: "uppercase",
          background: roleStyle.bg, color: roleStyle.text, border: `1px solid ${roleStyle.border}`,
        }}>
          {roleLabel}
        </span>
      </div>

      {/* Message body */}
      <p style={{ fontSize: "14px", color: "#e2e8f0", margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {data.message}
      </p>

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <a
              key={i}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", borderRadius: "10px", overflow: "hidden" }}
            >
              <img
                src={img.url}
                alt={img.name}
                style={{
                  maxWidth: "180px",
                  maxHeight: "140px",
                  objectFit: "cover",
                  borderRadius: "10px",
                  border: "1px solid rgba(148,163,184,0.15)",
                }}
              />
            </a>
          ))}
        </div>
      )}

      {/* Non-image file links */}
      {otherFiles.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {otherFiles.map((file, i) => (
            <a
              key={i}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "12px", color: "#38bdf8", textDecoration: "none",
                padding: "4px 10px", borderRadius: "8px",
                background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)",
              }}
            >
              {file.name}
            </a>
          ))}
        </div>
      )}

      {/* Job link + timestamp */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        {data.job_id ? (
          <Link
            href={`/jobs/${data.job_id}`}
            style={{ fontSize: "12px", color: "#64748b", textDecoration: "none" }}
          >
            Re: {data.job_title || "View job"} →
          </Link>
        ) : (
          <span />
        )}
        <span style={{ fontSize: "11px", color: "#475569" }}>
          {formatTime(data.sent_at)}
        </span>
      </div>
    </div>
  );
}
