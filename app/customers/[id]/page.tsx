"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";

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

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <Link href="/customers" style={{ fontSize: "13px", color: "#475569", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "8px", textDecoration: "none" }}>
              ← Customers
            </Link>
            <h1 className="section-title">Edit Customer</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Update your customer details to keep BillyBot organised.
            </p>
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: "28px 32px", maxWidth: "720px" }}>
        {initialLoading ? (
          <p style={{ fontSize: "14px", color: "#64748b" }}>Loading customer…</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}
