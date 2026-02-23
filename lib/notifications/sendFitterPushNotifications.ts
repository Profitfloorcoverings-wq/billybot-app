/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type SendFitterPushOptions = {
  fitterTeamMemberIds: string[];
  customerName: string | null;
  entryType: string;
  startDatetime: string;
  entryId: string;
};

export async function sendFitterPushNotifications({
  fitterTeamMemberIds,
  customerName,
  entryType,
  startDatetime,
  entryId,
}: SendFitterPushOptions): Promise<void> {
  if (fitterTeamMemberIds.length === 0) return;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Resolve team_member_id → member_id (auth user id)
  const { data: teamMembers } = await (supabase as any)
    .from("team_members")
    .select("id, member_id")
    .in("id", fitterTeamMemberIds);

  if (!teamMembers || (teamMembers as any[]).length === 0) return;

  const memberUserIds = (teamMembers as any[]).map((tm: any) => tm.member_id as string);

  // Look up push tokens
  const { data: tokenRows } = await supabase
    .from("push_tokens")
    .select("profile_id, expo_push_token")
    .in("profile_id", memberUserIds);

  if (!tokenRows || tokenRows.length === 0) return;

  const tokens = (tokenRows as any[])
    .map((r: any) => r.expo_push_token as string)
    .filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken["));

  if (tokens.length === 0) return;

  const startDate = new Date(startDatetime);
  const dateStr = startDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = startDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const entryTypeLabel = entryType.charAt(0).toUpperCase() + entryType.slice(1);

  const bodyText = [
    entryTypeLabel,
    customerName ? `for ${customerName}` : null,
    `on ${dateStr} at ${timeStr}`,
  ]
    .filter(Boolean)
    .join(" ");

  const messages: PushPayload[] = tokens.map((token) => ({
    to: token,
    title: "New diary booking",
    body: bodyText,
    data: { entry_id: entryId, entry_type: entryType },
  }));

  // Send in batches of 100
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const now = new Date().toISOString();
      await (supabase as any)
        .from("diary_fitters")
        .update({ notified_at: now })
        .eq("diary_entry_id", entryId)
        .in("team_member_id", fitterTeamMemberIds);
    } catch (err) {
      console.error("[sendFitterPushNotifications] push error", err);
    }
  }
}
