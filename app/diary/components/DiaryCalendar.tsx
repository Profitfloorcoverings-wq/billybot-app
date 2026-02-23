"use client";

import { useCallback, useState } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  endOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
  addMonths,
  addWeeks,
  addDays,
  subMonths,
  subWeeks,
  subDays,
} from "date-fns";
import { enGB } from "date-fns/locale";

import DiaryEntryModal from "./DiaryEntryModal";
import DiaryEntryDetailModal from "./DiaryEntryDetailModal";
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

const entryTypeLabels: Record<string, string> = {
  prep: "Prep",
  fitting: "Fitting",
  survey: "Survey",
  other: "Other",
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: DiaryEntry;
};

type Props = { initialEntries: DiaryEntry[] };

function entryToEvent(entry: DiaryEntry): CalendarEvent {
  return {
    id: entry.id,
    title: entry.title,
    start: new Date(entry.start_datetime),
    end: new Date(entry.end_datetime),
    resource: entry,
  };
}

function formatPeriodLabel(date: Date, view: "month" | "week" | "day"): string {
  if (view === "month") return format(date, "MMMM yyyy");
  if (view === "week") {
    const s = startOfWeek(date, { weekStartsOn: 1 });
    const e = endOfWeek(date, { weekStartsOn: 1 });
    if (s.getMonth() === e.getMonth()) return `${format(s, "d")}–${format(e, "d MMM yyyy")}`;
    return `${format(s, "d MMM")} – ${format(e, "d MMM yyyy")}`;
  }
  return format(date, "EEEE, d MMMM yyyy");
}

export default function DiaryCalendar({ initialEntries }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>(initialEntries);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [detailEntry, setDetailEntry] = useState<DiaryEntry | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");

  const events = entries.map(entryToEvent);

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const colour = entryTypeColours[event.resource.entry_type] ?? "#64748b";
    return {
      style: {
        backgroundColor: colour + "22",
        borderLeft: `3px solid ${colour}`,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        borderRadius: "5px",
        color: colour,
        fontWeight: 700,
        fontSize: "0.72rem",
        padding: "2px 6px",
      },
    };
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setDetailEntry(event.resource);
  }, []);

  const handleAddEntry = useCallback(() => {
    setEditingEntry(null);
    setModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setEditingEntry(null);
  }, []);

  const handleDetailClose = useCallback(() => setDetailEntry(null), []);

  const handleDetailEdit = useCallback(() => {
    if (detailEntry) {
      setEditingEntry(detailEntry);
      setDetailEntry(null);
      setModalOpen(true);
    }
  }, [detailEntry]);

  const fetchEntries = useCallback(async (date: Date) => {
    const start = startOfMonth(date).toISOString();
    const end = endOfMonth(date).toISOString();
    try {
      const res = await fetch(`/api/diary/entries?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { entries: DiaryEntry[] };
        setEntries(data.entries ?? []);
      }
    } catch (err) {
      console.error("[DiaryCalendar] fetch error", err);
    }
  }, []);

  const handleEntrySaved = useCallback(async (saved: DiaryEntry) => {
    await fetchEntries(currentDate);
    if (!entries.find(e => e.id === saved.id)) {
      setEntries(prev => [...prev, saved]);
    }
    setModalOpen(false);
    setEditingEntry(null);
  }, [currentDate, entries, fetchEntries]);

  const handleNavigate = useCallback(async (date: Date) => {
    setCurrentDate(date);
    await fetchEntries(date);
  }, [fetchEntries]);

  const handlePrev = useCallback(() => {
    const next = view === "month" ? subMonths(currentDate, 1)
      : view === "week" ? subWeeks(currentDate, 1)
      : subDays(currentDate, 1);
    setCurrentDate(next);
    void fetchEntries(next);
  }, [view, currentDate, fetchEntries]);

  const handleNext = useCallback(() => {
    const next = view === "month" ? addMonths(currentDate, 1)
      : view === "week" ? addWeeks(currentDate, 1)
      : addDays(currentDate, 1);
    setCurrentDate(next);
    void fetchEntries(next);
  }, [view, currentDate, fetchEntries]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    void fetchEntries(today);
  }, [fetchEntries]);

  // Style helpers
  const navBtn = {
    width: "32px", height: "32px", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.15)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: "16px", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease",
    flexShrink: 0 as const,
  };

  return (
    <div style={{ marginTop: "8px" }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" as const }}>

        {/* Left: nav + period label */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button type="button" onClick={handlePrev} style={navBtn} aria-label="Previous">‹</button>
          <button type="button" onClick={handleToday} style={{
            height: "32px", padding: "0 12px", borderRadius: "8px", border: "1px solid rgba(148,163,184,0.15)",
            background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: "12px", fontWeight: 600,
            cursor: "pointer", letterSpacing: "0.02em", transition: "all 0.15s ease",
          }}>Today</button>
          <button type="button" onClick={handleNext} style={navBtn} aria-label="Next">›</button>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", marginLeft: "8px", whiteSpace: "nowrap" as const }}>
            {formatPeriodLabel(currentDate, view)}
          </span>
        </div>

        {/* Right: view switcher + add button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
            {(["month", "week", "day"] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} style={{
                padding: "5px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                border: "none", transition: "all 0.15s ease",
                background: view === v ? "#38bdf8" : "transparent",
                color: view === v ? "#0f172a" : "#64748b",
              }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" onClick={handleAddEntry} className="btn btn-primary" style={{ fontSize: "13px", whiteSpace: "nowrap" as const }}>
            + Add entry
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div style={{
        borderRadius: "16px", border: "1px solid rgba(148,163,184,0.1)",
        background: "rgba(6,10,20,0.6)", overflow: "hidden",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}>
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
          style={{ height: 640 }}
          culture="en-GB"
          popup
          components={{ toolbar: () => null }}
        />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "20px", marginTop: "14px", flexWrap: "wrap" as const }}>
        {Object.entries(entryTypeColours).map(([type, colour]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: colour, flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
              {entryTypeLabels[type] ?? type}
            </span>
          </div>
        ))}
      </div>

      {detailEntry ? (
        <DiaryEntryDetailModal entry={detailEntry} onClose={handleDetailClose} onEdit={handleDetailEdit} />
      ) : null}

      {modalOpen ? (
        <DiaryEntryModal entry={editingEntry} onClose={handleModalClose} onSaved={handleEntrySaved} />
      ) : null}
    </div>
  );
}
