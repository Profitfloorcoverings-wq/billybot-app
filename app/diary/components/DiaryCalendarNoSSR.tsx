"use client";

import dynamic from "next/dynamic";
import type { DiaryEntry } from "@/types/diary";

const DiaryCalendar = dynamic(() => import("./DiaryCalendar"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[680px] text-[var(--muted)] text-sm">
      Loading calendar…
    </div>
  ),
});

export default function DiaryCalendarNoSSR({ initialEntries }: { initialEntries: DiaryEntry[] }) {
  return <DiaryCalendar initialEntries={initialEntries} />;
}
