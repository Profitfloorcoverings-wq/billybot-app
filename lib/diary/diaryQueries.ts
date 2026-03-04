import "server-only";
import { createClient } from "@supabase/supabase-js";

import type { DiaryEntry } from "@/types/diary";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function getDiaryEntriesForBusiness(
  userId: string,
  start: string,
  end: string
): Promise<DiaryEntry[]> {
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  // Resolve business_id: owner = self, member = look up team_members
  let businessId = userId;

  const { data: profile } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.user_role && profile.user_role !== "owner" && profile.parent_client_id) {
    businessId = profile.parent_client_id;
  }

  const { data: entries, error } = await supabase
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

  const result: DiaryEntry[] = (entries ?? []) as DiaryEntry[];

  if (result.length === 0) return result;

  // Fetch fitters for these entries
  const entryIds = result.map((e) => e.id);
  const { data: fitterRows } = await supabase
    .from("diary_fitters")
    .select("id, diary_entry_id, team_member_id, notified_at")
    .in("diary_entry_id", entryIds);

  if (fitterRows && fitterRows.length > 0) {
    const memberIds = [...new Set(fitterRows.map((f) => f.team_member_id))];
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("id, member_id, role")
      .in("id", memberIds);

    const memberClientIds = (teamMembers ?? []).map((tm) => tm.member_id);
    const { data: clientProfiles } = await supabase
      .from("clients")
      .select("id, business_name")
      .in("id", memberClientIds);

    const clientMap = new Map(
      (clientProfiles ?? []).map((c) => [c.id, c.business_name])
    );
    const teamMemberMap = new Map(
      (teamMembers ?? []).map((tm) => [tm.id, tm])
    );

    const fittersByEntry = new Map<string, DiaryEntry["fitters"]>();
    for (const f of fitterRows) {
      if (!fittersByEntry.has(f.diary_entry_id)) {
        fittersByEntry.set(f.diary_entry_id, []);
      }
      const tm = teamMemberMap.get(f.team_member_id);
      fittersByEntry.get(f.diary_entry_id)!.push({
        id: f.id,
        diary_entry_id: f.diary_entry_id,
        team_member_id: f.team_member_id,
        notified_at: f.notified_at ?? null,
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
