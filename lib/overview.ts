import { createServerSupabase } from "@/lib/supabase/server";
import { fetchKPIData } from "@/lib/sheets";
import { getPerformanceData, getKPIData, resolveDataSource } from "@/lib/data-source";
import { computeMetrics, computeAchievement } from "@/lib/metrics";
import { todayKL } from "@/lib/dates";
import type { ClientOverview, OverviewStats, ArchivedClient } from "@/lib/types";

function currentMonthRange(): { start: Date; end: Date } {
  const now = todayKL();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

export async function fetchAllClientsOverview(): Promise<{
  clients: ClientOverview[];
  stats: OverviewStats;
}> {
  const supabase = await createServerSupabase();

  const { data: rows } = await supabase
    .from("clients")
    .select("id, name, logo_url, sheet_id, status, funnel_type, profile")
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) {
    return {
      clients: [],
      stats: { activeClients: 0, needAttention: 0, totalAdSpend: 0, totalSales: 0 },
    };
  }

  // Freshness: one batched query for the latest successful sync per client
  // (sync_runs is the authority; getFreshness is per-client and would N+1 here).
  const ids = rows.map((r) => r.id);
  const { data: runs } = await supabase
    .from("sync_runs")
    .select("client_id, finished_at")
    .eq("status", "success")
    .in("client_id", ids)
    .order("finished_at", { ascending: false });
  const lastSync = new Map<string, string>();
  for (const run of runs ?? []) {
    if (run.finished_at && !lastSync.has(run.client_id)) lastSync.set(run.client_id, run.finished_at);
  }

  const { start, end } = currentMonthRange();

  const clients: ClientOverview[] = await Promise.all(
    rows.map(async (client) => {
      try {
        const dataSource = resolveDataSource(client);
        const [perfResult, kpi] = await Promise.all([
          getPerformanceData(client, dataSource),
          dataSource === "db" ? getKPIData(client, "db").catch(() => null) : fetchKPIData(client.sheet_id),
        ]);

        // Filter performance data to current month
        const monthData = perfResult.data.filter(
          (r) => r.date >= start && r.date <= end
        );

        const metrics = computeMetrics(
          monthData,
          client.funnel_type === "walkin" ? "walkin" : "appointment",
        );

        const achievement = kpi
          ? computeAchievement(metrics, kpi)
          : { sales: 0, cpl: 0, roas: 0, cpa_pct: 0, conv_rate: 0, orders: 0, ad_spend: 0, respond_rate: 0, appt_rate: 0, showup_rate: 0, aov: 0 };

        // Average of the 4 key tracked metrics
        const average =
          (achievement.sales + achievement.cpl + (achievement.cpa_pct || 0) + achievement.conv_rate) / 4;

        const health: ClientOverview["health"] =
          average >= 80 ? "good" : average >= 60 ? "watch" : "alert";

        const status: "active" | "inactive" = client.status === "active" ? "active" : "inactive";
        const funnelType: "appointment" | "walkin" = client.funnel_type === "walkin" ? "walkin" : "appointment";

        return {
          id: client.id,
          name: client.name,
          logo_url: client.logo_url ?? null,
          status,
          funnel_type: funnelType,
          metrics: {
            sales: metrics.sales,
            cpl: metrics.cpl,
            roas: metrics.roas,
            cpa_pct: metrics.cpa_pct,
            conv_rate: metrics.conv_rate,
            ad_spend: metrics.ad_spend,
          },
          achievement: {
            sales: achievement.sales,
            cpl: achievement.cpl,
            roas: achievement.roas,
            cpa_pct: achievement.cpa_pct || 0,
            conv_rate: achievement.conv_rate,
            average,
          },
          health,
          last_synced_at: lastSync.get(client.id) ?? null,
        };
      } catch {
        const status: "active" | "inactive" = client.status === "active" ? "active" : "inactive";
        const funnelType: "appointment" | "walkin" = client.funnel_type === "walkin" ? "walkin" : "appointment";
        return {
          id: client.id,
          name: client.name,
          logo_url: client.logo_url ?? null,
          status,
          funnel_type: funnelType,
          metrics: { sales: 0, cpl: 0, roas: 0, cpa_pct: 0, conv_rate: 0, ad_spend: 0 },
          achievement: { sales: 0, cpl: 0, roas: 0, cpa_pct: 0, conv_rate: 0, average: 0 },
          health: "alert" as const,
          last_synced_at: lastSync.get(client.id) ?? null,
        };
      }
    })
  );

  const stats: OverviewStats = {
    activeClients: clients.filter((c) => c.status === "active").length,
    needAttention: clients.filter((c) => c.health === "alert").length,
    totalAdSpend: clients.reduce((sum, c) => sum + c.metrics.ad_spend, 0),
    totalSales: clients.reduce((sum, c) => sum + c.metrics.sales, 0),
  };

  return { clients, stats };
}

/** Archived projects for the recycle bin — lightweight (no live KPIs needed). */
export async function fetchArchivedClients(): Promise<ArchivedClient[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("id, name, logo_url")
    .eq("status", "archived")
    .order("name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, logo_url: c.logo_url ?? null }));
}
