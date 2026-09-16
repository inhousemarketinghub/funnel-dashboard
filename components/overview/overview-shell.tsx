"use client";
import { useState, useMemo } from "react";
import { StatsBar } from "./stats-bar";
import { ClientKpiCard } from "./client-kpi-card";
import { CardReveal } from "@/components/animations/card-reveal";
import { createClient } from "@/lib/supabase/client";
import type { ClientOverview, OverviewStats } from "@/lib/types";
import { toast } from "sonner";

type StatusFilter = "all" | "active" | "inactive";
type FunnelFilter = "all" | "walkin" | "appointment";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const FUNNEL_OPTIONS: { value: FunnelFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "walkin", label: "Walk In" },
  { value: "appointment", label: "Appointment" },
];

export function OverviewShell({
  clients: initialClients,
  stats: _initialStats,
  isOwner = false,
}: {
  clients: ClientOverview[];
  stats: OverviewStats;
  isOwner?: boolean;
}) {
  const [clients, setClients] = useState(initialClients);
  const [deleteTarget, setDeleteTarget] = useState<ClientOverview | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [funnelFilter, setFunnelFilter] = useState<FunnelFilter>("all");

  // Filter
  const filtered = clients.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (funnelFilter !== "all" && c.funnel_type !== funnelFilter) return false;
    return true;
  });

  // Dynamic stats based on filtered list
  const dynamicStats: OverviewStats = useMemo(() => ({
    activeClients: filtered.filter((c) => c.status === "active").length,
    needAttention: filtered.filter((c) => c.health === "alert").length,
    totalAdSpend: filtered.reduce((sum, c) => sum + c.metrics.ad_spend, 0),
    totalSales: filtered.reduce((sum, c) => sum + c.metrics.sales, 0),
  }), [filtered]);

  // Sort: active first, inactive last
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (a.status !== "active" && b.status === "active") return 1;
    return 0;
  });

  // Toggle status handler
  async function handleToggleStatus(id: string, newStatus: "active" | "inactive") {
    const supabase = createClient();
    const { error } = await supabase.from("clients").update({ status: newStatus }).eq("id", id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)),
    );
  }

  async function handleArchive(id: string) {
    const res = await fetch("/api/client-lifecycle", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: id, status: "archived" }),
    });
    if (!res.ok) { toast.error("Failed to archive"); return; }
    setClients((prev) => prev.filter((c) => c.id !== id)); // drops off the overview
    toast.success("Project archived");
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Server requires archived state before a permanent delete, so archive
      // first (harmless if already archived) then delete in one flow.
      await fetch("/api/client-lifecycle", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: deleteTarget.id, status: "archived" }),
      });
      const res = await fetch("/api/client-lifecycle", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: deleteTarget.id, confirmName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Project permanently deleted");
      setDeleteTarget(null);
      setConfirmName("");
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : ""}`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Filter Bar — above StatsBar */}
      <div className="flex flex-wrap gap-6 mb-5">
        <div className="flex items-center gap-2">
          <span className="font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">Status</span>
          <div className="flex gap-1">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className="font-label text-[11px] px-3 py-1 rounded-full transition-colors cursor-pointer"
                style={{
                  background: statusFilter === opt.value ? "var(--blue)" : "var(--bg2)",
                  color: statusFilter === opt.value ? "#fff" : "var(--t3)",
                  border: `1px solid ${statusFilter === opt.value ? "var(--blue)" : "var(--border)"}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">Funnel</span>
          <div className="flex gap-1">
            {FUNNEL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFunnelFilter(opt.value)}
                className="font-label text-[11px] px-3 py-1 rounded-full transition-colors cursor-pointer"
                style={{
                  background: funnelFilter === opt.value ? "var(--blue)" : "var(--bg2)",
                  color: funnelFilter === opt.value ? "#fff" : "var(--t3)",
                  border: `1px solid ${funnelFilter === opt.value ? "var(--blue)" : "var(--border)"}`,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* StatsBar — dynamic values with CountUp animation */}
      <StatsBar stats={dynamicStats} />

      {sorted.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((client, i) => (
            <CardReveal key={client.id} delay={i * 100}>
              <ClientKpiCard
                client={client}
                onToggleStatus={handleToggleStatus}
                onArchive={isOwner ? handleArchive : undefined}
                onDelete={isOwner ? (id) => { const t = clients.find((c) => c.id === id); if (t) { setConfirmName(""); setDeleteTarget(t); } } : undefined}
              />
            </CardReveal>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-[var(--t2)] text-[15px] font-medium mb-1">
            No projects found.
          </p>
          <button
            onClick={() => { setStatusFilter("all"); setFunnelFilter("all"); }}
            className="text-[13px] text-[var(--blue)] mt-2 cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Permanent-delete confirmation: type the exact name to arm the button */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-[440px] rounded-[12px] border border-[var(--border)] bg-[var(--bg2)] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)]">Delete this project?</h2>
            <p className="mt-2 text-[13px] text-[var(--t3)]">
              This permanently removes <span className="font-semibold text-[var(--t1)]">{deleteTarget.name}</span> and
              all of its data — metrics, reports, sync history, notifications and access. This cannot be undone.
            </p>
            <p className="mt-4 text-[12px] text-[var(--t3)]">
              Type <span className="num font-semibold text-[var(--t1)]">{deleteTarget.name}</span> to confirm:
            </p>
            <input
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="mt-1.5 w-full rounded-[6px] border border-[var(--border)] bg-[var(--bg1)] px-3 py-2 text-[13px] text-[var(--t1)] outline-none focus:border-[var(--red)]"
              placeholder={deleteTarget.name}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setConfirmName(""); }}
                disabled={deleting}
                className="rounded-full px-5 py-2 text-[13px] text-[var(--t2)] hover:bg-[var(--bg3)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={deleting || confirmName.trim() !== deleteTarget.name}
                className="rounded-full bg-[var(--red)] px-5 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
              >
                {deleting ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
