export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { createEmailServiceClient } from "@/lib/email/serviceClient";
import { getUserFromRequest } from "@/utils/supabase/auth";

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const serviceClient = createEmailServiceClient();

  // Count conversation/enquiry jobs that have a pending draft reply
  const { count: conversationCount, error: convError } = await serviceClient
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id)
    .in("thread_type", ["conversation", "enquiry"])
    .not("outbound_email_body", "is", null)
    .neq("status", "merged");

  // Count job-type drafts
  const { count: jobCount, error: jobError } = await serviceClient
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id)
    .eq("thread_type", "job")
    .not("outbound_email_body", "is", null)
    .neq("status", "merged");

  if (convError || jobError) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const total = (conversationCount ?? 0) + (jobCount ?? 0);
  return NextResponse.json({
    count: total,
    conversationCount: conversationCount ?? 0,
    jobCount: jobCount ?? 0,
  });
}
