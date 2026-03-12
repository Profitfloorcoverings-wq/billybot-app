import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/content/generate
 * Takes bullet points / raw ideas and sends them to N8N
 * which uses Claude to generate platform-specific posts + DALL-E image.
 * N8N returns posts with visual_storage_path, we create signed URLs here.
 */
export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { bullets, platforms, account_type } = body;

  if (!bullets?.trim()) {
    return NextResponse.json({ error: "bullets is required" }, { status: 400 });
  }

  const webhookUrl = process.env.N8N_CONTENT_GENERATE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Content generation not configured" }, { status: 503 });
  }

  // Call N8N to generate content text + DALL-E image
  const n8nRes = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BillyBot-Secret": process.env.N8N_SHARED_SECRET ?? "",
    },
    body: JSON.stringify({
      profile_id: user.id,
      bullets,
      platforms: platforms ?? ["facebook", "instagram", "linkedin"],
      account_type: account_type ?? "both",
    }),
  });

  if (!n8nRes.ok) {
    const text = await n8nRes.text();
    return NextResponse.json({ error: "N8N generation failed", detail: text }, { status: 502 });
  }

  const result = await n8nRes.json();
  const posts: Array<{
    platform: string;
    account_type: string;
    content_text: string;
    hashtags?: string;
    pillar?: string;
    visual_prompt?: string;
    visual_storage_path?: string;
  }> = result.posts ?? [];

  if (posts.length === 0) {
    return NextResponse.json({ error: "No posts generated" }, { status: 422 });
  }

  // Convert visual_storage_path to signed URL if present
  let visualUrl: string | null = null;
  const storagePath = posts[0]?.visual_storage_path;
  if (storagePath) {
    const { data: signedData } = await supabaseAdmin.storage
      .from("job_files")
      .createSignedUrl(storagePath, 365 * 24 * 3600); // 1 year
    visualUrl = signedData?.signedUrl ?? null;
  }

  // Insert all as drafts
  const rows = posts.map((p) => ({
    client_id: user.id,
    platform: p.platform,
    account_type: p.account_type,
    content_text: p.content_text,
    hashtags: p.hashtags ?? null,
    pillar: p.pillar ?? null,
    visual_prompt: p.visual_prompt ?? null,
    visual_url: visualUrl,
    status: "draft" as const,
  }));

  const { data, error } = await supabaseAdmin
    .from("content_queue")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data }, { status: 201 });
}
