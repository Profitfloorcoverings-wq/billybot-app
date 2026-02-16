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

const ALLOWED_FIELDS = new Set([
  "status",
  "customer_reply",
  "site_address",
  "postcode",
  "customer_phone",
]);

type PatchBody = {
  status?: unknown;
  customer_reply?: unknown;
  site_address?: unknown;
  postcode?: unknown;
  customer_phone?: unknown;
};

function sanitizeStringField(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, maxLength);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as PatchBody;

  const bodyKeys = Object.keys(body as Record<string, unknown>);
  const invalidField = bodyKeys.find((key) => !ALLOWED_FIELDS.has(key));
  if (invalidField) {
    return NextResponse.json({ error: `Field not allowed: ${invalidField}` }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if ("status" in body) {
    if (typeof body.status !== "string") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const normalizedStatus = body.status.trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(normalizedStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = normalizedStatus;
  }

  if ("customer_reply" in body) {
    if (typeof body.customer_reply !== "boolean") {
      return NextResponse.json({ error: "Invalid customer_reply" }, { status: 400 });
    }
    patch.customer_reply = body.customer_reply;
  }

  if ("site_address" in body) {
    const siteAddress = sanitizeStringField(body.site_address, 240);
    if (siteAddress === null) {
      return NextResponse.json({ error: "Invalid site_address" }, { status: 400 });
    }
    patch.site_address = siteAddress;
  }

  if ("postcode" in body) {
    const postcode = sanitizeStringField(body.postcode, 24);
    if (postcode === null) {
      return NextResponse.json({ error: "Invalid postcode" }, { status: 400 });
    }
    patch.postcode = postcode;
  }

  if ("customer_phone" in body) {
    const customerPhone = sanitizeStringField(body.customer_phone, 32);
    if (customerPhone === null) {
      return NextResponse.json({ error: "Invalid customer_phone" }, { status: 400 });
    }
    patch.customer_phone = customerPhone;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data: ownedJob, error: ownershipError } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", id)
    .or(`profile_id.eq.${user.id},client_id.eq.${user.id}`)
    .maybeSingle();

  if (ownershipError || !ownedJob) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .or(`profile_id.eq.${user.id},client_id.eq.${user.id}`)
    .select(
      "id, status, customer_reply, site_address, postcode, customer_phone, last_activity_at"
    )
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to update job" }, { status: 500 });
  }

  return NextResponse.json({ job: data });
}
