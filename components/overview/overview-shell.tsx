"use client";
import { useState } from "react";
import { StatsBar } from "./stats-bar";
import { ClientKpiCard } from "./client-kpi-card";
import { Stagger } from "@/components/animations/stagger";
import { CardReveal } from "@/components/animations/card-reveal";
import type { ClientOverview, OverviewStats } from "@/lib/types";

type Filter = "all" | "active" | "alert";

export function OverviewShell({
  clients,
  stats,
}: {
  clients: ClientOverview[];
  stats: OverviewStats;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = clients.filter((c) => {
    if (filter === "active") return c.status === "active";
    if (filter === "alert") return c.health === "alert";
    return true;
  });

  return (
    <>
      <StatsBar stats={stats} filter={filter} onFilterChange={setFilter} />

      {filtered.length > 0 ? (
        <Stagger
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
          staggerMs={80}
        >
          {filtered.map((client) => (
            <CardReveal key={client.id}>
              <ClientKpiCard client={client} />
            </CardReveal>
          ))}
        </Stagger>
      ) : (
        <div className="text-center py-16">
          <p className="text-[var(--t2)] text-[15px] font-medium mb-1">
            {filter === "alert"
              ? "All clients are on track this month."
              : "No clients found."}
          </p>
          <button
            onClick={() => setFilter("all")}
            className="text-[13px] text-[var(--blue)] mt-2"
          >
            Show all clients
          </button>
        </div>
      )}
    </>
  );
}
