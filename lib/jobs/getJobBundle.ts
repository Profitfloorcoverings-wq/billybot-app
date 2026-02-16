import { createServerClient } from "@/utils/supabase/server";

export type JobRecord = {
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

export type CustomerRecord = {
  id: string;
  profile_id: string | null;
  customer_name: string | null;
  contact_name: string | null;
  address: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  updated_at: string | null;
};

export type QuoteRecord = {
  id: string;
  created_at: string | null;
  customer_name: string | null;
  quote_reference: string | null;
  pdf_url: string | null;
  job_details: string | null;
  quote: string | null;
  version: number | null;
  job_ref: string | null;
  quote_status: string | null;
  follow_up_status: string | null;
  possibleMatch?: boolean;
};

export type EmailEventRecord = {
  id: string;
  account_id: string | null;
  client_id: string | null;
  provider: string | null;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  from_email: string | null;
  subject: string | null;
  received_at: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  body_text: string | null;
  body_html: string | null;
  attachments: unknown;
  status: string | null;
  queue_status: string | null;
  attempts: number | null;
  processed_at: string | null;
  last_error: string | null;
  error: string | null;
  direction: "inbound" | "outbound" | null;
  meta: Record<string, unknown> | null;
};

export type NormalizedAttachment = {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  url: string | null;
  path: string | null;
  sourceEmailId: string;
  receivedAt: string | null;
};

export type JobBundle = {
  job: JobRecord;
  customer: CustomerRecord | null;
  quotes: QuoteRecord[];
  emailThread: EmailEventRecord[];
  latestEmail: EmailEventRecord | null;
  attachments: NormalizedAttachment[];
};

type GetJobBundleParams = {
  jobId: string;
  profileId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseAttachmentList(value: unknown): Record<string, unknown>[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((item) => !!asRecord(item)) as Record<string, unknown>[];
  }

  const root = asRecord(value);
  if (!root) return [];

  const nestedFiles = root.files;
  if (Array.isArray(nestedFiles)) {
    return nestedFiles.filter((item) => !!asRecord(item)) as Record<string, unknown>[];
  }

  return [];
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(raw: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeAttachment(
  raw: Record<string, unknown>,
  sourceEmailId: string,
  receivedAt: string | null,
  index: number
): NormalizedAttachment {
  const name =
    pickString(raw, ["filename", "name", "fileName"]) || `Attachment ${index + 1}`;
  const mimeType = pickString(raw, ["mimeType", "mime_type", "contentType", "content_type", "type"]);
  const size = pickNumber(raw, ["size", "fileSize", "content_length"]);
  const url = pickString(raw, ["url", "link", "download_url", "web_url"]);
  const path = pickString(raw, ["path", "storage_path", "storagePath"]);

  return {
    id: `${sourceEmailId}-${index}-${name}`,
    name,
    mimeType,
    size,
    url,
    path,
    sourceEmailId,
    receivedAt,
  };
}

export async function getJobBundle({ jobId, profileId }: GetJobBundleParams): Promise<JobBundle | null> {
  const supabase = await createServerClient();

  const { data: job, error: jobError } = await supabase
    .from("jobs")
    .select(
      "id, created_at, last_activity_at, customer_name, customer_email, customer_phone, title, job_details, outbound_email_subject, outbound_email_body, status, provider, provider_thread_id, provider_message_id, site_address, postcode, metadata, email_event_id, customer_reply, profile_id, client_id, conversation_id, job_thread_id"
    )
    .eq("id", jobId)
    .eq("profile_id", profileId)
    .maybeSingle<JobRecord>();

  if (jobError || !job) return null;

  const clientScope = job.client_id || profileId;

  const customerByEmailQuery = supabase
    .from("customers")
    .select("id, profile_id, customer_name, contact_name, address, phone, mobile, email, updated_at")
    .eq("profile_id", job.profile_id ?? profileId)
    .eq("email", job.customer_email ?? "")
    .limit(1)
    .maybeSingle<CustomerRecord>();

  const customerByNameQuery = supabase
    .from("customers")
    .select("id, profile_id, customer_name, contact_name, address, phone, mobile, email, updated_at")
    .eq("profile_id", job.profile_id ?? profileId)
    .ilike("customer_name", job.customer_name ?? "")
    .limit(1)
    .maybeSingle<CustomerRecord>();

  const quoteRefs = [job.id, job.job_thread_id].filter((value): value is string => Boolean(value));
  const directQuotesQuery = quoteRefs.length
    ? supabase
        .from("quotes")
        .select(
          "id, created_at, customer_name, quote_reference, pdf_url, job_details, quote, version, job_ref, quote_status, follow_up_status"
        )
        .eq("client_id", clientScope)
        .in("job_ref", quoteRefs)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] as QuoteRecord[] });

  const threadBase = supabase
    .from("email_events")
    .select(
      "id, account_id, client_id, provider, provider_message_id, provider_thread_id, from_email, subject, received_at, to_emails, cc_emails, body_text, body_html, attachments, status, queue_status, attempts, processed_at, last_error, error, direction, meta"
    )
    .eq("client_id", clientScope);

  const emailThreadQuery = job.provider_thread_id
    ? (() => {
        let query = threadBase.eq("provider_thread_id", job.provider_thread_id).order("received_at", {
          ascending: true,
          nullsFirst: false,
        });
        if (job.provider) query = query.eq("provider", job.provider);
        return query;
      })()
    : (() => {
        let query = threadBase.eq("id", job.email_event_id ?? "").order("received_at", {
          ascending: true,
          nullsFirst: false,
        });
        if (job.provider) query = query.eq("provider", job.provider);
        return query;
      })();

  const latestEmailQuery = job.provider_thread_id
    ? (() => {
        let query = threadBase.eq("provider_thread_id", job.provider_thread_id).order("received_at", {
          ascending: false,
          nullsFirst: false,
        });
        if (job.provider) query = query.eq("provider", job.provider);
        return query.limit(1);
      })()
    : (() => {
        let query = threadBase.eq("id", job.email_event_id ?? "").order("received_at", {
          ascending: false,
          nullsFirst: false,
        });
        if (job.provider) query = query.eq("provider", job.provider);
        return query.limit(1);
      })();

  const [
    { data: customerByEmail },
    { data: customerByName },
    directQuotesResult,
    { data: emailThread },
    { data: latestEmailList },
  ] = await Promise.all([
    customerByEmailQuery,
    customerByNameQuery,
    directQuotesQuery,
    emailThreadQuery,
    latestEmailQuery,
  ]);

  const latestEmail = latestEmailList?.[0] ?? null;
  const thread = emailThread ?? [];

  let quotes = directQuotesResult.data ?? [];
  if (!quotes.length && job.customer_name && job.created_at) {
    const windowStart = new Date(job.created_at);
    windowStart.setDate(windowStart.getDate() - 14);
    const windowEnd = new Date(job.created_at);
    windowEnd.setDate(windowEnd.getDate() + 30);

    const { data: fallbackQuotes } = await supabase
      .from("quotes")
      .select(
        "id, created_at, customer_name, quote_reference, pdf_url, job_details, quote, version, job_ref, quote_status, follow_up_status"
      )
      .eq("client_id", clientScope)
      .ilike("customer_name", job.customer_name)
      .gte("created_at", windowStart.toISOString())
      .lte("created_at", windowEnd.toISOString())
      .order("created_at", { ascending: false });

    quotes = (fallbackQuotes ?? []).map((quote) => ({ ...quote, possibleMatch: true }));
  }

  const attachments = thread.flatMap((event) => {
    const attachmentRecords = parseAttachmentList(event.attachments);
    return attachmentRecords.map((item, index) =>
      normalizeAttachment(item, event.id, event.received_at, index)
    );
  });

  return {
    job,
    customer: customerByEmail ?? customerByName ?? null,
    quotes,
    emailThread: thread,
    latestEmail,
    attachments,
  };
}
