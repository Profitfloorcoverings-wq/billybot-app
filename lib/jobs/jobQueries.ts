import { JOB_SELECT, normalizeStatus } from "@/app/jobs/utils";
import { createServerClient } from "@/utils/supabase/server";

export type TenantJob = {
  id: string;
  created_at: string | null;
  last_activity_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  title: string | null;
  job_details: string | null;
  outbound_email_subject: string | null;
  outbound_email_body: string | null;
  status: string | null;
  provider: string | null;
  provider_thread_id: string | null;
  provider_message_id: string | null;
  site_address: string | null;
  postcode: string | null;
  metadata: Record<string, unknown> | null;
  email_event_id: string | null;
  customer_reply: boolean | null;
  profile_id: string | null;
  client_id: string | null;
  conversation_id: string | null;
  job_thread_id: string | null;
};

export type JobsTenantResult = {
  user: { id: string; email?: string | null } | null;
  userError: { message?: string } | null;
  jobs: TenantJob[];
  jobsError: { message?: string } | null;
};

export type JobByIdTenantResult = {
  user: { id: string; email?: string | null } | null;
  userError: { message?: string } | null;
  job: TenantJob | null;
  jobError: { message?: string } | null;
  currentClientId: string | null;
};

export async function getJobsForCurrentTenant(statusValue = "all"): Promise<JobsTenantResult> {
  const supabase = await createServerClient();
  const { data: userData, error: userErrorRaw } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return {
      user: null,
      userError: userErrorRaw ? { message: userErrorRaw.message } : null,
      jobs: [],
      jobsError: null,
    };
  }

  let query = supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("client_id", user.id)
    .order("last_activity_at", { ascending: false });

  if (statusValue !== "all") {
    const normalized = normalizeStatus(statusValue);
    const pattern = normalized === "awaiting_info" ? "awaiting%info" : normalized;
    query = query.ilike("status", pattern);
  }

  const { data, error } = await query;

  return {
    user: { id: user.id, email: user.email ?? null },
    userError: userErrorRaw ? { message: userErrorRaw.message } : null,
    jobs: (data as TenantJob[] | null) ?? [],
    jobsError: error ? { message: error.message } : null,
  };
}

export async function getJobByIdForCurrentTenant(jobId: string): Promise<JobByIdTenantResult> {
  const supabase = await createServerClient();
  const { data: userData, error: userErrorRaw } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (!user) {
    return {
      user: null,
      userError: userErrorRaw ? { message: userErrorRaw.message } : null,
      job: null,
      jobError: null,
      currentClientId: null,
    };
  }

  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("client_id", user.id)
    .eq("id", jobId)
    .maybeSingle<TenantJob>();

  return {
    user: { id: user.id, email: user.email ?? null },
    userError: userErrorRaw ? { message: userErrorRaw.message } : null,
    job: data ?? null,
    jobError: error ? { message: error.message } : null,
    currentClientId: user.id,
  };
}
