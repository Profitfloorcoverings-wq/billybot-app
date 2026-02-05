import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { getUserFromCookies } from "@/utils/supabase/auth";

export const runtime = "nodejs";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"] as const;

export async function POST() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!stripeSecretKey || !siteUrl) {
    return NextResponse.json({ error: "Billing configuration missing" }, { status: 500 });
  }

  const user = await getUserFromCookies();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: client, error } = await supabase
    .from("clients")
    .select("stripe_id, stripe_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!client?.stripe_id || !ACTIVE_STATUSES.includes((client.stripe_status ?? "") as (typeof ACTIVE_STATUSES)[number])) {
    return NextResponse.json({ needs_plan: true }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  const returnUrl = process.env.STRIPE_PORTAL_RETURN_URL || `${siteUrl}/account`;

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_id,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}
