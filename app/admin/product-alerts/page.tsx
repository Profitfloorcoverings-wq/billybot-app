"use client";

import { useEffect, useState, useCallback } from "react";

type Alert = {
  id: string;
  client_id: string;
  job_id: string | null;
  original_name: string;
  original_context: string | null;
  matched_to: string;
  confidence: number | null;
  match_reason: string | null;
  status: string;
  resolved_to: string | null;
  resolved_at: string | null;
  source: string;
  created_at: string;
};

type AlertGroup = {
  original_name: string;
  matched_to: string;
  confidence: number | null;
  match_reason: string | null;
  occurrences: number;
  alerts: Alert[];
};

type ApiResponse = {
  total: number;
  groups: AlertGroup[];
};

const ADMIN_TOKEN =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("token") || "123456789"
    : "123456789";

export default function ProductAlertsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/product-alerts?status=${statusFilter}`,
        { headers: { "x-internal-token": ADMIN_TOKEN } }
      );
      if (!res.ok) {
        setError(`Error ${res.status}`);
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!ADMIN_TOKEN) {
      setError("Add ?token=YOUR_INTERNAL_TOKEN to the URL");
      setLoading(false);
      return;
    }
    fetchAlerts();
  }, [fetchAlerts]);

  const resolveAlert = async (
    alertId: string,
    status: "accepted" | "dismissed",
    bulk: boolean
  ) => {
    setResolving(alertId);
    try {
      const endpoint = bulk
        ? `/api/admin/product-alerts/${alertId}`
        : `/api/admin/product-alerts/${alertId}`;
      const method = bulk ? "POST" : "PATCH";
      await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": ADMIN_TOKEN,
        },
        body: JSON.stringify({ status }),
      });
      await fetchAlerts();
    } finally {
      setResolving(null);
    }
  };

  const remapAlert = async (alertId: string, resolvedTo: string) => {
    setResolving(alertId);
    try {
      await fetch(`/api/admin/product-alerts/${alertId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": ADMIN_TOKEN,
        },
        body: JSON.stringify({ status: "remapped", resolved_to: resolvedTo }),
      });
      await fetchAlerts();
    } finally {
      setResolving(null);
    }
  };

  if (!ADMIN_TOKEN && error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBox}>{error}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Product Match Alerts</h1>
        {data && (
          <span style={styles.badge}>
            {data.total} {statusFilter}
          </span>
        )}
      </header>

      <div style={styles.filters}>
        {["pending", "accepted", "remapped", "dismissed", "all"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              ...styles.filterBtn,
              ...(statusFilter === s ? styles.filterBtnActive : {}),
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <p style={styles.muted}>Loading...</p>}
      {error && <div style={styles.errorBox}>{error}</div>}

      {data && data.groups.length === 0 && (
        <p style={styles.muted}>No {statusFilter} alerts.</p>
      )}

      {data?.groups.map((group) => (
        <div key={group.original_name} style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <span style={styles.productName}>
                &ldquo;{group.original_name}&rdquo;
              </span>
              <span style={styles.arrow}>&rarr;</span>
              <span style={styles.matchedTo}>{group.matched_to}</span>
              {group.confidence !== null && (
                <span style={styles.confidence}>
                  ({Math.round(group.confidence * 100)}%)
                </span>
              )}
            </div>
            <span style={styles.occurrences}>
              {group.occurrences} occurrence{group.occurrences !== 1 ? "s" : ""}
            </span>
          </div>

          {group.match_reason && (
            <p style={styles.reason}>{group.match_reason}</p>
          )}

          <div style={styles.alertList}>
            {group.alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} style={styles.alertRow}>
                <span style={styles.alertMeta}>
                  {alert.source} &middot;{" "}
                  {new Date(alert.created_at).toLocaleDateString()}
                  {alert.original_context && (
                    <> &middot; {alert.original_context}</>
                  )}
                </span>
                <span style={styles.alertClient}>
                  {alert.client_id.slice(0, 8)}...
                </span>
              </div>
            ))}
            {group.occurrences > 5 && (
              <p style={styles.muted}>
                +{group.occurrences - 5} more
              </p>
            )}
          </div>

          {statusFilter === "pending" && (
            <div style={styles.actions}>
              <button
                style={styles.acceptBtn}
                disabled={resolving === group.alerts[0].id}
                onClick={() =>
                  resolveAlert(group.alerts[0].id, "accepted", true)
                }
              >
                Accept Match
              </button>
              <RemapButton
                alertId={group.alerts[0].id}
                onRemap={remapAlert}
                disabled={resolving === group.alerts[0].id}
              />
              <button
                style={styles.dismissBtn}
                disabled={resolving === group.alerts[0].id}
                onClick={() =>
                  resolveAlert(group.alerts[0].id, "dismissed", true)
                }
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RemapButton({
  alertId,
  onRemap,
  disabled,
}: {
  alertId: string;
  onRemap: (id: string, to: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (!open) {
    return (
      <button
        style={styles.remapBtn}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Add New Product &darr;
      </button>
    );
  }

  return (
    <div style={styles.remapForm}>
      <input
        style={styles.remapInput}
        placeholder="New product key (e.g. rubber)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button
        style={styles.acceptBtn}
        disabled={!value.trim()}
        onClick={() => {
          onRemap(alertId, value.trim());
          setOpen(false);
        }}
      >
        Save
      </button>
      <button style={styles.dismissBtn} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#e2e8f0",
    background: "#0f172a",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    margin: 0,
    color: "#f1f5f9",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    background: "rgba(56,189,248,0.1)",
    color: "#38bdf8",
    border: "1px solid rgba(56,189,248,0.25)",
  },
  filters: {
    display: "flex",
    gap: 8,
    marginBottom: 24,
  },
  filterBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    background: "rgba(255,255,255,0.05)",
    color: "#94a3b8",
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
    textTransform: "capitalize" as const,
  },
  filterBtnActive: {
    background: "rgba(56,189,248,0.15)",
    color: "#38bdf8",
    borderColor: "rgba(56,189,248,0.3)",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#f97316",
  },
  arrow: {
    margin: "0 10px",
    color: "#64748b",
  },
  matchedTo: {
    fontSize: 16,
    fontWeight: 600,
    color: "#38bdf8",
  },
  confidence: {
    marginLeft: 8,
    fontSize: 13,
    color: "#94a3b8",
  },
  occurrences: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 500,
  },
  reason: {
    fontSize: 13,
    color: "#94a3b8",
    margin: "4px 0 12px",
    fontStyle: "italic",
  },
  alertList: {
    marginBottom: 12,
  },
  alertRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: 12,
    color: "#64748b",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  alertMeta: {},
  alertClient: { fontFamily: "monospace" },
  muted: { color: "#64748b", fontSize: 13 },
  errorBox: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
  },
  actions: {
    display: "flex",
    gap: 8,
    paddingTop: 8,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  acceptBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.3)",
    cursor: "pointer",
  },
  remapBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "rgba(56,189,248,0.15)",
    color: "#38bdf8",
    border: "1px solid rgba(56,189,248,0.3)",
    cursor: "pointer",
  },
  dismissBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: "rgba(255,255,255,0.05)",
    color: "#64748b",
    border: "1px solid rgba(255,255,255,0.1)",
    cursor: "pointer",
  },
  remapForm: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  remapInput: {
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: 13,
    background: "rgba(255,255,255,0.05)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.15)",
    outline: "none",
    width: 200,
  },
};
