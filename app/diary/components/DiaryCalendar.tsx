"use client";

import { useCallback, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { enGB } from "date-fns/locale";

import DiaryEntryModal from "./DiaryEntryModal";
import type { DiaryEntry } from "@/types/diary";

const locales = { "en-GB": enGB };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const entryTypeColours: Record<string, string> = {
  prep: "#f59e0b",
  fitting: "#38bdf8",
  survey: "#22c55e",
  other: "#64748b",
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: DiaryEntry;
};

type Props = {
  initialEntries: DiaryEntry[];
};

function entryToEvent(entry: DiaryEntry): CalendarEvent {
  return {
    id: entry.id,
    title: entry.title,
    start: new Date(entry.start_datetime),
    end: new Date(entry.end_datetime),
    resource: entry,
  };
}

export default function DiaryCalendar({ initialEntries }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");

  const events = entries.map(entryToEvent);

  const eventPropGetter = useCallback(
    (event: CalendarEvent) => {
      const colour = entryTypeColours[event.resource.entry_type] ?? "#64748b";
      return {
        style: {
          backgroundColor: colour,
          borderColor: colour,
          color: "#0f172a",
          fontWeight: 600,
          fontSize: "0.75rem",
        },
      };
    },
    []
  );

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setEditingEntry(event.resource);
    setModalOpen(true);
  }, []);

  const handleAddEntry = useCallback(() => {
    setEditingEntry(null);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingEntry(null);
  }, []);

  const handleEntrySaved = useCallback(
    async (saved: DiaryEntry) => {
      // Refresh entries for the current visible month
      const start = startOfMonth(currentDate).toISOString();
      const end = endOfMonth(currentDate).toISOString();

      try {
        const res = await fetch(
          `/api/diary/entries?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as { entries: DiaryEntry[] };
          setEntries(data.entries ?? []);
        } else {
          // Optimistic update
          setEntries((prev) => {
            const idx = prev.findIndex((e) => e.id === saved.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = saved;
              return next;
            }
            return [...prev, saved];
          });
        }
      } catch {
        // Optimistic fallback
        setEntries((prev) => {
          const idx = prev.findIndex((e) => e.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [...prev, saved];
        });
      }

      setModalOpen(false);
      setEditingEntry(null);
    },
    [currentDate]
  );

  const handleNavigate = useCallback(
    async (date: Date) => {
      setCurrentDate(date);
      const start = startOfMonth(date).toISOString();
      const end = endOfMonth(date).toISOString();

      try {
        const res = await fetch(
          `/api/diary/entries?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
          { cache: "no-store" }
        );
        if (res.ok) {
          const data = (await res.json()) as { entries: DiaryEntry[] };
          setEntries(data.entries ?? []);
        }
      } catch (err) {
        console.error("[DiaryCalendar] fetch error", err);
      }
    },
    []
  );

  return (
    <div className="diary-calendar-wrapper">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                view === v
                  ? "bg-[var(--brand1)] text-[var(--neutral-900)]"
                  : "bg-[rgba(255,255,255,0.06)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddEntry}
          className="btn btn-primary text-sm"
        >
          + Add entry
        </button>
      </div>

      <div className="diary-calendar-container rounded-2xl border border-[var(--line)] bg-[rgba(6,10,20,0.8)] p-2 overflow-hidden">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={(v) => setView(v as "month" | "week" | "day")}
          date={currentDate}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          style={{ height: 620 }}
          culture="en-GB"
          popup
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {Object.entries(entryTypeColours).map(([type, colour]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span
              className="inline-block w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: colour }}
            />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <DiaryEntryModal
          entry={editingEntry}
          onClose={handleModalClose}
          onSaved={handleEntrySaved}
        />
      ) : null}
    </div>
  );
}
