"use client";

import { useEffect, useState, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export default function ChatPage() {
  const supabase = createSupabaseBrowser();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load history and conversation id on mount
  useEffect(() => {
    async function loadHistory() {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "__LOAD_HISTORY__" })
      });

      const data = await res.json();

      if (data?.messages?.length) {
        const convoId = data.messages[0].conversation_id;
        setConversationId(convoId);

        const formatted = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          created_at: m.created_at
        }));

        setMessages(formatted);
      }

      setLoading(false);
    }

    loadHistory();
  }, []);

  // Subscribe to realtime messages for this conversation
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel("chat-stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => [...prev, m]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  async function sendMessage() {
    if (!input.trim()) return;
    const userText = input;
    setInput("");

    // UI instant update
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        role: "user",
        content: userText,
        created_at: new Date().toISOString()
      }
    ]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userText })
    });

    // The reply will arrive through realtime subscription
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (loading) return <div className="p-6 text-white">Loading chat…</div>;

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <h1 className="text-3xl font-semibold text-white">Chat</h1>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-gray-700 bg-[rgba(15,23,42,0.85)] p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-700 text-gray-200 border border-gray-600 rounded-bl-none"
              }`}
            >
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-gray-700 bg-[rgba(15,23,42,0.9)] px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message BillyBot…"
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-md hover:bg-blue-700 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
