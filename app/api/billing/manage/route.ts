import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const client_id = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!stripeSecretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
}

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration environment variables.");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST() {
  const { data: client, error } = await supabase
    .from("clients")
    .select("stripe_id")
    .eq("id", client_id)
    .single();

  if (error || !client) {
    return NextResponse.json(
      { error: "Unable to find Stripe customer for client." },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: client.stripe_id,
    return_url: "https://billybot-app.vercel.app/account",
  });

  return NextResponse.json({ url: session.url });
}
