import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createServerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const SUBSCRIBER_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!stripeSecretKey || !siteUrl) {
    return NextResponse.json({ error: "Billing configuration missing" }, { status: 500 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("stripe_id, stripe_status")
    .eq("id", user.id)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: "Unable to load billing profile" }, { status: 500 });
  }

  if (!client?.stripe_id || !SUBSCRIBER_STATUSES.has(client.stripe_status ?? "")) {
    return NextResponse.json({ needs_plan: true }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_id,
    return_url: process.env.STRIPE_PORTAL_RETURN_URL || `${siteUrl}/account`,
  });

  return NextResponse.json({ url: session.url });
}
