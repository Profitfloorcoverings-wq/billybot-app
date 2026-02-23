/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createClient } from "@supabase/supabase-js";

import type { DiaryEntry } from "@/types/diary";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function getDiaryEntriesForBusiness(
  userId: string,
  start: string,
  end: string
): Promise<DiaryEntry[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Resolve business_id: owner = self, member = look up team_members
  let businessId = userId;

  const { data: profile } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();

  if (
    (profile as any)?.user_role &&
    (profile as any).user_role !== "owner" &&
    (profile as any)?.parent_client_id
  ) {
    businessId = (profile as any).parent_client_id as string;
  }

  const { data: entries, error } = await (supabase as any)
    .from("diary_entries")
    .select(
      "id, business_id, job_id, title, entry_type, status, start_datetime, end_datetime, customer_name, customer_email, customer_phone, job_address, postcode, notes, confirmation_data, created_by, created_at, updated_at"
    )
    .eq("business_id", businessId)
    .gte("start_datetime", start)
    .lte("start_datetime", end)
    .order("start_datetime", { ascending: true });

  if (error) {
    console.error("[diaryQueries] fetch error", error);
    return [];
  }

  const result: DiaryEntry[] = (entries as any[]) ?? [];

  if (result.length === 0) return result;

  // Fetch fitters for these entries
  const entryIds = result.map((e) => e.id);
  const { data: fitterRows } = await (supabase as any)
    .from("diary_fitters")
    .select("id, diary_entry_id, team_member_id, notified_at")
    .in("diary_entry_id", entryIds);

  if (fitterRows && (fitterRows as any[]).length > 0) {
    const memberIds = [...new Set((fitterRows as any[]).map((f: any) => f.team_member_id as string))];
    const { data: teamMembers } = await (supabase as any)
      .from("team_members")
      .select("id, member_id, role")
      .in("id", memberIds);

    const memberClientIds = ((teamMembers as any[]) ?? []).map((tm: any) => tm.member_id as string);
    const { data: clientProfiles } = await supabase
      .from("clients")
      .select("id, business_name")
      .in("id", memberClientIds);

    const clientMap = new Map(
      ((clientProfiles as any[]) ?? []).map((c: any) => [c.id as string, c.business_name as string | null])
    );
    const teamMemberMap = new Map(
      ((teamMembers as any[]) ?? []).map((tm: any) => [tm.id as string, tm])
    );

    const fittersByEntry = new Map<string, DiaryEntry["fitters"]>();
    for (const f of fitterRows as any[]) {
      if (!fittersByEntry.has(f.diary_entry_id)) {
        fittersByEntry.set(f.diary_entry_id, []);
      }
      const tm = teamMemberMap.get(f.team_member_id);
      fittersByEntry.get(f.diary_entry_id)!.push({
        id: f.id,
        diary_entry_id: f.diary_entry_id,
        team_member_id: f.team_member_id,
        notified_at: f.notified_at,
        name: tm ? clientMap.get(tm.member_id) ?? null : null,
        role: tm?.role ?? null,
      });
    }

    for (const entry of result) {
      entry.fitters = fittersByEntry.get(entry.id) ?? [];
    }
  }

  return result;
}
