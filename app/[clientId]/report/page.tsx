import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchLeadData, countEstShowUp, fetchKPIData, detectBrandsOrdered, fetchOverallKPI } from "@/lib/sheets";
import type { PerfResult } from "@/lib/sheets";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario, computeWeeklyBreakdown } from "@/lib/metrics";
import { fmtRM, fmtROAS, fmtPct, achLabel } from "@/lib/utils";
import { resolveSearchParams, getPreviousPeriod, formatRangeLabel, formatDateDisplay } from "@/lib/dates";
import type { KPIConfig, FunnelMetrics, MoMResult, Achievement } from "@/lib/types";
import { PrintButton } from "@/components/dashboard/print-button";
import { KPIChart } from "@/components/dashboard/kpi-chart";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";

const BRAND_COLORS = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--t1)", "var(--green)"];

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return <p className="text-[var(--t3)] p-8">Client not found</p>;

  let reportStart: Date;
  let reportEnd: Date;
  if (sp.month && typeof sp.month === "string") {
    const [y, m] = sp.month.split("-").map(Number);
    reportStart = new Date(y, m - 1, 1);
    reportEnd = new Date(y, m, 0);
  } else {
    const resolved = resolveSearchParams(sp.from, sp.to);
    reportStart = resolved.from;
    reportEnd = resolved.to;
  }
  const { from: prevStart, to: prevEnd } = getPreviousPeriod(reportStart, reportEnd);
  const thisLabel = formatRangeLabel(reportStart, reportEnd);
  const prevLabel = formatRangeLabel(prevStart, prevEnd);

  // Detect brands
  const brands = await detectBrandsOrdered(client.sheet_id);
  const isMultiBrand = brands.length > 1;

  // Fetch Overall data
  const [overallPerf, overallLead, overallKPI] = await Promise.all([
    fetchPerformanceData(client.sheet_id),
    fetchLeadData(client.sheet_id),
    isMultiBrand ? fetchOverallKPI(client.sheet_id, brands) : fetchKPIData(client.sheet_id),
  ]);
  const overallKpiConfig: KPIConfig = overallKPI || { sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0, showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0, target_contact: 0, target_appt: 0, target_showup: 0 };
  const funnelType = overallPerf.funnelType;

  // Compute Overall metrics
  const oThis = overallPerf.data.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const oPrev = overallPerf.data.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const oEstSU = countEstShowUp(overallLead, reportStart, reportEnd);
  const oEstSUPrev = countEstShowUp(overallLead, prevStart, prevEnd);
  const oTm = computeMetrics(oThis, oEstSU);
  const oLm = computeMetrics(oPrev, oEstSUPrev);
  const oMom = computeMoM(oTm, oLm);
  const oAch = computeAchievement(oTm, overallKpiConfig);

  // Fetch per-brand data (if multi-brand)
  interface BrandData {
    name: string;
    tm: FunnelMetrics;
    lm: FunnelMetrics;
    mom: MoMResult;
    ach: Achievement;
    kpi: KPIConfig;
    weeks: FunnelMetrics[];
  }
  const brandData: BrandData[] = [];
  if (isMultiBrand) {
    for (const brand of brands) {
      const [bPerf, bLead, bKPI] = await Promise.all([
        fetchPerformanceData(client.sheet_id, brand),
        fetchLeadData(client.sheet_id, brand),
        fetchKPIData(client.sheet_id, brand),
      ]);
      const bKpiConfig = bKPI || overallKpiConfig;
      const bThis = bPerf.data.filter((r) => r.date >= reportStart && r.date <= reportEnd);
      const bPrev = bPerf.data.filter((r) => r.date >= prevStart && r.date <= prevEnd);
      const bEstSU = countEstShowUp(bLead, reportStart, reportEnd);
      const bEstSUPrev = countEstShowUp(bLead, prevStart, prevEnd);
      const bTm = computeMetrics(bThis, bEstSU);
      const bLm = computeMetrics(bPrev, bEstSUPrev);
      brandData.push({
        name: brand,
        tm: bTm,
        lm: bLm,
        mom: computeMoM(bTm, bLm),
        ach: computeAchievement(bTm, bKpiConfig),
        kpi: bKpiConfig,
        weeks: computeWeeklyBreakdown(bThis),
      });
    }
  }

  // Budget scenarios (overall)
  const nextStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth() + 1, 1);
  const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
  const estSUNext = countEstShowUp(overallLead, nextStart, nextEnd);
  const s1 = budgetScenario(oTm.ad_spend, oTm, overallKpiConfig, estSUNext);
  const s2 = budgetScenario(oTm.ad_spend * 1.2, oTm, overallKpiConfig, estSUNext);
  const s3 = budgetScenario(oTm.ad_spend * 0.8, oTm, overallKpiConfig, estSUNext);
  const weeks = computeWeeklyBreakdown(oThis);

  function momColor(v: number | null, inv: boolean) {
    if (v === null) return "var(--t3)";
    const good = (v > 0 && !inv) || (v < 0 && inv);
    if (Math.abs(v) < 5) return "var(--yellow)";
    return good ? "var(--green)" : "var(--red)";
  }

  function buildHeroStats(tm: FunnelMetrics, ach: Achievement, kpi: KPIConfig) {
    return [
      { label: "Total Sales", value: fmtRM(tm.sales), ach: ach.sales, kpi: fmtRM(kpi.sales) },
      { label: "Total Ad Spend", value: fmtRM(tm.ad_spend), ach: ach.ad_spend, kpi: fmtRM(kpi.ad_spend) },
      { label: "CPA%", value: `${tm.cpa_pct.toFixed(2)}%`, ach: tm.cpa_pct > 0 ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, kpi: `${kpi.cpa_pct}%` },
      { label: "Orders", value: String(tm.orders), ach: ach.orders, kpi: String(kpi.orders) },
      { label: "AOV", value: fmtRM(tm.aov), ach: ach.aov, kpi: fmtRM(kpi.aov) },
      { label: "CPL", value: fmtRM(tm.cpl), ach: ach.cpl, kpi: fmtRM(kpi.cpl) },
      ...(funnelType !== "walkin" ? [
        { label: "Respond Rate", value: fmtPct(tm.respond_rate), ach: ach.respond_rate, kpi: `${kpi.respond_rate}%` },
        { label: "Appt Rate", value: fmtPct(tm.appt_rate), ach: ach.appt_rate, kpi: `${kpi.appt_rate}%` },
        { label: "Show Up Rate", value: fmtPct(tm.showup_rate), ach: ach.showup_rate, kpi: `${kpi.showup_rate}%` },
      ] : [
        { label: "Visit Rate", value: fmtPct(tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0), ach: kpi.respond_rate ? ((tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0) / kpi.respond_rate) * 100 : 0, kpi: `${kpi.respond_rate}%` },
      ]),
      { label: "Conv Rate", value: fmtPct(funnelType === "walkin" && tm.contact > 0 ? (tm.orders / tm.contact) * 100 : tm.conv_rate), ach: ach.conv_rate, kpi: `${kpi.conv_rate}%` },
    ];
  }

  function buildFunnelRows(tm: FunnelMetrics, lm: FunnelMetrics, mom: MoMResult, kpi: KPIConfig) {
    const rows = [
      { label: "Ad Spend", tm: fmtRM(tm.ad_spend), lm: fmtRM(lm.ad_spend), mom: mom.ad_spend, kpi: fmtRM(kpi.ad_spend), inv: false },
      { label: "Inquiry", tm: String(tm.inquiry), lm: String(lm.inquiry), mom: mom.inquiry, kpi: kpi.cpl > 0 ? String(Math.round(kpi.ad_spend / kpi.cpl)) : "—", inv: false },
      { label: funnelType === "walkin" ? "Visit" : "Contact", tm: String(tm.contact), lm: String(lm.contact), mom: mom.contact, kpi: String(kpi.target_contact), inv: false },
      { label: "CPL", tm: fmtRM(tm.cpl), lm: fmtRM(lm.cpl), mom: mom.cpl, kpi: fmtRM(kpi.cpl), inv: true },
    ];
    if (funnelType !== "walkin") {
      rows.push(
        { label: "Respond Rate", tm: fmtPct(tm.respond_rate), lm: fmtPct(lm.respond_rate), mom: mom.respond_rate ?? null, kpi: `${kpi.respond_rate}%`, inv: false },
        { label: "Appointment", tm: String(tm.appointment), lm: String(lm.appointment), mom: mom.appointment ?? null, kpi: String(kpi.target_appt), inv: false },
        { label: "Show Up", tm: String(tm.showup), lm: String(lm.showup), mom: mom.showup ?? null, kpi: String(kpi.target_showup), inv: false },
      );
    }
    rows.push(
      { label: "Orders", tm: String(tm.orders), lm: String(lm.orders), mom: mom.orders, kpi: String(kpi.orders), inv: false },
      { label: "Conv Rate", tm: fmtPct(funnelType === "walkin" && tm.contact > 0 ? (tm.orders / tm.contact) * 100 : tm.conv_rate), lm: fmtPct(funnelType === "walkin" && lm.contact > 0 ? (lm.orders / lm.contact) * 100 : lm.conv_rate), mom: mom.conv_rate, kpi: `${kpi.conv_rate}%`, inv: false },
      { label: "Sales", tm: fmtRM(tm.sales), lm: fmtRM(lm.sales), mom: mom.sales, kpi: fmtRM(kpi.sales), inv: false },
      { label: "AOV", tm: fmtRM(tm.aov), lm: fmtRM(lm.aov), mom: mom.aov, kpi: fmtRM(kpi.aov), inv: false },
      { label: "CPA%", tm: `${tm.cpa_pct.toFixed(2)}%`, lm: `${lm.cpa_pct.toFixed(2)}%`, mom: mom.cpa_pct, kpi: `${kpi.cpa_pct}%`, inv: true },
    );
    return rows;
  }

  function buildKpiItems(tm: FunnelMetrics, lm: FunnelMetrics, ach: Achievement, kpi: KPIConfig) {
    return [
      { label: "Sales", value: ach.sales, actual: fmtRM(tm.sales), target: fmtRM(kpi.sales), prevActual: fmtRM(lm.sales) },
      { label: "Ad Spend", value: ach.ad_spend, actual: fmtRM(tm.ad_spend), target: fmtRM(kpi.ad_spend), prevActual: fmtRM(lm.ad_spend) },
      { label: "Orders", value: ach.orders, actual: String(tm.orders), target: String(kpi.orders), prevActual: String(lm.orders) },
      { label: "AOV", value: ach.aov, actual: fmtRM(tm.aov), target: fmtRM(kpi.aov), prevActual: fmtRM(lm.aov) },
      { label: "CPL", value: ach.cpl, actual: fmtRM(tm.cpl), target: fmtRM(kpi.cpl), prevActual: fmtRM(lm.cpl) },
      { label: "Conv Rate", value: ach.conv_rate, actual: fmtPct(tm.conv_rate), target: `${kpi.conv_rate}%`, prevActual: fmtPct(lm.conv_rate) },
      { label: "CPA%", value: tm.cpa_pct ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, actual: `${tm.cpa_pct.toFixed(2)}%`, target: `${kpi.cpa_pct}%`, prevActual: `${lm.cpa_pct.toFixed(2)}%` },
    ];
  }

  // Render helpers
  function renderHeroGrid(stats: ReturnType<typeof buildHeroStats>) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-[10px]">
        {stats.map((s) => {
          const statusColor = s.ach >= 100 ? "var(--green)" : s.ach >= 80 ? "var(--yellow)" : "var(--red)";
          const statusBg = s.ach >= 100 ? "var(--green-bg)" : s.ach >= 80 ? "var(--yellow-bg)" : "var(--red-bg)";
          const statusText = s.ach >= 100 ? "Excellent" : s.ach >= 80 ? "Warning" : "Poor";
          return (
            <div key={s.label} className="card-base" style={{ padding: 16 }}>
              <div className="font-label text-[10px] text-[var(--t3)] mb-1">{s.label}</div>
              <div className="num text-[22px] font-bold tracking-tight text-[var(--t1)] mb-1">{s.value}</div>
              <span className="inline-flex items-center text-[9px] font-semibold px-2 py-[1px] rounded-full" style={{ background: statusBg, color: statusColor }}>{statusText}</span>
              <div className="text-[10px] text-[var(--t4)] mt-1">KPI: {s.kpi}</div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderComparisonTable(rows: ReturnType<typeof buildFunnelRows>) {
    return (
      <div className="card-deep" style={{ overflow: "hidden", padding: 0 }}>
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Metric", thisLabel, prevLabel, "PoP %", "KPI"].map((h) => (
                <th key={h} className="text-left font-label text-[10px] uppercase tracking-widest text-[var(--t4)] p-[10px_16px] border-b border-[var(--border)] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg3)]">
                <td className="p-[12px_16px] text-[13px] font-semibold text-[var(--t1)]">{r.label}</td>
                <td className="p-[12px_16px] num text-[13px] font-semibold text-[var(--t1)]">{r.tm}</td>
                <td className="p-[12px_16px] num text-[13px] text-[var(--t3)]">{r.lm}</td>
                <td className="p-[12px_16px] num text-[13px] font-semibold" style={{ color: momColor(r.mom ?? null, r.inv) }}>
                  {r.mom !== null && r.mom !== undefined ? `${r.mom > 0 ? "+" : ""}${r.mom.toFixed(1)}%` : "N/A"}
                </td>
                <td className="p-[12px_16px] num text-[13px] text-[var(--t3)]">{r.kpi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const scenarios = [
    { label: "Maintain", desc: "Current spend level", data: s1 },
    { label: "Scale +20%", desc: "Increase budget by 20%", data: s2 },
    { label: "Reduce -20%", desc: "Decrease budget by 20%", data: s3 },
  ];

  return (
    <div className="min-h-dvh bg-[var(--bg)] print:bg-white" style={{ transition: "background 500ms ease" }}>
      <style>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } .page-break { page-break-before: always; } }`}</style>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
        {/* Header */}
        <header className="py-[72px] pb-[52px] border-b-2 border-[var(--t1)]">
          <div className="flex items-center gap-[10px] mb-7">
            <span className="tag tag-blue">PERFORMANCE REPORT</span>
            <span className="text-[12px] text-[var(--t3)]">{formatDateDisplay(new Date())}</span>
          </div>
          <h1 className="font-heading text-[clamp(36px,5vw,48px)] font-semibold leading-[1.08] tracking-tight text-[var(--t1)] mb-[14px]">{client.name}</h1>
          <p className="text-[16px] text-[var(--t2)] max-w-[560px] font-light">{thisLabel} vs {prevLabel}</p>
          {isMultiBrand && (
            <div className="flex gap-2 mt-3">
              {brands.map((b, i) => (
                <span key={b} className="text-[10px] font-label uppercase tracking-wider px-2 py-[2px] rounded-full" style={{ background: `${BRAND_COLORS[i % BRAND_COLORS.length]}20`, color: BRAND_COLORS[i % BRAND_COLORS.length] }}>{b}</span>
              ))}
            </div>
          )}
        </header>

        {/* ── 01 Overall KPI ── */}
        <section className="py-14 border-b border-[var(--border)]">
          <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-[6px] flex items-center gap-2">
            <span className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: "var(--red)" }} />
            01 — {isMultiBrand ? "Overall" : "Overview"}
          </div>
          <h2 className="font-heading text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-[var(--t1)] mb-7">
            {isMultiBrand ? "Overall Performance" : "KPI Overview"}
          </h2>
          {renderHeroGrid(buildHeroStats(oTm, oAch, overallKpiConfig))}
        </section>

        {/* ── 02 Overall Comparison ── */}
        <section className="py-14 border-b border-[var(--border)] page-break">
          <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-[6px] flex items-center gap-2">
            <span className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: "var(--blue)" }} />
            02 — Comparison
          </div>
          <h2 className="font-heading text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-[var(--t1)] mb-7">Period Comparison</h2>
          {renderComparisonTable(buildFunnelRows(oTm, oLm, oMom, overallKpiConfig))}
          <div className="card-base mt-7" style={{ padding: 24 }}>
            <WeeklyChart weeks={weeks} />
          </div>
        </section>

        {/* ── 03 KPI Achievement ── */}
        <section className="py-14 border-b border-[var(--border)]">
          <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-[6px] flex items-center gap-2">
            <span className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: "var(--yellow)" }} />
            03 — Targets
          </div>
          <h2 className="font-heading text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-[var(--t1)] mb-7">KPI Achievement</h2>
          <div className="card-deep" style={{ padding: 24 }}>
            <KPIChart items={buildKpiItems(oTm, oLm, oAch, overallKpiConfig)} />
          </div>
        </section>

        {/* ── Brand Breakdown (multi-brand only) ── */}
        {isMultiBrand && brandData.map((bd, bi) => (
          <section key={bd.name} className="py-14 border-b border-[var(--border)] page-break">
            <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-[6px] flex items-center gap-2">
              <span className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: BRAND_COLORS[bi % BRAND_COLORS.length] }} />
              {String(bi + 4).padStart(2, "0")} — {bd.name}
            </div>
            <h2 className="font-heading text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-[var(--t1)] mb-7">{bd.name}</h2>

            {/* Brand KPI cards */}
            <div className="mb-7">
              {renderHeroGrid(buildHeroStats(bd.tm, bd.ach, bd.kpi))}
            </div>

            {/* Brand comparison table */}
            <div className="mb-7">
              {renderComparisonTable(buildFunnelRows(bd.tm, bd.lm, bd.mom, bd.kpi))}
            </div>

            {/* Brand weekly chart */}
            {bd.weeks.length > 0 && (
              <div className="card-base" style={{ padding: 24 }}>
                <WeeklyChart weeks={bd.weeks} />
              </div>
            )}
          </section>
        ))}

        {/* ── Budget Scenarios ── */}
        <section className="py-14 border-b border-[var(--border)] page-break">
          <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-[6px] flex items-center gap-2">
            <span className="inline-block w-[6px] h-[6px] rounded-full" style={{ background: "var(--red)" }} />
            {isMultiBrand ? String(brands.length + 4).padStart(2, "0") : "04"} — Projections
          </div>
          <h2 className="font-heading text-[clamp(24px,3vw,32px)] font-semibold tracking-tight text-[var(--t1)] mb-7">Budget Scenarios</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px]">
            {scenarios.map((sc, i) => (
              <div key={sc.label} className={`card-base accent-top ${["accent-red", "accent-blue", "accent-yellow"][i]}`}>
                <h3 className="font-semibold text-[15px] text-[var(--t1)] mb-1">{sc.label}</h3>
                <p className="text-[11px] text-[var(--t3)] mb-4">{sc.desc}</p>
                <div className="space-y-[6px]">
                  {[
                    { l: "Spend", v: fmtRM(sc.data.spend) },
                    { l: "Est. Inquiry", v: String(Math.round(sc.data.inquiry)) },
                    { l: "Est. Orders", v: String(Math.round(sc.data.orders)) },
                    { l: "Est. Sales", v: fmtRM(sc.data.sales) },
                    { l: "Est. ROAS", v: fmtROAS(sc.data.roas) },
                    { l: "Gap to KPI", v: fmtRM(sc.data.gap) },
                  ].map((row) => (
                    <div key={row.l} className="flex justify-between text-[13px]">
                      <span className="text-[var(--t3)]">{row.l}</span>
                      <span className="num font-semibold text-[var(--t1)]">{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 flex justify-between items-center">
          <div className="text-[12px] text-[var(--t4)]">
            <span className="font-label text-[10px] uppercase tracking-widest">Generated</span>
            <span className="ml-[6px]">{formatDateDisplay(new Date())}</span>
          </div>
        </footer>
        <PrintButton />
      </div>
    </div>
  );
}
