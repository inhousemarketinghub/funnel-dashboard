"use client";
import type { OverviewStats } from "@/lib/types";
import { CountUp } from "@/components/animations/count-up";

interface Props {
  stats: OverviewStats;
  filter: "all" | "active" | "alert";
  onFilterChange: (f: "all" | "active" | "alert") => void;
}

export function StatsBar({ stats, filter, onFilterChange }: Props) {
  const isActiveFilter = filter === "active";
  const isAlertFilter = filter === "alert";

  function handleActiveClick() {
    onFilterChange(isActiveFilter ? "all" : "active");
  }

  function handleAlertClick() {
    onFilterChange(isAlertFilter ? "all" : "alert");
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {/* Active Clients */}
      <div
        className="card-base cursor-pointer transition-all"
        style={{
          borderLeft: "3px solid var(--green)",
          ...(isActiveFilter
            ? { border: "2px solid var(--blue)", transform: "scale(1.02)" }
            : {}),
        }}
        onClick={handleActiveClick}
      >
        <div className="num text-[28px] font-semibold text-[var(--t1)]">
          <CountUp value={stats.activeClients} />
        </div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Active Clients</div>
      </div>

      {/* Need Attention */}
      <div
        className="card-base cursor-pointer transition-all"
        style={{
          borderLeft: "3px solid var(--red)",
          ...(stats.needAttention > 0 && !isAlertFilter ? { background: "var(--red-bg)" } : {}),
          ...(isAlertFilter
            ? { border: "2px solid var(--blue)", transform: "scale(1.02)" }
            : {}),
        }}
        onClick={handleAlertClick}
      >
        <div
          className="num text-[28px] font-semibold"
          style={{ color: stats.needAttention > 0 ? "var(--red)" : "var(--t1)" }}
        >
          <CountUp value={stats.needAttention} />
        </div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Need Attention</div>
      </div>

      {/* Total Ad Spend */}
      <div
        className="card-base"
        style={{ borderLeft: "3px solid var(--blue)" }}
      >
        <div className="num text-[28px] font-semibold text-[var(--t1)]">
          <CountUp
            value={Math.round(stats.totalAdSpend / 1000)}
            prefix="RM "
            suffix="K"
          />
        </div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Total Ad Spend</div>
      </div>

      {/* Total Sales */}
      <div
        className="card-base"
        style={{ borderLeft: "3px solid var(--green)" }}
      >
        <div className="num text-[28px] font-semibold" style={{ color: "var(--green)" }}>
          <CountUp
            value={Math.round(stats.totalSales / 1000)}
            prefix="RM "
            suffix="K"
          />
        </div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Total Sales</div>
      </div>
    </div>
  );
}
