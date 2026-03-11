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
  const { count, error } = await serviceClient
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("client_id", user.id)
    .in("thread_type", ["conversation", "enquiry"])
    .not("outbound_email_body", "is", null)
    .neq("status", "merged");

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}
