"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export const dynamic = "force-dynamic";

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversation_id: string;
  created_at: string;
};

export default function ChatPage() {
  const supabase = createSupabaseBrowser();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  // ✅ Give messages a real type, fixes the "never[]" error
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ------------------------------------------------------------
  // 1) Load existing history via /api/chat
  // ------------------------------------------------------------
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
        });

        if (!res.ok) {
          console.error("History load failed:", await res.text());
          return;
        }

        const data = await res.json();

        const history: DbMessage[] = (data?.messages || []).map((m: any) => ({
          id: m.id ?? `${Date.now()}-${Math.random()}`,
          role: m.role ?? "assistant",
          content: m.content ?? "",
          conversation_id: m.conversation_id ?? "",
          created_at: m.created_at ?? new Date().toISOString(),
        }));

        setMessages(history);

        if (history.length > 0) {
          setConversationId(history[0].conversation_id);
        }
      } catch (err) {
        console.error("Error loading history:", err);
      }
    }

    loadHistory();
  }, []);

  // ------------------------------------------------------------
  // 2) Scroll to bottom when messages change
  // ------------------------------------------------------------
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ------------------------------------------------------------
  // 3) Supabase Realtime subscription for new messages
  //    (e.g. n8n replies inserted via /api/chat/system)
  // ------------------------------------------------------------
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          const m: any = payload.new;

          const newMessage: DbMessage = {
            id: m.id ?? `${Date.now()}-${Math.random()}`,
            role: m.role ?? "assistant",
            content: m.content ?? "",
            conversation_id: m.conversation_id ?? conversationId,
            created_at: m.created_at ?? new Date().toISOString(),
          };

          setMessages(prev => [...prev, newMessage]);
        }
      );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, supabase]);

  // ------------------------------------------------------------
  // 4) Send message via /api/chat
  // ------------------------------------------------------------
  async function sendMessage() {
    if (!input.trim() || isSending) return;

    const text = input.trim();
    setInput("");
    setIsSending(true);

    // Optimistic user bubble
    const tempMessage: DbMessage = {
      id: `${Date.now()}-${Math.random()}`,
      role: "user",
      content: text,
      conversation_id: conversationId ?? "",
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        console.error("Chat send failed:", await res.text());
      } else {
        const data = await res.json();

        // If backend ever returns conversation_id, capture it
        if (data?.conversation_id && !conversationId) {
          setConversationId(data.conversation_id as string);
        }
        // Assistant reply will come in via Realtime, so no need to append here
      }
    } catch (err) {
      console.error("Chat error:", err);
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

  // ------------------------------------------------------------
  // 5) UI
  // ------------------------------------------------------------
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text)]">
          Chat
        </h1>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.85)] p-4">
        {messages.map(m => (
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

      {/* Input bar */}
      <div className="rounded-2xl border border-[var(--line)] bg-[rgba(15,23,42,0.9)] px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
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
