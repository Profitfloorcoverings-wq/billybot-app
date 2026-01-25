"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

import BillyBotLogo from "./BillyBotLogo";
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
  const iosAppUrl = process.env.NEXT_PUBLIC_IOS_APP_URL;
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const normalizedAppBase = useMemo(
    () => appBaseUrl?.replace(/\/$/, ""),
    [appBaseUrl],
  );
  const [qrUrl, setQrUrl] = useState<string | null>(
    normalizedAppBase ? `${normalizedAppBase}/get-the-app` : null,
  );

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

  useEffect(() => {
    if (qrUrl || typeof window === "undefined") return;
    setQrUrl(`${window.location.origin}/get-the-app`);
  }, [qrUrl]);

  const showNav = !!isAuthenticated;
  const showAppBlock = Boolean(iosAppUrl && qrUrl);
  const qrValue = qrUrl ?? "";

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
          <span className="sidebar-app-copy">
            Scan to install BillyBot on your iPhone.
          </span>
          <div
            className="sidebar-app-qr"
            role="img"
            aria-label="QR code to open the BillyBot iPhone app"
          >
            <QRCodeCanvas value={qrValue} size={120} level="M" includeMargin={false} />
          </div>
          <Link href="/get-the-app" className="sidebar-app-link">
            Open on this device
          </Link>
        </div>
      ) : null}

      <div className="sidebar-footer">
        <span className="sidebar-tag">Admin gone. Quotes done.</span>
      </div>
    </aside>
  );
}
