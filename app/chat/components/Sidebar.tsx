"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const navItems = [
  { label: "Chat", href: "/chat" },
  { label: "Quotes", href: "/quotes", watchQuotes: true },
  { label: "Customers", href: "/customers" },
  { label: "Pricing", href: "/pricing" },
  { label: "Account", href: "/account" },
];

const QUOTES_LAST_VIEWED_KEY = "quotes_last_viewed_at";

export default function Sidebar() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
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
    async function syncSession() {
      const { data } = await supabase.auth.getSession();
      setIsAuthenticated(!!data.session?.user);
    }

    void syncSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const showNav = !!isAuthenticated;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mark" />
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
