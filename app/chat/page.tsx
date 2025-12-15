"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  ChangeEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { createClient as createSupabaseClient } from "@/utils/supabase/client";
import { getSession } from "@/utils/supabase/session";
import LoginPage from "../auth/login/page";

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
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const supabase: SupabaseClient | null = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null;
    }

    return createSupabaseClient();
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const currentSession = await getSession();

      if (!isMounted) return;

      setSession(currentSession);
      setAuthLoading(false);
    }

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;

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
            nextSeen.add(String(m.id));
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
  }, [session]);

  useEffect(() => {
    if (initialLoadRef.current) {
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

          const idKey = String(newMessage.id);
          if (seenIdsRef.current.has(idKey)) return;

          seenIdsRef.current.add(idKey);

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
    const userText = input.trim();
    if (!userText || sending) return;

    setSending(true);

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
        incoming.push(data.userMessage);
        seenIdsRef.current.add(String(data.userMessage.id));
      }

      if (data?.assistantMessage) {
        incoming.push(data.assistantMessage);
        seenIdsRef.current.add(String(data.assistantMessage.id));
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

      setInput("");
      clearAllFiles();
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
    if (e.key !== "Enter" || e.shiftKey) return;

    if (input.trim() && !sending) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(files);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setAttachedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

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

  if (authLoading) return null;
  if (!session || !session.user) return <LoginPage />;

  return (
    <div className="chat-page h-[calc(100vh-120px)] overflow-hidden">
      <header className="rounded-3xl border border-[var(--line)] bg-[rgba(13,19,35,0.85)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h1 className="text-3xl font-black text-white">Chat with BillyBot</h1>
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

        <div className="chat-composer">
          <div className={`chat-attachment-row ${attachedFiles.length ? "is-visible" : ""}`}>
            <span className="chat-attachment-label">Attachments</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="chat-attachment-pill">
                  <span className="chat-attachment-name">{file.name}</span>
                  <button
                    type="button"
                    className="chat-attachment-remove"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="chat-input-row" style={{ alignItems: "center", gap: "12px" }}>
            <div className="chat-input-shell" style={{ padding: "12px 16px", gap: "12px" }}>
              <button
                type="button"
                onClick={openFilePicker}
                className="chat-upload-btn"
                aria-label="Upload files"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                  className="chat-upload-icon"
                >
                  <path d="M12 5v14m-7-7h14" strokeWidth={1.8} strokeLinecap="round" />
                </svg>
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Tell BillyBot what you need."
                className="chat-input resize-none"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="chat-send-btn flex items-center justify-center gap-2"
              style={{ height: "56px", padding: "0 20px" }}
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
    </div>
  );
}
