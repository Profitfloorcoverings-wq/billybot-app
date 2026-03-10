import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowedFields = [
    "supplier_name",
    "description",
    "amount_net",
    "amount_vat",
    "amount_total",
    "receipt_date",
    "category",
    "job_id",
    "status",
  ];

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field];
  }

  const { data: receipt, error } = await supabaseAdmin
    .from("receipts")
    .update(updates)
    .eq("id", id)
    .eq("client_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ receipt });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: receipt } = await supabaseAdmin
    .from("receipts")
    .select("storage_path")
    .eq("id", id)
    .eq("client_id", user.id)
    .maybeSingle();

  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (receipt.storage_path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from("job_files")
      .remove([receipt.storage_path]);
    if (storageError) console.error("Storage delete error:", storageError);
  }

  const { error } = await supabaseAdmin
    .from("receipts")
    .delete()
    .eq("id", id)
    .eq("client_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
