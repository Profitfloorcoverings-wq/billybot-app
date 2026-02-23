"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type StatusOption = {
  label: string;
  value: string;
};

type JobsFiltersProps = {
  initialSearch: string;
  initialStatus: string;
  debugEnabled?: boolean;
  statusOptions: StatusOption[];
  onSearchChange?: (value: string) => void;
};

export default function JobsFilters({
  initialSearch,
  initialStatus,
  debugEnabled = false,
  statusOptions,
  onSearchChange,
}: JobsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  const urlStatusValue = useMemo(
    () => searchParams.get("status") ?? "all",
    [searchParams]
  );

  useEffect(() => {
    setStatus(urlStatusValue);
  }, [urlStatusValue]);

  useEffect(() => {
    setSearch(initialSearch);
    onSearchChange?.(initialSearch);
  }, [initialSearch, onSearchChange]);

  const updateQueryParams = useCallback(
    (nextStatus?: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (typeof nextStatus === "string") {
        if (nextStatus && nextStatus !== "all") {
          params.set("status", nextStatus);
        } else {
          params.delete("status");
        }
      }

      if (debugEnabled) {
        params.set("debug", "1");
      }

      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

      if (nextUrl !== currentUrl) {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [debugEnabled, pathname, router, searchParams]
  );

  useEffect(() => {
    if (status !== urlStatusValue) {
      updateQueryParams(status);
    }
  }, [status, updateQueryParams, urlStatusValue]);

  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="form-field" style={{ flex: 1, minWidth: "200px" }}>
        <label className="form-label">Search</label>
        <input
          className="chat-input"
          value={search}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearch(nextValue);
            onSearchChange?.(nextValue);
          }}
          placeholder="Search by title, customer name, or email…"
        />
      </div>
      <div className="form-field" style={{ minWidth: "180px" }}>
        <label className="form-label">Status</label>
        <select
          className="chat-input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {statusOptions.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
