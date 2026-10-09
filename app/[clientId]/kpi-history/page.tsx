import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { resolveDataSource, getPerformanceData } from "@/lib/data-source";
import { computeMetrics } from "@/lib/metrics";
import { fetchTargetVersions, effectiveVersionAsOf, monthStartsBetween } from "@/lib/kpi-history";
import type { KPIConfig, FunnelMetrics } from "@/lib/types";
import { KpiHistoryClient, type HistoryRow, type MetricSet, type BudgetChange } from "./kpi-history-client";

export const dynamic = "force-dynamic";

function fromSnapshot(s: KPIConfig): MetricSet {
  return {
    ad_spend: s.ad_spend, sales: s.sales, orders: s.orders, aov: s.aov, cpa_pct: s.cpa_pct,
    cpl: s.cpl, conv_rate: s.conv_rate, respond_rate: s.respond_rate, appt_rate: s.appt_rate,
    showup_rate: s.showup_rate, roas: s.roas,
  };
}
function fromMetrics(m: FunnelMetrics): MetricSet {
  return {
    ad_spend: m.ad_spend, sales: m.sales, orders: m.orders, aov: m.aov, cpa_pct: m.cpa_pct,
    cpl: m.cpl, conv_rate: m.conv_rate, respond_rate: m.respond_rate, appt_rate: m.appt_rate,
    showup_rate: m.showup_rate, roas: m.roas,
  };
}

export default async function KpiHistoryPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("view_projection")) redirect(`/${clientId}`);

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const versions = await fetchTargetVersions(clientId, ""); // newest first
  const perf = await getPerformanceData(client, resolveDataSource(client));
  const funnel: "walkin" | "appointment" = client.funnel_type === "walkin" ? "walkin" : "appointment";
  const now = new Date();
  const earliest = versions.length ? new Date(versions[versions.length - 1].effective_from) : now;

  const rows: HistoryRow[] = monthStartsBetween(earliest, now).reverse().map((mStart) => {
    const mEnd = new Date(Date.UTC(mStart.getUTCFullYear(), mStart.getUTCMonth() + 1, 0, 23, 59, 59));
    const target = effectiveVersionAsOf(versions, mEnd)?.snapshot ?? null;
    const monthRows = perf.data.filter((r) => r.date >= mStart && r.date <= mEnd);
    const actual = computeMetrics(monthRows, funnel);
    const changes = versions.filter((v) => {
      const tt = new Date(v.effective_from);
      return tt >= mStart && tt <= mEnd;
    });
    return {
      month: mStart.toISOString().slice(0, 7),
      target: target ? fromSnapshot(target) : null,
      actual: fromMetrics(actual),
      changes: changes
        .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
        .map((v) => ({ id: v.id, effective_from: v.effective_from, source: v.source, target: fromSnapshot(v.snapshot) })),
    };
  });

  // Daily-budget change log (separate from the target rows). Walk oldest→newest,
  // emit a record only when the daily budget (Incl SST) actually changes.
  const asc = [...versions].reverse();
  const dailyBudget: BudgetChange[] = [];
  let prevBudget: number | null = null;
  for (const v of asc) {
    const d = v.snapshot.daily_ad ?? 0;
    if (prevBudget === null || d !== prevBudget) {
      dailyBudget.push({ id: v.id, effective_from: v.effective_from, source: v.source, daily_ad: d, from: prevBudget });
      prevBudget = d;
    }
  }
  dailyBudget.reverse(); // newest first for display

  return <KpiHistoryClient rows={rows} dailyBudget={dailyBudget} funnel={funnel} lang={lang} />;
}
