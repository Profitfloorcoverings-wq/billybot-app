"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/utils/supabase/client";

type Customer = {
  id: string;
  customer_name?: string | null;
  address?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
};

async function fetchCustomers(supabase: ReturnType<typeof createClient>, profileId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("profile_id", profileId)
    .order("customer_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export default function CustomersPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        const profileId = userData?.user?.id;

        if (userError || !profileId) {
          throw new Error(userError?.message || "Unable to find your account");
        }

        if (active) setProfileId(profileId);
        const data = await fetchCustomers(supabase, profileId);
        if (active) setCustomers(data);
      } catch (err: any) {
        if (active) setError(err.message || "Unable to load customers");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const query = search.toLowerCase();
    return customers.filter((customer) => {
      const fields = [
        customer.customer_name,
        customer.contact_name,
        customer.email,
        customer.phone,
        customer.mobile,
      ];
      return fields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [customers, search]);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    setToast(null);

    const previousCustomers = customers;
    setCustomers((prev) => prev.filter((customer) => customer.id !== deleteTarget.id));

    try {
      let activeProfileId = profileId;
      if (!activeProfileId) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        activeProfileId = userData?.user?.id ?? null;
        if (userError || !activeProfileId) {
          throw new Error(userError?.message || "Unable to find your account");
        }
        setProfileId(activeProfileId);
      }

      const { count, error: quotesError } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", deleteTarget.id);

      if (quotesError) {
        throw quotesError;
      }

      if ((count ?? 0) > 0) {
        setCustomers(previousCustomers);
        setDeleteError("This customer has existing quotes. Delete those first.");
        return;
      }

      const { error: deleteError } = await supabase
        .from("customers")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("profile_id", activeProfileId);

      if (deleteError) {
        throw deleteError;
      }

      setToast("Customer deleted.");
      setDeleteTarget(null);
    } catch (err) {
      setCustomers(previousCustomers);
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

  return (
    <div className="page-container">
      <div className="section-header">
        <div className="stack">
          <h1 className="section-title">Customers</h1>
          <p className="section-subtitle">
            Keep every customer organised, searchable, and ready for your next job.
          </p>
        </div>

        <Link href="/customers/new" className="btn btn-primary">
          Add Customer
        </Link>
      </div>

      <div className="card stack">
        {toast ? <div className="toast">{toast}</div> : null}
        <div className="stack md:row md:items-center md:justify-between">
          <div className="stack">
            <p className="section-subtitle">Search</p>
            <input
              className="input-fluid"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contact, phone, or email"
            />
          </div>

          <div className="tag">{customers.length} total</div>
        </div>

        <div className="table-card scrollable-table">
          <div className="relative w-full max-h-[70vh] overflow-y-auto">
            {loading && <div className="empty-state">Loading customers…</div>}
            {error && !loading && (
              <div className="empty-state" style={{ color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {!loading && !error && filteredCustomers.length === 0 && (
              <div className="empty-state stack items-center">
                <h3 className="section-title">No customers yet</h3>
                <p className="section-subtitle">
                  Add your first customer to get started.
                </p>
                <Link href="/customers/new" className="btn btn-primary">
                  Add Customer
                </Link>
              </div>
            )}

            {!loading && !error && filteredCustomers.length > 0 && (
              <div>
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => router.push(`/customers/${customer.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/customers/${customer.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="list-row text-left w-full cursor-pointer"
                  >
                    <div className="stack gap-1">
                      <p className="font-semibold text-[15px] text-white">
                        {customer.customer_name || "Untitled"}
                      </p>
                      <p className="text-sm text-[var(--muted)] md:hidden">
                        {customer.contact_name || "No contact"}
                      </p>
                    </div>

                    <p className="text-sm text-[var(--muted)] hidden md:block">
                      {customer.contact_name || "—"}
                    </p>

                    <p className="text-sm text-[var(--muted)] truncate">
                      {customer.email || "—"}
                    </p>

                    <p className="text-sm text-[var(--muted)]">
                      {customer.phone || customer.mobile || "—"}
                    </p>

                    <div className="flex items-center justify-end gap-3 text-[var(--muted)]">
                      <button
                        type="button"
                        className="btn btn-danger px-3 py-2 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(customer);
                          setDeleteError(null);
                        }}
                      >
                        Delete
                      </button>
                      →
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget ? (
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
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirmDelete}
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
