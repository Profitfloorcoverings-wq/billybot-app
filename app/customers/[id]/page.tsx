"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";

type LinkedJob = {
  id: string;
  title: string | null;
  status: string | null;
  last_activity_at: string | null;
  thread_type: string | null;
};

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function EditCustomerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);

  useEffect(() => {
    let active = true;

    async function loadCustomer() {
      setInitialLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const profileId = userData?.user?.id;

        if (userError || !profileId) {
          throw new Error(userError?.message || "Unable to find your account");
        }

        const { data, error: fetchError } = await supabase
          .from("customers")
          .select("*")
          .eq("id", id)
          .eq("profile_id", profileId)
          .single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("Customer not found");

        if (active) {
          setCustomerName(data.customer_name || "");
          setContactName(data.contact_name || "");
          setAddress(data.address || "");
          setEmail(data.email || "");
          setPhone(data.phone || "");
          setMobile(data.mobile || "");
        }

        // Fetch linked jobs by email
        const customerEmail = (data.email || "").trim();
        if (customerEmail) {
          const { data: jobs } = await supabase
            .from("jobs")
            .select("id, title, status, last_activity_at, thread_type")
            .eq("client_id", profileId)
            .eq("customer_email", customerEmail)
            .neq("status", "merged")
            .order("last_activity_at", { ascending: false })
            .limit(20);

          if (active && jobs) setLinkedJobs(jobs as LinkedJob[]);
        }
      } catch (err: unknown) {
        if (active) {
          setError((err as Error)?.message || "Unable to load customer");
        }
      } finally {
        if (active) setInitialLoading(false);
      }
    }

    void loadCustomer();

    return () => {
      active = false;
    };
  }, [id, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const profileId = userData?.user?.id;

      if (userError || !profileId) {
        throw new Error(userError?.message || "No user found");
      }

      const { error: updateError } = await supabase
        .from("customers")
        .update({ customer_name: customerName, contact_name: contactName, address, email, phone, mobile })
        .eq("id", id)
        .eq("profile_id", profileId);

      if (updateError) throw updateError;

      router.push("/customers");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to update customer"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCustomer() {
    setError(null);
    setDeleting(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const profileId = userData?.user?.id;

      if (userError || !profileId) {
        throw new Error(userError?.message || "No user found");
      }

      const { error: deleteError, count } = await supabase
        .from("customers")
        .delete({ count: "exact" })
        .eq("id", id);

      if (deleteError) throw deleteError;
      if (!count) throw new Error("Unable to delete customer");

      router.push("/customers");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to delete customer"
      );
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const busy = loading || deleting;
  const displayName = customerName.trim() || "Unnamed Customer";
  const initials = getInitials(displayName);

  return (
    <div className="page-container" style={{ maxWidth: "900px" }}>
      {/* Back nav */}
      <Link
        href="/customers"
        style={{
          fontSize: "13px", color: "#64748b", textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: "6px",
          marginBottom: "16px", padding: "4px 0",
        }}
      >
        <span style={{ fontSize: "16px" }}>←</span> Back to Customers
      </Link>

      {initialLoading ? (
        <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", animation: "pulse-soft 1.5s ease-in-out infinite", marginBottom: "8px" }}>👤</div>
          <span style={{ color: "#64748b", fontSize: "14px" }}>Loading customer…</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header card */}
          <div className="card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "50%", flexShrink: 0,
                background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "18px", fontWeight: 700, color: "#38bdf8",
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#f1f5f9", margin: "0 0 4px" }}>
                  {displayName}
                </h1>
                {contactName.trim() && contactName.trim().toLowerCase() !== displayName.toLowerCase() && (
                  <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 8px" }}>
                    Contact: {contactName}
                  </p>
                )}
                {/* Quick actions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
                  {email.trim() && (
                    <a
                      href={`mailto:${email.trim()}`}
                      style={{
                        fontSize: "13px", color: "#38bdf8", textDecoration: "none",
                        background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)",
                        padding: "5px 14px", borderRadius: "999px",
                        display: "inline-flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "13px" }}>✉</span> {email.trim()}
                    </a>
                  )}
                  {(phone.trim() || mobile.trim()) && (
                    <a
                      href={`tel:${(mobile.trim() || phone.trim()).replace(/\s/g, "")}`}
                      style={{
                        fontSize: "13px", color: "#e2e8f0", textDecoration: "none",
                        background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)",
                        padding: "5px 14px", borderRadius: "999px",
                        display: "inline-flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "12px" }}>📞</span> {mobile.trim() || phone.trim()}
                    </a>
                  )}
                  {address.trim() && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(address.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: "13px", color: "#e2e8f0", textDecoration: "none",
                        background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)",
                        padding: "5px 14px", borderRadius: "999px",
                        display: "inline-flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "12px" }}>📍</span> Open in Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Linked jobs */}
          {linkedJobs.length > 0 && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Linked Jobs
                </h2>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {linkedJobs.length} {linkedJobs.length === 1 ? "job" : "jobs"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {linkedJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={job.thread_type === "conversation" || job.thread_type === "enquiry" ? `/conversations/${job.id}` : `/jobs/${job.id}`}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                      padding: "10px 14px", borderRadius: "10px", textDecoration: "none",
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "6px",
                        background: job.thread_type === "enquiry" ? "rgba(249,115,22,0.12)" : "rgba(56,189,248,0.08)",
                        color: job.thread_type === "enquiry" ? "#fb923c" : "#38bdf8",
                        border: job.thread_type === "enquiry" ? "1px solid rgba(249,115,22,0.25)" : "1px solid rgba(56,189,248,0.15)",
                        whiteSpace: "nowrap",
                      }}>
                        {job.thread_type === "enquiry" ? "Enquiry" : job.thread_type === "conversation" ? "Conv" : "Job"}
                      </span>
                      <span style={{ fontSize: "14px", color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.title || "Untitled"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      {job.status && (
                        <span style={{ fontSize: "11px", color: "#64748b", textTransform: "capitalize" }}>{job.status}</span>
                      )}
                      <span style={{ fontSize: "12px", color: "#475569" }}>{formatRelativeTime(job.last_activity_at)}</span>
                      <span style={{ color: "#475569", fontSize: "14px" }}>›</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Edit form */}
          <div className="card" style={{ padding: "24px 28px" }}>
            <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#94a3b8", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Edit Details
            </h2>
            <form onSubmit={handleSubmit} className="form-stack">
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label" htmlFor="customer_name">Customer name</label>
                  <input
                    id="customer_name"
                    className="chat-input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Acme Corp"
                    required
                    disabled={busy}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="contact_name">Contact name</label>
                  <input
                    id="contact_name"
                    className="chat-input"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Doe"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="address">Address</label>
                <input
                  id="address"
                  className="chat-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street, Springfield"
                  disabled={busy}
                />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label className="form-label" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="chat-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@acme.com"
                    disabled={busy}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label" htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    className="chat-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="07700 900123"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="mobile">Mobile</label>
                <input
                  id="mobile"
                  className="chat-input"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="07700 900456"
                  disabled={busy}
                />
              </div>

              {error ? (
                <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
                  {error}
                </p>
              ) : null}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", paddingTop: "4px" }}>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {loading ? "Saving…" : "Save changes"}
                  </button>
                  <Link href="/customers" className="btn btn-secondary">
                    Cancel
                  </Link>
                </div>

                {/* Delete zone */}
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                    style={{ fontSize: "13px", fontWeight: 600, color: "#f87171", background: "transparent", border: "none", cursor: "pointer", padding: "4px 0", opacity: busy ? 0.5 : 1 }}
                  >
                    Delete customer
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "13px", color: "#f87171" }}>Are you sure?</span>
                    <button
                      type="button"
                      onClick={handleDeleteCustomer}
                      disabled={busy}
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 14px", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={busy}
                      className="btn btn-secondary"
                      style={{ fontSize: "12px", padding: "6px 14px" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
