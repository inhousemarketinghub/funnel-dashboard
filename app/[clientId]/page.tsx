import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchLeadData, countEstShowUp } from "@/lib/sheets";
import { computeMetrics, computeMoM, computeAchievement } from "@/lib/metrics";
import { fmtRM, fmtROAS } from "@/lib/utils";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { FunnelFlow } from "@/components/dashboard/funnel-flow";
import { KPIChart } from "@/components/dashboard/kpi-chart";
import { MoMTable } from "@/components/dashboard/mom-table";
import type { KPIConfig } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return <p className="text-[#78716C] p-8">Client not found</p>;

  const now = new Date();
  const reportEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const reportStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth(), 1);
  const prevEnd = new Date(reportStart.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);

  const monthStr = `${reportStart.getFullYear()}-${String(reportStart.getMonth() + 1).padStart(2, "0")}-01`;
  let { data: kpiRow } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).eq("month", monthStr).single();
  if (!kpiRow) {
    const { data } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).order("month", { ascending: false }).limit(1).single();
    kpiRow = data;
  }
  const kpi: KPIConfig = kpiRow || {
    sales: 300000, orders: 6, aov: 50000, cpl: 26, respond_rate: 30,
    appt_rate: 33, showup_rate: 90, conv_rate: 25, ad_spend: 7500,
    daily_ad: 250, roas: 40, cpa_pct: 2.5, target_contact: 80, target_appt: 27, target_showup: 24,
  };

  const [perfData, leadData] = await Promise.all([
    fetchPerformanceData(client.sheet_id),
    fetchLeadData(client.sheet_id),
  ]);

  const thisMonthRows = perfData.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const lastMonthRows = perfData.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const estSU = countEstShowUp(leadData, reportStart, reportEnd);
  const estSULast = countEstShowUp(leadData, prevStart, prevEnd);

  const tm = computeMetrics(thisMonthRows, estSU);
  const lm = computeMetrics(lastMonthRows, estSULast);
  const mom = computeMoM(tm, lm);
  const ach = computeAchievement(tm, kpi);

  const thisMonthName = reportStart.toLocaleDateString("en", { month: "long", year: "numeric" });
  const lastMonthName = prevStart.toLocaleDateString("en", { month: "long", year: "numeric" });

  const kpiItems = [
    { label: "Sales", value: ach.sales, target: fmtRM(kpi.sales), actual: fmtRM(tm.sales) },
    { label: "Ad Spend", value: ach.ad_spend, target: fmtRM(kpi.ad_spend), actual: fmtRM(tm.ad_spend) },
    { label: "AOV", value: ach.aov, target: fmtRM(kpi.aov), actual: fmtRM(tm.aov) },
    { label: "CPL", value: ach.cpl, target: fmtRM(kpi.cpl), actual: fmtRM(tm.cpl) },
    { label: "Respond Rate", value: ach.respond_rate, target: `${kpi.respond_rate}%`, actual: `${tm.respond_rate.toFixed(1)}%` },
    { label: "Appt Rate", value: ach.appt_rate, target: `${kpi.appt_rate}%`, actual: `${tm.appt_rate.toFixed(1)}%` },
    { label: "Show Up Rate", value: ach.showup_rate, target: `${kpi.showup_rate}%`, actual: `${tm.showup_rate.toFixed(1)}%` },
    { label: "Conv Rate", value: Math.min(ach.conv_rate, 200), target: `${kpi.conv_rate}%`, actual: `${tm.conv_rate.toFixed(1)}%` },
    { label: "CPA%", value: tm.cpa_pct ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, target: `${kpi.cpa_pct}%`, actual: `${tm.cpa_pct.toFixed(2)}%` },
  ];

  return (
    <div>
      <HeroCards metrics={tm} kpi={kpi} achievement={ach} />
      <FunnelFlow metrics={tm} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-[rgba(214,211,209,0.5)] rounded-lg p-6">
          <h3 className="font-[family-name:var(--font-geist-sans)] font-bold text-[15px] tracking-tight mb-4">MoM Funnel Comparison</h3>
          <MoMTable tm={tm} lm={lm} mom={mom} kpi={kpi} thisMonth={thisMonthName} lastMonth={lastMonthName} />
        </div>
        <KPIChart items={kpiItems} />
      </div>
      <div className="flex gap-3">
        <Link href={`/${clientId}/report/monthly`}>
          <Button className="bg-[#D97706] hover:bg-[#B45309] text-white active:translate-y-px transition-transform">Generate Monthly Report</Button>
        </Link>
      </div>
    </div>
  );
}
