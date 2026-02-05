"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Attachments</CardTitle>
          <Button asChild size="sm">
            <a href={requestHref}>Request photos</a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-4">
        {attachments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-center">
            <span className="text-2xl">📷</span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">No photos/docs yet</p>
              <p className="text-xs text-[var(--muted)]">
                Ask the customer for site photos or documents to unblock quoting.
              </p>
            </div>
            <Button asChild>
              <a href={requestHref}>Request photos</a>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachments.map((attachment) => (
              <button
                key={attachment.url}
                type="button"
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-left"
                onClick={() => setActive(attachment)}
              >
                <img
                  src={attachment.url}
                  alt={attachment.name ?? "Attachment"}
                  className="h-24 w-full rounded-lg object-cover"
                />
                <div className="mt-2 text-xs text-white line-clamp-1">
                  {attachment.name ?? "Attachment"}
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>

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
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="absolute right-4 top-4"
              onClick={() => setActive(null)}
            >
              Close
            </Button>
            <img
              src={active.url}
              alt={active.name ?? "Attachment"}
              className="max-h-[80vh] w-full object-contain"
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
