"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  ChangeEvent,
  Suspense,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createClient as createSupabaseClient } from "@/utils/supabase/client";
import { getSession } from "@/utils/supabase/session";
import { useClientFlags } from "@/components/client-flags/ClientFlagsProvider";
import LoginPage from "../auth/login/page";

type Message = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  type?: string | null;
  conversation_id?: string;
  quote_reference?: string | null;
  job_sheet_reference?: string | null;
  file_url?: string | null;
  created_at?: string;
};

type LinkCardProps = {
  label: "QUOTE" | "JOB SHEET";
  reference?: string | null;
  url: string;
};

function LinkCard({ label, reference, url }: LinkCardProps) {
  const title = reference ? `${label} ${reference}` : label;

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {title}
      </div>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${title}`}
        className="block w-[min(360px,100%)]"
      >
        <div className="rounded-2xl border border-[rgba(249,115,22,0.55)] bg-[linear-gradient(135deg,var(--orange-1),var(--orange-2))] px-5 py-4 text-center text-sm font-extrabold text-white shadow-[0_0_18px_var(--orange-glow)] transition hover:brightness-105">
          Open
        </div>
      </a>
    </div>
  );
}

const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value);

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
type BannerState = {
  showBanner: boolean;
  showPricingBtn: boolean;
  showUploadBtn: boolean;
};

function ChatPageContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [bannerState, setBannerState] = useState<BannerState | null>(null);
  const [taskState, setTaskState] = useState<
    "idle" | "building_quote" | "updating_quote" | string
  >("idle");
  const [taskHint, setTaskHint] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const taskHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { flags } = useClientFlags();
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversation_id");

  const supabase: SupabaseClient | null = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null;
    }

    return createSupabaseClient();
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const isLocked =
    taskState === "building_quote" || taskState === "updating_quote";

  const taskBannerContent = useMemo(() => {
    if (taskState === "building_quote") {
      return {
        title: "Building quote…",
        subtext: "Please wait for it to finish generating before requesting changes.",
      };
    }

    if (taskState === "updating_quote") {
      return {
        title: "Updating quote…",
        subtext: "Please wait — I’m applying your changes.",
      };
    }

    return null;
  }, [taskState]);

  const triggerTaskHint = () => {
    if (!isLocked) return;

    const hint =
      taskState === "updating_quote"
        ? "Quote is updating. Wait a moment."
        : "Quote is still being built. Wait a moment.";

    setTaskHint(hint);

    if (taskHintTimeoutRef.current) {
      clearTimeout(taskHintTimeoutRef.current);
    }

    taskHintTimeoutRef.current = setTimeout(() => {
      setTaskHint(null);
    }, 2000);
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
          body: JSON.stringify({
            message: "__LOAD_HISTORY__",
            conversation_id: requestedConversationId ?? undefined,
          }),
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
  }, [session, requestedConversationId]);

  const computedBanner = useMemo(() => {
    if (flags.loading) {
      return null;
    }

    const showBanner = !(flags.hasEdited && flags.hasUploaded);
    const showPricingBtn = !flags.hasEdited;
    const showUploadBtn = !flags.hasUploaded;

    return { showBanner, showPricingBtn, showUploadBtn };
  }, [flags.hasEdited, flags.hasUploaded, flags.loading]);

  useEffect(() => {
    if (!computedBanner) return;
    setBannerState(computedBanner);
  }, [computedBanner]);

  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!supabase || !conversationId) return;

    let isMounted = true;

    async function fetchTaskState() {
      const client = supabase;
      if (!client) return;

      const { data, error } = await client
        .from("conversations")
        .select("task_state")
        .eq("id", conversationId)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.warn("Failed to fetch task state:", error.message);
        return;
      }

      setTaskState(data?.task_state ?? "idle");
    }

    void fetchTaskState();

    return () => {
      isMounted = false;
    };
  }, [supabase, conversationId]);

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

  useEffect(() => {
    if (!supabase || !conversationId) return;

    const channel = supabase
      .channel(`conversation-task-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `id=eq.${conversationId}`,
        },
        (payload) => {
          const nextState = (payload.new as { task_state?: string }).task_state ?? "idle";
          setTaskState(nextState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    if (!isLocked) {
      setTaskHint(null);
    }
  }, [isLocked]);

  useEffect(() => {
    return () => {
      if (taskHintTimeoutRef.current) {
        clearTimeout(taskHintTimeoutRef.current);
      }
    };
  }, []);

  async function sendMessage() {
    if (isLocked) return;

    const userText = input.trim();
    const filesToSend = attachedFiles;
    const hasAttachments = filesToSend.length > 0;
    const hasContent = !!userText || hasAttachments;

    if (!hasContent || sending) return;

    setSending(true);

    if (hasAttachments) {
      const attachmentMessage: Message = {
        id: `attachment-${Date.now()}`,
        role: "user",
        type: "file",
        content:
          filesToSend.length === 1
            ? "\ud83d\udcce 1 attachment sent"
            : `\ud83d\udcce ${filesToSend.length} attachments sent`,
      };

      setMessages((prev) => [...prev, attachmentMessage]);
    }

    setInput("");
    clearAllFiles();

    try {
      const filesPayload = await Promise.all(
        filesToSend.map(
          (file) =>
            new Promise<{ name: string; type: string; size: number; base64: string }>((resolve, reject) => {
              const reader = new FileReader();

              reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";
                const base64 = result.includes(",") ? result.split(",", 2)[1] ?? "" : result;
                resolve({
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  base64,
                });
              };

              reader.onerror = () => {
                reject(reader.error ?? new Error("Failed to read file"));
              };

              reader.readAsDataURL(file);
            })
        )
      );

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversation_id: conversationId ?? requestedConversationId ?? undefined,
          files: filesPayload,
          history,
        }),
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
      console.warn("Chat request failed or delayed. Awaiting realtime reply.", err);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (isLocked) return;
    if (e.key !== "Enter" || e.shiftKey) return;

    if ((input.trim() || attachedFiles.length > 0) && !sending) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(files);
  };

  const removeFile = (index: number) => {
    if (isLocked) return;
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
      return <LinkCard label="QUOTE" reference={m.quote_reference} url={m.content} />;
    }

    if (m.type === "job_sheet") {
      const url = m.file_url || (isHttpUrl(m.content.trim()) ? m.content.trim() : null);

      if (url) {
        return <LinkCard label="JOB SHEET" reference={m.job_sheet_reference} url={url} />;
      }
    }

    return (
      <div className="prose prose-invert max-w-none text-sm leading-normal [&_p]:my-1 [&_li]:my-0 [&_ul]:my-1">
        <ReactMarkdown>{m.content}</ReactMarkdown>
      </div>
    );
  };

  if (authLoading) return null;
  if (!session || !session.user) return <LoginPage />;

  const effectiveBanner = computedBanner ?? bannerState;
  let bannerTitle = "Starter prices enabled";
  let bannerMessage = "update pricing settings or upload supplier price lists";

  if (flags.hasEdited && !flags.hasUploaded) {
    bannerTitle = "Pricing saved";
    bannerMessage = "upload a supplier price list to unlock full quoting";
  } else if (!flags.hasEdited && flags.hasUploaded) {
    bannerTitle = "Supplier prices added";
    bannerMessage = "review pricing settings to finish setup";
  }

  return (
    <div className="chat-page h-[calc(100vh-120px)] overflow-hidden">
      {effectiveBanner?.showBanner ? (
        <div className="starter-banner-wrap">
          <div className="starter-banner">
            <div className="starter-banner-left">
              <span className="starter-banner-dot" aria-hidden="true" />
              <span className="starter-banner-text">
                <strong>{bannerTitle}</strong>
                <span className="starter-banner-sep">—</span>
                <span className="starter-banner-msg">{bannerMessage}</span>
              </span>
            </div>

            <div className="starter-banner-actions">
              {effectiveBanner.showPricingBtn ? (
                <Link href="/pricing" className="starter-banner-btn starter-banner-btn-primary">
                  Pricing Settings
                </Link>
              ) : null}
              {effectiveBanner.showUploadBtn ? (
                <Link href="/suppliers" className="starter-banner-btn starter-banner-btn-ghost">
                  Upload Price Lists
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <header className="chat-header">
        <h1 className="section-title">Chat with BillyBot</h1>
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
          {taskBannerContent ? (
            <div className="chat-task-banner">
              <div className="chat-task-loader" aria-hidden="true">
                <span className="chat-task-dots" />
                <span className="chat-task-dots" />
                <span className="chat-task-dots" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{taskBannerContent.title}</div>
                <div className="text-xs text-[var(--muted)]">{taskBannerContent.subtext}</div>
              </div>
            </div>
          ) : null}
          {taskHint ? <div className="chat-task-hint">{taskHint}</div> : null}

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
                    disabled={isLocked}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div
            className="chat-input-row"
            onMouseDownCapture={(event) => {
              if (!isLocked) return;
              const target = event.target as HTMLElement;
              if (target.closest(".chat-input") || target.closest(".chat-upload-btn")) {
                triggerTaskHint();
              }
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (isLocked) {
                  triggerTaskHint();
                  return;
                }
                openFilePicker();
              }}
              className="chat-upload-btn"
              aria-label="Upload files"
              disabled={isLocked}
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
              disabled={isLocked}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={sendMessage}
              disabled={(!input.trim() && attachedFiles.length === 0) || sending || isLocked}
              className="chat-send-btn flex items-center justify-center gap-2"
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

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageContent />
    </Suspense>
  );
}
