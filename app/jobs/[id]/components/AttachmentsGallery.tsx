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
    <div className="stack gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {attachments.map((file, index) => {
          const isImage = looksLikeImage(file.mimeType, file.name);
          return (
            <article key={file.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="line-clamp-1 text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs text-[var(--muted)]">{file.mimeType || "Unknown type"} · {formatBytes(file.size)}</p>
              <p className="text-xs text-[var(--muted)]">From email {formatTimestamp(file.receivedAt)}</p>
              <div className="mt-3 flex gap-2">
                {isImage && file.url ? (
                  <button
                    type="button"
                    className="btn btn-secondary h-8 px-3 text-xs"
                    onClick={() => {
                      const idx = imageAttachments.findIndex((image) => image.id === file.id);
                      setActiveIndex(idx >= 0 ? idx : null);
                    }}
                  >
                    Preview
                  </button>
                ) : null}
                {file.url ? (
                  <a href={file.url} target="_blank" rel="noreferrer" className="btn btn-secondary h-8 px-3 text-xs">
                    Open / Download
                  </a>
                ) : (
                  <span className="text-xs text-[var(--muted)]">No file URL available</span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {activeIndex !== null && imageAttachments[activeIndex] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-5xl rounded-2xl border border-white/15 bg-slate-950 p-4">
            <img
              src={imageAttachments[activeIndex].url || ""}
              alt={imageAttachments[activeIndex].name}
              className="max-h-[75vh] w-full rounded-xl object-contain"
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                className="btn btn-secondary h-9 px-3"
                onClick={() => setActiveIndex((value) => (value && value > 0 ? value - 1 : value))}
                disabled={activeIndex === 0}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn btn-secondary h-9 px-3"
                onClick={() => setActiveIndex((value) => (value !== null && value < imageAttachments.length - 1 ? value + 1 : value))}
                disabled={activeIndex >= imageAttachments.length - 1}
              >
                Next
              </button>
              <button type="button" className="btn btn-primary h-9 px-3" onClick={() => setActiveIndex(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
