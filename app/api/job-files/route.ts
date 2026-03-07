import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");
    if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

    // Verify job belongs to user
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const { data: files, error } = await supabaseAdmin
      .from("job_files")
      .select("*")
      .eq("job_id", jobId)
      .eq("client_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Generate signed URLs for each file
    const filesWithUrls = await Promise.all(
      (files ?? []).map(async (file) => {
        const { data: signedUrl } = await supabaseAdmin.storage
          .from("job_files")
          .createSignedUrl(file.storage_path, 3600); // 1 hour

        return { ...file, signed_url: signedUrl?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ files: filesWithUrls });
  } catch (err) {
    console.error("[job-files GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const jobId = formData.get("job_id") as string | null;
    const fileCategory = (formData.get("file_category") as string) || "document";

    if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

    const validCategories = ["floor_plan", "site_photo", "cutting_plan", "document"];
    if (!validCategories.includes(fileCategory)) {
      return NextResponse.json({ error: "Invalid file_category" }, { status: 400 });
    }

    // Verify job belongs to user
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .eq("client_id", user.id)
      .maybeSingle();

    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const files = formData.getAll("files") as File[];
    if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    const uploaded: Array<Record<string, unknown>> = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileId = crypto.randomUUID();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${jobId}/${fileId}-${safeName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("job_files")
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        console.error("[job-files upload]", uploadError);
        continue;
      }

      const { data: row, error: insertError } = await supabaseAdmin
        .from("job_files")
        .insert({
          job_id: jobId,
          client_id: user.id,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          storage_path: storagePath,
          file_category: fileCategory,
          uploaded_via: "web_upload",
        })
        .select()
        .single();

      if (insertError) {
        console.error("[job-files insert]", insertError);
        continue;
      }

      const { data: signedUrl } = await supabaseAdmin.storage
        .from("job_files")
        .createSignedUrl(storagePath, 3600);

      uploaded.push({ ...row, signed_url: signedUrl?.signedUrl ?? null });
    }

    return NextResponse.json({ files: uploaded });
  } catch (err) {
    console.error("[job-files POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
