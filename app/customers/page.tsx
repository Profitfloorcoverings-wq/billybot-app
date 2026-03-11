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

type JobSummary = { customer_email: string; count: number; latest: string | null };

function getInitials(name: string): string {
  const parts = name.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

async function fetchCustomers(supabase: ReturnType<typeof createClient>, profileId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("profile_id", profileId)
    .order("customer_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchJobCounts(supabase: ReturnType<typeof createClient>, profileId: string): Promise<Map<string, JobSummary>> {
  // Get job counts grouped by customer_email
  const { data } = await supabase
    .from("jobs")
    .select("customer_email, last_activity_at")
    .eq("client_id", profileId)
    .not("customer_email", "is", null)
    .neq("status", "merged");

  const map = new Map<string, JobSummary>();
  if (!data) return map;

  for (const row of data) {
    const email = (row.customer_email as string)?.toLowerCase();
    if (!email) continue;
    const existing = map.get(email);
    if (existing) {
      existing.count++;
      if (row.last_activity_at && (!existing.latest || row.last_activity_at > existing.latest)) {
        existing.latest = row.last_activity_at as string;
      }
    } else {
      map.set(email, { customer_email: email, count: 1, latest: (row.last_activity_at as string) ?? null });
    }
  }
  return map;
}

type ViewMode = "table" | "cards";

export default function CustomersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobCounts, setJobCounts] = useState<Map<string, JobSummary>>(new Map());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

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

        const [data, jobs] = await Promise.all([
          fetchCustomers(supabase, profileId),
          fetchJobCounts(supabase, profileId),
        ]);
        if (active) {
          setCustomers(data);
          setJobCounts(jobs);
        }
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
        customer.address,
      ];
      return fields.some((value) => value?.toLowerCase().includes(query));
    });
  }, [customers, search]);

  const withEmail = customers.filter((c) => c.email?.trim()).length;
  const withPhone = customers.filter((c) => c.phone?.trim() || c.mobile?.trim()).length;

  return (
    <div className="page-container">
      <header style={{ marginBottom: "4px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 className="section-title">Customers</h1>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
              Your customer directory — searchable and always up to date.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {!loading && customers.length > 0 && (
              <div style={{ display: "flex", gap: "8px" }}>
                <StatBadge value={customers.length} label="Total" color="#38bdf8" />
                <StatBadge value={withEmail} label="Email" color="#34d399" />
                <StatBadge value={withPhone} label="Phone" color="#a78bfa" />
              </div>
            )}
            <Link href="/customers/new" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
              + Add Customer
            </Link>
          </div>
        </div>
      </header>

      <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Search row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", color: "#475569", pointerEvents: "none" }}>
              🔍
            </span>
            <input
              className="chat-input"
              style={{ width: "100%", paddingLeft: "36px" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contact, phone, email, or address…"
            />
          </div>
          {!loading && customers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", borderRadius: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  style={{
                    padding: "7px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
                    background: viewMode === "cards" ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.02)",
                    color: viewMode === "cards" ? "#38bdf8" : "#64748b",
                  }}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  style={{
                    padding: "7px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "none",
                    background: viewMode === "table" ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.02)",
                    color: viewMode === "table" ? "#38bdf8" : "#64748b",
                  }}
                >
                  Table
                </button>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap" as const }}>
                Showing {filteredCustomers.length} of {customers.length}
              </p>
            </div>
          )}
        </div>

        <div className="table-card scrollable-table">
          <div style={{ position: "relative", width: "100%", maxHeight: "70vh", overflowY: "auto" }}>
            {loading && (
              <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <div style={{ fontSize: "28px", animation: "pulse-soft 1.5s ease-in-out infinite" }}>👥</div>
                <span style={{ color: "#64748b", fontSize: "14px" }}>Loading customers…</span>
              </div>
            )}
            {error && !loading && (
              <div className="empty-state" style={{ color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {!loading && !error && filteredCustomers.length === 0 && (
              <div className="empty-state" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "48px 24px" }}>
                <div style={{ fontSize: "36px", opacity: 0.3 }}>👥</div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                  {search.trim() ? "No customers match your search" : "No customers yet"}
                </h3>
                <p style={{ color: "#64748b", fontSize: "14px", margin: 0, textAlign: "center", maxWidth: "360px" }}>
                  {search.trim()
                    ? "Try a different search term or clear the search."
                    : "Add your first customer to keep track of contacts, jobs, and quotes all in one place."}
                </p>
                {!search.trim() && (
                  <Link href="/customers/new" className="btn btn-primary" style={{ marginTop: "4px" }}>
                    + Add Customer
                  </Link>
                )}
              </div>
            )}

            {!loading && !error && filteredCustomers.length > 0 && viewMode === "cards" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
                {filteredCustomers.map((customer) => {
                  const customerName = customer.customer_name?.trim() || "Untitled";
                  const contactName = customer.contact_name?.trim() || "";
                  const showContact = contactName && contactName.toLowerCase() !== customerName.toLowerCase();
                  const email = customer.email?.trim() || "";
                  const phone = customer.mobile?.trim() || customer.phone?.trim() || "";
                  const jobs = email ? jobCounts.get(email.toLowerCase()) : undefined;
                  const init = getInitials(customerName);

                  return (
                    <Link
                      key={customer.id}
                      href={`/customers/${customer.id}`}
                      className="card"
                      style={{ padding: "16px 18px", textDecoration: "none", display: "block", transition: "border-color 0.15s" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                        <div style={{
                          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                          background: email ? "rgba(56,189,248,0.1)" : "rgba(148,163,184,0.08)",
                          border: email ? "1px solid rgba(56,189,248,0.2)" : "1px solid rgba(148,163,184,0.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "14px", fontWeight: 700,
                          color: email ? "#38bdf8" : "#475569",
                        }}>
                          {init}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: "15px", fontWeight: 600, color: "#f1f5f9", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {customerName}
                          </p>
                          {showContact && (
                            <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>{contactName}</p>
                          )}
                        </div>
                        {jobs ? (
                          <span style={{
                            fontSize: "12px", fontWeight: 600, color: "#38bdf8",
                            background: "rgba(56,189,248,0.08)", padding: "3px 10px", borderRadius: "999px",
                            border: "1px solid rgba(56,189,248,0.15)", flexShrink: 0,
                          }}>
                            {jobs.count} job{jobs.count !== 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {email && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "12px", color: "#475569" }}>✉</span>
                            <span style={{ fontSize: "13px", color: "#38bdf8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
                          </div>
                        )}
                        {phone && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11px", color: "#475569" }}>📞</span>
                            <span style={{ fontSize: "13px", color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}>{phone}</span>
                          </div>
                        )}
                        {!email && !phone && (
                          <span style={{ fontSize: "12px", color: "#475569" }}>No contact details</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {!loading && !error && filteredCustomers.length > 0 && viewMode === "table" && (
              <table className="data-table">
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ width: "280px" }}>Customer</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th style={{ textAlign: "center" }}>Jobs</th>
                    <th className="sticky-cell" style={{ textAlign: "right" }} aria-label="Actions" />
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
                    const jobs = email ? jobCounts.get(email.toLowerCase()) : undefined;
                    const init = getInitials(customerName);

                    return (
                      <tr key={customer.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/customers/${customer.id}`}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{
                              width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                              background: email ? "rgba(56,189,248,0.1)" : "rgba(148,163,184,0.08)",
                              border: email ? "1px solid rgba(56,189,248,0.2)" : "1px solid rgba(148,163,184,0.15)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "13px", fontWeight: 700,
                              color: email ? "#38bdf8" : "#475569",
                            }}>
                              {init}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {customerName}
                              </p>
                              {showContact && (
                                <p style={{ fontSize: "12px", color: "#64748b", margin: "2px 0 0" }}>{contactName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {email ? (
                            <a
                              href={`mailto:${email}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: "13px", color: "#38bdf8", textDecoration: "none",
                                display: "inline-flex", alignItems: "center", gap: "5px",
                                maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}
                              title={`Email ${email}`}
                            >
                              <span style={{ fontSize: "12px" }}>✉</span> {email}
                            </a>
                          ) : (
                            <span style={{ fontSize: "13px", color: "#475569" }}>—</span>
                          )}
                        </td>
                        <td>
                          {phone ? (
                            <a
                              href={`tel:${phone.replace(/\s/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                fontSize: "13px", color: "#e2e8f0", textDecoration: "none",
                                fontVariantNumeric: "tabular-nums",
                                display: "inline-flex", alignItems: "center", gap: "5px",
                              }}
                              title={`Call ${phone}`}
                            >
                              <span style={{ fontSize: "11px" }}>📞</span> {phone}
                            </a>
                          ) : (
                            <span style={{ fontSize: "13px", color: "#475569" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {jobs ? (
                            <span style={{
                              fontSize: "12px", fontWeight: 600, color: "#38bdf8",
                              background: "rgba(56,189,248,0.08)", padding: "3px 10px", borderRadius: "999px",
                              border: "1px solid rgba(56,189,248,0.15)",
                            }}>
                              {jobs.count}
                            </span>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#475569" }}>0</span>
                          )}
                        </td>
                        <td className="sticky-cell">
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                            {email && (
                              <a
                                href={`mailto:${email}`}
                                onClick={(e) => e.stopPropagation()}
                                className="btn btn-secondary"
                                style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "999px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                title="Send email"
                              >
                                ✉ Email
                              </a>
                            )}
                            <Link
                              href={`/customers/${customer.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="btn btn-secondary"
                              style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "999px" }}
                            >
                              View
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

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: `${color}11`, border: `1px solid ${color}26`,
      borderRadius: "10px", padding: "6px 14px", textAlign: "center" as const,
      minWidth: "56px",
    }}>
      <p style={{ fontSize: "18px", fontWeight: 700, color, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "#64748b", marginTop: "2px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}
