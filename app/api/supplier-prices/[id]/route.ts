import { NextRequest, NextResponse } from "next/server";
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
  price: number | null;
  roll_price: number | null;
  cut_price: number | null;
  m2_price: number | null;
  price_per_m: number | null;
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
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing supplier price id" }, { status: 400 });
    }

    const body = (await req.json()) as Partial<SupplierPriceUpdate>;

    const updatePayload: Partial<SupplierPriceUpdate> = {};

    const updateNumberField = (
      key: keyof SupplierPriceUpdate,
      label: string
    ) => {
      if (!Object.prototype.hasOwnProperty.call(body, key)) return;
      const rawValue = body[key];
      if (rawValue === null) {
        updatePayload[key] = null;
        return;
      }
      if (typeof rawValue === "number") {
        if (!Number.isFinite(rawValue) || rawValue < 0) {
          throw new Error(`${label} must be a finite number greater than or equal to 0`);
        }
        updatePayload[key] = rawValue;
        return;
      }
      throw new Error(`Invalid ${label}`);
    };

    try {
      updateNumberField("price", "price");
      updateNumberField("roll_price", "roll_price");
      updateNumberField("cut_price", "cut_price");
      updateNumberField("m2_price", "m2_price");
      updateNumberField("price_per_m", "price_per_m");
    } catch (err: unknown) {
      return NextResponse.json(
        {
          error:
            err && typeof err === "object" && "message" in err
              ? String((err as { message?: string }).message)
              : "Invalid fields",
        },
        { status: 400 }
      );
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("supplier_prices")
      .update(updatePayload)
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
