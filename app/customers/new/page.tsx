"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
      const { error: insertError } = await supabase.from("customers").insert([
        {
          profile_id: "19b639a4-6e14-4c69-9ddf-04d371a3e45b",
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
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Add Customer</h1>
          <p className="section-subtitle">
            Create a new customer profile so BillyBot can keep everything organised.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card stack gap-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="field-group">
            <label className="field-label" htmlFor="customer_name">
              Customer name
            </label>
            <input
              id="customer_name"
              className="input-fluid"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="contact_name">
              Contact name
            </label>
            <input
              id="contact_name"
              className="input-fluid"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          <div className="field-group md:col-span-2">
            <label className="field-label" htmlFor="address">
              Address
            </label>
            <input
              id="address"
              className="input-fluid"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street, Springfield"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input-fluid"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@acme.com"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="input-fluid"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="field-group md:col-span-2">
            <label className="field-label" htmlFor="mobile">
              Mobile
            </label>
            <input
              id="mobile"
              className="input-fluid"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="(555) 987-6543"
            />
          </div>
        </div>

        {error ? (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Saving…" : "Save customer"}
          </button>
          {loading ? <span className="text-sm text-[var(--muted)]">Creating customer…</span> : null}
        </div>
      </form>
    </div>
  );
}
