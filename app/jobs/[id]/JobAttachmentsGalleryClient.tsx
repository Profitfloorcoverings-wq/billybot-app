"use client";

import { useState } from "react";

type Attachment = {
  url: string;
  name?: string;
};

type JobAttachmentsGalleryClientProps = {
  attachments: Attachment[];
  requestHref: string;
};

export default function JobAttachmentsGalleryClient({
  attachments,
  requestHref,
}: JobAttachmentsGalleryClientProps) {
  const [active, setActive] = useState<Attachment | null>(null);

  return (
    <div className="bb-surface stack gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title text-lg">Attachments</h2>
        <a href={requestHref} className="bb-btn bb-btn-primary">
          Request photos
        </a>
      </div>
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
          <span className="text-2xl">📷</span>
          <div className="stack gap-1">
            <p className="text-sm font-semibold text-white">No photos/docs yet</p>
            <p className="text-xs text-[var(--muted)]">
              Ask the customer for site photos or documents to unblock quoting.
            </p>
          </div>
          <a href={requestHref} className="bb-btn bb-btn-primary">
            Request photos
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {attachments.map((attachment) => (
            <button
              key={attachment.url}
              type="button"
              className="bb-inset bb-surface-hover group relative overflow-hidden text-left"
              onClick={() => setActive(attachment)}
            >
              <img
                src={attachment.url}
                alt={attachment.name ?? "Attachment"}
                className="h-24 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-xs text-white line-clamp-1">
                {attachment.name ?? "Attachment"}
              </div>
            </button>
          ))}
        </div>
      )}

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
        >
          <div
            className="relative max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActive(null)}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white"
            >
              Close
            </button>
            <img
              src={active.url}
              alt={active.name ?? "Attachment"}
              className="max-h-[80vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
