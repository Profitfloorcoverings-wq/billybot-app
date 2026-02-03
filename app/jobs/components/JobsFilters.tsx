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
};

export default function JobsFilters({
  initialSearch,
  initialStatus,
  debugEnabled = false,
  statusOptions,
}: JobsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

  const urlSearchValue = useMemo(() => searchParams.get("search") ?? "", [searchParams]);
  const urlStatusValue = useMemo(
    () => searchParams.get("status") ?? "all",
    [searchParams]
  );

  useEffect(() => {
    setSearch(urlSearchValue);
  }, [urlSearchValue]);

  useEffect(() => {
    setStatus(urlStatusValue);
  }, [urlStatusValue]);

  const updateQueryParams = useCallback(
    (nextSearch?: string, nextStatus?: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (typeof nextSearch === "string") {
        if (nextSearch.trim()) {
          params.set("search", nextSearch);
        } else {
          params.delete("search");
        }
      }

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
    const handle = setTimeout(() => {
      if (search !== urlSearchValue) {
        updateQueryParams(search, undefined);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [search, updateQueryParams, urlSearchValue]);

  useEffect(() => {
    if (status !== urlStatusValue) {
      updateQueryParams(undefined, status);
    }
  }, [status, updateQueryParams, urlStatusValue]);

  return (
    <div className="stack md:row md:items-end md:justify-between gap-3">
      <div className="stack flex-1">
        <p className="section-subtitle">Search</p>
        <input
          className="input-fluid"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
