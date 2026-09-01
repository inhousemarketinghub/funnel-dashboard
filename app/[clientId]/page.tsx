import { createServerSupabase } from "@/lib/supabase/server";
import { getProjectPermissions } from "@/lib/auth";
import { fetchKPIData, fetchOverallKPI, fetchBrandPerformance } from "@/lib/sheets";
import { getPerformanceData, getPersonData, getFreshness, getBrands, resolveDataSource } from "@/lib/data-source";
import type { PersonData, PerfResult, BrandPerformanceData } from "@/lib/sheets";
import { BrandSelector } from "@/components/dashboard/brand-selector";
import { computeMetrics, computeMoM, computeAchievement } from "@/lib/metrics";
import { fmtRM, fmtROAS } from "@/lib/utils";
import { resolveSearchParams, getPreviousPeriod, formatRangeLabel, formatDateParam } from "@/lib/dates";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { FunnelFlow } from "@/components/dashboard/funnel-flow";
import { KPIChart } from "@/components/dashboard/kpi-chart";
import { PersonPerformance } from "@/components/dashboard/person-performance";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { BrandPerformance } from "@/components/dashboard/brand-performance";
import { MoMTable } from "@/components/dashboard/mom-table";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { SplitText } from "@/components/animations/split-text";
import { MonthPickerDialog } from "@/components/dashboard/month-picker-dialog";
import { CardReveal } from "@/components/animations/card-reveal";
import { BlurText } from "@/components/animations/blur-text";
import { ScrollReveal } from "@/components/animations/scroll-reveal";
import { Stagger } from "@/components/animations/stagger";
import type { KPIConfig } from "@/lib/types";
import { parseProfile } from "@/lib/profile";
import { generateInsights } from "@/lib/insights";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { MobileDashboard } from "@/components/dashboard/mobile-dashboard";
import { Suspense } from "react";
import { after } from "next/server";
import Link from "next/link";
import { cookies } from "next/headers";
import { t, normalizeLang, LANG_COOKIE } from "@/lib/i18n";

export default async function DashboardPage({
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
  if (!client) return <p className="text-[#78716C] p-8">Client not found</p>;
  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);

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
  let { data: kpiRow } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).eq("month", monthStr).single();
  if (!kpiRow) {
    const { data } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).order("month", { ascending: false }).limit(1).single();
    kpiRow = data;
  }
  // Person-performance source filter: ?source=Facebook,Instagram (comma-joined).
  // No param → the profile's Paid Ads sources apply as the per-client DEFAULT
  // scope; ?source=all explicitly clears it. Only the team section consumes
  // this — funnel cards stay untouched.
  const profile = parseProfile(client.profile);
  const sourceParam = Array.isArray(sp.source) ? sp.source[0] : sp.source;
  const selectedSources =
    sourceParam === "all"
      ? undefined
      : sourceParam
        ? sourceParam.split(",").map((s) => s.trim()).filter(Boolean)
        : profile.paid_sources?.length
          ? profile.paid_sources
          : undefined;

  // Data-source mode: profile.data_source, plus the admin-only ?ds= override
  // for production test-drives (edit_settings gate; render-scoped, never stored).
  const dsParam = Array.isArray(sp.ds) ? sp.ds[0] : sp.ds;
  let dataSource = resolveDataSource(client);
  if ((dsParam === "db" || dsParam === "sheets") && dsParam !== dataSource) {
    const perms = await getProjectPermissions(clientId);
    if (perms.includes("edit_settings")) dataSource = dsParam;
  }

  // Brand detection (ordered by KPI tab; db mode reads brand_states so the
  // page stays alive when Google is unreachable)
  const brands = await getBrands(client, dataSource);
  const brandParam = sp.brand as string | undefined;
  // "Overall" or no selection = no brand filter (aggregate all)
  const selectedBrand = brandParam && brandParam !== "Overall" ? brandParam : brands.length === 1 ? brands[0] : undefined;

  let perfResult: PerfResult = { data: [], funnelType: "appointment", tracked: { appointment: true, est_showup: true, showup: true } };
  let sheetKPI: KPIConfig | null = null;
  let personData: PersonData = { appointmentPersons: [], salesPersons: [], brandBreakdowns: {}, availableSources: [] };
  // Brand Performance follows the date range only (not the brand selector); resilient to absent tab.
  let brandPerformance: BrandPerformanceData | null = null;
  // When the cached sheet data was last pulled from Google (for the refresh button label).
  let fetchedAt: number | null = null;
  let fetchError: string | null = null;
  try {
    if (dataSource === "db") {
      // Funnel + person data come from the mirror; residual sheet reads (KPI
      // targets, Order-Items brand performance) degrade gracefully so the
      // dashboard still renders mirror data when Google is unreachable (QA).
      [perfResult, personData, fetchedAt] = await Promise.all([
        getPerformanceData(client, "db", selectedBrand),
        getPersonData(client, "db", reportStart, reportEnd, selectedBrand, selectedSources),
        getFreshness(client, "db"),
      ]);
      [sheetKPI, brandPerformance] = await Promise.all([
        fetchKPIData(client.sheet_id, selectedBrand).catch(() => null),
        fetchBrandPerformance(client.sheet_id, reportStart, reportEnd).catch(() => null),
      ]);
    } else {
      [perfResult, sheetKPI, personData, brandPerformance, fetchedAt] = await Promise.all([
        getPerformanceData(client, "sheets", selectedBrand),
        fetchKPIData(client.sheet_id, selectedBrand),
        getPersonData(client, "sheets", reportStart, reportEnd, selectedBrand, selectedSources),
        fetchBrandPerformance(client.sheet_id, reportStart, reportEnd),
        getFreshness(client, "sheets"),
      ]);
    }
  } catch (err) {
    perfResult = { data: [], funnelType: "appointment", tracked: { appointment: true, est_showup: true, showup: true } };
    fetchError = err instanceof Error ? err.message : "Failed to fetch Google Sheet data";
  }

  // For Overall (multi-brand, no selectedBrand): ALWAYS sum all brand KPIs
  if (brands.length > 1 && !selectedBrand) {
    sheetKPI = dataSource === "db"
      ? await fetchOverallKPI(client.sheet_id, brands).catch(() => sheetKPI)
      : await fetchOverallKPI(client.sheet_id, brands);
  }

  // KPI: prefer Sheet data, fallback to Supabase, then defaults
  const kpi: KPIConfig = sheetKPI || kpiRow || {
    sales: 300000, orders: 6, aov: 50000, cpl: 26, respond_rate: 30,
    appt_rate: 33, showup_rate: 90, conv_rate: 25, ad_spend: 7500,
    daily_ad: 250, roas: 40, cpa_pct: 2.5, target_contact: 80, target_appt: 27, target_showup: 24,
  };

  // Format the data-pull time as Malaysia time on the server (deterministic, no
  // client/server timezone mismatch) for the refresh button's "数据更新于" label.
  const fetchedAtLabel = fetchedAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date(fetchedAt))
    : null;

  // Staleness-triggered background sync (PRD L86): a db-sourced dashboard
  // older than 60 min fires one worker refresh AFTER the response is sent —
  // intra-day freshness without waiting for the daily cron. trigger=stale is
  // throttled server-side, so concurrent stale renders are cheap no-ops.
  if (dataSource === "db") {
    const STALE_MS = 60 * 60 * 1000;
    const cronSecret = process.env.CRON_SECRET;
    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (cronSecret && prodHost && (!fetchedAt || Date.now() - fetchedAt > STALE_MS)) {
      after(async () => {
        try {
          await fetch(`https://${prodHost}/api/sync?clientId=${encodeURIComponent(clientId)}&trigger=stale`, {
            headers: { authorization: `Bearer ${cronSecret}` },
          });
        } catch (err) {
          console.error("stale sync trigger failed", err);
        }
      });
    }
  }

  const perfData = perfResult.data;
  const detectedFunnelType = perfResult.funnelType;
  const thisRangeRows = perfData.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const prevRangeRows = perfData.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const tm = computeMetrics(thisRangeRows, detectedFunnelType);
  const lm = computeMetrics(prevRangeRows, detectedFunnelType);
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
    paceRatio, funnelType: detectedFunnelType, language: lang,
  });

  const isWalkin = detectedFunnelType === "walkin";
  const walkinVisitRate = tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0;
  const walkinVisitRatePrev = lm.inquiry > 0 ? (lm.contact / lm.inquiry) * 100 : 0;
  const walkinConvRate = tm.contact > 0 ? (tm.orders / tm.contact) * 100 : 0;
  const walkinConvRatePrev = lm.contact > 0 ? (lm.orders / lm.contact) * 100 : 0;

  // Quantity breakdowns shown when a mobile tile is tapped — mirrors the desktop Hero Card expand.
  const leadFunnelTaxed = tm.lead_funnel_spend * 1.08;
  const brandingTaxed = tm.branding_spend * 1.08;
  const hasSpendSplit = tm.lead_funnel_spend + tm.branding_spend > 0;
  const targetedDailyBudget = daysInMonth > 0 ? kpi.ad_spend / daysInMonth : 0;
  const avgDailySpend = rangeDays > 0 ? tm.ad_spend / rangeDays : 0;

  const paceL = t(lang, "pace");
  const monthlyL = t(lang, "monthly");
  const kpiItems = [
    { label: t(lang, "sales"), value: paceAchSales, target: `${paceL}: ${fmtRM(paceSales)}`, actual: fmtRM(tm.sales), prevActual: fmtRM(lm.sales), monthlyTarget: `${monthlyL}: ${fmtRM(kpi.sales)}` },
    { label: t(lang, "adSpend"), value: paceAchAdSpend, target: `${paceL}: ${fmtRM(paceAdSpend)}`, actual: fmtRM(tm.ad_spend), prevActual: fmtRM(lm.ad_spend), monthlyTarget: `${monthlyL}: ${fmtRM(kpi.ad_spend)}`,
      breakdown: [
        ...(hasSpendSplit ? [
          { label: t(lang, "leadFunnelAdSpend"), value: fmtRM(leadFunnelTaxed) },
          { label: t(lang, "brandingAdSpend"), value: fmtRM(brandingTaxed) },
        ] : []),
        { label: t(lang, "targetedDailyBudget"), value: fmtRM(targetedDailyBudget) },
        { label: t(lang, "currentDailyBudget"), value: fmtRM(kpi.daily_ad) },
        { label: t(lang, "avgDaily"), value: fmtRM(avgDailySpend) },
      ],
    },
    { label: t(lang, "orders"), value: paceAchOrders, target: `${paceL}: ${Math.round(paceOrders)}`, actual: String(tm.orders), prevActual: String(lm.orders), monthlyTarget: `${monthlyL}: ${kpi.orders}` },
    { label: t(lang, "aov"), value: ach.aov, target: fmtRM(kpi.aov), actual: fmtRM(tm.aov), prevActual: fmtRM(lm.aov) },
    { label: t(lang, "cpl"), value: ach.cpl, target: fmtRM(kpi.cpl), actual: fmtRM(tm.cpl), prevActual: fmtRM(lm.cpl),
      breakdown: [{ label: t(lang, "inquiryPM"), value: String(tm.inquiry) }],
    },
    {
      label: isWalkin ? t(lang, "visitRate") : t(lang, "respondRate"),
      value: isWalkin ? (kpi.respond_rate > 0 ? (walkinVisitRate / kpi.respond_rate) * 100 : 0) : ach.respond_rate,
      target: `${kpi.respond_rate}%`,
      actual: isWalkin ? `${walkinVisitRate.toFixed(1)}%` : `${tm.respond_rate.toFixed(1)}%`,
      prevActual: isWalkin ? `${walkinVisitRatePrev.toFixed(1)}%` : `${lm.respond_rate.toFixed(1)}%`,
      breakdown: [
        { label: isWalkin ? t(lang, "visit") : t(lang, "contactGiven"), value: String(tm.contact) },
        { label: t(lang, "inquiry"), value: String(tm.inquiry) },
      ],
    },
    ...(!isWalkin ? [
      // notTracked: the sheet has no column for the underlying metric — show
      // "not tracked" instead of a fabricated 0% (and keep it out of averages).
      { label: t(lang, "apptRate"), value: ach.appt_rate, target: `${kpi.appt_rate}%`, actual: `${tm.appt_rate.toFixed(1)}%`, prevActual: `${lm.appt_rate.toFixed(1)}%`,
        notTracked: !perfResult.tracked.appointment,
        breakdown: [
          { label: t(lang, "appointment"), value: String(tm.appointment) },
          { label: t(lang, "contactGiven"), value: String(tm.contact) },
        ],
      },
      { label: t(lang, "showUpRate"), value: ach.showup_rate, target: `${kpi.showup_rate}%`, actual: `${tm.showup_rate.toFixed(1)}%`, prevActual: `${lm.showup_rate.toFixed(1)}%`,
        notTracked: !perfResult.tracked.showup || !perfResult.tracked.est_showup,
        breakdown: [
          { label: t(lang, "showUp"), value: String(tm.showup) },
          { label: t(lang, "estShowUp"), value: String(tm.est_showup) },
        ],
      },
    ] : []),
    {
      label: t(lang, "convRate"),
      value: isWalkin ? (kpi.conv_rate > 0 ? (walkinConvRate / kpi.conv_rate) * 100 : 0) : Math.min(ach.conv_rate, 200),
      target: `${kpi.conv_rate}%`,
      actual: isWalkin ? `${walkinConvRate.toFixed(1)}%` : `${tm.conv_rate.toFixed(1)}%`,
      prevActual: isWalkin ? `${walkinConvRatePrev.toFixed(1)}%` : `${lm.conv_rate.toFixed(1)}%`,
      notTracked: !isWalkin && !perfResult.tracked.showup, // appt conv_rate = orders / showup
      breakdown: [
        { label: t(lang, "orders"), value: String(tm.orders) },
        { label: isWalkin ? t(lang, "visit") : t(lang, "showUp"), value: isWalkin ? String(tm.contact) : String(tm.showup) },
      ],
    },
    { label: t(lang, "cpaPct"), value: tm.cpa_pct ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, target: `${kpi.cpa_pct}%`, actual: `${tm.cpa_pct.toFixed(2)}%`, prevActual: `${lm.cpa_pct.toFixed(2)}%` },
  ];

  const perms = await getProjectPermissions(clientId);
  const canReport = perms.includes("view_report");

  return (
    <div>
      {/* ───────── Desktop layout (md and up) — unchanged ───────── */}
      <div className="hidden md:block">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-7">
        <div>
          <SplitText text={t(lang, "performanceOverview")} />
          <div className="flex items-center gap-3 mt-[3px]">
            <p className="text-[14px] text-[var(--t3)] font-light">{thisRangeLabel}</p>
            {brands.length > 0 && (
              <Suspense>
                <BrandSelector clientId={clientId} brands={brands.length > 1 ? ["Overall", ...brands] : brands} lang={lang} />
              </Suspense>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Suspense>
            <DateRangePicker clientId={clientId} lang={lang} />
          </Suspense>
          <RefreshButton sheetId={client.sheet_id} clientId={clientId} dataSource={dataSource} fetchedAtLabel={fetchedAtLabel} lang={lang} />
        </div>
      </div>

      {/* Error banner — show instead of data */}
      {fetchError && (
        <div className="p-8 rounded-[10px] border border-[var(--red)] bg-[var(--red-bg)] text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--red)]/10 flex items-center justify-center text-[var(--red)] text-[20px] font-bold">!</div>
          <p className="text-[var(--red)] text-[15px] font-medium mb-1">{t(lang, "unableToLoadData")}</p>
          <p className="text-[var(--red)]/70 text-[13px] mb-3">{fetchError}</p>
          <p className="text-[var(--t4)] text-[12px]">{t(lang, "unableToLoadDataHint")}</p>
        </div>
      )}

      {!fetchError && <>
      {/* KPI Cards: grouped by Frontend/Midend/Backend */}
      <div className="mb-8">
        <HeroCards metrics={tm} kpi={kpi} achievement={{...ach, sales: paceAchSales, ad_spend: paceAchAdSpend, orders: paceAchOrders}} prevMetrics={lm} days={rangeDays} funnelType={detectedFunnelType || "appointment"} paceKpi={{sales: paceSales, ad_spend: paceAdSpend, orders: paceOrders}} lang={lang} tracked={perfResult.tracked} />
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
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">{t(lang, "conversion")}</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">{t(lang, "leadFunnel")}</div>
            </BlurText>
            <FunnelFlow metrics={tm} funnelType={detectedFunnelType} lang={lang} tracked={perfResult.tracked} />
          </div>
        </CardReveal>
        <CardReveal delay={280} className="c7">
          <div className="card-deep">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">{t(lang, "analysis")}</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">{t(lang, "periodComparison")}</div>
            </BlurText>
            <MoMTable tm={tm} lm={lm} mom={mom} kpi={kpi} thisMonth={thisRangeLabel} lastMonth={prevRangeLabel} funnelType={detectedFunnelType} lang={lang} tracked={perfResult.tracked} />
          </div>
        </CardReveal>

        {/* Row 3: KPI Achievement */}
        <CardReveal delay={360} className="c12">
          <div className="card-deep">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">{t(lang, "targetsSection")}</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">{t(lang, "kpiAchievement")}</div>
            </BlurText>
            <KPIChart items={kpiItems} lang={lang} />
          </div>
        </CardReveal>
      </div>

      {/* Person Performance — bottom section */}
      {(personData.appointmentPersons.length > 0 || personData.salesPersons.length > 0) && (
        <CardReveal delay={500} className="mt-[10px]">
          <div className="card-base">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">{t(lang, "team")}</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">{t(lang, "personPerformance")}</div>
            </BlurText>
            <PersonPerformance
              appointmentPersons={personData.appointmentPersons}
              salesPersons={personData.salesPersons}
              kpi={kpi}
              brandBreakdowns={personData.brandBreakdowns}
              hasMultiBrand={brands.length > 1}
              funnelType={detectedFunnelType}
              lang={lang}
              clientId={clientId}
              availableSources={personData.availableSources}
              activeSources={selectedSources}
            />
          </div>
        </CardReveal>
      )}

      {/* Brand Performance — product/brand split from the Order Items tab */}
      {brandPerformance && brandPerformance.totalQty > 0 && (
        <CardReveal delay={580} className="mt-[10px]">
          <div className="card-base">
            <div className="font-label text-[11px] uppercase tracking-widest text-[var(--t3)] mb-1">{t(lang, "products")}</div>
            <BlurText>
              <div className="text-[14px] font-semibold text-[var(--t1)] mb-4">{t(lang, "brandPerformanceTitle")}</div>
            </BlurText>
            <BrandPerformance data={brandPerformance} lang={lang} />
          </div>
        </CardReveal>
      )}
      </>}
      </div>

      {/* ───────── Mobile layout (below md) — app-style tabs + tiles ───────── */}
      <div className="md:hidden">
        {fetchError ? (
          <div className="mt-4 rounded-[10px] border border-[var(--red)] bg-[var(--red-bg)] p-6 text-center">
            <p className="text-[15px] font-medium text-[var(--red)] mb-1">{t(lang, "unableToLoadData")}</p>
            <p className="text-[13px] text-[var(--red)]/70">{fetchError}</p>
          </div>
        ) : (
          <MobileDashboard
            lang={lang}
            tm={tm}
            lm={lm}
            kpi={kpi}
            mom={mom}
            insights={insights}
            personData={personData}
            funnelType={detectedFunnelType || "appointment"}
            kpiItems={kpiItems}
            thisRangeLabel={thisRangeLabel}
            prevRangeLabel={prevRangeLabel}
            clientId={clientId}
            brands={brands.length > 1 ? ["Overall", ...brands] : brands}
            hasMultiBrand={brands.length > 1}
            canReport={canReport}
            brandPerformance={brandPerformance}
            sheetId={client.sheet_id}
            dataSource={dataSource}
            fetchedAtLabel={fetchedAtLabel}
          />
        )}
      </div>
    </div>
  );
}
