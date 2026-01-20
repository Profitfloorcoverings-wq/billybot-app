"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
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
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      <div className="card stack gap-4">
        <div className="stack md:row md:items-end md:justify-between gap-3">
          <div className="stack flex-1">
            <p className="section-subtitle">Search</p>
            <input
              className="input-fluid"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contact, phone, or email"
            />
          </div>

          <p className="text-xs text-[var(--muted)] md:text-right">
            {customers.length} total
          </p>
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
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-[var(--card)]">
                  <tr>
                    <th>Name</th>
                    <th className="hidden md:table-cell">Email</th>
                    <th className="hidden md:table-cell">Phone</th>
                    <th className="sticky-cell text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => {
                    const customerName = customer.customer_name?.trim() || "Untitled";
                    const contactName = customer.contact_name?.trim() || "";
                    const showContact =
                      contactName &&
                      contactName.toLowerCase() !== customerName.toLowerCase();
                    const email = customer.email?.trim() || "";
                    const phone = customer.phone?.trim() || customer.mobile?.trim() || "";

                    return (
                      <tr key={customer.id} className="group">
                        <td>
                          <div className="stack gap-1">
                            <p className="text-[15px] font-semibold text-white">
                              {customerName}
                            </p>
                            {showContact ? (
                              <p className="text-sm text-[var(--muted)]">{contactName}</p>
                            ) : null}
                            <div className="mt-2 flex flex-col gap-1 text-sm text-[var(--muted)] md:hidden">
                              <span className="truncate" title={email || undefined}>
                                {email || "—"}
                              </span>
                              <span className="font-mono tabular-nums">
                                {phone || "—"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <span
                            className="text-sm text-[var(--muted)] truncate block max-w-[280px]"
                            title={email || undefined}
                          >
                            {email || "—"}
                          </span>
                        </td>
                        <td className="hidden md:table-cell">
                          <span className="text-sm text-[var(--muted)] font-mono tabular-nums">
                            {phone || "—"}
                          </span>
                        </td>
                        <td className="sticky-cell">
                          <div className="flex items-center justify-end">
                            <Link
                              href={`/customers/${customer.id}`}
                              aria-label={`View ${customerName}`}
                              className="btn btn-secondary btn-small h-9 w-9 p-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent1)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,23,42,0.92)]"
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="h-4 w-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M7.5 4.5L12.5 10L7.5 15.5"
                                />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
