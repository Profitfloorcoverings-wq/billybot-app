"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import { getSession } from "@/utils/supabase/session";

const navItems = [
  { label: "Chat", href: "/chat" },
  { label: "Quotes", href: "/quotes", watchQuotes: true },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Customers", href: "/customers" },
  { label: "Pricing", href: "/pricing" },
  { label: "Requests", href: "/requests" },
  { label: "Account", href: "/account" },
];

const QUOTES_LAST_VIEWED_KEY = "quotes_last_viewed_at";

export default function Sidebar() {
  const pathname = usePathname();
  const [hasNewQuote, setHasNewQuote] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    async function syncSession() {
      const session = await getSession();

      if (!isMounted) return;

      setIsAuthenticated(!!session?.user);
    }

    void syncSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const showNav = !!isAuthenticated;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg
          className="sidebar-logo-mark"
          width="38"
          height="38"
          viewBox="0 0 38 38"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id="billybot-logo-gradient" x1="6" y1="2" x2="32" y2="36">
              <stop offset="0%" stopColor="var(--brand1)" />
              <stop offset="100%" stopColor="var(--brand2)" />
            </linearGradient>
          </defs>
          <circle cx="19" cy="19" r="18" fill="url(#billybot-logo-gradient)" />
          <circle
            cx="19"
            cy="19"
            r="12"
            stroke="rgba(255, 255, 255, 0.7)"
            strokeWidth="2"
          />
          <path
            d="M16 12.5H21.4C23.7 12.5 25.5 14.2 25.5 16.3C25.5 18.4 23.7 20.1 21.4 20.1H16V12.5Z"
            fill="rgba(255, 255, 255, 0.95)"
          />
          <path
            d="M16 20.1H22.2C24.7 20.1 26.7 21.9 26.7 24.2C26.7 26.4 24.7 28.2 22.2 28.2H16V20.1Z"
            fill="rgba(255, 255, 255, 0.95)"
          />
        </svg>
        <span className="sidebar-logo-text">
          BillyBot<span className="sidebar-logo-trade">™</span>
        </span>
      </div>

      {showNav ? (
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
                <span className="sidebar-link-inner">
                  <span>{item.label}</span>
                  {showNew ? <span className="sidebar-new-dot" aria-hidden="true" /> : null}
                </span>
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="sidebar-footer">
        <span className="sidebar-tag">Admin gone. Quotes done.</span>
      </div>
    </aside>
  );
}
