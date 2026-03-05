"use client";

import { useRouter } from "next/navigation";

interface EmailDraftData {
  customer_name?: string;
  customer_email?: string;
  job_id: string;
  job_title?: string;
  subject?: string;
}

export default function EmailDraftCard({ data }: { data: EmailDraftData }) {
  const router = useRouter();

  return (
    <div
      style={{
        width: "min(380px, 100%)",
        borderRadius: "14px",
        border: "1px solid rgba(251, 146, 60, 0.4)",
        background: "linear-gradient(135deg, rgba(251, 146, 60, 0.08) 0%, rgba(234, 88, 12, 0.04) 100%)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <p
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#fb923c",
          margin: 0,
        }}
      >
        ✉️ DRAFT EMAIL REPLY
      </p>

      {data.customer_name && (
        <p style={{ fontSize: "14px", fontWeight: 600, color: "#fff", margin: 0 }}>
          {data.customer_name}
        </p>
      )}

      {data.subject && (
        <p
          style={{
            fontSize: "13px",
            color: "#94a3b8",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {data.subject}
        </p>
      )}

      <button
        onClick={() => router.push(`/jobs/${data.job_id}?tab=emails`)}
        style={{
          marginTop: "4px",
          padding: "10px 18px",
          borderRadius: "10px",
          border: "none",
          background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(251, 146, 60, 0.3)",
        }}
      >
        Review & Send →
      </button>
    </div>
  );
}
