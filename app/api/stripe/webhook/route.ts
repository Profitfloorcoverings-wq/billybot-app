import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecretKey || !webhookSecret) {
    console.error("Stripe webhook env vars missing");
    return NextResponse.json({ error: "Webhook configuration missing" }, { status: 500 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Supabase service env vars missing");
    return NextResponse.json({ error: "Supabase configuration missing" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2023-10-16",
  });

  const body = await request.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id ?? session.metadata?.user_id ?? null;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

    if (!userId || !customerId) {
      console.warn("Stripe checkout session missing user or customer mapping");
      return NextResponse.json({ received: true });
    }

    const { error } = await supabase
      .from("clients")
      .update({
        stripe_id: customerId,
        stripe_status: "active",
      })
      .eq("id", userId);

    if (error) {
      console.error("Failed to update client after checkout", error);
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id ?? null;
    const status = subscription.status ?? null;

    if (!customerId) {
      console.warn("Stripe subscription missing customer id");
      return NextResponse.json({ received: true });
    }

    const { error } = await supabase
      .from("clients")
      .update({
        stripe_status: status,
      })
      .eq("stripe_id", customerId);

    if (error) {
      console.error("Failed to update client after subscription update", error);
    }
  }

  return NextResponse.json({ received: true });
}
