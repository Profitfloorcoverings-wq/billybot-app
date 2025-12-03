"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const navItems = [
  { label: "Chat", href: "/chat" },
  { label: "Quotes", href: "/quotes", watchQuotes: true },
  { label: "Jobs", href: "/jobs" },
  { label: "Settings", href: "/settings" },
];

const QUOTES_LAST_VIEWED_KEY = "quotes_last_viewed_at";

export default function Sidebar() {
  const pathname = usePathname();
  const [hasNewQuote, setHasNewQuote] = useState(false);

  const checkLatestQuote = useCallback(async () => {
    try {
      const res = await fetch("/api/quotes?latest=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { latest_created_at?: string | null };
      const latest = data?.latest_created_at;
      if (!latest) {
        setHasNewQuote(false);
        return;
      }

      const lastViewed = localStorage.getItem(QUOTES_LAST_VIEWED_KEY);
      if (!lastViewed) {
        setHasNewQuote(true);
        return;
      }

      setHasNewQuote(new Date(latest).getTime() > new Date(lastViewed).getTime());
    } catch (err) {
      console.error("Sidebar quote check error", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkLatestQuote();
    }, 0);

    return () => clearTimeout(timer);
  }, [checkLatestQuote]);

  useEffect(() => {
    if (pathname === "/quotes") {
      const timer = setTimeout(() => {
        const now = new Date().toISOString();
        localStorage.setItem(QUOTES_LAST_VIEWED_KEY, now);
        void checkLatestQuote();
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [pathname, checkLatestQuote]);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark" />
        <span className="sidebar-logo-text">
          BillyBot<span className="sidebar-logo-trade">™</span>
        </span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const showNew = item.watchQuotes && hasNewQuote && pathname !== item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
              onClick={() => {
                if (item.watchQuotes) {
                  const now = new Date().toISOString();
                  localStorage.setItem(QUOTES_LAST_VIEWED_KEY, now);
                  setHasNewQuote(false);
                }
              }}
            >
              <span className="flex items-center gap-2">
                {item.label}
                {showNew ? <span className="sidebar-new">New quote</span> : null}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-tag">Admin gone. Quotes done.</span>
      </div>
    </aside>
  );
}
