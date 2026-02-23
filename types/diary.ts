export type EntryType = "prep" | "fitting" | "survey" | "other";
export type EntryStatus = "pending_confirmation" | "confirmed" | "cancelled" | "completed";

export type DiaryEntry = {
  id: string;
  business_id: string;
  job_id: string | null;
  title: string;
  entry_type: EntryType;
  status: EntryStatus;
  start_datetime: string;
  end_datetime: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  job_address: string | null;
  postcode: string | null;
  notes: string | null;
  confirmation_data: DiaryConfirmationPayload | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fitters
  fitters?: DiaryFitter[];
};

export type DiaryFitter = {
  id: string;
  diary_entry_id: string;
  team_member_id: string;
  notified_at: string | null;
  // Joined from team_members + clients
  name?: string | null;
  role?: string | null;
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
