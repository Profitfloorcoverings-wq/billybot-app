import { NextResponse } from "next/server";

import { getUserFromCookies } from "@/utils/supabase/auth";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromCookies();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;
  const clientId = user.id;

  const webhookUrl = process.env.N8N_REANALYSE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Reanalyse webhook not configured" },
      { status: 503 }
    );
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify job ownership
  const { data: job, error: jobErr } = await admin
    .from("jobs")
    .select("id, client_id, provider_thread_id, provider, email_event_id")
    .eq("id", jobId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Fetch email events with attachments for this job's thread
  let emailQuery = admin
    .from("email_events")
    .select("id, attachments, provider_thread_id, from_email, subject")
    .eq("client_id", clientId)
    .not("attachments", "is", null);

  if (job.provider_thread_id) {
    emailQuery = emailQuery.eq("provider_thread_id", job.provider_thread_id);
    if (job.provider) {
      emailQuery = emailQuery.eq("provider", job.provider);
    }
  } else if (job.email_event_id) {
    emailQuery = emailQuery.eq("id", job.email_event_id);
  } else {
    return NextResponse.json(
      { error: "No email thread linked to this job" },
      { status: 400 }
    );
  }

  const { data: emails, error: emailErr } = await emailQuery;

  if (emailErr || !emails?.length) {
    return NextResponse.json(
      { error: "No email attachments found for this job" },
      { status: 404 }
    );
  }

  // Collect all attachments (up to 5 image/PDF attachments)
  const IMAGE_PDF_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/tiff",
    "application/pdf",
  ];

  type RawAttachment = {
    filename?: string;
    name?: string;
    contentType?: string;
    mime_type?: string;
    base64?: string;
    data?: string;
    content?: string;
  };

  const attachments: RawAttachment[] = [];
  for (const email of emails) {
    const list = Array.isArray(email.attachments)
      ? email.attachments
      : [];
    for (const att of list as RawAttachment[]) {
      const mime =
        att.contentType || att.mime_type || "";
      if (IMAGE_PDF_TYPES.some((t) => mime.toLowerCase().startsWith(t))) {
        attachments.push(att);
      }
      if (attachments.length >= 5) break;
    }
    if (attachments.length >= 5) break;
  }

  if (!attachments.length) {
    return NextResponse.json(
      { error: "No image/PDF attachments found" },
      { status: 404 }
    );
  }

  // POST to N8N reanalyse webhook
  const payload = {
    job_id: jobId,
    profile_id: clientId,
    attachments: attachments.map((att) => ({
      filename: att.filename || att.name || "attachment",
      contentType: att.contentType || att.mime_type || "application/octet-stream",
      base64: att.base64 || att.data || att.content || "",
    })),
  };

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-BillyBot-Secret": process.env.N8N_WEBHOOK_SECRET || "",
      },
      body: JSON.stringify(payload),
    });

    if (!n8nRes.ok) {
      const text = await n8nRes.text().catch(() => "");
      return NextResponse.json(
        { error: "N8N webhook failed", detail: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, attachmentCount: attachments.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to reach N8N", detail: String(err) },
      { status: 502 }
    );
  }
}
