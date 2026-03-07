import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AttachFile = {
  file_name: string;
  mime_type: string;
  base64: string;
  file_category: "floor_plan" | "site_photo" | "cutting_plan" | "document";
};

type AttachPayload = {
  job_id: string;
  client_id: string;
  files: AttachFile[];
  uploaded_via?: string;
};

/**
 * POST /api/job-files/attach
 * Called by N8N to attach files to a job.
 * Auth: X-BillyBot-Secret header.
 */
export async function POST(request: Request) {
  try {
    const secret = request.headers.get("X-BillyBot-Secret") || request.headers.get("x-billybot-secret");
    if (!secret || secret !== process.env.N8N_SHARED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AttachPayload;
    const { job_id, client_id, files, uploaded_via } = body;

    if (!job_id || !client_id || !files?.length) {
      return NextResponse.json({ error: "job_id, client_id, and files[] required" }, { status: 400 });
    }

    const validCategories = ["floor_plan", "site_photo", "cutting_plan", "document"];
    const uploaded: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const category = validCategories.includes(file.file_category) ? file.file_category : "document";
      const buffer = Buffer.from(file.base64, "base64");
      const fileId = crypto.randomUUID();
      const safeName = (file.file_name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${client_id}/${job_id}/${fileId}-${safeName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("job_files")
        .upload(storagePath, buffer, {
          contentType: file.mime_type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("[job-files/attach upload]", uploadError);
        continue;
      }

      const { data: row, error: insertError } = await supabaseAdmin
        .from("job_files")
        .insert({
          job_id,
          client_id,
          file_name: file.file_name || safeName,
          mime_type: file.mime_type || null,
          size_bytes: buffer.length,
          storage_path: storagePath,
          file_category: category,
          uploaded_via: uploaded_via || "chat",
        })
        .select()
        .single();

      if (insertError) {
        console.error("[job-files/attach insert]", insertError);
        continue;
      }

      uploaded.push(row);
    }

    return NextResponse.json({ files: uploaded, count: uploaded.length });
  } catch (err) {
    console.error("[job-files/attach POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
