import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromRequest } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  let query = supabaseAdmin
    .from("marketing_context")
    .select("*")
    .eq("client_id", user.id)
    .eq("active", true)
    .order("priority", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Support bulk insert
  const items = Array.isArray(body) ? body : [body];

  const rows = items.map((item: { category: string; title: string; content: string; tags?: string[]; priority?: number }) => ({
    client_id: user.id,
    category: item.category,
    title: item.title,
    content: item.content,
    tags: item.tags ?? [],
    priority: item.priority ?? 5,
  }));

  const { data, error } = await supabaseAdmin
    .from("marketing_context")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data }, { status: 201 });
}
