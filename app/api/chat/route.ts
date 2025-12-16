import { createClient } from "@supabase/supabase-js";

import { getAuthenticatedUserId } from "@/utils/supabase/auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const n8nWebhook = process.env.N8N_WEBHOOK_URL!;

export async function POST(req: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let conversationId: string | null = body?.conversation_id ?? null;

    if (!conversationId) {
      const { data: existingConversation, error: existingConversationError } = await supabase
        .from("conversations")
        .select("id")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConversationError && existingConversationError.code !== "PGRST116") {
        throw existingConversationError;
      }

      if (existingConversation?.id) {
        conversationId = existingConversation.id;
      } else {
        conversationId = crypto.randomUUID();

        const { error: conversationInsertError } = await supabase
          .from("conversations")
          .insert({ id: conversationId, profile_id: userId });

        if (conversationInsertError) {
          throw conversationInsertError;
        }
      }
    }

    const message = typeof body?.message === "string" ? body.message : "";
    const files = Array.isArray(body?.files) ? body.files : [];

    const messageType = files.length > 0 && message === "" ? "file" : "text";

    const { error: messageInsertError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      profile_id: userId,
      role: "user",
      type: messageType,
      content: message,
      created_at: new Date().toISOString(),
    });

    if (messageInsertError) {
      throw messageInsertError;
    }

    const forwardedBody = {
      ...body,
      profile_id: userId,
      message,
      files,
      conversation_id: conversationId,
    };

    const n8nRes = await fetch(n8nWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardedBody),
    });

    const responseText = await n8nRes.text();
    let parsedResponse: unknown = null;

    try {
      parsedResponse = responseText ? JSON.parse(responseText) : {};
    } catch {
      parsedResponse = responseText;
    }

    const payload =
      parsedResponse && typeof parsedResponse === "object"
        ? { ...(parsedResponse as Record<string, unknown>), conversation_id: conversationId }
        : { conversation_id: conversationId, data: parsedResponse };

    return new Response(JSON.stringify(payload), {
      status: n8nRes.status,
      statusText: n8nRes.statusText,
      headers: { ...Object.fromEntries(n8nRes.headers), "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message?: string }).message)
        : "Server error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
