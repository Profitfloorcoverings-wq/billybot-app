"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RequestsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/account?tab=support");
  }, [router]);

  return (
    <main className="page-container standard page container">
      <p style={{ fontSize: "14px", color: "#64748b" }}>Redirecting to Account → Support…</p>
    </main>
  );
}
