"use client";

import { useEffect, useState, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@supabase/supabase-js";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  conversation_id: string;
  created_at: string;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Supabase browser client (uses NEXT_PUBLIC_ keys)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Load history
  useEffect(() => {
    async function loadHistory() {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
      });

      const data = await res.json();

      if (data?.messages?.length) {
        setMessages(data.messages);
        setConversationId(data.messages[0].conversation_id);
      }
    }

    loadHistory();
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel("chat_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const m = payload.new as Message;

          setMessages((prev) => {
            // avoid duplicates
            if (prev.some((x) => x.id === m.id)) return prev;
            return [...prev, m];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Sending user message
  async function sendMessage() {
    if (!input.trim()) return;
    const text = input;
    setInput("");

    // Optimistic local render
    const temp: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      conversation_id: conversationId || "",
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, temp]);

    // Send to backend
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    // The bot reply will come through Supabase Realtime automatically
    if (data.conversation_id && !conversationId) {
      setConversationId(data.conversation_id);
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
              className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-[var(--brand1)] text-white rounded-br-none"
                  : "bg-[#1f2937] text-[var(--text)] border border-[var(--line)] rounded-bl-none"
              }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
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
            disabled={!input.trim()}
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand1)] px-4 py-2 text-sm font-medium text-white shadow-md shadow-[rgba(235,139,37,0.4)] hover:bg-[var(--brand2)] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
