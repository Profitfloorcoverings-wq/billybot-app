/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";
import { confirmDiaryEntrySideEffects } from "@/lib/diary/confirmSideEffects";
import type { DiaryEntry } from "@/types/diary";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nSharedSecret = process.env.N8N_SHARED_SECRET;

async function resolveBusinessId(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("clients")
    .select("user_role, parent_client_id")
    .eq("id", userId)
    .maybeSingle();

  if ((data as any)?.user_role !== "owner" && (data as any)?.parent_client_id) {
    return (data as any).parent_client_id as string;
  }
  return userId;
}

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const businessId = await resolveBusinessId(supabase, userId);

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const status = searchParams.get("status");

  let query = (supabase as any)
    .from("diary_entries")
    .select("*")
    .eq("business_id", businessId)
    .order("start_datetime", { ascending: true });

  if (start) query = query.gte("start_datetime", start);
  if (end) query = query.lte("start_datetime", end);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("[diary/entries] GET error", error);
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  return NextResponse.json({ entries: (data as unknown[]) ?? [] });
}

export async function POST(req: Request) {
  // N8N calls can use X-BillyBot-Secret header instead of cookie auth
  const callerSecret = req.headers.get("X-BillyBot-Secret");
  const isN8NCall = n8nSharedSecret && callerSecret === n8nSharedSecret;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (isN8NCall) {
    const body = await req.json();
    const profileId = typeof body.profile_id === "string" ? body.profile_id : null;
    if (!profileId) {
      return NextResponse.json({ error: "profile_id required for N8N calls" }, { status: 400 });
    }
    const businessId = await resolveBusinessId(supabase, profileId);
    return handlePost(supabase, profileId, businessId, body);
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = await resolveBusinessId(supabase, userId);

  const body = await req.json();
  return handlePost(supabase, userId, businessId, body);
}

async function handlePost(
  supabase: any,
  userId: string,
  businessId: string,
  body: Record<string, unknown>
) {
  const {
    title,
    entry_type = "fitting",
    status = "confirmed",
    start_datetime,
    end_datetime,
    customer_name,
    customer_email,
    customer_phone,
    job_address,
    postcode,
    notes,
    job_id,
    fitter_ids,
    conversation_id,
  } = body;

  if (!title || !start_datetime || !end_datetime) {
    return NextResponse.json(
      { error: "title, start_datetime and end_datetime are required" },
      { status: 400 }
    );
  }

  const confirmationData =
    status === "pending_confirmation"
      ? {
          title,
          entry_type,
          start_datetime,
          end_datetime,
          customer_name: customer_name ?? null,
          customer_email: customer_email ?? null,
          customer_phone: customer_phone ?? null,
          job_address: job_address ?? null,
          postcode: postcode ?? null,
          notes: notes ?? null,
          fitter_ids: Array.isArray(fitter_ids) ? fitter_ids : [],
          job_id: job_id ?? null,
        }
      : null;

  const { data: entry, error: insertError } = await supabase
    .from("diary_entries")
    .insert({
      business_id: businessId,
      job_id: job_id ?? null,
      title,
      entry_type,
      status,
      start_datetime,
      end_datetime,
      customer_name: customer_name ?? null,
      customer_email: customer_email ?? null,
      customer_phone: customer_phone ?? null,
      job_address: job_address ?? null,
      postcode: postcode ?? null,
      notes: notes ?? null,
      confirmation_data: confirmationData,
      created_by: userId,
    })
    .select()
    .single();

  if (insertError || !entry) {
    console.error("[diary/entries] POST insert error", insertError);
    return NextResponse.json({ error: "Failed to create entry" }, { status: 500 });
  }

  // For pending_confirmation: insert a diary_confirmation message into the conversation
  if (status === "pending_confirmation" && conversation_id) {
    const messageContent = JSON.stringify({
      ...confirmationData,
      entry_id: (entry as any).id,
    });

    await supabase.from("messages").insert({
      conversation_id,
      profile_id: businessId,
      role: "assistant",
      type: "diary_confirmation",
      content: messageContent,
      metadata: { entry_id: (entry as any).id },
    });
  }

  // For confirmed: insert fitters, send push, fire webhook
  if (status === "confirmed") {
    const fitterIdsArr = Array.isArray(fitter_ids) ? (fitter_ids as string[]) : [];
    await confirmDiaryEntrySideEffects(entry as DiaryEntry, fitterIdsArr);
  }

  return NextResponse.json({ success: true, entry }, { status: 201 });
}
