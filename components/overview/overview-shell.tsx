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
}: {
  clients: ClientOverview[];
  stats: OverviewStats;
}) {
  const [clients, setClients] = useState(initialClients);
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
              <ClientKpiCard client={client} onToggleStatus={handleToggleStatus} />
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
    </>
  );
}
