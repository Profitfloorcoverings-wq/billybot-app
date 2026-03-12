import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/content/video
 * Upload a video → store in Supabase Storage → call N8N to generate
 * platform-specific captions/variants → save as pending_approval posts.
 */
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("video") as File | null;
  if (!file) return NextResponse.json({ error: "No video file" }, { status: 400 });

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "mp4";
  const storagePath = `${user.id}/content/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await supabaseAdmin.storage
    .from("job_files")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Get signed URL (long-lived for N8N processing)
  const { data: signedData } = await supabaseAdmin.storage
    .from("job_files")
    .createSignedUrl(storagePath, 7 * 24 * 3600); // 7 days

  const videoUrl = signedData?.signedUrl ?? "";

  // Call N8N to generate captions for each platform
  const webhookUrl = process.env.N8N_CONTENT_VIDEO_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const n8nRes = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-BillyBot-Secret": process.env.N8N_SHARED_SECRET ?? "",
        },
        body: JSON.stringify({
          profile_id: user.id,
          video_url: videoUrl,
          file_name: file.name,
          platforms: ["facebook", "instagram", "linkedin", "tiktok"],
        }),
      });

      if (n8nRes.ok) {
        const result = await n8nRes.json();
        const posts = result.posts ?? [];

        if (posts.length > 0) {
          const rows = posts.map((p: { platform: string; account_type?: string; content_text: string; hashtags?: string; pillar?: string }) => ({
            client_id: user.id,
            platform: p.platform,
            account_type: p.account_type ?? "personal",
            content_text: p.content_text,
            hashtags: p.hashtags ?? null,
            pillar: p.pillar ?? null,
            video_url: videoUrl,
            status: "pending_approval",
          }));

          const { data } = await supabaseAdmin.from("content_queue").insert(rows).select();
          return NextResponse.json({ posts: data }, { status: 201 });
        }
      }
    } catch {
      // N8N failed — still save a basic draft
    }
  }

  // Fallback: save one draft post per platform with the video
  const platforms = ["facebook", "instagram", "linkedin", "tiktok"];
  const rows = platforms.map((platform) => ({
    client_id: user.id,
    platform,
    account_type: "personal",
    content_text: `[Video: ${file.name}] — edit caption before posting`,
    video_url: videoUrl,
    status: "draft" as const,
  }));

  const { data } = await supabaseAdmin.from("content_queue").insert(rows).select();
  return NextResponse.json({ posts: data, note: "Saved as drafts — edit captions manually" }, { status: 201 });
}
