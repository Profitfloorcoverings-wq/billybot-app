import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";
import { randomUUID } from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate a DALL-E image, upload to Supabase, return signed URL.
 * Returns null if anything fails (non-blocking).
 */
async function generateImage(visualPrompt: string, clientId: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !visualPrompt) return null;

  try {
    // 1. Call DALL-E 3
    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: visualPrompt,
        size: "1024x1024",
        quality: "standard",
        n: 1,
      }),
    });

    if (!dalleRes.ok) return null;

    const dalleData = await dalleRes.json();
    const tempUrl = dalleData.data?.[0]?.url;
    if (!tempUrl) return null;

    // 2. Download the temporary image
    const imgRes = await fetch(tempUrl);
    if (!imgRes.ok) return null;
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    // 3. Upload to Supabase Storage
    const storagePath = `${clientId}/content/${randomUUID()}.png`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("job-files")
      .upload(storagePath, buffer, { contentType: "image/png", upsert: false });

    if (uploadErr) return null;

    // 4. Create a long-lived signed URL
    const { data: signedData } = await supabaseAdmin.storage
      .from("job-files")
      .createSignedUrl(storagePath, 365 * 24 * 3600); // 1 year

    return signedData?.signedUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/content/generate
 * Takes bullet points / raw ideas and sends them to N8N
 * which uses Claude to generate platform-specific posts.
 * Then generates DALL-E images for each post.
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

  // Call N8N to generate content text
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
  }> = result.posts ?? [];

  if (posts.length === 0) {
    return NextResponse.json({ error: "No posts generated" }, { status: 422 });
  }

  // Generate DALL-E images in parallel (batches of 3 to respect rate limits)
  const imageUrls: (string | null)[] = new Array(posts.length).fill(null);

  if (process.env.OPENAI_API_KEY) {
    const batchSize = 3;
    for (let i = 0; i < posts.length; i += batchSize) {
      const batch = posts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((p) => generateImage(p.visual_prompt ?? "", user.id))
      );
      batchResults.forEach((url, j) => {
        imageUrls[i + j] = url;
      });
      // Small delay between batches for rate limits
      if (i + batchSize < posts.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  // Insert all as drafts with images
  const rows = posts.map((p, idx) => ({
    client_id: user.id,
    platform: p.platform,
    account_type: p.account_type,
    content_text: p.content_text,
    hashtags: p.hashtags ?? null,
    pillar: p.pillar ?? null,
    visual_prompt: p.visual_prompt ?? null,
    visual_url: imageUrls[idx] ?? null,
    status: "draft" as const,
  }));

  const { data, error } = await supabaseAdmin
    .from("content_queue")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data }, { status: 201 });
}
