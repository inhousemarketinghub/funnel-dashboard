"use client";

import { useState } from "react";
import Link from "next/link";
import type { FunnelMetrics, KPIConfig, MoMResult, InsightGroup } from "@/lib/types";
import type { PersonData, BrandPerformanceData } from "@/lib/sheets";
import { t, type Lang } from "@/lib/i18n";
import { FunnelFlow } from "./funnel-flow";
import { MoMTable } from "./mom-table";
import { KPIChart } from "./kpi-chart";
import { PersonPerformance } from "./person-performance";
import { BrandPerformance } from "./brand-performance";
import { SummaryCards } from "./summary-cards";
import { DateRangePicker } from "./date-range-picker";
import { BrandSelector } from "./brand-selector";
import { MonthPickerDialog } from "./month-picker-dialog";
import { RefreshButton } from "./refresh-button";
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
  /** Sheet column missing — grey "not tracked" tile, excluded from banner stats */
  notTracked?: boolean;
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
  sheetId: string;
  fetchedAtLabel: string | null;
  lang: Lang;
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
function statusText(v: number, lang: Lang): string {
  if (v >= 100) return t(lang, "excellent");
  if (v >= 80) return t(lang, "warning");
  return t(lang, "poor");
}

const TAB_LABEL_KEYS: Record<TabKey, string> = {
  overview: "overviewTab", funnel: "funnelTab", team: "team", targets: "targetsSection", products: "products",
};

export function MobileDashboard({
  tm, lm, kpi, mom, insights, personData, funnelType, kpiItems,
  thisRangeLabel, prevRangeLabel, clientId, brands, hasMultiBrand, canReport,
  brandPerformance, sheetId, fetchedAtLabel, lang,
}: Props) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [selected, setSelected] = useState<KpiItem | null>(null);

  const hasPerson =
    personData.appointmentPersons.length > 0 || personData.salesPersons.length > 0;
  // Untracked metrics are opinion-free: keep them out of the banner stats so a
  // missing sheet column can't pin the banner at "needs attention" forever.
  const scoredItems = kpiItems.filter((k) => !k.notTracked);
  const poorCount = scoredItems.filter((k) => k.value < 80).length;
  const avgAch = scoredItems.length
    ? Math.round(scoredItems.reduce((a, k) => a + Math.min(k.value, 150), 0) / scoredItems.length)
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
          {hasMultiBrand && <BrandSelector clientId={clientId} brands={brands} lang={lang} />}
          <Link href={`/${clientId}/trends`} className="topbar-btn">{t(lang, "trends")}</Link>
          {canReport && <MonthPickerDialog clientId={clientId} lang={lang} />}
          <DateRangePicker clientId={clientId} lang={lang} />
          <RefreshButton sheetId={sheetId} fetchedAtLabel={fetchedAtLabel} lang={lang} />
        </div>
      </div>

      {/* Sticky segmented tabs (sits just below the compact MobileNav) */}
      <div
        className="no-scrollbar sticky top-[55px] z-40 -mx-4 flex gap-2 overflow-x-auto px-4 py-2"
        style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)", scrollbarWidth: "none" }}
      >
        {visibleTabs.map((tabItem) => {
          const active = tab === tabItem.key;
          return (
            <button
              key={tabItem.key}
              onClick={() => setTab(tabItem.key)}
              className="font-label flex-shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[12px] transition-colors"
              style={{
                background: active ? "var(--blue)" : "var(--bg3)",
                color: active ? "#fff" : "var(--t3)",
                border: `1px solid ${active ? "var(--blue)" : "var(--border)"}`,
              }}
            >
              {t(lang, TAB_LABEL_KEYS[tabItem.key])}
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
                <span className="num font-semibold">{avgAch}%</span> {t(lang, "avgAchievement")}
                {" · "}
                {poorCount === 0
                  ? t(lang, "allOnTrack")
                  : (lang === "zh"
                      ? `${poorCount} 项需关注`
                      : `${poorCount} need${poorCount > 1 ? "" : "s"} attention`)}
              </div>
            </div>

            {/* Compact KPI tiles — tap to drill in */}
            <div className="grid grid-cols-2 gap-3">
              {kpiItems.map((k) => (
                <button
                  key={k.label}
                  onClick={() => setSelected(k)}
                  className="card-base relative text-left"
                  style={{ padding: 14, borderLeft: `3px solid ${k.notTracked ? "var(--t4)" : statusColor(k.value)}` }}
                >
                  <div className="font-label mb-1 truncate text-[10px] uppercase tracking-wider text-[var(--t4)]">
                    {k.label}
                  </div>
                  <div className={`num text-[20px] font-bold leading-tight ${k.notTracked ? "text-[var(--t4)]" : "text-[var(--t1)]"}`}>
                    {k.notTracked ? t(lang, "notTracked") : k.actual}
                  </div>
                  <div className="mt-1 text-[10px]" style={{ color: k.notTracked ? "var(--t4)" : statusColor(k.value) }}>
                    {k.notTracked ? t(lang, "notTrackedHint") : `${statusText(k.value, lang)} · ${Math.round(k.value)}%`}
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
            <FunnelFlow metrics={tm} funnelType={funnelType} lang={lang} />
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
              lang={lang}
            />
          </div>
        )}

        {tab === "targets" && (
          <div className="space-y-4">
            <div className="card-deep">
              <div className="font-label mb-3 text-[11px] uppercase tracking-widest text-[var(--t3)]">
                {t(lang, "kpiAchievement")}
              </div>
              <KPIChart items={kpiItems} lang={lang} />
            </div>
            <div className="card-deep">
              <div className="font-label mb-3 text-[11px] uppercase tracking-widest text-[var(--t3)]">
                {t(lang, "periodComparison")}
              </div>
              <MoMTable
                tm={tm}
                lm={lm}
                mom={mom}
                kpi={kpi}
                thisMonth={thisRangeLabel}
                lastMonth={prevRangeLabel}
                funnelType={funnelType}
                lang={lang}
              />
            </div>
          </div>
        )}

        {tab === "products" && hasBrand && brandPerformance && (
          <div className="card-base">
            <BrandPerformance data={brandPerformance} lang={lang} />
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
              style={{ background: "var(--bg3)", color: selected.notTracked ? "var(--t4)" : statusColor(selected.value) }}
            >
              {selected.notTracked
                ? t(lang, "notTrackedHint")
                : `${statusText(selected.value, lang)} · ${Math.round(selected.value)}% ${t(lang, "ofTarget")}`}
            </span>
            <div className="space-y-1.5 text-[13px] text-[var(--t2)]">
              <div>{selected.target}</div>
              {selected.monthlyTarget && <div>{selected.monthlyTarget}</div>}
              {selected.prevActual && <div>{t(lang, "previous")}: {selected.prevActual}</div>}
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
              {t(lang, "close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
