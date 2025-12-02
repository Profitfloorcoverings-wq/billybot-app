"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Chat", href: "/chat" },
  { label: "Jobs", href: "/jobs" },
  { label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              {item.label}
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
