import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchLeadData, countEstShowUp } from "@/lib/sheets";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario } from "@/lib/metrics";
import type { KPIConfig } from "@/lib/types";

export async function POST(request: NextRequest) {
  const { clientId, type } = await request.json();
  const supabase = await createServerSupabase();

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const [perfData, leadData] = await Promise.all([
    fetchPerformanceData(client.sheet_id),
    fetchLeadData(client.sheet_id),
  ]);

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

  const thisMonthRows = perfData.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const lastMonthRows = perfData.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const estSU = countEstShowUp(leadData, reportStart, reportEnd);
  const estSULast = countEstShowUp(leadData, prevStart, prevEnd);

  const tm = computeMetrics(thisMonthRows, estSU);
  const lm = computeMetrics(lastMonthRows, estSULast);
  const mom = computeMoM(tm, lm);
  const ach = computeAchievement(tm, kpi);

  const nextStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth() + 1, 1);
  const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
  const estSUNext = countEstShowUp(leadData, nextStart, nextEnd);

  const s1 = budgetScenario(tm.ad_spend, tm, kpi, estSUNext);
  const s2 = budgetScenario(tm.ad_spend * 1.2, tm, kpi, estSUNext);
  const s3 = budgetScenario(tm.ad_spend * 0.8, tm, kpi, estSUNext);

  return NextResponse.json({
    client: { name: client.name, id: client.id },
    kpi, tm, lm, mom, ach, s1, s2, s3, estSUNext,
    reportMonth: reportStart.toLocaleDateString("en", { month: "long", year: "numeric" }),
    prevMonth: prevStart.toLocaleDateString("en", { month: "long", year: "numeric" }),
    generatedAt: new Date().toISOString(),
  });
}
