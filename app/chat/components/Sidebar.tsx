"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import BillyBotLogo from "./BillyBotLogo";
import { createClient } from "@/utils/supabase/client";
import { getSession } from "@/utils/supabase/session";

type NavItem = {
  label: string;
  href: string;
  watchQuotes?: boolean;
  ownerManagerOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Chat", href: "/chat" },
  { label: "Diary", href: "/diary" },
  { label: "Jobs", href: "/jobs" },
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
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasApp, setHasApp] = useState(false);
  const qrValue = "https://apps.apple.com/gb/app/billybot/id6758058400";

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

      if (session?.user) {
        const [{ data: profile }, { data: pushToken }] = await Promise.all([
          supabase.from("clients").select("user_role").eq("id", session.user.id).maybeSingle(),
          supabase.from("push_tokens").select("profile_id").eq("profile_id", session.user.id).maybeSingle(),
        ]);
        if (isMounted) {
          setUserRole(profile?.user_role ?? "owner");
          setHasApp(!!pushToken);
        }
      }
    }

    void syncSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setIsAuthenticated(!!session?.user);
      if (!session?.user) setUserRole(null);
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const showNav = !!isAuthenticated;
  const showAppBlock = !hasApp;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BillyBotLogo className="h-[38px] w-[38px] flex-none" />
        <span className="sidebar-logo-text">
          BillyBot<span className="sidebar-logo-trade">™</span>
        </span>
      </div>

      {showNav ? (
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            // Hide Team link for non-owner/manager roles
            if (item.ownerManagerOnly && userRole !== "owner" && userRole !== "manager") {
              return null;
            }
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

      {showAppBlock ? (
        <div className="sidebar-app-block">
          <span className="sidebar-app-title">Get the iPhone app</span>
          <div className="sidebar-app-qr">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                qrValue,
              )}&margin=0`}
              alt="QR code to open the BillyBot iPhone app"
            />
          </div>
        </div>
      ) : null}

      <div className="sidebar-footer">
        <span className="sidebar-tag">Admin gone. Quotes done.</span>
      </div>
    </aside>
  );
}
