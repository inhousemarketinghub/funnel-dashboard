"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ClientOverview } from "@/lib/types";
import { CountUp } from "@/components/animations/count-up";

interface Props {
  client: ClientOverview;
  onToggleStatus?: (id: string, newStatus: "active" | "inactive") => void;
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

export function ClientKpiCard({ client, onToggleStatus }: Props) {
  const isActive = client.status === "active";
  const badge = healthBadgeStyle(client.health);
  const avg = client.achievement.average;
  const barRef = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setBarVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const metrics = [
    { label: "Sales", raw: client.metrics.sales, prefix: "RM ", suffix: client.metrics.sales >= 1000 ? "K" : "", displayValue: client.metrics.sales >= 1000 ? client.metrics.sales / 1000 : client.metrics.sales, decimals: client.metrics.sales >= 1000 ? 0 : 0, ach: client.achievement.sales },
    { label: "CPL", raw: client.metrics.cpl, prefix: "RM ", suffix: "", displayValue: client.metrics.cpl, decimals: 0, ach: client.achievement.cpl },
    { label: "CPA%", raw: client.metrics.cpa_pct, prefix: "", suffix: "%", displayValue: client.metrics.cpa_pct, decimals: 1, ach: client.achievement.cpa_pct },
    { label: "Conv%", raw: client.metrics.conv_rate, prefix: "", suffix: "%", displayValue: client.metrics.conv_rate, decimals: 1, ach: client.achievement.conv_rate },
  ];

  return (
    <Link
      href={`/${client.id}`}
      className="card-base block no-underline transition-all hover:shadow-md hover:border-[var(--blue)] hover:-translate-y-[1px] hover:scale-[1.01]"
      style={{ transitionDuration: "150ms", opacity: isActive ? 1 : 0.5 }}
    >
      {/* Header: logo/initial + name + toggle + health badge */}
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
        <span className="font-heading text-[18px] font-semibold text-[var(--t1)] truncate flex-1">
          {client.name}
        </span>
        {onToggleStatus && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleStatus(client.id, isActive ? "inactive" : "active");
            }}
            className="flex-shrink-0 w-[36px] h-[20px] rounded-full relative transition-colors cursor-pointer"
            style={{ background: isActive ? "var(--green)" : "var(--border)" }}
            title={isActive ? "Active" : "Inactive"}
          >
            <div
              className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white transition-transform"
              style={{ left: isActive ? "18px" : "2px" }}
            />
          </button>
        )}
        <span
          className="font-label text-[10px] font-semibold px-2 py-[3px] rounded-full flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      {/* 4 metrics grid with CountUp */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="num text-[13px] font-semibold" style={{ color: achievementColor(m.ach) }}>
              <CountUp value={m.displayValue} prefix={m.prefix} suffix={m.suffix} decimals={m.decimals} className="text-[13px] font-semibold" />
            </div>
            <div className="font-label text-[10px] text-[var(--t4)] mt-[2px] uppercase tracking-wide">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Achievement progress bar with scroll-triggered animation */}
      <div ref={barRef}>
        <div className="flex justify-between items-center mb-1">
          <span className="font-label text-[10px] text-[var(--t4)] uppercase tracking-wide">
            Avg Achievement
          </span>
          <span className="num text-[11px] font-semibold" style={{ color: achievementColor(avg) }}>
            <CountUp value={avg} suffix="%" decimals={0} className="text-[11px] font-semibold" />
          </span>
        </div>
        <div className="h-[4px] rounded-full" style={{ background: "var(--border)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: barVisible ? `${Math.min(avg, 100)}%` : "0%",
              background: achievementColor(avg),
              transition: "width 800ms cubic-bezier(0.215, 0.61, 0.355, 1)",
            }}
          />
        </div>
      </div>
    </Link>
  );
}
