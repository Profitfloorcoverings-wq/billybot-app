import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: receipt, error: receiptError } = await supabaseAdmin
    .from("receipts")
    .select("*")
    .eq("id", id)
    .eq("client_id", user.id)
    .single();

  if (receiptError || !receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  if (receipt.status !== "approved") {
    return NextResponse.json({ error: "Receipt must be approved before syncing" }, { status: 400 });
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("accounting_system")
    .eq("id", user.id)
    .single();

  if (!client?.accounting_system) {
    return NextResponse.json({ error: "No accounting system connected" }, { status: 400 });
  }

  let imageUrl: string | null = null;
  if (receipt.storage_path) {
    const { data: signedUrl } = await supabaseAdmin.storage
      .from("job_files")
      .createSignedUrl(receipt.storage_path, 3600);
    imageUrl = signedUrl?.signedUrl ?? null;
  }

  const webhookUrl = process.env.N8N_RECEIPT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Receipt sync webhook not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync_to_accounting",
        receipt_id: receipt.id,
        client_id: user.id,
        accounting_system: client.accounting_system,
        supplier_name: receipt.supplier_name,
        description: receipt.description,
        amount_net: receipt.amount_net,
        amount_vat: receipt.amount_vat,
        amount_total: receipt.amount_total,
        currency: receipt.currency,
        receipt_date: receipt.receipt_date,
        category: receipt.category,
        image_url: imageUrl,
      }),
    });

    if (!response.ok) {
      await supabaseAdmin
        .from("receipts")
        .update({ status: "error", updated_at: new Date().toISOString() })
        .eq("id", id);
      return NextResponse.json({ error: "Accounting sync failed" }, { status: 502 });
    }

    const result = await response.json();

    await supabaseAdmin
      .from("receipts")
      .update({
        accounting_bill_id: result.bill_id || null,
        accounting_synced_at: new Date().toISOString(),
        status: "synced",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    return NextResponse.json({ success: true, bill_id: result.bill_id });
  } catch (err) {
    console.error("Accounting sync error:", err);
    await supabaseAdmin
      .from("receipts")
      .update({ status: "error", updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ error: "Accounting sync failed" }, { status: 502 });
  }
}
