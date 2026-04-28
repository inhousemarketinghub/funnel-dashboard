import { createServerSupabase } from "@/lib/supabase/server";
import { getProjectPermissions } from "@/lib/auth";
import { fetchPerformanceData, fetchLeadData, countEstShowUp, fetchKPIData, fetchPersonData, detectBrandsOrdered, fetchOverallKPI } from "@/lib/sheets";
import type { PersonData, PerfResult } from "@/lib/sheets";
import { BrandSelector } from "@/components/dashboard/brand-selector";
import { computeMetrics, computeMoM, computeAchievement } from "@/lib/metrics";
import { fmtRM, fmtROAS } from "@/lib/utils";
import { resolveSearchParams, getPreviousPeriod, formatRangeLabel, formatDateParam } from "@/lib/dates";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { FunnelFlow } from "@/components/dashboard/funnel-flow";
import { KPIChart } from "@/components/dashboard/kpi-chart";
import { PersonPerformance } from "@/components/dashboard/person-performance";
import { MoMTable } from "@/components/dashboard/mom-table";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { SplitText } from "@/components/animations/split-text";
import { MonthPickerDialog } from "@/components/dashboard/month-picker-dialog";
import { CardReveal } from "@/components/animations/card-reveal";
import { BlurText } from "@/components/animations/blur-text";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { Stagger } from "@/components/animations/stagger";
import type { KPIConfig } from "@/lib/types";
import { generateInsights } from "@/lib/insights";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Suspense } from "react";
import Link from "next/link";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const __ssrStart = Date.now();
  const __reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[SSR ${__reqId}] start`);

  const { clientId } = await params;
  const sp = await searchParams;
  const __sb1 = Date.now();
  const supabase = await createServerSupabase();
  console.log(`[SSR ${__reqId}] createServerSupabase ${Date.now() - __sb1}ms`);
  const __sb2 = Date.now();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  console.log(`[SSR ${__reqId}] supabase clients query ${Date.now() - __sb2}ms`);
  if (!client) return <p className="text-[#78716C] p-8">Client not found</p>;
  const clientLanguage = (client.language as "en" | "zh" | "ms") || "en";

  // Date range from URL params (defaults to this month 1st → today)
  const { from: reportStart, to: reportEnd } = resolveSearchParams(sp.from, sp.to);
  // Support manual previous period from URL params
  const autoPrev = getPreviousPeriod(reportStart, reportEnd);
  const prevFromParam = sp.prevFrom ? new Date(sp.prevFrom as string) : null;
  const prevToParam = sp.prevTo ? new Date(sp.prevTo as string) : null;
  const prevStart = prevFromParam && !isNaN(prevFromParam.getTime()) ? prevFromParam : autoPrev.from;
  const prevEnd = prevToParam && !isNaN(prevToParam.getTime()) ? prevToParam : autoPrev.to;

  // KPI lookup for the month containing the start of the range
  const monthStr = `${reportStart.getFullYear()}-${String(reportStart.getMonth() + 1).padStart(2, "0")}-01`;
  const __sb3 = Date.now();
  let { data: kpiRow } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).eq("month", monthStr).single();
  if (!kpiRow) {
    const { data } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).order("month", { ascending: false }).limit(1).single();
    kpiRow = data;
  }
  console.log(`[SSR ${__reqId}] supabase kpi_configs query ${Date.now() - __sb3}ms`);
  // Brand from URL only (don't await brands list yet — parallelize that fetch
  // with the data fetches below). brandFromUrl is sufficient for the fetch
  // helpers because passing undefined falls into auto-detect path inside each
  // fetcher; passing a specific name does exact-match. selectedBrand (which
  // also folds in single-brand auto-fallback) is computed AFTER the Promise.all.
  const brandParam = sp.brand as string | undefined;
  const brandFromUrl = brandParam && brandParam !== "Overall" ? brandParam : undefined;

  let perfResult: PerfResult = { data: [], funnelType: "appointment" };
  let leadData: import("@/lib/types").Lead[] = [];
  let sheetKPI: KPIConfig | null = null;
  let personData: PersonData = { appointmentPersons: [], salesPersons: [], brandBreakdowns: {} };
  let brands: string[] = [];
  let fetchError: string | null = null;

  // [PERF DIAG] temporary instrumentation — remove after we identify bottleneck
  const __perfStart = Date.now();
  console.log(`[PERF ${__reqId}] data layer start sheet=${client.sheet_id} brand=${brandFromUrl ?? "Overall"}`);

  try {
    const __t = [Date.now(), Date.now(), Date.now(), Date.now(), Date.now()];
    [perfResult, leadData, sheetKPI, personData, brands] = await Promise.all([
      fetchPerformanceData(client.sheet_id, brandFromUrl).then((r) => { console.log(`[PERF ${__reqId}] fetchPerformanceData ${Date.now() - __t[0]}ms`); return r; }),
      fetchLeadData(client.sheet_id, brandFromUrl).then((r) => { console.log(`[PERF ${__reqId}] fetchLeadData ${Date.now() - __t[1]}ms`); return r; }),
      fetchKPIData(client.sheet_id, brandFromUrl).then((r) => { console.log(`[PERF ${__reqId}] fetchKPIData ${Date.now() - __t[2]}ms`); return r; }),
      fetchPersonData(client.sheet_id, reportStart, reportEnd, brandFromUrl).then((r) => { console.log(`[PERF ${__reqId}] fetchPersonData ${Date.now() - __t[3]}ms`); return r; }),
      detectBrandsOrdered(client.sheet_id).then((r) => { console.log(`[PERF ${__reqId}] detectBrandsOrdered ${Date.now() - __t[4]}ms`); return r; }),
    ]);
    console.log(`[PERF ${__reqId}] Promise.all done ${Date.now() - __perfStart}ms`);
  } catch (err) {
    perfResult = { data: [], funnelType: "appointment" };
    leadData = [];
    brands = [];
    fetchError = err instanceof Error ? err.message : "Failed to fetch Google Sheet data";
    console.log(`[PERF ${__reqId}] FETCH ERROR ${Date.now() - __perfStart}ms: ${fetchError}`);
  }

  // selectedBrand = explicit URL brand, OR single-brand auto-fallback
  const selectedBrand = brandFromUrl ?? (brands.length === 1 ? brands[0] : undefined);

  // For Overall (multi-brand, no selectedBrand): ALWAYS sum all brand KPIs
  if (brands.length > 1 && !selectedBrand) {
    const __ot = Date.now();
    sheetKPI = await fetchOverallKPI(client.sheet_id, brands);
    console.log(`[PERF ${__reqId}] fetchOverallKPI(${brands.length} brands) ${Date.now() - __ot}ms`);
  }
  console.log(`[PERF ${__reqId}] TOTAL data layer ${Date.now() - __perfStart}ms (brands=${brands.length}, perfRows=${perfResult.data.length}, leadRows=${leadData.length})`);

  // KPI: prefer Sheet data, fallback to Supabase, then defaults
  const kpi: KPIConfig = sheetKPI || kpiRow || {
    sales: 300000, orders: 6, aov: 50000, cpl: 26, respond_rate: 30,
    appt_rate: 33, showup_rate: 90, conv_rate: 25, ad_spend: 7500,
    daily_ad: 250, roas: 40, cpa_pct: 2.5, target_contact: 80, target_appt: 27, target_showup: 24,
  };

  const perfData = perfResult.data;
  const detectedFunnelType = perfResult.funnelType;
  const thisRangeRows = perfData.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const prevRangeRows = perfData.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const estSU = countEstShowUp(leadData, reportStart, reportEnd);
  const estSUPrev = countEstShowUp(leadData, prevStart, prevEnd);

  const tm = computeMetrics(thisRangeRows, estSU);
  const lm = computeMetrics(prevRangeRows, estSUPrev);
  const mom = computeMoM(tm, lm);
  const ach = computeAchievement(tm, kpi);

  const thisRangeLabel = formatRangeLabel(reportStart, reportEnd);
  const prevRangeLabel = formatRangeLabel(prevStart, prevEnd);

  // Days in current range for daily avg calculation
  const rangeDays = Math.max(1, Math.round((reportEnd.getTime() - reportStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  // Days in the month for pace calculation
  const daysInMonth = new Date(reportStart.getFullYear(), reportStart.getMonth() + 1, 0).getDate();
  const paceRatio = rangeDays / daysInMonth; // e.g., 7/30 = 0.233

  // Pace-adjusted KPI targets for cumulative metrics (Sales, Ad Spend, Orders)
  const paceSales = kpi.sales * paceRatio;
  const paceAdSpend = kpi.ad_spend * paceRatio;
  const paceOrders = kpi.orders * paceRatio;

  // Pace-adjusted achievement for cumulative metrics
  const paceAchSales = paceSales > 0 ? (tm.sales / paceSales) * 100 : 0;
  const paceAchAdSpend = paceAdSpend > 0 ? (tm.ad_spend / paceAdSpend) * 100 : 0;
  const paceAchOrders = paceOrders > 0 ? (tm.orders / paceOrders) * 100 : 0;

  // Performance Summary insights
  const summaryAch = { ...ach, sales: paceAchSales, ad_spend: paceAchAdSpend, orders: paceAchOrders };
  const insights = generateInsights({
    metrics: tm, kpi, achievement: summaryAch,
    paceRatio, funnelType: detectedFunnelType, language: clientLanguage,
  });

  const isWalkin = detectedFunnelType === "walkin";
  const walkinVisitRate = tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0;
  const walkinVisitRatePrev = lm.inquiry > 0 ? (lm.contact / lm.inquiry) * 100 : 0;
  const walkinConvRate = tm.contact > 0 ? (tm.orders / tm.contact) * 100 : 0;
  const walkinConvRatePrev = lm.contact > 0 ? (lm.orders / lm.contact) * 100 : 0;

  const kpiItems = [
    { label: "Sales", value: paceAchSales, target: `Pace: ${fmtRM(paceSales)}`, actual: fmtRM(tm.sales), prevActual: fmtRM(lm.sales), monthlyTarget: `Monthly: ${fmtRM(kpi.sales)}` },
    { label: "Ad Spend", value: paceAchAdSpend, target: `Pace: ${fmtRM(paceAdSpend)}`, actual: fmtRM(tm.ad_spend), prevActual: fmtRM(lm.ad_spend), monthlyTarget: `Monthly: ${fmtRM(kpi.ad_spend)}` },
    { label: "Orders", value: paceAchOrders, target: `Pace: ${Math.round(paceOrders)}`, actual: String(tm.orders), prevActual: String(lm.orders), monthlyTarget: `Monthly: ${kpi.orders}` },
    { label: "AOV", value: ach.aov, target: fmtRM(kpi.aov), actual: fmtRM(tm.aov), prevActual: fmtRM(lm.aov) },
    { label: "CPL", value: ach.cpl, target: fmtRM(kpi.cpl), actual: fmtRM(tm.cpl), prevActual: fmtRM(lm.cpl) },
    {
      label: isWalkin ? "Visit Rate" : "Respond Rate",
      value: isWalkin ? (kpi.respond_rate > 0 ? (walkinVisitRate / kpi.respond_rate) * 100 : 0) : ach.respond_rate,
      target: `${kpi.respond_rate}%`,
      actual: isWalkin ? `${walkinVisitRate.toFixed(1)}%` : `${tm.respond_rate.toFixed(1)}%`,
      prevActual: isWalkin ? `${walkinVisitRatePrev.toFixed(1)}%` : `${lm.respond_rate.toFixed(1)}%`,
    },
    ...(!isWalkin ? [
      { label: "Appt Rate", value: ach.appt_rate, target: `${kpi.appt_rate}%`, actual: `${tm.appt_rate.toFixed(1)}%`, prevActual: `${lm.appt_rate.toFixed(1)}%` },
      { label: "Show Up Rate", value: ach.showup_rate, target: `${kpi.showup_rate}%`, actual: `${tm.showup_rate.toFixed(1)}%`, prevActual: `${lm.showup_rate.toFixed(1)}%` },
    ] : []),
    {
      label: "Conv Rate",
      value: isWalkin ? (kpi.conv_rate > 0 ? (walkinConvRate / kpi.conv_rate) * 100 : 0) : Math.min(ach.conv_rate, 200),
      target: `${kpi.conv_rate}%`,
      actual: isWalkin ? `${walkinConvRate.toFixed(1)}%` : `${tm.conv_rate.toFixed(1)}%`,
      prevActual: isWalkin ? `${walkinConvRatePrev.toFixed(1)}%` : `${lm.conv_rate.toFixed(1)}%`,
    },
    { label: "CPA%", value: tm.cpa_pct ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, target: `${kpi.cpa_pct}%`, actual: `${tm.cpa_pct.toFixed(2)}%`, prevActual: `${lm.cpa_pct.toFixed(2)}%` },
  ];

  const __pms = Date.now();
  const perms = await getProjectPermissions(clientId);
  console.log(`[SSR ${__reqId}] getProjectPermissions ${Date.now() - __pms}ms`);
  const canReport = perms.includes("view_report");

  console.log(`[SSR ${__reqId}] TOTAL ${Date.now() - __ssrStart}ms`);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-7">
        <div>
          <SplitText text="Performance Overview" />
          <div className="flex items-center gap-3 mt-[3px]">
            <p className="text-[14px] text-[var(--t3)] font-light">{thisRangeLabel}</p>
            {brands.length > 0 && (
              <Suspense>
                <BrandSelector clientId={clientId} brands={brands.length > 1 ? ["Overall", ...brands] : brands} />
              </Suspense>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          {canReport && <MonthPickerDialog clientId={clientId} />}
          <Suspense>
            <DateRangePicker clientId={clientId} />
          </Suspense>
        </div>
      </div>

      {/* Error banner — show instead of data */}
      {fetchError && (
        <div className="p-8 rounded-[10px] border border-[var(--red)] bg-[var(--red-bg)] text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--red)]/10 flex items-center justify-center text-[var(--red)] text-[20px] font-bold">!</div>
          <p className="text-[var(--red)] text-[15px] font-medium mb-1">Unable to load data</p>
          <p className="text-[var(--red)]/70 text-[13px] mb-3">{fetchError}</p>
          <p className="text-[var(--t4)] text-[12px]">Make sure the Google Sheet is shared as &quot;Anyone with the link can view&quot; and contains the required tabs.</p>
        </div>
      )}

      {!fetchError && <>
      {/* KPI Cards: grouped by Frontend/Midend/Backend */}
      <div className="mb-8">
        <HeroCards metrics={tm} kpi={kpi} achievement={{...ach, sales: paceAchSales, ad_spend: paceAchAdSpend, orders: paceAchOrders}} prevMetrics={lm} days={rangeDays} funnelType={detectedFunnelType || "appointment"} paceKpi={{sales: paceSales, ad_spend: paceAdSpend, orders: paceOrders}} />
      </div>

      {/* Performance Summary */}
      <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8" staggerMs={150}>
        <SummaryCards insights={insights} />
      </Stagger>

      {/* Bento Grid */}
      <div className="bento">
        {/* Row 2: Funnel + Period Comparison */}
        <CardReveal delay={200} className="c5">
          <div className="card-base">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">Conversion</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">Lead Funnel</div>
            </BlurText>
            <FunnelFlow metrics={tm} funnelType={detectedFunnelType} />
          </div>
        </CardReveal>
        <CardReveal delay={280} className="c7">
          <div className="card-deep">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">Analysis</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">Period Comparison</div>
            </BlurText>
            <MoMTable tm={tm} lm={lm} mom={mom} kpi={kpi} thisMonth={thisRangeLabel} lastMonth={prevRangeLabel} funnelType={detectedFunnelType} />
          </div>
        </CardReveal>

        {/* Row 3: KPI Achievement */}
        <CardReveal delay={360} className="c12">
          <div className="card-deep">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">Targets</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">KPI Achievement</div>
            </BlurText>
            <KPIChart items={kpiItems} />
          </div>
        </CardReveal>
      </div>

      {/* Person Performance — bottom section */}
      {(personData.appointmentPersons.length > 0 || personData.salesPersons.length > 0) && (
        <CardReveal delay={500} className="mt-[10px]">
          <div className="card-base">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">Team</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">Person Performance</div>
            </BlurText>
            <PersonPerformance
              appointmentPersons={personData.appointmentPersons}
              salesPersons={personData.salesPersons}
              kpi={kpi}
              brandBreakdowns={personData.brandBreakdowns}
              hasMultiBrand={brands.length > 1}
              funnelType={detectedFunnelType}
            />
          </div>
        </CardReveal>
      )}
      </>}
    </div>
  );
}
