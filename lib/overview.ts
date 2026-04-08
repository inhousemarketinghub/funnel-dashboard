import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchKPIData } from "@/lib/sheets";
import { computeMetrics, computeAchievement } from "@/lib/metrics";
import type { ClientOverview, OverviewStats } from "@/lib/types";

function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
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
    .select("id, name, logo_url, sheet_id")
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) {
    return {
      clients: [],
      stats: { activeClients: 0, needAttention: 0, totalAdSpend: 0, totalSales: 0 },
    };
  }

  const { start, end } = currentMonthRange();

  const clients: ClientOverview[] = await Promise.all(
    rows.map(async (client) => {
      try {
        const [perfResult, kpi] = await Promise.all([
          fetchPerformanceData(client.sheet_id),
          fetchKPIData(client.sheet_id),
        ]);

        // Filter performance data to current month
        const monthData = perfResult.data.filter(
          (r) => r.date >= start && r.date <= end
        );

        const metrics = computeMetrics(monthData, 0);

        const achievement = kpi
          ? computeAchievement(metrics, kpi)
          : { sales: 0, cpl: 0, roas: 0, cpa_pct: 0, conv_rate: 0, orders: 0, ad_spend: 0, respond_rate: 0, appt_rate: 0, showup_rate: 0, aov: 0 };

        // Average of the 4 key tracked metrics
        const average =
          (achievement.sales + achievement.cpl + (achievement.cpa_pct || 0) + achievement.conv_rate) / 4;

        const health: ClientOverview["health"] =
          average >= 80 ? "good" : average >= 60 ? "watch" : "alert";

        return {
          id: client.id,
          name: client.name,
          logo_url: client.logo_url ?? null,
          status: "active" as const,
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
        };
      } catch {
        // Data fetch failed — include with zeroed metrics and alert health
        return {
          id: client.id,
          name: client.name,
          logo_url: client.logo_url ?? null,
          status: "active" as const,
          metrics: { sales: 0, cpl: 0, roas: 0, cpa_pct: 0, conv_rate: 0, ad_spend: 0 },
          achievement: { sales: 0, cpl: 0, roas: 0, cpa_pct: 0, conv_rate: 0, average: 0 },
          health: "alert" as const,
        };
      }
    })
  );

  const stats: OverviewStats = {
    activeClients: clients.length,
    needAttention: clients.filter((c) => c.health === "alert").length,
    totalAdSpend: clients.reduce((sum, c) => sum + c.metrics.ad_spend, 0),
    totalSales: clients.reduce((sum, c) => sum + c.metrics.sales, 0),
  };

  return { clients, stats };
}
