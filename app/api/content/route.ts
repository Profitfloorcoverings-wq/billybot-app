import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube"];
const VALID_ACCOUNT_TYPES = ["brand", "personal"];
const VALID_STATUSES = ["draft", "pending_approval", "approved", "scheduled", "published", "failed", "rejected"];
const VALID_PILLARS = [
  "pain_solution", "demo", "humor", "social_proof", "education",
  "build_in_public", "founder_story", "ai_hot_take", "industry_insight", "lessons",
];

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const platform = searchParams.get("platform");
  const accountType = searchParams.get("account_type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabaseAdmin
    .from("content_queue")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (platform) query = query.eq("platform", platform);
  if (accountType) query = query.eq("account_type", accountType);
  if (from) query = query.gte("scheduled_for", from);
  if (to) query = query.lte("scheduled_for", to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { platform, account_type, content_text, media_urls, hashtags, pillar, scheduled_for, status } = body;

  if (!platform || !VALID_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  if (account_type && !VALID_ACCOUNT_TYPES.includes(account_type)) {
    return NextResponse.json({ error: "Invalid account_type" }, { status: 400 });
  }
  if (!content_text?.trim()) {
    return NextResponse.json({ error: "content_text is required" }, { status: 400 });
  }
  if (pillar && !VALID_PILLARS.includes(pillar)) {
    return NextResponse.json({ error: "Invalid pillar" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("content_queue")
    .insert({
      client_id: user.id,
      platform,
      account_type: account_type ?? "brand",
      content_text: content_text.trim(),
      media_urls: media_urls ?? [],
      hashtags: hashtags ?? null,
      pillar: pillar ?? null,
      scheduled_for: scheduled_for ?? null,
      status: status === "scheduled" && scheduled_for ? "scheduled" : "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data }, { status: 201 });
}
