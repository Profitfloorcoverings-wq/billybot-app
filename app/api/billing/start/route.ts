import { NextResponse } from "next/server";

import { createServerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function getAllowedPriceIds() {
  return [
    process.env.STRIPE_PRICE_STARTER_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY,
    process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_TEAM_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY,
    process.env.STRIPE_PRICE_STARTER_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL,
    process.env.STRIPE_PRICE_PRO_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL,
    process.env.STRIPE_PRICE_TEAM_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_ANNUAL,
  ].filter((value): value is string => Boolean(value));
}

type BillingCycle = "monthly" | "annual";
type PlanTier = "starter" | "pro" | "team";

function getPlanFromPriceId(priceId: string): { plan_tier: PlanTier; billing_cycle: BillingCycle } | null {
  const priceMap: Array<{ priceId: string | undefined; plan_tier: PlanTier; billing_cycle: BillingCycle }> = [
    {
      priceId: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_MONTHLY,
      plan_tier: "starter",
      billing_cycle: "monthly",
    },
    {
      priceId: process.env.STRIPE_PRICE_PRO_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY,
      plan_tier: "pro",
      billing_cycle: "monthly",
    },
    {
      priceId: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY,
      plan_tier: "team",
      billing_cycle: "monthly",
    },
    {
      priceId: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER_ANNUAL,
      plan_tier: "starter",
      billing_cycle: "annual",
    },
    {
      priceId: process.env.STRIPE_PRICE_PRO_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL,
      plan_tier: "pro",
      billing_cycle: "annual",
    },
    {
      priceId: process.env.STRIPE_PRICE_TEAM_ANNUAL ?? process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_ANNUAL,
      plan_tier: "team",
      billing_cycle: "annual",
    },
  ];

  const match = priceMap.find((entry) => entry.priceId === priceId);
  if (!match) {
    return null;
  }

  return { plan_tier: match.plan_tier, billing_cycle: match.billing_cycle };
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { price_id?: string } | null;
  const priceId = body?.price_id?.trim();
  const allowedPriceIds = getAllowedPriceIds();

  if (!priceId || !allowedPriceIds.includes(priceId)) {
    return NextResponse.json({ error: "Invalid price_id" }, { status: 400 });
  }

  const selectedPlan = getPlanFromPriceId(priceId);

  if (!selectedPlan) {
    return NextResponse.json({ error: "Billing plan mapping missing" }, { status: 500 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("stripe_id")
    .eq("id", user.id)
    .maybeSingle();

  if (clientError) {
    return NextResponse.json({ error: "Unable to load billing profile" }, { status: 500 });
  }

  const webhookUrl = process.env.N8N_BILLING_CHECKOUT_WEBHOOK;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!webhookUrl || !webhookSecret || !siteUrl) {
    return NextResponse.json({ error: "Billing configuration missing" }, { status: 500 });
  }

  const n8nRes = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({
      client_id: user.id,
      user_email: user.email,
      stripe_id: client?.stripe_id ?? null,
      price_id: priceId,
      plan_tier: selectedPlan.plan_tier,
      billing_cycle: selectedPlan.billing_cycle,
      success_url: `${siteUrl}/account?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/account?billing=cancel`,
    }),
  });

  if (!n8nRes.ok) {
    const errorText = await n8nRes.text();
    return NextResponse.json(
      { error: "Unable to start checkout", detail: errorText || undefined },
      { status: 502 }
    );
  }

  const data = (await n8nRes.json().catch(() => null)) as { url?: string } | null;

  if (!data?.url) {
    return NextResponse.json({ error: "Checkout URL missing" }, { status: 502 });
  }

  return NextResponse.json({ url: data.url });
}
