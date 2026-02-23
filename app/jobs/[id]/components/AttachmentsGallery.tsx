"use client";

import { useMemo, useState } from "react";

import { formatBytes, formatTimestamp, looksLikeImage } from "./helpers";
import type { JobPageData } from "./types";

export default function AttachmentsGallery({ attachments }: { attachments: JobPageData["attachments"] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const imageAttachments = useMemo(
    () => attachments.filter((file) => looksLikeImage(file.mimeType, file.name) && file.url),
    [attachments]
  );

  if (!attachments.length) {
    return <div className="empty-state">No attachments were found in this email thread.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
        {attachments.map((file) => {
          const isImage = looksLikeImage(file.mimeType, file.name);
          return (
            <article
              key={file.id}
              style={{
                borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)", padding: "14px 16px",
              }}
            >
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </p>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                {file.mimeType || "Unknown type"} · {formatBytes(file.size)}
              </p>
              <p style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                Received {formatTimestamp(file.receivedAt)}
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                {isImage && file.url && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                    onClick={() => {
                      const idx = imageAttachments.findIndex((image) => image.id === file.id);
                      setActiveIndex(idx >= 0 ? idx : null);
                    }}
                  >
                    Preview
                  </button>
                )}
                {file.url ? (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: "6px 12px", fontSize: "12px" }}
                  >
                    Download
                  </a>
                ) : (
                  <span style={{ fontSize: "12px", color: "#64748b" }}>No link available</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {activeIndex !== null && imageAttachments[activeIndex] && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.85)", padding: "16px",
        }}>
          <div style={{
            position: "relative", width: "100%", maxWidth: "1000px",
            borderRadius: "20px", border: "1px solid rgba(148,163,184,0.15)",
            background: "#020617", padding: "16px",
          }}>
            <img
              src={imageAttachments[activeIndex].url || ""}
              alt={imageAttachments[activeIndex].name}
              style={{ maxHeight: "75vh", width: "100%", borderRadius: "12px", objectFit: "contain" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 16px" }}
                onClick={() => setActiveIndex((v) => (v && v > 0 ? v - 1 : v))}
                disabled={activeIndex === 0}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                {activeIndex + 1} / {imageAttachments.length}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 16px" }}
                onClick={() => setActiveIndex((v) => (v !== null && v < imageAttachments.length - 1 ? v + 1 : v))}
                disabled={activeIndex >= imageAttachments.length - 1}
              >
                Next →
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "8px 16px" }}
                onClick={() => setActiveIndex(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
