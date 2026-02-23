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
      } catch (err: unknown) {
        if (active) setError((err as Error).message || "Unable to load customers");
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
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Customers</h1>
            <p style={{ color: "#475569", fontSize: "13px", marginTop: "4px" }}>
              Keep every customer organised, searchable, and ready for your next job.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {!loading && customers.length > 0 && (
              <div style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", borderRadius: "10px", padding: "8px 16px", textAlign: "center" as const }}>
                <p style={{ fontSize: "20px", fontWeight: 700, color: "#38bdf8", lineHeight: 1 }}>{customers.length}</p>
                <p style={{ fontSize: "11px", color: "#475569", marginTop: "3px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Total</p>
              </div>
            )}
            <Link href="/customers/new" className="btn btn-primary">
              + Add Customer
            </Link>
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Search row */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#475569", marginBottom: "8px" }}>
              Search
            </p>
            <input
              className="chat-input"
              style={{ width: "100%" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contact, phone, or email"
            />
          </div>
          {!loading && customers.length > 0 && (
            <p style={{ fontSize: "12px", color: "#475569", whiteSpace: "nowrap" as const }}>
              {filteredCustomers.length} of {customers.length}
            </p>
          )}
        </div>

        <div className="table-card scrollable-table">
          <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            {loading && <div className="empty-state">Loading customers…</div>}
            {error && !loading && (
              <div className="empty-state" style={{ color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {!loading && !error && filteredCustomers.length === 0 && (
              <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9" }}>No customers yet</h3>
                <p style={{ color: "#475569", fontSize: "14px" }}>Add your first customer to get started.</p>
                <Link href="/customers/new" className="btn btn-primary">
                  + Add Customer
                </Link>
              </div>
            )}

            {!loading && !error && filteredCustomers.length > 0 && (
              <table className="data-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th className="sticky-cell" style={{ textAlign: "right" }} aria-label="Edit actions" />
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
                    const phone = customer.mobile?.trim() || customer.phone?.trim() || "";

                    return (
                      <tr key={customer.id}>
                        <td>
                          <p style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", marginBottom: showContact ? "3px" : 0 }}>
                            {customerName}
                          </p>
                          {showContact ? (
                            <p style={{ fontSize: "13px", color: "#64748b" }}>{contactName}</p>
                          ) : null}
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", color: "#64748b", display: "block", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }} title={email || undefined}>
                            {email || "—"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                            {phone || "—"}
                          </span>
                        </td>
                        <td className="sticky-cell">
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Link href={`/customers/${customer.id}`} className="btn btn-secondary" style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "999px" }}>
                              Edit
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
