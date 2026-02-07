import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

export async function POST() {
  // Guard against missing env vars
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("Stripe secret key missing at runtime");
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY missing" },
      { status: 500 }
    );
  }

  // Lazy import Stripe so Turbopack doesn't evaluate it at build time
  const Stripe = (await import("stripe")).default;

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const user = await getUserFromCookies();
  const profileId = user?.id;

  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: client, error } = await supabase
    .from("clients")
    .select("stripe_id")
    .eq("id", profileId)
    .single();

  if (error || !client?.stripe_id) {
    return NextResponse.json(
      { error: "Client not found or missing stripe_id" },
      { status: 500 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_id,
    return_url: "https://billybot-app.vercel.app/account",
  });

  return NextResponse.json({ url: session.url });
}
