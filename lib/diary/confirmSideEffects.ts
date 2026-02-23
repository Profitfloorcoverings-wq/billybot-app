import "server-only";
import { createClient } from "@supabase/supabase-js";

import { sendFitterPushNotifications } from "@/lib/notifications/sendFitterPushNotifications";
import { fireDiaryWebhook } from "@/lib/notifications/fireDiaryWebhook";
import type { DiaryEntry } from "@/types/diary";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function confirmDiaryEntrySideEffects(
  entry: DiaryEntry,
  fitterIds: string[]
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (fitterIds.length > 0) {
    const fitterRows = fitterIds.map((tid) => ({
      diary_entry_id: entry.id,
      team_member_id: tid,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("diary_fitters").insert(fitterRows);

    await sendFitterPushNotifications({
      fitterTeamMemberIds: fitterIds,
      customerName: entry.customer_name,
      entryType: entry.entry_type,
      startDatetime: entry.start_datetime,
      entryId: entry.id,
    });
  }

  await fireDiaryWebhook(entry);
}
