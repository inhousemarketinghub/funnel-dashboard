import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { resolveDataSource, getPerformanceData } from "@/lib/data-source";
import { computeMetrics } from "@/lib/metrics";
import { fetchTargetVersions, effectiveVersionAsOf, monthStartsBetween } from "@/lib/kpi-history";
import { KpiHistoryClient, type HistoryRow } from "./kpi-history-client";

export const dynamic = "force-dynamic";

export default async function KpiHistoryPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("view_projection")) redirect(`/${clientId}`);

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const versions = await fetchTargetVersions(clientId, "");
  const perf = await getPerformanceData(client, resolveDataSource(client));
  const funnel = client.funnel_type === "walkin" ? "walkin" : "appointment";
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
      target: target ? { sales: target.sales, ad_spend: target.ad_spend, cpa_pct: target.cpa_pct, cpl: target.cpl } : null,
      actual: { sales: actual.sales, ad_spend: actual.ad_spend, cpa_pct: actual.cpa_pct, cpl: actual.cpl },
      changes: changes
        .sort((a, b) => a.effective_from.localeCompare(b.effective_from))
        .map((v) => ({ id: v.id, effective_from: v.effective_from, source: v.source, snapshot: v.snapshot })),
    };
  });

  return <KpiHistoryClient rows={rows} lang={lang} />;
}
