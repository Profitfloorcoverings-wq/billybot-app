import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_CATEGORIES = ["materials", "labour", "equipment", "fuel", "other"];

export async function GET(request: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const status = searchParams.get("status");

  let query = supabaseAdmin
    .from("receipts")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);
  if (status) query = query.eq("status", status);

  const { data: receipts, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const receiptsWithUrls = await Promise.all(
    (receipts ?? []).map(async (receipt) => {
      if (!receipt.storage_path) return receipt;
      const { data: signedUrl } = await supabaseAdmin.storage
        .from("job_files")
        .createSignedUrl(receipt.storage_path, 3600);
      return { ...receipt, signed_url: signedUrl?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ receipts: receiptsWithUrls });
}

export async function POST(request: Request) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const jobId = formData.get("job_id") as string | null;
  const category = (formData.get("category") as string) || "materials";

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  if (jobId) {
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("client_id", user.id)
      .maybeSingle();
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const files = formData.getAll("files") as File[];
  if (!files.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const uploaded = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/receipts/${randomUUID()}-${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("job_files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Receipt upload error:", uploadError);
      continue;
    }

    const { data: receipt, error: insertError } = await supabaseAdmin
      .from("receipts")
      .insert({
        client_id: user.id,
        job_id: jobId || null,
        category,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        uploaded_via: "web_upload",
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Receipt insert error:", insertError);
      continue;
    }

    // Fire N8N extraction webhook async (don't await)
    const webhookUrl = process.env.N8N_RECEIPT_WEBHOOK_URL;
    if (webhookUrl) {
      const { data: signedUrl } = await supabaseAdmin.storage
        .from("job_files")
        .createSignedUrl(storagePath, 3600);

      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_id: receipt.id,
          client_id: user.id,
          job_id: jobId || null,
          file_name: file.name,
          mime_type: file.type,
          image_url: signedUrl?.signedUrl ?? null,
          storage_path: storagePath,
        }),
      }).catch((err) => console.error("N8N receipt webhook error:", err));
    }

    const { data: signedUrl } = await supabaseAdmin.storage
      .from("job_files")
      .createSignedUrl(storagePath, 3600);

    uploaded.push({ ...receipt, signed_url: signedUrl?.signedUrl ?? null });
  }

  return NextResponse.json({ receipts: uploaded });
}
