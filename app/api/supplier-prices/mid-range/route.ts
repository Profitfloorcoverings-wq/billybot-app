import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const user = await getUserFromCookies();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch products and client profile in parallel
    const [pricesResult, clientResult] = await Promise.all([
      supabase
        .from("supplier_prices")
        .select(
          'product_name, category, m2_price, price, uom, "ItemRef.value", sales_account_code, sales_ledger_account_id'
        )
        .eq("client_id", user.id)
        .eq("price_source", "mid range")
        .order("category")
        .order("product_name"),
      supabase
        .from("clients")
        .select("accounting_system")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (pricesResult.error) throw pricesResult.error;

    const products = (pricesResult.data ?? []).map((row) => ({
      product_name: row.product_name as string | null,
      category: row.category as string | null,
      m2_price: row.m2_price as number | null,
      price: row.price as number | null,
      uom: row.uom as string | null,
      item_ref_value: (row as Record<string, unknown>)["ItemRef.value"] as string | null,
      sales_account_code: row.sales_account_code as string | null,
      sales_ledger_account_id: row.sales_ledger_account_id as string | null,
    }));

    const accountingSystem = clientResult.data?.accounting_system ?? null;

    return NextResponse.json({ products, accounting_system: accountingSystem });
  } catch (err: unknown) {
    console.error("MID-RANGE PRICES API ERROR:", err);
    return NextResponse.json(
      {
        error:
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Server error",
      },
      { status: 500 }
    );
  }
}
