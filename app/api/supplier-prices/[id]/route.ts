import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

type RawSupplierPrice = {
  id: number | string;
  created_at: string | null;
  updated_at: string | null;
  client_id: string | null;
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

type SupplierPriceUpdate = {
  product_name: string;
  uom: string;
  price: number;
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing supplier price id" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<SupplierPriceUpdate>;
    const productName = body.product_name;
    const uom = body.uom;
    const rawPrice = body.price;
    const parsedPrice =
      typeof rawPrice === "string" ? Number(rawPrice) : typeof rawPrice === "number" ? rawPrice : null;

    if (
      typeof productName !== "string" ||
      typeof uom !== "string" ||
      parsedPrice === null ||
      !Number.isFinite(parsedPrice)
    ) {
      return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
    }

    if (parsedPrice < 0) {
      return NextResponse.json(
        { error: "Price must be greater than or equal to 0" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("supplier_prices")
      .update({
        product_name: productName,
        uom,
        price: parsedPrice,
      })
      .eq("id", id)
      .eq("client_id", profileId)
      .select(
        "id, created_at, updated_at, client_id, supplier_name, product_name, category, uom, roll_price, cut_price, m2_price, price, price_per_m, price_source, product_id, \"ItemRef.value\""
      )
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ price: normalizePrice(data) });
  } catch (err: unknown) {
    console.error("SUPPLIER PRICE PATCH ERROR:", err);
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
