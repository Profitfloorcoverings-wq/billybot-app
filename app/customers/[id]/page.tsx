"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Unable to load customer");
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
        .update({
          customer_name: customerName,
          contact_name: contactName,
          address,
          email,
          phone,
          mobile,
        })
        .eq("id", id)
        .eq("profile_id", profileId);

      if (updateError) {
        throw updateError;
      }

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

      if (deleteError) {
        throw deleteError;
      }

      if (!count) {
        throw new Error("Unable to delete customer");
      }

      router.push("/customers");
    } catch (err) {
      setError(
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to delete customer"
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Edit Customer</h1>
          <p className="section-subtitle">
            Update your customer details to keep BillyBot organised.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card stack gap-6">
        {initialLoading ? (
          <div className="text-sm text-[var(--muted)]">Loading customer…</div>
        ) : (
          <>
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
                  disabled={loading || deleting}
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
                  disabled={loading || deleting}
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
                  disabled={loading || deleting}
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
                  disabled={loading || deleting}
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
                  disabled={loading || deleting}
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
                  disabled={loading || deleting}
                />
              </div>
            </div>

            {error ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                <button type="submit" className="btn btn-primary" disabled={loading || deleting}>
                  {loading ? "Updating…" : "Update customer"}
                </button>
                {loading ? <span className="text-sm text-[var(--muted)]">Saving changes…</span> : null}
              </div>
              <button
                type="button"
                className="btn btn-secondary text-red-200 border border-red-500/40 hover:bg-red-500/10"
                onClick={handleDeleteCustomer}
                disabled={loading || deleting}
              >
                {deleting ? "Deleting…" : "Delete customer"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
