import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const n8nRamsSendWebhook = process.env.N8N_RAMS_SEND_WEBHOOK_URL;

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { job_id } = (await req.json()) as { job_id?: string };
    if (!job_id) {
      return NextResponse.json({ error: "Missing job_id" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify this job belongs to the authenticated user's business
    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("id, client_id, title, customer_name, customer_email, risk_assessment_url, risk_assessment_ref, method_statement_url, method_statement_ref")
      .eq("id", job_id)
      .eq("client_id", userId)
      .maybeSingle();

    if (jobErr) throw jobErr;
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Fetch all signatures for this job
    const { data: signatures, error: sigErr } = await supabase
      .from("rams_signatures")
      .select("*")
      .eq("job_id", job_id)
      .order("document_type")
      .order("signer_name");

    if (sigErr) throw sigErr;

    if (!n8nRamsSendWebhook) {
      return NextResponse.json({ error: "N8N_RAMS_SEND_WEBHOOK_URL not configured" }, { status: 500 });
    }

    // Fire N8N webhook — N8N handles PDF signature overlay + email to customer
    const webhookRes = await fetch(n8nRamsSendWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: job.id,
        job_title: job.title,
        customer_name: job.customer_name,
        customer_email: job.customer_email,
        risk_assessment_url: job.risk_assessment_url,
        risk_assessment_ref: job.risk_assessment_ref,
        method_statement_url: job.method_statement_url,
        method_statement_ref: job.method_statement_ref,
        signatures: signatures ?? [],
      }),
    });

    if (!webhookRes.ok) {
      throw new Error(`N8N webhook failed: ${webhookRes.status}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: unknown) {
    console.error("RAMS SEND ERROR:", err);
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
