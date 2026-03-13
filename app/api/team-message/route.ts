import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB safety net

type FileAttachment = {
  name: string;
  type: string;
  base64: string;
};

type RequestBody = {
  recipient_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  job_id?: string;
  job_title?: string;
  files?: FileAttachment[];
};

/**
 * POST /api/team-message
 * Called by N8N to deliver a team message to a recipient's Billy chat.
 * Auth: X-BillyBot-Secret header.
 */
export async function POST(request: Request) {
  try {
    // Auth
    const secret =
      request.headers.get("X-BillyBot-Secret") ||
      request.headers.get("x-billybot-secret") ||
      request.headers.get("x-n8n-secret");
    if (!secret || secret !== process.env.N8N_SHARED_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const { recipient_id, sender_id, sender_name, sender_role, message, job_id, job_title, files } = body;

    if (!recipient_id || !sender_id || !sender_name || !message) {
      return NextResponse.json(
        { error: "recipient_id, sender_id, sender_name, and message are required" },
        { status: 400 }
      );
    }

    // Find or create recipient's conversation
    let conversationId: string;
    const { data: existingConv } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("profile_id", recipient_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convError } = await supabaseAdmin
        .from("conversations")
        .insert({ profile_id: recipient_id, task_state: "idle" })
        .select("id")
        .single();
      if (convError || !newConv) {
        console.error("[team-message] Failed to create conversation:", convError);
        return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
      }
      conversationId = newConv.id;
    }

    // Upload files if present
    const uploadedFiles: Array<{ name: string; type: string; url: string }> = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const buffer = Buffer.from(file.base64, "base64");
        if (buffer.length > MAX_FILE_SIZE) {
          console.warn(`[team-message] Skipping oversized file: ${file.name} (${buffer.length} bytes)`);
          continue;
        }

        const fileId = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storagePath = `${sender_id}/team-messages/${fileId}-${safeName}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("job-files")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });

        if (uploadError) {
          console.error(`[team-message] Upload error for ${file.name}:`, uploadError);
          continue;
        }

        // 7-day signed URL
        const { data: signedUrl } = await supabaseAdmin.storage
          .from("job-files")
          .createSignedUrl(storagePath, 604800);

        if (signedUrl?.signedUrl) {
          uploadedFiles.push({
            name: file.name,
            type: file.type,
            url: signedUrl.signedUrl,
          });
        }
      }
    }

    // Build message content JSON
    const roleLabel = sender_role.charAt(0).toUpperCase() + sender_role.slice(1);
    const contentPayload = {
      sender_name: `${sender_name} (${roleLabel})`,
      sender_id,
      sender_role,
      message,
      job_id: job_id ?? null,
      job_title: job_title ?? null,
      sent_at: new Date().toISOString(),
      files: uploadedFiles.length > 0 ? uploadedFiles : undefined,
    };

    // Insert message
    const { error: msgError } = await supabaseAdmin.from("messages").insert({
      conversation_id: conversationId,
      profile_id: recipient_id,
      role: "assistant",
      type: "team_message",
      content: JSON.stringify(contentPayload),
      created_at: new Date().toISOString(),
    });

    if (msgError) {
      console.error("[team-message] Message insert error:", msgError);
      return NextResponse.json({ error: "Failed to insert message" }, { status: 500 });
    }

    // Send push notification
    const { data: tokenRows } = await supabaseAdmin
      .from("push_tokens")
      .select("expo_push_token")
      .eq("profile_id", recipient_id);

    const tokens = (tokenRows ?? [])
      .map((r) => r.expo_push_token)
      .filter((t): t is string => typeof t === "string" && t.startsWith("ExponentPushToken["));

    if (tokens.length > 0) {
      const hasFiles = uploadedFiles.length > 0;
      const pushBody = hasFiles
        ? `📷 Photo: ${message.slice(0, 80)}`
        : message.slice(0, 100);

      const pushMessages = tokens.map((token) => ({
        to: token,
        title: `Message from ${sender_name}`,
        body: pushBody,
        data: { conversation_id: conversationId },
      }));

      try {
        await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(pushMessages),
        });
      } catch (pushErr) {
        console.error("[team-message] Push notification error:", pushErr);
        // Non-fatal — message is already saved
      }
    }

    return NextResponse.json({
      status: "ok",
      conversation_id: conversationId,
      file_urls: uploadedFiles.map((f) => f.url),
    });
  } catch (err: unknown) {
    console.error("[team-message] Error:", err);
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
