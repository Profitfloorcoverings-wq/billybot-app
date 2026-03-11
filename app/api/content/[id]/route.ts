import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Only allow updating certain fields
  const allowed: Record<string, unknown> = {};
  const fields = ["content_text", "hashtags", "pillar", "scheduled_for", "status", "platform", "account_type", "media_urls", "visual_prompt", "visual_url", "video_url"];
  for (const f of fields) {
    if (f in body) allowed[f] = body[f];
  }

  // If scheduling, ensure scheduled_for is set
  if (allowed.status === "scheduled" && !allowed.scheduled_for) {
    return NextResponse.json({ error: "scheduled_for required when scheduling" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("content_queue")
    .update(allowed)
    .eq("id", id)
    .eq("client_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ post: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("content_queue")
    .delete()
    .eq("id", id)
    .eq("client_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
