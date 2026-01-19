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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
          setProfileId(profileId);
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

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    setToast(null);

    try {
      let activeProfileId = profileId;
      if (!activeProfileId) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        activeProfileId = userData?.user?.id ?? null;
        if (userError || !activeProfileId) {
          throw new Error(userError?.message || "No user found");
        }
        setProfileId(activeProfileId);
      }

      const { count, error: quotesError } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", id)
        .eq("profile_id", activeProfileId);

      if (quotesError) {
        throw quotesError;
      }

      if ((count ?? 0) > 0) {
        setDeleteError("This customer has existing quotes. Delete those first.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("profile_id", activeProfileId);

      if (deleteError) {
        throw deleteError;
      }

      setToast("Customer deleted.");
      router.push("/customers");
      setTimeout(() => router.refresh(), 0);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "Unable to delete customer";
      setDeleteError(message);
      setToast(message);
    } finally {
      setDeleting(false);
    }
  }

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
        {toast ? <div className="toast">{toast}</div> : null}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
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
                  disabled={loading}
                />
              </div>
            </div>

            {error ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {error}
              </div>
            ) : null}
            {deleteError ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                {deleteError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Updating…" : "Update customer"}
              </button>
              {loading ? <span className="text-sm text-[var(--muted)]">Saving changes…</span> : null}
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setDeleteOpen(true);
                  setDeleteError(null);
                }}
                disabled={loading || deleting}
              >
                Delete customer
              </button>
            </div>
          </>
        )}
      </form>

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[var(--panel)] text-[var(--text)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold">Delete customer?</h2>
            </div>
            <div className="px-6 py-5 stack gap-4 text-sm text-[var(--muted)]">
              <p>This will permanently delete this customer. This can’t be undone.</p>
              {deleteError ? (
                <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                  {deleteError}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => {
                    setDeleteOpen(false);
                    void handleDelete();
                  }}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
