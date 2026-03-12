"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatBytes, formatTimestamp, looksLikeImage } from "./helpers";
import type { JobPageData } from "./types";

type Attachment = JobPageData["attachments"][number];

function downloadBase64File(file: Attachment) {
  if (!file.url) return;
  const a = document.createElement("a");
  a.href = file.url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function AttachmentsGallery({ attachments }: { attachments: JobPageData["attachments"] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const imageAttachments = useMemo(
    () => attachments.filter((file) => looksLikeImage(file.mimeType, file.name) && file.url),
    [attachments]
  );

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (activeIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveIndex(null);
      if (e.key === "ArrowLeft") setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") setActiveIndex((i) => (i !== null && i < imageAttachments.length - 1 ? i + 1 : i));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, imageAttachments.length]);

  const handleDownload = useCallback((file: Attachment) => {
    if (file.base64 || file.url?.startsWith("data:")) {
      downloadBase64File(file);
    } else if (file.url) {
      window.open(file.url, "_blank");
    }
  }, []);

  if (!attachments.length) {
    return <div className="empty-state">No attachments were found in this email thread.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
        {attachments.map((file) => {
          const isImage = looksLikeImage(file.mimeType, file.name);
          const hasUrl = !!file.url;
          return (
            <article
              key={file.id}
              style={{
                borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)", overflow: "hidden",
              }}
            >
              {/* Image thumbnail */}
              {isImage && hasUrl && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = imageAttachments.findIndex((image) => image.id === file.id);
                    setActiveIndex(idx >= 0 ? idx : null);
                  }}
                  style={{
                    display: "block", width: "100%", background: "rgba(0,0,0,0.3)",
                    border: "none", padding: 0, cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <img
                    src={file.url!}
                    alt={file.name}
                    style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}
                  />
                </button>
              )}

              {/* Non-image file icon */}
              {!isImage && (
                <div style={{
                  height: "80px", display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.06)",
                  fontSize: "28px", color: "#475569",
                }}>
                  {file.mimeType?.includes("pdf") ? "📄" : "📎"}
                </div>
              )}

              <div style={{ padding: "12px 14px" }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {file.name}
                </p>
                <p style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                  {file.mimeType || "Unknown type"} · {formatBytes(file.size)}
                </p>
                {file.receivedAt && (
                  <p style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    Received {formatTimestamp(file.receivedAt)}
                  </p>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  {isImage && hasUrl && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                      onClick={() => {
                        const idx = imageAttachments.findIndex((image) => image.id === file.id);
                        setActiveIndex(idx >= 0 ? idx : null);
                      }}
                    >
                      Preview
                    </button>
                  )}
                  {hasUrl ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                      onClick={() => handleDownload(file)}
                    >
                      Download
                    </button>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#64748b" }}>No link available</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {activeIndex !== null && imageAttachments[activeIndex] && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.9)", padding: "16px",
          }}
          onClick={() => setActiveIndex(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
            position: "relative", width: "100%", maxWidth: "1000px",
            borderRadius: "20px", border: "1px solid rgba(148,163,184,0.15)",
            background: "#020617", padding: "16px",
          }}>
            <img
              src={imageAttachments[activeIndex].url || ""}
              alt={imageAttachments[activeIndex].name}
              style={{ maxHeight: "75vh", width: "100%", borderRadius: "12px", objectFit: "contain" }}
            />
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "8px 0 0", textAlign: "center" }}>
              {imageAttachments[activeIndex].name}
            </p>
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
                onClick={() => handleDownload(imageAttachments[activeIndex!])}
              >
                Download
              </button>
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
