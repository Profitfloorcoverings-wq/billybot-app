"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// FIX: Don't create Supabase on the server
function getSupabase() {
  if (typeof window === "undefined") return null;
  return createSupabaseBrowser();
}

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversation_id: string | null;
  created_at: string;
};

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // 1) Load existing history from /api/chat
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
        });

        const data = await res.json();

        if (Array.isArray(data?.messages)) {
          const dbMessages = data.messages as DbMessage[];

          // map into strictly typed UI messages
          setMessages(
            dbMessages.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content ?? "",
            }))
          );

          // grab conversation_id for Realtime
          const firstConvo = dbMessages[0]?.conversation_id;
          if (firstConvo) setConversationId(firstConvo);
        }
      } catch (err) {
        console.error("Error loading history", err);
      }
    }

    loadHistory();
  }, []);

  // 2) Supabase Realtime for new messages in this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-messages-${conversationId}`)
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
            // avoid duplicates if we already have this id
            if (prev.some((m) => m.id === row.id)) return prev;

            return [
              ...prev,
              { id: row.id, role: row.role, content: row.content ?? "" },
            ];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // 3) Auto-scroll when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // 4) Send a message via /api/chat (n8n + system route still work)
  async function sendMessage() {
    const text = input.trim();
    if (!text) return;

    setInput("");
    setIsSending(true);

    // optimistic user bubble
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: "user", content: text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      const replyText =
        typeof data.reply === "string"
          ? data.reply
          : "BillyBot didn't respond.";

      // optimistic assistant bubble – Realtime will also insert the “real” row
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now() + 1}`,
          role: "assistant",
          content: replyText,
        },
      ]);
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
                }`}
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
        <div ref={bottomRef} />
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
