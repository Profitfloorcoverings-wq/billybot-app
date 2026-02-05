import { NextResponse } from "next/server";

import { createServerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function getAllowedPriceIds() {
  return [
    process.env.STRIPE_PRICE_STARTER_MONTHLY,
    process.env.STRIPE_PRICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_TEAM_MONTHLY,
    process.env.STRIPE_PRICE_STARTER_ANNUAL,
    process.env.STRIPE_PRICE_PRO_ANNUAL,
    process.env.STRIPE_PRICE_TEAM_ANNUAL,
  ].filter((value): value is string => Boolean(value));
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
      price_id: priceId,
      success_url: `${siteUrl}/account?billing=success`,
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
