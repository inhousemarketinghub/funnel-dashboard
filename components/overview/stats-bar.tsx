import type { OverviewStats } from "@/lib/types";

interface Props {
  stats: OverviewStats;
}

function fmtK(value: number): string {
  return `RM ${Math.round(value / 1000)}K`;
}

export function StatsBar({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {/* Active Clients */}
      <div className="card-base">
        <div className="num text-[28px] font-semibold text-[var(--t1)]">{stats.activeClients}</div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Active Clients</div>
      </div>

      {/* Need Attention */}
      <div
        className="card-base"
        style={stats.needAttention > 0 ? { background: "var(--red-bg)" } : undefined}
      >
        <div
          className="num text-[28px] font-semibold"
          style={{ color: stats.needAttention > 0 ? "var(--red)" : "var(--t1)" }}
        >
          {stats.needAttention}
        </div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Need Attention</div>
      </div>

      {/* Total Ad Spend */}
      <div className="card-base">
        <div className="num text-[28px] font-semibold text-[var(--t1)]">{fmtK(stats.totalAdSpend)}</div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Total Ad Spend</div>
      </div>

      {/* Total Sales */}
      <div className="card-base">
        <div className="num text-[28px] font-semibold" style={{ color: "var(--green)" }}>
          {fmtK(stats.totalSales)}
        </div>
        <div className="font-label text-[11px] text-[var(--t3)] mt-1 uppercase tracking-wide">Total Sales</div>
      </div>
    </div>
  );
}
