"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { fetchCustomers } from "@/lib/supabase/customers";
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

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCustomers() {
      try {
        setError(null);
        const supabase = createClient();
        const { data, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!data?.user) {
          setError("Please sign in to view customers.");
          return;
        }

        const list = await fetchCustomers(data.user.id);
        if (!active) return;
        setCustomers(list);
      } catch (err) {
        if (!active) return;
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as { message?: string }).message)
            : "Unable to load customers.";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCustomers();

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

  const hasCustomers = filteredCustomers.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Customers</p>
          <h1 className="text-3xl font-black text-white">Customers</h1>
          <p className="text-sm text-[var(--muted)]">
            Keep every customer organised, searchable, and ready for your next job.
          </p>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--brand1)] to-[var(--brand2)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(37,99,235,0.45)] transition hover:shadow-[0_22px_38px_rgba(59,130,246,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand1)]"
        >
          <span className="text-lg">＋</span>
          Add Customer
        </Link>
      </header>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)]/80 p-4 shadow-[0_20px_45px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer, contact, phone, or email"
              className="w-full rounded-xl border border-[var(--line)] bg-[#0b1223] px-4 py-3 text-sm text-white placeholder:text-[var(--muted)] shadow-inner shadow-[rgba(0,0,0,0.25)] focus:border-[var(--brand1)] focus:outline-none focus:ring-2 focus:ring-[var(--brand1)]"
            />
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[var(--muted)]">
              ⌕
            </div>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            {customers.length} total
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--line)] bg-[#0c1325]">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1.2fr] bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:grid">
            <span>Customer Name</span>
            <span>Address</span>
            <span>Contact Name</span>
            <span>Phone</span>
            <span>Mobile</span>
            <span>Email</span>
          </div>

          {loading && (
            <div className="flex items-center justify-center px-4 py-10 text-sm text-[var(--muted)]">
              Loading customers…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center justify-center px-4 py-10 text-sm text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && !hasCustomers && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-[var(--muted)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-lg text-white">🧰</div>
              <p className="font-semibold text-white">Start by adding your first customer.</p>
              <p>Use the button above to add your next job lead.</p>
            </div>
          )}

          {!loading && !error && hasCustomers && (
            <div className="divide-y divide-[var(--line)]">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => router.push(`/customers/${customer.id}`)}
                  className="grid w-full grid-cols-1 gap-3 bg-transparent px-4 py-4 text-left transition hover:bg-white/3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand1)] md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1.2fr] md:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{customer.customer_name || "Untitled"}</p>
                    <p className="text-xs text-[var(--muted)] md:hidden">{customer.email || "No email"}</p>
                  </div>
                  <p className="text-sm text-[var(--muted)] md:truncate">{customer.address || "—"}</p>
                  <p className="text-sm text-[var(--muted)] md:truncate">{customer.contact_name || "—"}</p>
                  <p className="text-sm text-[var(--muted)] md:truncate">{customer.phone || "—"}</p>
                  <p className="text-sm text-[var(--muted)] md:truncate">{customer.mobile || "—"}</p>
                  <p className="hidden text-sm text-[var(--muted)] md:block md:truncate">{customer.email || "—"}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
