import type { CustomerRecord, EmailEventRecord, JobFileRecord, JobRecord, NormalizedAttachment, QuoteRecord } from "@/lib/jobs/getJobBundle";

export type JobPageData = {
  job: JobRecord;
  customer: CustomerRecord | null;
  quotes: QuoteRecord[];
  emailThread: EmailEventRecord[];
  latestEmail: EmailEventRecord | null;
  attachments: NormalizedAttachment[];
  jobFiles: JobFileRecord[];
};
