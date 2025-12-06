"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Customer = {
  id: string;
  customer_name?: string | null;
  address?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
};

async function fetchCustomers(profileId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      const hardCodedProfileId = "19b639a4-6e14-4c69-9ddf-04d371a3e45b";

      try {
        const data = await fetchCustomers(hardCodedProfileId);
        if (active) setCustomers(data);
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

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

      <div className="card stack">
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

        <div className="table-card">
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
                <button
                  key={customer.id}
                  onClick={() => router.push(`/customers/${customer.id}`)}
                  className="list-row text-left w-full"
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

                  <div className="flex items-center justify-end text-[var(--muted)]">
                    →
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

