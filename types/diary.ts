import type { Database } from "./supabase";

type DiaryEntryRow = Database["public"]["Tables"]["diary_entries"]["Row"];
type DiaryFitterRow = Database["public"]["Tables"]["diary_fitters"]["Row"];

export type EntryType = "prep" | "fitting" | "survey" | "other";
export type EntryStatus = "pending_confirmation" | "confirmed" | "cancelled" | "completed";

export type DiaryFitter = DiaryFitterRow & {
  name?: string | null;
  role?: string | null;
};

export type DiaryEntry = DiaryEntryRow & {
  fitters?: DiaryFitter[];
};

export type DiaryConfirmationPayload = {
  title: string;
  entry_type: EntryType;
  start_datetime: string;
  end_datetime: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  postcode: string | null;
  notes: string | null;
  fitter_ids: string[];
  job_id?: string | null;
};
