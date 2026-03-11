"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Post = {
  id: string;
  platform: string;
  account_type: string;
  content_text: string;
  hashtags: string | null;
  pillar: string | null;
  visual_prompt: string | null;
  visual_url: string | null;
  video_url: string | null;
  scheduled_for: string | null;
  status: string;
  published_at: string | null;
  external_post_id: string | null;
  engagement: Record<string, number> | null;
  error_message: string | null;
  source_context: unknown;
  created_at: string;
};

const PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube"];
const ACCOUNT_TYPES = ["brand", "personal"];
const PILLARS = [
  "pain_solution", "demo", "humor", "social_proof", "education",
  "build_in_public", "founder_story", "ai_hot_take", "industry_insight", "lessons",
];

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "FB", instagram: "IG", linkedin: "LI", tiktok: "TT", youtube: "YT",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#9ca3af",
  pending_approval: "#f59e0b",
  approved: "#60a5fa",
  scheduled: "#818cf8",
  published: "#34d399",
  failed: "#f87171",
  rejected: "#6b7280",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getWeekDates(): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function defaultScheduleTime(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function ContentQueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"approval" | "calendar" | "all">("approval");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [bullets, setBullets] = useState("");
  const [genPlatforms, setGenPlatforms] = useState<string[]>(["facebook", "instagram", "linkedin"]);
  const [genAccountType, setGenAccountType] = useState("both");
  const [generating, setGenerating] = useState(false);

  // Edit modal
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");
  const [editHashtags, setEditHashtags] = useState("");
  const [editPillar, setEditPillar] = useState("");
  const [editSchedule, setEditSchedule] = useState("");
  const [saving, setSaving] = useState(false);

  // Video upload
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/content");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts ?? []);
      }
    } catch {
      console.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Derived
  const pendingApproval = posts.filter((p) => p.status === "pending_approval");
  const scheduled = posts.filter((p) => ["approved", "scheduled"].includes(p.status));
  const published = posts.filter((p) => p.status === "published");

  // Actions
  async function updatePost(id: string, updates: Record<string, unknown>) {
    const res = await fetch(`/api/content/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    return res.ok;
  }

  async function handleApprove(post: Post) {
    const scheduleFor = post.scheduled_for || defaultScheduleTime();
    const ok = await updatePost(post.id, { status: "scheduled", scheduled_for: scheduleFor });
    if (ok) {
      setToast({ message: "Approved & scheduled", type: "success" });
      void loadPosts();
    }
  }

  async function handleReject(id: string) {
    const ok = await updatePost(id, { status: "rejected" });
    if (ok) {
      setToast({ message: "Rejected", type: "success" });
      void loadPosts();
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/content/${id}`, { method: "DELETE" });
    if (res.ok) {
      setToast({ message: "Deleted", type: "success" });
      if (editPost?.id === id) setEditPost(null);
      void loadPosts();
    }
  }

  async function handleSave() {
    if (!editPost) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { content_text: editText };
      if (editHashtags !== (editPost.hashtags ?? "")) body.hashtags = editHashtags || null;
      if (editPillar !== (editPost.pillar ?? "")) body.pillar = editPillar || null;
      if (editSchedule) body.scheduled_for = new Date(editSchedule).toISOString();
      const ok = await updatePost(editPost.id, body);
      if (ok) {
        setEditPost(null);
        setToast({ message: "Updated", type: "success" });
        void loadPosts();
      }
    } catch {
      setToast({ message: "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!bullets.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullets, platforms: genPlatforms, account_type: genAccountType }),
      });
      if (res.ok) {
        const data = await res.json();
        setToast({ message: `${data.posts.length} posts generated`, type: "success" });
        setBullets("");
        setShowGenerate(false);
        void loadPosts();
      } else {
        const err = await res.json();
        setToast({ message: err.error ?? "Generation failed", type: "error" });
      }
    } catch {
      setToast({ message: "Generation failed", type: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Create a draft post with the video — generate captions via N8N
      const formData = new FormData();
      formData.append("video", file);
      const res = await fetch("/api/content/video", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setToast({ message: `Video uploaded, ${data.posts?.length ?? 0} variants created`, type: "success" });
        void loadPosts();
      } else {
        setToast({ message: "Video upload failed", type: "error" });
      }
    } catch {
      setToast({ message: "Video upload failed", type: "error" });
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  function openEdit(post: Post) {
    setEditPost(post);
    setEditText(post.content_text);
    setEditHashtags(post.hashtags ?? "");
    setEditPillar(post.pillar ?? "");
    setEditSchedule(post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : defaultScheduleTime());
  }

  // Calendar helpers
  const weekDates = getWeekDates();
  function postsForDay(date: Date) {
    const dayStr = date.toISOString().slice(0, 10);
    return posts.filter((p) => p.scheduled_for?.slice(0, 10) === dayStr && ["scheduled", "approved", "published"].includes(p.status));
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>
          Content Hub
          {pendingApproval.length > 0 && (
            <span style={{ marginLeft: 10, fontSize: 14, fontWeight: 600, color: "#f59e0b", background: "rgba(245, 158, 11, 0.12)", padding: "3px 10px", borderRadius: 12 }}>
              {pendingApproval.length} awaiting approval
            </span>
          )}
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="file" ref={videoInputRef} accept="video/*" onChange={handleVideoUpload} style={{ display: "none" }} />
          <button onClick={() => videoInputRef.current?.click()} disabled={uploading} style={btnSecondary}>
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
          <button onClick={() => setShowGenerate(true)} style={btnSecondary}>
            Generate Extra
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 12, color: "var(--muted)" }}>
        <span>{pendingApproval.length} pending</span>
        <span>{scheduled.length} scheduled</span>
        <span>{published.length} published</span>
        <span>{posts.length} total</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 0 }}>
        {(["approval", "calendar", "all"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: "none",
              border: "none",
              color: tab === t ? "var(--text)" : "var(--muted)",
              fontSize: 13,
              fontWeight: tab === t ? 700 : 400,
              padding: "8px 16px",
              cursor: "pointer",
              borderBottom: tab === t ? "2px solid var(--brand1)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t === "approval" ? `Review (${pendingApproval.length})` : t === "calendar" ? "Calendar" : "All Posts"}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      ) : tab === "approval" ? (
        /* APPROVAL QUEUE */
        pendingApproval.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>All caught up</p>
            <p style={{ fontSize: 13 }}>The Marketing Brain generates new posts daily at 6am. You can also hit &quot;Generate Extra&quot; anytime.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {pendingApproval.map((p) => (
              <div
                key={p.id}
                style={{
                  background: "var(--panel)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  borderRadius: "var(--radius)",
                  padding: 20,
                }}
              >
                {/* Post header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent1)", background: "rgba(96, 165, 250, 0.1)", padding: "2px 8px", borderRadius: 4 }}>
                      {PLATFORM_LABELS[p.platform]} · {p.account_type}
                    </span>
                    {p.pillar && (
                      <span style={{ fontSize: 11, color: "var(--muted)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 4 }}>
                        {p.pillar.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {formatDate(p.created_at)}
                  </span>
                </div>

                {/* Post content - full text */}
                <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>
                  {p.content_text}
                </div>

                {/* Hashtags */}
                {p.hashtags && (
                  <div style={{ fontSize: 12, color: "var(--accent1)", marginBottom: 12 }}>{p.hashtags}</div>
                )}

                {/* Visual prompt preview */}
                {p.visual_prompt && (
                  <div style={{ fontSize: 11, color: "var(--muted)", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: 6, marginBottom: 12, borderLeft: "3px solid var(--brand1)" }}>
                    <strong>Visual idea:</strong> {p.visual_prompt}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => handleReject(p.id)} style={{ ...btnSecondary, color: "#f87171", fontSize: 12, padding: "6px 14px" }}>
                    Reject
                  </button>
                  <button onClick={() => openEdit(p)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 14px" }}>
                    Edit
                  </button>
                  <button onClick={() => handleApprove(p)} style={{ ...btnApprove, fontSize: 12, padding: "6px 14px" }}>
                    Approve & Schedule
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "calendar" ? (
        /* CALENDAR VIEW */
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {weekDates.map((date, i) => {
              const dayPosts = postsForDay(date);
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div
                  key={i}
                  style={{
                    background: isToday ? "rgba(59, 130, 246, 0.08)" : "var(--panel)",
                    border: isToday ? "1px solid var(--brand1)" : "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    padding: 12,
                    minHeight: 200,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{DAY_LABELS[date.getDay()]}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{date.getDate()}</div>
                  {dayPosts.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>No posts</div>
                  )}
                  {dayPosts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => openEdit(p)}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 6,
                        padding: "6px 8px",
                        marginBottom: 4,
                        cursor: "pointer",
                        borderLeft: `3px solid ${STATUS_COLORS[p.status] ?? "#666"}`,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", gap: 4, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{PLATFORM_LABELS[p.platform]}</span>
                        <span>{p.account_type}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {p.content_text}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ALL POSTS */
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {posts.map((p) => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
              }}
            >
              <div style={{ minWidth: 36, textAlign: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent1)" }}>{PLATFORM_LABELS[p.platform]}</span>
                <div style={{ fontSize: 9, color: "var(--muted)" }}>{p.account_type}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: "var(--text)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.content_text}
                </p>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {p.pillar?.replace(/_/g, " ") ?? ""}{p.scheduled_for ? ` · ${formatDate(p.scheduled_for)}` : ""}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: STATUS_COLORS[p.status], textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {p.status.replace(/_/g, " ")}
              </span>
              {p.engagement && Object.keys(p.engagement).length > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {Object.entries(p.engagement).map(([k, v]) => `${v} ${k}`).join(" · ")}
                </span>
              )}
            </div>
          ))}
          {posts.length === 0 && (
            <p style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>No posts yet. The Marketing Brain will generate your first batch at 6am.</p>
          )}
        </div>
      )}

      {/* Generate Modal */}
      {showGenerate && (
        <div style={overlay} onClick={() => setShowGenerate(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Generate Extra Posts</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>Add context the Marketing Brain doesn&apos;t have — things that happened today, ideas, videos you shot.</p>
            <label style={labelStyle}>What&apos;s happening? (bullet points)</label>
            <textarea
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              rows={5}
              placeholder={"- Just shipped a new feature\n- Funny thing happened on site today\n- Got great feedback from a customer"}
              style={textareaStyle}
            />
            <label style={labelStyle}>Platforms</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {PLATFORMS.map((p) => (
                <label key={p} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text)", fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={genPlatforms.includes(p)}
                    onChange={(e) => setGenPlatforms(e.target.checked ? [...genPlatforms, p] : genPlatforms.filter((x) => x !== p))}
                  />
                  {p}
                </label>
              ))}
            </div>
            <label style={labelStyle}>Account</label>
            <select value={genAccountType} onChange={(e) => setGenAccountType(e.target.value)} style={{ ...selectStyle, marginBottom: 16 }}>
              <option value="both">Both (brand + personal)</option>
              <option value="brand">Brand only</option>
              <option value="personal">Personal only</option>
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowGenerate(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleGenerate} disabled={generating || !bullets.trim()} style={btnPrimary}>
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editPost && (
        <div style={overlay} onClick={() => setEditPost(null)}>
          <div style={{ ...modal, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                {PLATFORM_LABELS[editPost.platform]} · {editPost.account_type}
              </h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[editPost.status], textTransform: "uppercase" }}>
                {editPost.status.replace(/_/g, " ")}
              </span>
            </div>

            <label style={labelStyle}>Content</label>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={8}
              style={textareaStyle}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>Pillar</label>
                <select value={editPillar} onChange={(e) => setEditPillar(e.target.value)} style={selectStyle}>
                  <option value="">None</option>
                  {PILLARS.map((p) => <option key={p} value={p}>{p.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Schedule For</label>
                <input type="datetime-local" value={editSchedule} onChange={(e) => setEditSchedule(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <label style={labelStyle}>Hashtags</label>
            <input value={editHashtags} onChange={(e) => setEditHashtags(e.target.value)} placeholder="#flooring #billybot" style={{ ...inputStyle, marginBottom: 12 }} />

            {editPost.visual_prompt && (
              <div style={{ fontSize: 11, color: "var(--muted)", background: "rgba(255,255,255,0.03)", padding: "8px 12px", borderRadius: 6, marginBottom: 12, borderLeft: "3px solid var(--brand1)" }}>
                <strong>Visual idea:</strong> {editPost.visual_prompt}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={() => handleDelete(editPost.id)} style={{ ...btnSecondary, color: "#f87171" }}>Delete</button>
              <button onClick={() => setEditPost(null)} style={btnSecondary}>Cancel</button>
              {editPost.status === "pending_approval" && (
                <>
                  <button onClick={() => { handleReject(editPost.id); setEditPost(null); }} style={{ ...btnSecondary, color: "#f87171" }}>Reject</button>
                  <button
                    onClick={async () => { await handleSave(); await handleApprove({ ...editPost, scheduled_for: editSchedule ? new Date(editSchedule).toISOString() : null }); setEditPost(null); }}
                    style={btnApprove}
                  >
                    Save & Approve
                  </button>
                </>
              )}
              <button onClick={handleSave} disabled={saving} style={btnPrimary}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "error" ? "#7f1d1d" : "#064e3b", color: "white", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 100 }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Styles
const btnPrimary: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--brand1), var(--brand2))",
  color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnApprove: React.CSSProperties = {
  background: "linear-gradient(135deg, #34d399, #10b981)",
  color: "white", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer",
};
const selectStyle: React.CSSProperties = {
  background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%",
};
const inputStyle: React.CSSProperties = {
  background: "var(--panel)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: "100%",
};
const textareaStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", color: "var(--text)", border: "1px solid var(--line)", borderRadius: 8, padding: 12,
  fontSize: 13, lineHeight: 1.5, width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 12,
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em",
};
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
};
const modal: React.CSSProperties = {
  background: "#0f172a", border: "1px solid var(--line)", borderRadius: 12, padding: 24, width: "90%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto",
};
