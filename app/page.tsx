"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useState, useEffect, useCallback, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversation_id: string;
  created_at: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// ---------- Supabase client (browser) ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // ---------- Load history from /api/chat ----------
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
      });

      if (!res.ok) {
        console.error("History request failed", await res.text());
        return;
      }

      const data = await res.json();

      const rows: DbMessage[] = data?.messages ?? [];

      if (rows.length) {
        // Save conversation id from first row
        if (!conversationId) {
          setConversationId(rows[0].conversation_id);
        }

        const formatted: Message[] = rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));

        setMessages(formatted);
      }
    } catch (err) {
      console.error("Error loading history:", err);
    }
  }, [conversationId]);

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ---------- Supabase Realtime subscription ----------
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
        (payload) => {
          const row = payload.new as DbMessage;

          // We only care about assistant messages here.
          // User messages typed in the app are already shown optimistically.
          if (row.role !== "assistant") return;

          setMessages((prev) => {
            // Avoid duplicates if we somehow already have this id
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                role: row.role,
                content: row.content,
              },
            ];
          });
        }
      )
      .subscribe();

    // Clean up on unmount / conversation change
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // ---------- Send message ----------
  async function sendMessage() {
    if (!input.trim() || isSending) return;

    const userText = input.trim();
    setInput("");

    // Optimistic user bubble
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: userText },
    ]);

    setIsSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok) {
        console.error("Chat send failed", await res.text());
      } else {
        // After the server inserts rows, Realtime will push the assistant reply.
        // If this was the very first message, reload history so we get conversation_id.
        if (!conversationId) {
          await loadHistory();
        }
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
      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
          Chat
        </h1>
      </div>

      {/* MESSAGES */}
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
                }
              `}
              style={{
                padding: "8px 12px",
                lineHeight: "1.35",
                fontSize: "0.9rem",
              }}
            >
              <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* INPUT BAR */}
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
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand1)] px-4 py-2 text-sm font-medium text-white shadow-md shadow-[rgba(235,139,37,0.4)] hover:bg-[var(--brand2)] disabled:opacity-40"
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
