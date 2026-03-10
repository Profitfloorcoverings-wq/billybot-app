import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const secret = request.headers.get("x-billybot-secret") || request.headers.get("X-BillyBot-Secret");
  if (!secret || secret !== process.env.N8N_SHARED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    client_id,
    job_id,
    file_name,
    mime_type,
    base64,
    category = "materials",
    uploaded_via = "chat",
    ai_extracted,
    supplier_name,
    amount_net,
    amount_vat,
    amount_total,
    receipt_date,
    description,
  } = body;

  if (!client_id) {
    return NextResponse.json({ error: "client_id required" }, { status: 400 });
  }

  let storagePath: string | null = null;

  if (base64 && file_name) {
    const buffer = Buffer.from(base64, "base64");
    const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = `${client_id}/receipts/${randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("job_files")
      .upload(storagePath, buffer, {
        contentType: mime_type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Receipt attach upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  const status = ai_extracted || supplier_name || amount_total ? "extracted" : "pending";

  const { data: receipt, error } = await supabaseAdmin
    .from("receipts")
    .insert({
      client_id,
      job_id: job_id || null,
      supplier_name: supplier_name || null,
      description: description || null,
      amount_net: amount_net ?? null,
      amount_vat: amount_vat ?? null,
      amount_total: amount_total ?? null,
      receipt_date: receipt_date || null,
      category,
      storage_path: storagePath,
      file_name: file_name || null,
      mime_type: mime_type || null,
      uploaded_via,
      ai_extracted: ai_extracted || null,
      status,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ receipt });
}
