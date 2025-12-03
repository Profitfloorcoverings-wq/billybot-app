"use client";

import { useEffect, useMemo, useRef, useState, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Message = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  type?: string | null;
  conversation_id?: string;
  quote_reference?: string | null;
  created_at?: string;
};

type HistoryResponse = {
  conversation_id: string;
  messages: Message[];
};

type SendResponse = {
  reply: string;
  conversation_id: string;
  userMessage?: Message;
  assistantMessage?: Message;
};

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const supabase: SupabaseClient | null = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "__LOAD_HISTORY__" }),
        });

        const data = (await res.json()) as HistoryResponse;
        if (data?.conversation_id) {
          setConversationId(data.conversation_id);
        }

        if (Array.isArray(data?.messages)) {
          setMessages(data.messages);
          const nextSeen = new Set<string>();
          data.messages.forEach((m) => {
            if (typeof m.id === "number" || typeof m.id === "string") {
              nextSeen.add(String(m.id));
            }
          });
          seenIdsRef.current = nextSeen;
        }
      } catch (err) {
        console.error("Error loading history:", err);
      } finally {
        setLoading(false);
        scrollToBottom("auto");
      }
    }

    loadHistory();
  }, []);

  useEffect(() => {
    if (initialLoadRef.current) {
      // Avoid jumpy behavior on the very first render; history load already scrolls.
      initialLoadRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!supabase || !conversationId) return;

    const channel = supabase
      .channel(`messages-conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message & { conversation_id?: string };
          const eventConversationId = newMessage.conversation_id
            ? String(newMessage.conversation_id)
            : null;
          if (!eventConversationId || eventConversationId !== String(conversationId)) return;

          const idKey =
            typeof newMessage.id === "number" || typeof newMessage.id === "string"
              ? String(newMessage.id)
              : null;
          if (idKey && seenIdsRef.current.has(idKey)) {
            return;
          }
          if (idKey) {
            seenIdsRef.current.add(idKey);
          }
          setMessages((prev) => [...prev, { ...newMessage, conversation_id: eventConversationId }]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  async function sendMessage() {
    if (!input.trim() || sending) return;

    setSending(true);
    const userText = input.trim();
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data = (await res.json()) as SendResponse;

      if (data?.conversation_id && !conversationId) {
        setConversationId(data.conversation_id);
      }

      const incoming: Message[] = [];
      if (data?.userMessage) {
        const msg = data.userMessage;
        if (typeof msg.id === "number" || typeof msg.id === "string") {
          seenIdsRef.current.add(String(msg.id));
        }
        incoming.push(msg);
      }
      if (data?.assistantMessage) {
        const msg = data.assistantMessage;
        if (typeof msg.id === "number" || typeof msg.id === "string") {
          seenIdsRef.current.add(String(msg.id));
        }
        incoming.push(msg);
      } else if (data?.reply) {
        incoming.push({
          id: Date.now(),
          role: "assistant",
          content: data.reply,
          type: "text",
        });
      }

      if (incoming.length) {
        setMessages((prev) => [...prev, ...incoming]);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "assistant",
          content: "Error: Could not reach BillyBot.",
          type: "text",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const renderMessage = (m: Message) => {
    if (m.type === "quote") {
      const label = m.quote_reference ? `Quote ${m.quote_reference}` : "Quote";
      return (
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</div>
          <a
            className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[rgba(37,99,235,0.12)] px-4 py-3 text-[var(--text)] shadow-md transition hover:border-[var(--brand2)] hover:bg-[rgba(59,130,246,0.16)]"
            href={m.content}
            target="_blank"
            rel="noreferrer"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand1)] text-white shadow-lg">
              PDF
            </span>
            <div className="flex flex-col">
              <span className="font-semibold">{label} is ready</span>
              <span className="text-sm text-[var(--muted)]">Tap to open the download</span>
            </div>
          </a>
        </div>
      );
    }

    return (
      <div className="prose prose-invert max-w-none text-sm leading-normal [&_p]:my-1 [&_li]:my-0 [&_ul]:my-1">
        <ReactMarkdown>{m.content}</ReactMarkdown>
      </div>
    );
  };

  return (
    <div className="chat-page h-[calc(100vh-120px)] overflow-hidden">
      <header className="rounded-3xl border border-[var(--line)] bg-[rgba(13,19,35,0.85)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black text-white">Chat with BillyBot</h1>
          </div>
          <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-[rgba(37,99,235,0.12)] px-4 py-3 text-[var(--text)] border border-[var(--line)]">
            <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            <div className="text-sm font-semibold">Live updates enabled</div>
          </div>
        </div>
      </header>

      <div className="chat-panel min-h-0">
        <div className="flex items-center justify-between rounded-2xl bg-[rgba(255,255,255,0.04)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>Conversation</span>
          <span>{loading ? "Syncing…" : "Live"}</span>
        </div>

        <div className="chat-messages flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[rgba(6,10,20,0.8)] p-4 shadow-[0_14px_38px_rgba(0,0,0,0.35)]">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"}`}
            >
              <div className={`chat-badge ${m.role === "user" ? "chat-badge-user" : ""}`}>
                {m.role === "user" ? "You" : "BillyBot"}
              </div>
              {renderMessage(m)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-row">
          <div className="chat-input-shell">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Tell BillyBot what you need."
              className="chat-input resize-none"
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="chat-send-btn"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="chat-send-loader" aria-hidden />
                <span className="text-sm font-semibold">Working…</span>
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
