import "server-only";
import type { DiaryEntry } from "@/types/diary";

const n8nDiaryWebhook = process.env.N8N_DIARY_WEBHOOK_URL;

export async function fireDiaryWebhook(entry: DiaryEntry): Promise<void> {
  if (!n8nDiaryWebhook) return;

  try {
    await fetch(n8nDiaryWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_id: entry.id,
        business_id: entry.business_id,
        title: entry.title,
        entry_type: entry.entry_type,
        status: entry.status,
        start_datetime: entry.start_datetime,
        end_datetime: entry.end_datetime,
        customer_name: entry.customer_name,
        customer_email: entry.customer_email,
        customer_phone: entry.customer_phone,
        job_address: entry.job_address,
        postcode: entry.postcode,
        notes: entry.notes,
        job_id: entry.job_id,
      }),
    });
  } catch (err) {
    console.error("[fireDiaryWebhook] error", err);
    // Fail silently — webhook is non-critical
  }
}
