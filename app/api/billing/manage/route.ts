import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

function getReturnUrl(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  return siteUrl ?? origin;
}

export async function POST(request: Request) {
  // Guard against missing env vars
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRICE_ID_PREMIUM;

  if (!stripeSecretKey) {
    console.error("Stripe secret key missing at runtime");
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY missing" },
      { status: 500 }
    );
  }

  if (!stripePriceId) {
    console.error("Stripe price id missing at runtime");
    return NextResponse.json(
      { error: "STRIPE_PRICE_ID_PREMIUM missing" },
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

  if (error) {
    console.error("Failed to load client", error);
    return NextResponse.json({ error: "Unable to load billing profile" }, { status: 500 });
  }

  const returnUrl = `${getReturnUrl(request)}/account`;

  if (client?.stripe_id) {
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    client_reference_id: profileId,
    metadata: {
      user_id: profileId,
    },
    customer_email: user.email ?? undefined,
    success_url: `${returnUrl}?checkout=success`,
    cancel_url: `${returnUrl}?checkout=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
