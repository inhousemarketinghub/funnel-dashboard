"use client";

import { useState } from "react";
import type { FunnelMetrics, KPIConfig, MoMResult, InsightGroup } from "@/lib/types";
import type { PersonData, BrandPerformanceData } from "@/lib/sheets";
import { FunnelFlow } from "./funnel-flow";
import { MoMTable } from "./mom-table";
import { KPIChart } from "./kpi-chart";
import { PersonPerformance } from "./person-performance";
import { BrandPerformance } from "./brand-performance";
import { SummaryCards } from "./summary-cards";
import { DateRangePicker } from "./date-range-picker";
import { BrandSelector } from "./brand-selector";
import { MonthPickerDialog } from "./month-picker-dialog";
import { Stagger } from "@/components/animations/stagger";

// Matches the kpiItems shape built in app/[clientId]/page.tsx (and KPIChart's).
export interface KpiItem {
  label: string;
  value: number; // achievement % — higher is better, already normalised for inverted metrics
  target: string;
  actual: string;
  prevActual?: string;
  monthlyTarget?: string;
  breakdown?: { label: string; value: string }[]; // underlying counts, shown in the tap-detail sheet
}

interface Props {
  tm: FunnelMetrics;
  lm: FunnelMetrics;
  kpi: KPIConfig;
  mom: MoMResult;
  insights: InsightGroup;
  personData: PersonData;
  funnelType: string;
  kpiItems: KpiItem[];
  thisRangeLabel: string;
  prevRangeLabel: string;
  clientId: string;
  brands: string[];
  hasMultiBrand: boolean;
  canReport: boolean;
  brandPerformance: BrandPerformanceData | null;
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "funnel", label: "Funnel" },
  { key: "team", label: "Team" },
  { key: "targets", label: "Targets" },
  { key: "products", label: "Products" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function statusColor(v: number): string {
  if (v >= 100) return "var(--green)";
  if (v >= 80) return "var(--yellow)";
  return "var(--red)";
}
function statusText(v: number): string {
  if (v >= 100) return "Excellent";
  if (v >= 80) return "Warning";
  return "Poor";
}

export function MobileDashboard({
  tm, lm, kpi, mom, insights, personData, funnelType, kpiItems,
  thisRangeLabel, prevRangeLabel, clientId, brands, hasMultiBrand, canReport,
  brandPerformance,
}: Props) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [selected, setSelected] = useState<KpiItem | null>(null);

  const hasPerson =
    personData.appointmentPersons.length > 0 || personData.salesPersons.length > 0;
  const poorCount = kpiItems.filter((k) => k.value < 80).length;
  const avgAch = kpiItems.length
    ? Math.round(kpiItems.reduce((a, k) => a + Math.min(k.value, 150), 0) / kpiItems.length)
    : 0;
  const bannerColor = poorCount === 0 ? "var(--green)" : poorCount <= 2 ? "var(--yellow)" : "var(--red)";
  const hasBrand = !!brandPerformance && brandPerformance.totalQty > 0;

  const visibleTabs = TABS.filter(
    (t) => (t.key !== "team" || hasPerson) && (t.key !== "products" || hasBrand),
  );

  return (
    <div className="md:hidden">
      {/* Date range + brand + monthly report controls */}
      <div className="mb-3 flex flex-col gap-2">
        <div className="num text-[13px] text-[var(--t3)]">{thisRangeLabel}</div>
        <div className="flex flex-wrap items-center gap-2">
          {hasMultiBrand && <BrandSelector clientId={clientId} brands={brands} />}
          {canReport && <MonthPickerDialog clientId={clientId} />}
          <DateRangePicker clientId={clientId} />
        </div>
      </div>

      {/* Sticky segmented tabs (sits just below the compact MobileNav) */}
      <div
        className="no-scrollbar sticky top-[55px] z-40 -mx-4 flex gap-2 overflow-x-auto px-4 py-2"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}
      >
        {visibleTabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="font-label flex-shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] transition-colors"
              style={{
                background: active ? "var(--blue)" : "var(--bg3)",
                color: active ? "#fff" : "var(--t3)",
                border: `1px solid ${active ? "var(--blue)" : "var(--border)"}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="pt-4">
        {tab === "overview" && (
          <div className="space-y-4">
            {/* Status banner */}
            <div
              className="flex items-center gap-3 rounded-[12px] p-4"
              style={{ background: "var(--bg2)", boxShadow: "var(--shadow-sm)" }}
            >
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: bannerColor }} />
              <div className="text-[13px] text-[var(--t1)]">
                <span className="num font-semibold">{avgAch}%</span> avg achievement
                {" · "}
                {poorCount === 0 ? "all on track" : `${poorCount} need${poorCount > 1 ? "" : "s"} attention`}
              </div>
            </div>

            {/* Compact KPI tiles — tap to drill in */}
            <div className="grid grid-cols-2 gap-3">
              {kpiItems.map((k) => (
                <button
                  key={k.label}
                  onClick={() => setSelected(k)}
                  className="card-base relative text-left"
                  style={{ padding: 14, borderLeft: `3px solid ${statusColor(k.value)}` }}
                >
                  <div className="font-label mb-1 truncate text-[10px] uppercase tracking-wider text-[var(--t4)]">
                    {k.label}
                  </div>
                  <div className="num text-[20px] font-bold leading-tight text-[var(--t1)]">
                    {k.actual}
                  </div>
                  <div className="mt-1 text-[10px]" style={{ color: statusColor(k.value) }}>
                    {statusText(k.value)} · {Math.round(k.value)}%
                  </div>
                </button>
              ))}
            </div>

            {/* Insights */}
            <Stagger className="grid grid-cols-1 gap-3" staggerMs={120}>
              <SummaryCards insights={insights} />
            </Stagger>
          </div>
        )}

        {tab === "funnel" && (
          <div className="card-base flex justify-center">
            <FunnelFlow metrics={tm} funnelType={funnelType} />
          </div>
        )}

        {tab === "team" && hasPerson && (
          <div className="card-base">
            <PersonPerformance
              appointmentPersons={personData.appointmentPersons}
              salesPersons={personData.salesPersons}
              kpi={kpi}
              brandBreakdowns={personData.brandBreakdowns}
              hasMultiBrand={hasMultiBrand}
              funnelType={funnelType}
            />
          </div>
        )}

        {tab === "targets" && (
          <div className="space-y-4">
            <div className="card-deep">
              <div className="font-label mb-3 text-[11px] uppercase tracking-widest text-[var(--t3)]">
                KPI Achievement
              </div>
              <KPIChart items={kpiItems} />
            </div>
            <div className="card-deep">
              <div className="font-label mb-3 text-[11px] uppercase tracking-widest text-[var(--t3)]">
                Period Comparison
              </div>
              <MoMTable
                tm={tm}
                lm={lm}
                mom={mom}
                kpi={kpi}
                thisMonth={thisRangeLabel}
                lastMonth={prevRangeLabel}
                funnelType={funnelType}
              />
            </div>
          </div>
        )}

        {tab === "products" && hasBrand && brandPerformance && (
          <div className="card-base">
            <BrandPerformance data={brandPerformance} />
          </div>
        )}
      </div>

      {/* Tile detail — bottom sheet */}
      {selected && (
        <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(20,18,14,0.45)" }} />
          <div
            className="relative w-full rounded-t-[20px] p-6 pb-10"
            style={{ background: "var(--bg2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1 w-10 rounded-full" style={{ background: "var(--border)" }} />
            <div className="font-label mb-1 text-[11px] uppercase tracking-wider text-[var(--t4)]">
              {selected.label}
            </div>
            <div className="num mb-3 text-[32px] font-bold leading-none text-[var(--t1)]">
              {selected.actual}
            </div>
            <span
              className="mb-5 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "var(--bg3)", color: statusColor(selected.value) }}
            >
              {statusText(selected.value)} · {Math.round(selected.value)}% of target
            </span>
            <div className="space-y-1.5 text-[13px] text-[var(--t2)]">
              <div>{selected.target}</div>
              {selected.monthlyTarget && <div>{selected.monthlyTarget}</div>}
              {selected.prevActual && <div>Previous: {selected.prevActual}</div>}
            </div>
            {selected.breakdown && selected.breakdown.length > 0 && (
              <div
                className="mt-5 flex flex-wrap gap-x-8 gap-y-4"
                style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}
              >
                {selected.breakdown.map((b) => (
                  <div key={b.label}>
                    <div className="font-label mb-1 text-[10px] uppercase tracking-wider text-[var(--t4)]">
                      {b.label}
                    </div>
                    <div className="num text-[16px] font-semibold text-[var(--t1)]">{b.value}</div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-6 w-full rounded-[12px] py-3 text-[13px] font-medium"
              style={{ background: "var(--t1)", color: "var(--bg)" }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
