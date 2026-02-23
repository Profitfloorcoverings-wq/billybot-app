import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

import DiaryCalendarNoSSR from "./components/DiaryCalendarNoSSR";
import { getDiaryEntriesForBusiness } from "@/lib/diary/diaryQueries";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function DiaryPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, ...options });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Default to current month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const entries = await getDiaryEntriesForBusiness(user.id, start, end);

  const thisMonth = entries.length;

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Diary</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Schedule and manage fittings, surveys and prep jobs
            </p>
          </div>
          {thisMonth > 0 && (
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" as const }}>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1 }}>{thisMonth}</p>
                <p style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>This month</p>
              </div>
            </div>
          )}
        </div>
      </header>
      <DiaryCalendarNoSSR initialEntries={entries} />
    </div>
  );
}
