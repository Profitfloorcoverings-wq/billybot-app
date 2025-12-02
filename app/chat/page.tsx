"use client";
export const dynamic = "force-dynamic";


import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function ChatPage() {
  const supabase = createSupabaseBrowser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load existing messages
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });

      setMessages(data || []);
    }
    load();
  }, []);

  // Realtime listener
  useEffect(() => {
    const channel = supabase
      .channel("messages-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;

    await fetch("/api/chat/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input })
    });

    setInput("");
  }

  return (
    <div className="flex flex-col h-screen">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div key={msg.id} className="bg-gray-800 p-3 rounded text-white">
            {msg.content}
          </div>
        ))}
      </div>

      <div className="p-4 flex gap-2">
        <input
          className="flex-1 p-2 border rounded"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}
