import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

type RawSupplierPrice = {
  id: number | string;
  created_at: string | null;
  updated_at: string | null;
  client_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  product_name: string | null;
  category: string | null;
  uom: string | null;
  roll_price: number | null;
  cut_price: number | null;
  m2_price: number | null;
  price: number | null;
  price_per_m: number | null;
  price_source: string | null;
  product_id: string | null;
  "ItemRef.value"?: string | null;
};

type SupplierPrice = Omit<RawSupplierPrice, "ItemRef.value"> & {
  item_ref_value: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizePrice(price: RawSupplierPrice): SupplierPrice {
  const itemRefValue = price["ItemRef.value"] ?? null;
  return {
    ...price,
    item_ref_value: itemRefValue,
  };
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const user = await getUserFromCookies();
    const profileId = user?.id;

    if (!profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("supplier_prices")
      .select(
        "id, created_at, updated_at, client_id, supplier_id, supplier_name, product_name, category, uom, roll_price, cut_price, m2_price, price, price_per_m, price_source, product_id, \"ItemRef.value\""
      )
      .eq("client_id", profileId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) throw error;

    const prices = Array.isArray(data) ? data.map(normalizePrice) : [];

    return NextResponse.json({ prices });
  } catch (err: unknown) {
    console.error("SUPPLIER PRICES API ERROR:", err);
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
