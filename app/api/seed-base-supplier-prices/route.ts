import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BASE_PRICE_COLUMNS = [
  "mat_lvt_m2",
  "mat_ceramic_tiles_m2",
  "mat_domestic_carpet_m2",
  "mat_commercial_carpet_m2",
  "mat_safety_m2",
  "mat_domestic_vinyl_m2",
  "mat_commercial_vinyl_m2",
  "mat_wall_cladding_m2",
  "mat_ply_m2",
  "mat_weld",
  "mat_coved_m2",
  "mat_gripper",
  "mat_matting_m2",
  "mat_nosings_m",
  "mat_adhesive_m2",
  "mat_latex_m2",
  "mat_underlay",
  "mat_door_bars_each",
  "mat_uplift_m2",
  "waste_disposal",
  "furniture_removal",
  "lab_domestic_carpet_m2",
  "lab_commercial_carpet_m2",
  "lab_carpet_tiles_m2",
  "lab_lvt_m2",
  "lab_ceramic_tiles_m2",
  "lab_safety_m2",
  "lab_domestic_vinyl_m2",
  "lab_commercial_vinyl_m2",
  "lab_wall_cladding_m2",
  "lab_coved_m",
  "lab_ply_m2",
  "lab_latex_m2",
  "lab_door_bars_each",
  "lab_nosings_m",
  "lab_matting_m2",
  "lab_uplift_m2",
  "lab_gripper_m",
] as const;

const UOM_OVERRIDES: Record<string, "m2" | "m" | "each"> = {
  mat_gripper: "m",
  mat_underlay: "m2",
  waste_disposal: "m2",
};

const PRODUCT_NAME_OVERRIDES: Record<string, string> = {
  lvt: "lvt_tiles",
};

type SeedPayload = {
  client_id?: string;
  profile_id?: string;
};

type CatalogItem = {
  column: string;
  product_name: string;
  uom: "m2" | "m" | "each";
  price: number;
};

function toNum(value: unknown): number | null {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function canonKey(column: string): { productName: string; uom: "m2" | "m" | "each" } {
  const isLabour = column.startsWith("lab_");
  const withoutPrefix = column.replace(/^mat_/, "").replace(/^lab_/, "");

  let uom: "m2" | "m" | "each" = "each";
  let baseName = withoutPrefix;

  if (withoutPrefix.endsWith("_m2")) {
    uom = "m2";
    baseName = withoutPrefix.slice(0, -3);
  } else if (withoutPrefix.endsWith("_m")) {
    uom = "m";
    baseName = withoutPrefix.slice(0, -2);
  } else if (withoutPrefix.endsWith("_each")) {
    uom = "each";
    baseName = withoutPrefix.slice(0, -5);
  }

  if (UOM_OVERRIDES[column]) {
    uom = UOM_OVERRIDES[column];
  }

  const canonical = PRODUCT_NAME_OVERRIDES[baseName] ?? baseName;
  return {
    productName: isLabour ? `labour_${canonical}` : canonical,
    uom,
  };
}

function buildCatalog(settings: Record<string, unknown> | null): CatalogItem[] {
  return BASE_PRICE_COLUMNS.map((column) => {
    const { productName, uom } = canonKey(column);
    const rawValue = settings?.[column];
    const parsed = toNum(rawValue);
    const price = parsed && parsed > 0 ? parsed : 1;

    return {
      column,
      product_name: productName,
      uom,
      price,
    };
  });
}

function buildPricePayload(uom: "m2" | "m" | "each", price: number) {
  return {
    m2_price: uom === "m2" ? price : null,
    price_per_m: uom === "m" ? price : null,
    price: uom === "each" ? price : null,
  };
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SeedPayload;
    const clientId = body?.client_id;
    const profileId = body?.profile_id;

    if (!clientId || !profileId) {
      return NextResponse.json({ error: "Missing client_id or profile_id" }, { status: 400 });
    }

    const user = await getUserFromCookies();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.id !== clientId || user.id !== profileId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!clientRow) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    let { data: pricingSettings, error: pricingError } = await supabase
      .from("pricing_settings")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (pricingError) throw pricingError;

    if (!pricingSettings) {
      const defaults = {
        profile_id: profileId,
        vat_registered: true,
        separate_labour: true,
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertError } = await supabase
        .from("pricing_settings")
        .insert(defaults)
        .select("*")
        .single();

      if (insertError) throw insertError;
      pricingSettings = inserted;
    }

    const catalog = buildCatalog(pricingSettings);

    const { data: existingRows, error: existingError } = await supabase
      .from("supplier_prices")
      .select("product_name, uom")
      .eq("client_id", clientId)
      .eq("supplier_name", "BASE");

    if (existingError) throw existingError;

    const existingKeys = new Set(
      (existingRows ?? []).map((row) => `${row.product_name ?? ""}|${row.uom ?? ""}`)
    );

    const now = new Date().toISOString();
    const rows = catalog
      .filter((item) => !existingKeys.has(`${item.product_name}|${item.uom}`))
      .map((item) => ({
        client_id: clientId,
        supplier_name: "BASE",
        product_name: item.product_name,
        uom: item.uom,
        category: "base",
        price_source: "mid range",
        updated_at: now,
        ...buildPricePayload(item.uom, item.price),
      }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase.from("supplier_prices").upsert(rows, {
        onConflict: "client_id,supplier_name,product_name,uom",
      });

      if (upsertError) throw upsertError;
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err) {
    console.error("SEED BASE SUPPLIER PRICES ERROR:", err);
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
