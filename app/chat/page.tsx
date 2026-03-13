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
import DiaryConfirmationCard from "./components/DiaryConfirmationCard";
import QuoteBuilderCard from "./components/QuoteBuilderCard";
import type { LineItem } from "./components/QuoteBuilderCard";
import InvoiceBuilderCard from "./components/InvoiceBuilderCard";
import EmailDraftCard from "./components/EmailDraftCard";
import TeamMessageCard from "./components/TeamMessageCard";

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
  label: "QUOTE" | "JOB SHEET" | "RISK ASSESSMENT" | "METHOD STATEMENT";
  reference?: string | null;
  url: string;
};

const LINK_CARD_STYLES: Record<LinkCardProps["label"], { border: string; background: string; shadow: string; icon: string; openText: string }> = {
  "QUOTE": {
    border: "rgba(249,115,22,0.5)",
    background: "linear-gradient(135deg, #f97316, #fb923c)",
    shadow: "0 0 18px rgba(249,115,22,0.5)",
    icon: "📄",
    openText: "Open Quote",
  },
  "JOB SHEET": {
    border: "rgba(56,189,248,0.4)",
    background: "linear-gradient(135deg, #0369a1, #0ea5e9)",
    shadow: "0 0 18px rgba(56,189,248,0.4)",
    icon: "📋",
    openText: "Open Job Sheet",
  },
  "RISK ASSESSMENT": {
    border: "rgba(239,68,68,0.4)",
    background: "linear-gradient(135deg, #b91c1c, #ef4444)",
    shadow: "0 0 18px rgba(239,68,68,0.4)",
    icon: "⚠️",
    openText: "Open Risk Assessment",
  },
  "METHOD STATEMENT": {
    border: "rgba(34,197,94,0.4)",
    background: "linear-gradient(135deg, #15803d, #22c55e)",
    shadow: "0 0 18px rgba(34,197,94,0.4)",
    icon: "📝",
    openText: "Open Method Statement",
  },
};

function LinkCard({ label, reference, url }: LinkCardProps) {
  const title = reference ? `${label} ${reference}` : label;
  const s = LINK_CARD_STYLES[label];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#64748b", margin: 0 }}>
        {title}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${title}`}
        style={{ display: "block", width: "min(340px, 100%)", textDecoration: "none" }}
      >
        <div style={{
          borderRadius: "14px",
          border: `1px solid ${s.border}`,
          background: s.background,
          padding: "14px 20px",
          textAlign: "center" as const,
          fontSize: "14px",
          fontWeight: 800,
          color: "#fff",
          boxShadow: s.shadow,
          transition: "filter 0.12s ease, transform 0.12s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}>
          <span style={{ fontSize: "16px" }}>{s.icon}</span>
          {s.openText}
        </div>
      </a>
    </div>
  );
}

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;
type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

function formatMessageTime(ts?: string): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const taskHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

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
    taskState === "building_quote" || taskState === "updating_quote" || taskState === "building_job_sheet" || taskState === "building_rams";

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

    if (taskState === "building_job_sheet") {
      return {
        title: "Building job sheet…",
        subtext: "Please wait while I put together the job sheet.",
      };
    }

    if (taskState === "building_rams") {
      return {
        title: "Building RAMS documents…",
        subtext: "Please wait while I generate the risk assessment and method statement.",
      };
    }

    return null;
  }, [taskState]);

  const triggerTaskHint = () => {
    if (!isLocked) return;

    const hint =
      taskState === "updating_quote"
        ? "Quote is updating. Wait a moment."
        : taskState === "building_job_sheet"
          ? "Job sheet is being built. Wait a moment."
          : taskState === "building_rams"
            ? "RAMS documents are being generated. Wait a moment."
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

  useEffect(() => {
    const w = window as WindowWithSpeech;
    setVoiceSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleVoice() {
    if (isLocked || sending) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const w = window as WindowWithSpeech;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-GB";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  async function sendMessageCore(userText: string, filesToSend: File[]) {
    const hasAttachments = filesToSend.length > 0;

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
                // Infer MIME type from extension if browser returns empty type (common with HEIC)
                let mimeType = file.type;
                if (!mimeType) {
                  const ext = file.name.split(".").pop()?.toLowerCase();
                  if (ext === "heic" || ext === "heif") mimeType = "image/heic";
                  else if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
                  else if (ext === "png") mimeType = "image/png";
                  else if (ext === "webp") mimeType = "image/webp";
                  else if (ext === "pdf") mimeType = "application/pdf";
                  else mimeType = "application/octet-stream";
                }
                resolve({
                  name: file.name,
                  type: mimeType,
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

  async function sendMessage() {
    if (isLocked) return;
    const userText = input.trim();
    const filesToSend = attachedFiles;
    if ((!userText && filesToSend.length === 0) || sending) return;
    await sendMessageCore(userText, filesToSend);
  }

  async function sendPrompt(text: string) {
    if (isLocked || sending) return;
    await sendMessageCore(text, []);
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

    if (m.type === "risk_assessment") {
      const url = isHttpUrl(m.content.trim()) ? m.content.trim() : null;
      if (url) {
        return <LinkCard label="RISK ASSESSMENT" url={url} />;
      }
    }

    if (m.type === "method_statement") {
      const url = isHttpUrl(m.content.trim()) ? m.content.trim() : null;
      if (url) {
        return <LinkCard label="METHOD STATEMENT" url={url} />;
      }
    }

    if (m.type === "quote_builder" && conversationId) {
      const { lines: initialLines, generated } = (() => {
        try {
          const parsed = JSON.parse(m.content) as LineItem[] | { lines: LineItem[]; generated?: boolean };
          if (Array.isArray(parsed)) return { lines: parsed, generated: false };
          if (parsed && Array.isArray(parsed.lines)) return { lines: parsed.lines, generated: !!parsed.generated };
          return { lines: [], generated: false };
        } catch {
          return { lines: [], generated: false };
        }
      })();
      return <QuoteBuilderCard conversationId={conversationId} messageId={String(m.id)} initialLines={initialLines} initialDone={generated} />;
    }

    if (m.type === "invoice_builder" && conversationId) {
      const parsed = (() => {
        try {
          return JSON.parse(m.content) as {
            lines?: LineItem[];
            quote_id?: string;
            quote_reference?: string;
            customer_name?: string;
            billing_email?: string;
            billing_address?: string;
          };
        } catch {
          return null;
        }
      })();
      if (parsed) {
        return (
          <InvoiceBuilderCard
            conversationId={conversationId}
            initialLines={Array.isArray(parsed.lines) ? parsed.lines : []}
            quoteId={parsed.quote_id}
            quoteReference={parsed.quote_reference}
            customerName={parsed.customer_name}
            billingEmail={parsed.billing_email}
            billingAddress={parsed.billing_address}
          />
        );
      }
    }

    if (m.type === "email_draft") {
      const data = (() => { try { return JSON.parse(m.content); } catch { return null; } })();
      if (data?.job_id) return <EmailDraftCard data={data} />;
    }

    if (m.type === "team_message") {
      const tmData = (() => { try { return JSON.parse(m.content); } catch { return null; } })();
      if (tmData?.sender_name) return <TeamMessageCard data={tmData} />;
    }

    if (m.type === "diary_confirmation") {
      const confirmData = (() => {
        try {
          return JSON.parse(m.content) as Parameters<typeof DiaryConfirmationCard>[0]["data"];
        } catch {
          return null;
        }
      })();
      if (confirmData) {
        return <DiaryConfirmationCard key={m.id} messageId={m.id} data={confirmData} />;
      }
    }

    return (
      <div className="chat-md">
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

      <header style={{ marginBottom: "0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Chat with BillyBot</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Your AI flooring operator — quote, schedule, and manage jobs by chat.
            </p>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 12px", borderRadius: "999px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", flexShrink: 0 }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.7)", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#4ade80", letterSpacing: "0.04em" }}>BillyBot online</span>
          </div>
        </div>
      </header>

      <div className="chat-panel min-h-0">
        {/* Conversation bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "12px", background: "rgba(255,255,255,0.03)", padding: "7px 14px", marginBottom: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.18em", color: "#475569" }}>Conversation</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {loading ? (
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Syncing…</span>
            ) : (
              <>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px rgba(34,197,94,0.6)" }} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#4ade80", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>Live</span>
              </>
            )}
          </div>
        </div>

        <div className="chat-messages">
          {!loading && messages.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "20px", padding: "24px 16px" }}>
              <p style={{ color: "#64748b", fontSize: "14px", fontWeight: 600, margin: 0, textAlign: "center" }}>
                What do you need to quote today?
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                {[
                  { label: "Quote a 20m² LVT kitchen", message: "I need to quote a 20m² LVT kitchen floor — supply and fit." },
                  { label: "Repair a vinyl floor", message: "I need to quote a vinyl floor repair, roughly 2m² patch." },
                  { label: "Price up a full house carpet", message: "I need to price up carpeting a full house — 3 beds, landing, and stairs." },
                ].map(({ label, message }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => void sendPrompt(message)}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "#cbd5e1",
                      fontSize: "13px",
                      fontWeight: 500,
                      padding: "10px 16px",
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(249,115,22,0.4)";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(249,115,22,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"}`}
            >
              <div className={`chat-badge ${m.role === "user" ? "chat-badge-user" : ""}`}>
                {m.role === "user" ? "You" : "BillyBot"}
                {m.created_at ? (
                  <span style={{ opacity: 0.5, fontWeight: 400, marginLeft: "6px" }}>
                    {formatMessageTime(m.created_at)}
                  </span>
                ) : null}
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
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>{taskBannerContent.title}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{taskBannerContent.subtext}</div>
              </div>
            </div>
          ) : null}
          {taskHint ? <div className="chat-task-hint">{taskHint}</div> : null}

          <div className={`chat-attachment-row ${attachedFiles.length ? "is-visible" : ""}`}>
            <span className="chat-attachment-label">Attachments</span>
            <div style={{ display: "flex", flex: 1, flexWrap: "wrap", gap: "8px" }}>
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
              accept="image/*,application/pdf,.heic,.heif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {voiceSupported ? (
              <button
                type="button"
                onClick={toggleVoice}
                disabled={isLocked || sending}
                aria-label={isListening ? "Stop recording" : "Start voice input"}
                style={{
                  flexShrink: 0,
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: isListening ? "none" : "1px solid rgba(255,255,255,0.1)",
                  background: isListening ? "#ef4444" : "rgba(255,255,255,0.05)",
                  color: isListening ? "#fff" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: isLocked || sending ? "not-allowed" : "pointer",
                  transition: "background 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: isListening ? "0 0 0 4px rgba(239,68,68,0.25)" : "none",
                  animation: isListening ? "mic-pulse 1.4s ease-in-out infinite" : "none",
                  opacity: isLocked || sending ? 0.4 : 1,
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="9" y1="22" x2="15" y2="22" />
                </svg>
              </button>
            ) : null}

            <button
              onClick={sendMessage}
              disabled={(!input.trim() && attachedFiles.length === 0) || sending || isLocked}
              className="chat-send-btn"
            >
              {sending ? (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="chat-send-loader" aria-hidden />
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>Working…</span>
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
