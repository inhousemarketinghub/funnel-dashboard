import type { DailyMetric, FunnelMetrics, KPIConfig, MoMResult, Achievement, BudgetScenario } from "./types";
import { pct, momPct } from "./utils";

export function computeMetrics(rows: DailyMetric[], estShowUp: number): FunnelMetrics {
  const sum = (fn: (r: DailyMetric) => number) => rows.reduce((a, r) => a + fn(r), 0);

  const ad_spend = sum((r) => r.ad_spend);
  const inquiry = sum((r) => r.inquiry);
  const contact = sum((r) => r.contact);
  const appointment = sum((r) => r.appointment);
  const showup = sum((r) => r.showup);
  const orders = sum((r) => r.orders);
  const sales = sum((r) => r.sales);

  return {
    ad_spend, inquiry, contact, appointment, showup, orders, sales,
    est_showup: estShowUp,
    cpl: inquiry ? ad_spend / inquiry : 0,
    respond_rate: pct(contact, inquiry),
    appt_rate: pct(appointment, contact),
    showup_rate: estShowUp ? pct(showup, estShowUp) : 0,
    conv_rate: showup ? pct(orders, showup) : 0,
    aov: orders ? sales / orders : 0,
    roas: ad_spend ? sales / ad_spend : 0,
    cpa_pct: sales ? pct(ad_spend, sales) : 0,
  };
}

const metricKeys: (keyof FunnelMetrics)[] = [
  "ad_spend", "inquiry", "contact", "appointment", "showup", "orders", "sales",
  "cpl", "respond_rate", "appt_rate", "showup_rate", "conv_rate", "aov", "roas", "cpa_pct",
];

export function computeMoM(current: FunnelMetrics, previous: FunnelMetrics): MoMResult {
  const result: MoMResult = {};
  for (const k of metricKeys) {
    result[k] = momPct(current[k] as number, previous[k] as number);
  }
  return result;
}

export function computeAchievement(m: FunnelMetrics, kpi: KPIConfig): Achievement {
  return {
    sales: pct(m.sales, kpi.sales),
    orders: pct(m.orders, kpi.orders),
    ad_spend: pct(m.ad_spend, kpi.ad_spend),
    cpl: m.cpl ? pct(kpi.cpl, m.cpl) : 0,
    respond_rate: pct(m.respond_rate, kpi.respond_rate),
    appt_rate: pct(m.appt_rate, kpi.appt_rate),
    showup_rate: pct(m.showup_rate, kpi.showup_rate),
    conv_rate: pct(m.conv_rate, kpi.conv_rate),
    aov: pct(m.aov, kpi.aov),
    roas: pct(m.roas, kpi.roas),
  };
}

export function budgetScenario(
  spend: number, metrics: FunnelMetrics, kpi: KPIConfig, estSUNext: number
): BudgetScenario {
  const inquiry = metrics.cpl ? spend / metrics.cpl : 0;
  const new_contact = inquiry * metrics.respond_rate / 100;
  const new_appt = new_contact * metrics.appt_rate / 100;
  const pipeline = estSUNext + new_appt;
  const show_up = pipeline * metrics.showup_rate / 100;
  const orders = show_up * metrics.conv_rate / 100;
  const sales = orders * metrics.aov;
  const roas = spend ? sales / spend : 0;
  const cpa_pct = sales ? pct(spend, sales) : 0;
  const gap = sales - kpi.sales;

  return { spend, inquiry, new_contact, new_appt, pipeline, show_up, orders, sales, roas, cpa_pct, gap };
}

export function computeWeeklyBreakdown(rows: DailyMetric[]): FunnelMetrics[] {
  const w1 = rows.filter((r) => r.date.getDate() >= 1 && r.date.getDate() <= 7);
  const w2 = rows.filter((r) => r.date.getDate() >= 8 && r.date.getDate() <= 14);
  const w3 = rows.filter((r) => r.date.getDate() >= 15 && r.date.getDate() <= 21);
  const w4 = rows.filter((r) => r.date.getDate() >= 22);
  return [w1, w2, w3, w4].map((w) => computeMetrics(w, 0));
}
