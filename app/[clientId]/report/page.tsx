import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchLeadData, countEstShowUp, fetchKPIData, detectBrandsOrdered, fetchOverallKPI } from "@/lib/sheets";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario, computeWeeklyBreakdown } from "@/lib/metrics";
import { fmtRM, fmtROAS, fmtPct } from "@/lib/utils";
import { resolveSearchParams, getPreviousPeriod, formatRangeLabel, formatDateDisplay } from "@/lib/dates";
import type { KPIConfig, FunnelMetrics, MoMResult, Achievement } from "@/lib/types";
import { PrintButton } from "@/components/dashboard/print-button";
import { KPIChart } from "@/components/dashboard/kpi-chart";
import { WeeklyChart } from "@/components/dashboard/weekly-chart";
import { ReportTabs } from "@/components/dashboard/report-tabs";

export default async function ReportPage({
  params, searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { clientId } = await params;
  const sp = await searchParams;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return <p className="text-[var(--t3)] p-8">Client not found</p>;

  let reportStart: Date, reportEnd: Date;
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

  const brands = await detectBrandsOrdered(client.sheet_id);
  const isMultiBrand = brands.length > 1;

  // Fetch Overall
  const [overallPerf, overallLead, overallKPI] = await Promise.all([
    fetchPerformanceData(client.sheet_id),
    fetchLeadData(client.sheet_id),
    isMultiBrand ? fetchOverallKPI(client.sheet_id, brands) : fetchKPIData(client.sheet_id),
  ]);
  const kpi0: KPIConfig = overallKPI || { sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0, showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0, target_contact: 0, target_appt: 0, target_showup: 0 };
  const ft = overallPerf.funnelType;
  const isWalkin = ft === "walkin";

  function filterRange(data: typeof overallPerf.data, start: Date, end: Date) {
    return data.filter((r) => r.date >= start && r.date <= end);
  }

  function computeAll(perfData: typeof overallPerf.data, leadData: typeof overallLead, kpi: KPIConfig) {
    const thisR = filterRange(perfData, reportStart, reportEnd);
    const prevR = filterRange(perfData, prevStart, prevEnd);
    const esu = countEstShowUp(leadData, reportStart, reportEnd);
    const esuP = countEstShowUp(leadData, prevStart, prevEnd);
    const tm = computeMetrics(thisR, esu);
    const lm = computeMetrics(prevR, esuP);
    return { tm, lm, mom: computeMoM(tm, lm), ach: computeAchievement(tm, kpi), weeks: computeWeeklyBreakdown(thisR), kpi };
  }

  const overall = computeAll(overallPerf.data, overallLead, kpi0);

  // Per-brand data
  interface BrandBundle { name: string; tm: FunnelMetrics; lm: FunnelMetrics; mom: MoMResult; ach: Achievement; kpi: KPIConfig; weeks: FunnelMetrics[] }
  const brandBundles: BrandBundle[] = [];
  if (isMultiBrand) {
    for (const b of brands) {
      const [bp, bl, bk] = await Promise.all([
        fetchPerformanceData(client.sheet_id, b),
        fetchLeadData(client.sheet_id, b),
        fetchKPIData(client.sheet_id, b),
      ]);
      const bkpi = bk || kpi0;
      const d = computeAll(bp.data, bl, bkpi);
      brandBundles.push({ name: b, ...d });
    }
  }

  // Budget scenarios (overall)
  const nS = new Date(reportEnd.getFullYear(), reportEnd.getMonth() + 1, 1);
  const nE = new Date(nS.getFullYear(), nS.getMonth() + 1, 0);
  const esuN = countEstShowUp(overallLead, nS, nE);
  const s1 = budgetScenario(overall.tm.ad_spend, overall.tm, kpi0, esuN);
  const s2 = budgetScenario(overall.tm.ad_spend * 1.2, overall.tm, kpi0, esuN);
  const s3 = budgetScenario(overall.tm.ad_spend * 0.8, overall.tm, kpi0, esuN);

  function momColor(v: number | null, inv: boolean) {
    if (v === null) return "var(--t3)";
    const good = (v > 0 && !inv) || (v < 0 && inv);
    return Math.abs(v || 0) < 5 ? "var(--yellow)" : good ? "var(--green)" : "var(--red)";
  }

  function heroStats(tm: FunnelMetrics, ach: Achievement, kpi: KPIConfig) {
    const row1 = [
      { label: "Total Sales", value: fmtRM(tm.sales), ach: ach.sales, kpi: fmtRM(kpi.sales) },
      { label: "Total Ad Spend", value: fmtRM(tm.ad_spend), ach: ach.ad_spend, kpi: fmtRM(kpi.ad_spend) },
      { label: "CPA%", value: `${tm.cpa_pct.toFixed(2)}%`, ach: tm.cpa_pct > 0 ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, kpi: `${kpi.cpa_pct}%` },
      { label: "Orders", value: String(tm.orders), ach: ach.orders, kpi: String(kpi.orders) },
      { label: "AOV", value: fmtRM(tm.aov), ach: ach.aov, kpi: fmtRM(kpi.aov) },
    ];
    const row2 = [
      { label: "CPL", value: fmtRM(tm.cpl), ach: ach.cpl, kpi: fmtRM(kpi.cpl) },
      ...(isWalkin ? [
        { label: "Visit Rate", value: fmtPct(tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0), ach: kpi.respond_rate ? ((tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0) / kpi.respond_rate) * 100 : 0, kpi: `${kpi.respond_rate}%` },
      ] : [
        { label: "Respond Rate", value: fmtPct(tm.respond_rate), ach: ach.respond_rate, kpi: `${kpi.respond_rate}%` },
        { label: "Appt Rate", value: fmtPct(tm.appt_rate), ach: ach.appt_rate, kpi: `${kpi.appt_rate}%` },
        { label: "Show Up Rate", value: fmtPct(tm.showup_rate), ach: ach.showup_rate, kpi: `${kpi.showup_rate}%` },
      ]),
      { label: "Conv Rate", value: fmtPct(isWalkin && tm.contact > 0 ? (tm.orders / tm.contact) * 100 : tm.conv_rate), ach: ach.conv_rate, kpi: `${kpi.conv_rate}%` },
    ];
    return { row1, row2 };
  }

  function funnelRows(tm: FunnelMetrics, lm: FunnelMetrics, mom: MoMResult, kpi: KPIConfig) {
    const r = [
      { label: "Ad Spend", tm: fmtRM(tm.ad_spend), lm: fmtRM(lm.ad_spend), mom: mom.ad_spend, kpi: fmtRM(kpi.ad_spend), inv: false },
      { label: "Inquiry", tm: String(tm.inquiry), lm: String(lm.inquiry), mom: mom.inquiry, kpi: kpi.cpl > 0 ? String(Math.round(kpi.ad_spend / kpi.cpl)) : "—", inv: false },
      { label: isWalkin ? "Visit" : "Contact", tm: String(tm.contact), lm: String(lm.contact), mom: mom.contact, kpi: String(kpi.target_contact), inv: false },
      { label: "CPL", tm: fmtRM(tm.cpl), lm: fmtRM(lm.cpl), mom: mom.cpl, kpi: fmtRM(kpi.cpl), inv: true },
    ];
    if (!isWalkin) r.push(
      { label: "Respond Rate", tm: fmtPct(tm.respond_rate), lm: fmtPct(lm.respond_rate), mom: mom.respond_rate ?? null, kpi: `${kpi.respond_rate}%`, inv: false },
      { label: "Appointment", tm: String(tm.appointment), lm: String(lm.appointment), mom: mom.appointment ?? null, kpi: String(kpi.target_appt), inv: false },
      { label: "Show Up", tm: String(tm.showup), lm: String(lm.showup), mom: mom.showup ?? null, kpi: String(kpi.target_showup), inv: false },
    );
    r.push(
      { label: "Orders", tm: String(tm.orders), lm: String(lm.orders), mom: mom.orders, kpi: String(kpi.orders), inv: false },
      { label: "Conv Rate", tm: fmtPct(isWalkin && tm.contact > 0 ? (tm.orders / tm.contact) * 100 : tm.conv_rate), lm: fmtPct(isWalkin && lm.contact > 0 ? (lm.orders / lm.contact) * 100 : lm.conv_rate), mom: mom.conv_rate, kpi: `${kpi.conv_rate}%`, inv: false },
      { label: "Sales", tm: fmtRM(tm.sales), lm: fmtRM(lm.sales), mom: mom.sales, kpi: fmtRM(kpi.sales), inv: false },
      { label: "AOV", tm: fmtRM(tm.aov), lm: fmtRM(lm.aov), mom: mom.aov, kpi: fmtRM(kpi.aov), inv: false },
      { label: "CPA%", tm: `${tm.cpa_pct.toFixed(2)}%`, lm: `${lm.cpa_pct.toFixed(2)}%`, mom: mom.cpa_pct, kpi: `${kpi.cpa_pct}%`, inv: true },
    );
    return r;
  }

  function kpiItems(tm: FunnelMetrics, lm: FunnelMetrics, ach: Achievement, kpi: KPIConfig) {
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

  // ── Render helpers ──

  function HeroGrid({ stats }: { stats: ReturnType<typeof heroStats> }) {
    return (
      <>
        <div className={`grid grid-cols-2 ${isWalkin ? "md:grid-cols-4" : "md:grid-cols-5"} gap-[10px] mb-[10px]`}>
          {stats.row1.map((s) => <HeroCard key={s.label} s={s} />)}
        </div>
        <div className={`grid grid-cols-2 ${isWalkin ? "md:grid-cols-3" : "md:grid-cols-5"} gap-[10px]`}>
          {stats.row2.map((s) => <HeroCard key={s.label} s={s} />)}
        </div>
      </>
    );
  }

  function HeroCard({ s }: { s: { label: string; value: string; ach: number; kpi: string } }) {
    const sc = s.ach >= 100 ? "var(--green)" : s.ach >= 80 ? "var(--yellow)" : "var(--red)";
    const sb = s.ach >= 100 ? "var(--green-bg)" : s.ach >= 80 ? "var(--yellow-bg)" : "var(--red-bg)";
    const st = s.ach >= 100 ? "Excellent" : s.ach >= 80 ? "Warning" : "Poor";
    return (
      <div className="card-base" style={{ padding: 16 }}>
        <div className="font-label text-[10px] text-[var(--t3)] mb-1">{s.label}</div>
        <div className="num text-[22px] font-bold tracking-tight text-[var(--t1)] mb-1">{s.value}</div>
        <span className="inline-flex items-center text-[9px] font-semibold px-2 py-[1px] rounded-full" style={{ background: sb, color: sc }}>{st}</span>
        <div className="text-[10px] text-[var(--t4)] mt-1">KPI: {s.kpi}</div>
      </div>
    );
  }

  function CompTable({ rows }: { rows: ReturnType<typeof funnelRows> }) {
    return (
      <div className="card-deep" style={{ overflow: "hidden", padding: 0 }}>
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead><tr>
            {["Metric", thisLabel, prevLabel, "PoP %", "KPI"].map((h) => (
              <th key={h} className="text-left font-label text-[10px] uppercase tracking-widest text-[var(--t4)] p-[10px_16px] border-b border-[var(--border)] font-medium">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg3)]">
                <td className="p-[12px_16px] text-[13px] font-semibold text-[var(--t1)]">{r.label}</td>
                <td className="p-[12px_16px] num text-[13px] font-semibold text-[var(--t1)]">{r.tm}</td>
                <td className="p-[12px_16px] num text-[13px] text-[var(--t3)]">{r.lm}</td>
                <td className="p-[12px_16px] num text-[13px] font-semibold" style={{ color: momColor(r.mom ?? null, r.inv) }}>
                  {r.mom != null ? `${r.mom > 0 ? "+" : ""}${r.mom.toFixed(1)}%` : "N/A"}
                </td>
                <td className="p-[12px_16px] num text-[13px] text-[var(--t3)]">{r.kpi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function ReportSection({ d, title }: { d: { tm: FunnelMetrics; lm: FunnelMetrics; mom: MoMResult; ach: Achievement; kpi: KPIConfig; weeks: FunnelMetrics[] }; title: string }) {
    return (
      <div>
        {title && <h2 className="font-heading text-[22px] font-semibold tracking-tight text-[var(--t1)] mb-6">{title}</h2>}

        <div className="mb-8">
          <h3 className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-3">KPI Overview</h3>
          <HeroGrid stats={heroStats(d.tm, d.ach, d.kpi)} />
        </div>

        <div className="mb-8">
          <h3 className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-3">Period Comparison</h3>
          <CompTable rows={funnelRows(d.tm, d.lm, d.mom, d.kpi)} />
          {d.weeks.length > 0 && (
            <div className="card-base mt-4" style={{ padding: 24 }}>
              <WeeklyChart weeks={d.weeks} />
            </div>
          )}
        </div>

        <div>
          <h3 className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-3">KPI Achievement</h3>
          <div className="card-deep" style={{ padding: 24 }}>
            <KPIChart items={kpiItems(d.tm, d.lm, d.ach, d.kpi)} />
          </div>
        </div>
      </div>
    );
  }

  const scenarios = [
    { label: "Maintain", desc: "Current spend level", data: s1 },
    { label: "Scale +20%", desc: "Increase budget by 20%", data: s2 },
    { label: "Reduce -20%", desc: "Decrease budget by 20%", data: s3 },
  ];

  const tabs = isMultiBrand ? ["Overall", ...brands] : [];

  return (
    <div className="min-h-dvh bg-[var(--bg)] print:bg-white" style={{ transition: "background 500ms ease" }}>
      <style>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } .page-break { page-break-before: always; } }`}</style>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
        {/* Header */}
        <header className="py-[72px] pb-[40px] border-b-2 border-[var(--t1)]">
          <div className="flex items-center gap-[10px] mb-5">
            <span className="tag tag-blue">PERFORMANCE REPORT</span>
            <span className="text-[12px] text-[var(--t3)]">{formatDateDisplay(new Date())}</span>
          </div>
          <h1 className="font-heading text-[clamp(36px,5vw,48px)] font-semibold leading-[1.08] tracking-tight text-[var(--t1)] mb-2">{client.name}</h1>
          <p className="text-[16px] text-[var(--t2)] font-light">{thisLabel} vs {prevLabel}</p>
        </header>

        {/* Content with tabs (multi-brand) or direct (single) */}
        <div className="py-10">
          {isMultiBrand ? (
            <ReportTabs
              tabs={tabs}
              contents={[
                <ReportSection key="overall" d={overall} title="Overall Performance" />,
                ...brandBundles.map((bd) => (
                  <ReportSection key={bd.name} d={bd} title={bd.name} />
                )),
              ]}
            />
          ) : (
            <ReportSection d={overall} title="" />
          )}
        </div>

        {/* Budget Scenarios (always shown) */}
        <section className="py-10 border-t border-[var(--border)]">
          <h3 className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)] mb-3">Budget Scenarios</h3>
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
