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
    <div className="stack md:row md:items-end md:justify-between gap-3">
      <div className="stack flex-1">
        <p className="section-subtitle">Search</p>
        <input
          className="input-fluid"
          value={search}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSearch(nextValue);
            onSearchChange?.(nextValue);
          }}
          placeholder="Search by job title, customer name, or email"
        />
      </div>
      <div className="stack min-w-[200px]">
        <p className="section-subtitle">Status</p>
        <select
          className="input-fluid"
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
