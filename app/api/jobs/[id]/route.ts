import { NextResponse } from "next/server";

import { getUserFromCookies } from "@/utils/supabase/auth";
import { createServerClient } from "@/utils/supabase/server";

const ALLOWED_STATUSES = new Set([
  "new",
  "quoting",
  "waiting_customer",
  "booked",
  "in_progress",
  "completed",
  "lost",
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const patch: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    const normalizedStatus = body.status.trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(normalizedStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = normalizedStatus;
  }

  if (typeof body.customer_reply === "boolean") {
    patch.customer_reply = body.customer_reply;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .or(`profile_id.eq.${user.id},client_id.eq.${user.id}`)
    .select("id, status, customer_reply, site_address, postcode")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to update job" }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}
