import Link from "next/link";
import type { ClientOverview } from "@/lib/types";

interface Props {
  client: ClientOverview;
}

// Format helpers
function fmtCurrency(value: number): string {
  if (value >= 1000) return `RM ${Math.round(value / 1000)}K`;
  return `RM ${Math.round(value)}`;
}

function fmtRate(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtMultiplier(value: number): string {
  return `${value.toFixed(1)}x`;
}

function achievementColor(pct: number): string {
  if (pct >= 80) return "var(--green)";
  if (pct >= 60) return "var(--yellow)";
  return "var(--red)";
}

function healthBadgeStyle(health: ClientOverview["health"]): { bg: string; color: string; label: string } {
  switch (health) {
    case "good":
      return { bg: "var(--green-bg)", color: "var(--green)", label: "On Track" };
    case "watch":
      return { bg: "var(--yellow-bg)", color: "var(--yellow)", label: "Watch" };
    case "alert":
      return { bg: "var(--red-bg)", color: "var(--red)", label: "Alert" };
  }
}

export function ClientKpiCard({ client }: Props) {
  const badge = healthBadgeStyle(client.health);
  const avg = client.achievement.average;

  const metrics = [
    {
      label: "Sales",
      value: fmtCurrency(client.metrics.sales),
      ach: client.achievement.sales,
    },
    {
      label: "CPL",
      value: fmtCurrency(client.metrics.cpl),
      ach: client.achievement.cpl,
    },
    {
      label: "ROAS",
      value: fmtMultiplier(client.metrics.roas),
      ach: client.achievement.roas,
    },
    {
      label: "Conv%",
      value: fmtRate(client.metrics.conv_rate),
      ach: client.achievement.conv_rate,
    },
  ];

  return (
    <Link
      href={`/${client.id}`}
      className="card-base block no-underline transition-all hover:shadow-md hover:border-[var(--blue)] hover:-translate-y-[1px]"
      style={{ transitionDuration: "150ms" }}
    >
      {/* Header: logo/initial + name + health badge */}
      <div className="flex items-center gap-3 mb-4">
        {client.logo_url ? (
          <img
            src={client.logo_url}
            alt=""
            className="w-9 h-9 rounded-[6px] object-contain bg-white p-[2px] flex-shrink-0"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-[6px] flex items-center justify-center flex-shrink-0 text-[14px] font-semibold"
            style={{ background: "var(--sand)", color: "var(--t2)" }}
          >
            {client.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="font-heading text-[15px] font-semibold text-[var(--t1)] truncate flex-1">
          {client.name}
        </span>
        <span
          className="font-label text-[10px] font-semibold px-2 py-[3px] rounded-full flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      {/* 4 metrics grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div
              className="num text-[13px] font-semibold"
              style={{ color: achievementColor(m.ach) }}
            >
              {m.value}
            </div>
            <div className="font-label text-[10px] text-[var(--t4)] mt-[2px] uppercase tracking-wide">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Achievement progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-label text-[10px] text-[var(--t4)] uppercase tracking-wide">
            Avg Achievement
          </span>
          <span
            className="num text-[11px] font-semibold"
            style={{ color: achievementColor(avg) }}
          >
            {avg.toFixed(0)}%
          </span>
        </div>
        <div
          className="h-[4px] rounded-full"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(avg, 100)}%`,
              background: achievementColor(avg),
            }}
          />
        </div>
      </div>
    </Link>
  );
}
