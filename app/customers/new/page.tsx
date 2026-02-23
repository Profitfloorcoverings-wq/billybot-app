"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/utils/supabase/client";

export default function NewCustomerPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [customerName, setCustomerName] = useState("");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      const { error: insertError } = await supabase.from("customers").insert([
        {
          profile_id: profileId,
          customer_name: customerName,
          contact_name: contactName,
          address,
          email,
          phone,
          mobile,
        },
      ]);

      if (insertError) {
        throw insertError;
      }

      router.push("/customers");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to add customer"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <Link href="/customers" style={{ fontSize: "13px", color: "#475569", display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "8px", textDecoration: "none" }}>
              ← Customers
            </Link>
            <h1 className="section-title">Add Customer</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Create a new customer profile so BillyBot can keep everything organised.
            </p>
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: "28px 32px", maxWidth: "720px" }}>
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
                disabled={loading}
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
                disabled={loading}
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
              disabled={loading}
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
                disabled={loading}
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
                disabled={loading}
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
              disabled={loading}
            />
          </div>

          {error ? (
            <p style={{ fontSize: "13px", color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: "10px", padding: "10px 14px", margin: 0 }}>
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Save customer"}
            </button>
            <Link href="/customers" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
