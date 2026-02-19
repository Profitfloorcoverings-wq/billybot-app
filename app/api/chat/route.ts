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

    const resolveConversationId = async () => {
      const requestedConversationId = body?.conversation_id ? String(body.conversation_id) : null;

      if (requestedConversationId) {
        const { data: requestedConversation, error: requestedConversationError } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", requestedConversationId)
          .eq("profile_id", userId)
          .maybeSingle();

        if (requestedConversationError) {
          throw requestedConversationError;
        }

        if (requestedConversation?.id) {
          return requestedConversation.id;
        }
      }

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
        return existingConversation.id;
      }

      const newConversationId = crypto.randomUUID();

      const { error: conversationInsertError } = await supabase
        .from("conversations")
        .insert({ id: newConversationId, profile_id: userId });

      if (conversationInsertError) {
        throw conversationInsertError;
      }

      return newConversationId;
    };

    const message = typeof body?.message === "string" ? body.message : "";

    if (message === "__LOAD_HISTORY__") {
      const conversationId = await resolveConversationId();

      let historyMessages: unknown[] | null = null;

      const { data: historyWithExtendedFields, error: historyWithExtendedFieldsError } = await supabase
        .from("messages")
        .select("id, role, content, type, conversation_id, quote_reference, job_sheet_reference, file_url, created_at")
        .eq("conversation_id", conversationId)
        .eq("profile_id", userId)
        .order("created_at", { ascending: true });

      if (!historyWithExtendedFieldsError) {
        historyMessages = historyWithExtendedFields;
      } else {
        const { data: historyWithOriginalFields, error: historyWithOriginalFieldsError } = await supabase
          .from("messages")
          .select("id, role, content, type, conversation_id, quote_reference, created_at")
          .eq("conversation_id", conversationId)
          .eq("profile_id", userId)
          .order("created_at", { ascending: true });

        if (historyWithOriginalFieldsError) {
          throw historyWithOriginalFieldsError;
        }

        historyMessages = historyWithOriginalFields;
      }

      return new Response(
        JSON.stringify({
          conversation_id: conversationId,
          messages: historyMessages ?? [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const conversationId = await resolveConversationId();
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

    if (
      parsedResponse &&
      typeof parsedResponse === "object" &&
      "reply" in parsedResponse &&
      typeof (parsedResponse as { reply?: unknown }).reply === "string"
    ) {
      const url = new URL(req.url);
      const systemEndpoint = new URL("/api/chat/system", url);
      const systemRes = await fetch(systemEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: (parsedResponse as { reply: string }).reply, conversation_id: conversationId }),
      });

      if (!systemRes.ok) {
        const errorText = await systemRes.text();
        throw new Error(`Failed to persist assistant reply: ${errorText}`);
      }
    }

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
