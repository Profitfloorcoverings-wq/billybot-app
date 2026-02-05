import { NextResponse } from "next/server";

import { getUserFromCookies } from "@/utils/supabase/auth";

export const runtime = "nodejs";

const PRICE_ENV_KEYS = [
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_TEAM_MONTHLY",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PRO_ANNUAL",
  "STRIPE_PRICE_TEAM_ANNUAL",
] as const;

function getAllowedPrices() {
  return PRICE_ENV_KEYS.map((key) => process.env[key]).filter(
    (value): value is string => Boolean(value)
  );
}

export async function GET() {
  return NextResponse.json({ prices: getPricesByPlan() });
}

function getPricesByPlan() {
  return {
    starter: {
      monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? null,
      annual: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? null,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? null,
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? null,
    },
    team: {
      monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? null,
      annual: process.env.STRIPE_PRICE_TEAM_ANNUAL ?? null,
    },
  };
}

export async function POST(request: Request) {
  const user = await getUserFromCookies();

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookUrl = process.env.N8N_BILLING_CHECKOUT_WEBHOOK;
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!webhookUrl || !webhookSecret || !siteUrl) {
    return NextResponse.json({ error: "Billing configuration missing" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { price_id?: string } | null;
  const priceId = body?.price_id;

  if (!priceId) {
    return NextResponse.json({ error: "price_id is required" }, { status: 400 });
  }

  const allowedPrices = getAllowedPrices();

  if (!allowedPrices.includes(priceId)) {
    return NextResponse.json({ error: "Invalid price_id" }, { status: 400 });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": webhookSecret,
    },
    body: JSON.stringify({
      client_id: user.id,
      user_email: user.email,
      price_id: priceId,
      success_url: `${siteUrl}/account?billing=success`,
      cancel_url: `${siteUrl}/account?billing=cancel`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return NextResponse.json(
      { error: "Unable to start checkout", details: text || null },
      { status: 502 }
    );
  }

  const data = (await response.json().catch(() => null)) as { url?: string } | null;

  if (!data?.url) {
    return NextResponse.json({ error: "Missing checkout url" }, { status: 502 });
  }

  return NextResponse.json({ url: data.url });
}
