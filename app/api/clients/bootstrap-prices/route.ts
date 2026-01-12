import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { defaultPricingRows } from "@/src/lib/defaultPricingRows";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type BootstrapRequest = {
  clientId: string;
};

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Supabase environment variables are missing" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as BootstrapRequest;

    if (!body?.clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const rows = defaultPricingRows.map((row) => ({
      ...row,
      client_id: body.clientId,
      supplier_name: "DEFAULT",
    }));

    const { error } = await supabase
      .from("supplier_prices")
      .upsert(rows, { onConflict: "client_id,product_name" });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("BOOTSTRAP PRICING ERROR:", err);
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
