"use client";

import { useState, useEffect, useRef, KeyboardEvent, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------- Browser Supabase Client ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This runs safely in the browser only
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

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

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ---------- Load chat history ----------
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const rows = (data?.messages ?? []) as DbMessage[];

      if (rows.length) {
        if (!conversationId) {
          setConversationId(rows[0].conversation_id);
        }

        const formatted: UiMessage[] = rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          type: m.type ?? undefined,
          quote_reference: m.quote_reference ?? undefined,
        }));

        setMessages(formatted);
      }
    } catch (err) {
      console.error("History load error:", err);
    }
  }, [conversationId]);

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ---------- Supabase Realtime ----------
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: { new: DbMessage }) => {
          const row = payload.new;

          // Assistant only (user messages are optimistic)
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                role: row.role,
                content: row.content ?? "",
                type: row.type ?? undefined,
                quote_reference: row.quote_reference ?? undefined,
              },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: text },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        console.error("Send failed", await res.text());
        return;
      }

      // If first message ever, load history to get conversation_id
      if (!conversationId) {
        await loadHistory();
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
          Chat
        </h1>
      </div>

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
        <div ref={bottomRef} />
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
