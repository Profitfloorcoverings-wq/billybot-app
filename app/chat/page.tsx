"use client";

import { useState, useEffect, useRef, KeyboardEvent, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------- Browser Supabase Client ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createBrowserSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase env vars; skipping realtime client init");
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error("Supabase client init error:", err);
    return null;
  }
}

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "quote" | null;
  quote_reference?: string | null;
  conversation_id: string;
  created_at: string;
};

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "quote" | null;
  quote_reference?: string | null;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Init browser client
  useEffect(() => {
    setSupabaseClient(createBrowserSupabaseClient());
  }, []);

  // ---------- Load chat history ----------
  const loadMessagesFromSupabase = useCallback(
    async (conversation_id: string) => {
      if (!supabaseClient) return;

      const { data, error } = await supabaseClient
        .from("messages")
        .select("id, role, content, type, quote_reference, created_at")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Supabase history error:", error);
        return;
      }

      const formatted: UiMessage[] = (data ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content ?? "",
        type: m.type ?? undefined,
        quote_reference: m.quote_reference ?? undefined,
      }));

      setMessages(formatted);
    },
    [supabaseClient]
  );

  // ---------- Load or create conversation ----------
  const initializeConversation = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const rows = (data?.messages ?? []) as DbMessage[];
      const formattedRows: UiMessage[] = rows.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content ?? "",
        type: m.type ?? undefined,
        quote_reference: m.quote_reference ?? undefined,
      }));

      const existingConvIdFromRows =
        rows.length > 0 ? rows[0].conversation_id : null;

      const existingConvIdFromPayload =
        typeof data?.conversation_id === "string" ? data.conversation_id : null;

      const resolvedConversationId =
        existingConvIdFromRows ?? existingConvIdFromPayload;

      if (formattedRows.length > 0) {
        setMessages(formattedRows);
      }

      if (resolvedConversationId) {
        setConversationId(resolvedConversationId);
        await loadMessagesFromSupabase(resolvedConversationId);
      }
    } catch (err) {
      console.error("History load error:", err);
    }
  }, [loadMessagesFromSupabase]);

  useEffect(() => {
    initializeConversation();
  }, [initializeConversation]);

  useEffect(() => {
    if (conversationId && supabaseClient) {
      loadMessagesFromSupabase(conversationId);
    }
  }, [conversationId, supabaseClient, loadMessagesFromSupabase]);

  // ---------- Realtime subscription ----------
  useEffect(() => {
    if (!conversationId || !supabaseClient) return;

    const channel = supabaseClient
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as DbMessage;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;

            return [
              ...prev,
              {
                id: row.id,
                role: row.role,
                content: row.content,
                type: row.type ?? undefined,
                quote_reference: row.quote_reference ?? undefined,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [conversationId, supabaseClient]);

  // ---------- Auto-scroll ----------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ---------- Send Message ----------
  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);

    // optimistic UI
    const localId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: localId, role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        console.error("Send failed", await res.text());
      }

      const data = await res.json().catch(() => null);
      const newConversationId =
        typeof data?.conversation_id === "string" ? data.conversation_id : null;

      if (newConversationId && newConversationId !== conversationId) {
        setConversationId(newConversationId);
        await loadMessagesFromSupabase(newConversationId);
      } else if (!conversationId) {
        await initializeConversation();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Error: Could not reach BillyBot.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ---------- UI ----------
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
        Chat
      </h1>

      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.85)] p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed
                ${
                  m.role === "user"
                    ? "bg-[var(--brand1)] text-white rounded-br-none"
                    : "bg-[#1f2937] text-[var(--text)] border border-[var(--line)] rounded-bl-none"
                }`}
            >
              {m.type === "quote" ? (
                <a
                  href={m.content}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-1 rounded-lg bg-[rgba(255,255,255,0.05)] px-3 py-2 text-left text-[var(--text)] hover:bg-[rgba(255,255,255,0.08)]"
                >
                  <span className="text-sm font-semibold">
                    {m.quote_reference
                      ? `Quote ${m.quote_reference} is ready`
                      : "Quote is ready"}
                  </span>
                  <span className="text-xs text-[var(--muted)]">Tap to open</span>
                </a>
              ) : (
                <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef}></div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.9)] px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message BillyBot…"
            className="flex-1 resize-none bg-transparent text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() || isSending}
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand1)] px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-[var(--brand2)] disabled:opacity-40"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
