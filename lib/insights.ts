import type { FunnelMetrics, KPIConfig, Achievement, InsightLanguage, Insight, InsightGroup } from "./types";
import { fmtRM } from "./utils";

interface MetricDef {
  key: string;
  achKey: string;
  label: Record<InsightLanguage, string>;
  format: (v: number) => string;
  compute?: (m: FunnelMetrics, kpi: KPIConfig) => number; // override achievement
}

const COMMON_METRICS: MetricDef[] = [
  { key: "sales", achKey: "sales", label: { en: "Sales", zh: "销售额", ms: "Jualan" }, format: fmtRM },
  { key: "ad_spend", achKey: "ad_spend", label: { en: "Ad Spend", zh: "广告支出", ms: "Belanja Iklan" }, format: fmtRM },
  { key: "orders", achKey: "orders", label: { en: "Orders", zh: "订单", ms: "Pesanan" }, format: (v) => String(Math.round(v)) },
  { key: "cpl", achKey: "cpl", label: { en: "CPL", zh: "CPL", ms: "CPL" }, format: fmtRM },
  { key: "aov", achKey: "aov", label: { en: "AOV", zh: "AOV", ms: "AOV" }, format: fmtRM },
  { key: "conv_rate", achKey: "conv_rate", label: { en: "Conv Rate", zh: "转化率", ms: "Kadar Penukaran" }, format: (v) => `${v.toFixed(1)}%` },
  {
    key: "cpa_pct", achKey: "cpa_pct",
    label: { en: "CPA%", zh: "CPA%", ms: "CPA%" },
    format: (v) => `${v.toFixed(2)}%`,
    compute: (m, kpi) => m.cpa_pct > 0 ? (kpi.cpa_pct / m.cpa_pct) * 100 : 0,
  },
];

const APPT_METRICS: MetricDef[] = [
  { key: "respond_rate", achKey: "respond_rate", label: { en: "Respond Rate", zh: "回复率", ms: "Kadar Respons" }, format: (v) => `${v.toFixed(1)}%` },
  { key: "appt_rate", achKey: "appt_rate", label: { en: "Appt Rate", zh: "预约率", ms: "Kadar Temu Janji" }, format: (v) => `${v.toFixed(1)}%` },
  { key: "showup_rate", achKey: "showup_rate", label: { en: "Show Up Rate", zh: "出席率", ms: "Kadar Kehadiran" }, format: (v) => `${v.toFixed(1)}%` },
];

const WALKIN_METRICS: MetricDef[] = [
  { key: "visit_rate", achKey: "respond_rate", label: { en: "Visit Rate", zh: "到访率", ms: "Kadar Lawatan" }, format: (v) => `${v.toFixed(1)}%` },
];

const CATEGORY_LABELS: Record<InsightLanguage, { topPerformer: string; needsAttention: string; paceForecast: string }> = {
  en: { topPerformer: "Top Performer", needsAttention: "Needs Attention", paceForecast: "Pace Forecast" },
  zh: { topPerformer: "表现优秀", needsAttention: "需要关注", paceForecast: "进度预测" },
  ms: { topPerformer: "Prestasi Terbaik", needsAttention: "Perlu Perhatian", paceForecast: "Ramalan Kadar" },
};

const TEMPLATES: Record<InsightLanguage, {
  topPerformer: string;
  topDefault: string;
  needsAttention: string;
  attentionDefault: string;
  paceOnTrack: string;
  paceBehind: string;
  paceActualHit: string;
  paceActualMiss: string;
}> = {
  en: {
    topPerformer: "{metric} hit {achievement}% of target ({value})",
    topDefault: "All metrics within target range",
    needsAttention: "{metric} at {achievement}% — currently {value}",
    attentionDefault: "All metrics performing above 80%",
    paceOnTrack: "{metric}: Projected {projected} by month-end (Target: {target})",
    paceBehind: "{metric}: Projected {projected}, gap of {gap} to target {target}",
    paceActualHit: "{metric}: {value} achieved vs target {target}",
    paceActualMiss: "{metric}: {value} vs target {target}, gap of {gap}",
  },
  zh: {
    topPerformer: "{metric} 达成目标 {achievement}%（{value}）",
    topDefault: "所有指标均在目标范围内",
    needsAttention: "{metric} 仅达 {achievement}% — 当前 {value}",
    attentionDefault: "所有指标表现均超过 80%",
    paceOnTrack: "{metric}: 预计月末达 {projected}（目标: {target}）",
    paceBehind: "{metric}: 预计 {projected}，距目标 {target} 差 {gap}",
    paceActualHit: "{metric}: 已达成 {value}，目标 {target}",
    paceActualMiss: "{metric}: 实际 {value}，目标 {target}，差距 {gap}",
  },
  ms: {
    topPerformer: "{metric} mencapai {achievement}% sasaran ({value})",
    topDefault: "Semua metrik dalam julat sasaran",
    needsAttention: "{metric} pada {achievement}% — kini {value}",
    attentionDefault: "Semua metrik melebihi 80%",
    paceOnTrack: "{metric}: Diunjurkan {projected} menjelang akhir bulan (Sasaran: {target})",
    paceBehind: "{metric}: Diunjurkan {projected}, jurang {gap} kepada sasaran {target}",
    paceActualHit: "{metric}: {value} dicapai vs sasaran {target}",
    paceActualMiss: "{metric}: {value} vs sasaran {target}, jurang {gap}",
  },
};

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

export function generateInsights(params: {
  metrics: FunnelMetrics;
  kpi: KPIConfig;
  achievement: Achievement;
  paceRatio: number;
  funnelType: "appointment" | "walkin";
  language: InsightLanguage;
}): InsightGroup {
  const { metrics, kpi, achievement, paceRatio, funnelType, language } = params;
  const t = TEMPLATES[language];

  // Build metric list based on funnel type
  const metricDefs = [
    ...COMMON_METRICS,
    ...(funnelType === "walkin" ? WALKIN_METRICS : APPT_METRICS),
  ];

  // Compute achievement for each metric
  const evaluated = metricDefs.map((def) => {
    const ach = def.compute ? def.compute(metrics, kpi) : (achievement[def.achKey] ?? 0);
    const rawValue = metrics[def.key as keyof FunnelMetrics] as number ?? 0;
    return { def, ach, rawValue };
  }).filter((e) => e.ach > 0); // skip metrics with zero achievement (no data)

  // Top Performers: achievement >= 100, sorted desc
  const excellent = evaluated
    .filter((e) => e.ach >= 100)
    .sort((a, b) => b.ach - a.ach)
    .slice(0, 2);

  const topPerformers: Insight[] = excellent.length > 0
    ? excellent.map((e) => ({
        metric: e.def.label[language],
        message: interpolate(t.topPerformer, {
          metric: e.def.label[language],
          achievement: Math.round(e.ach).toString(),
          value: e.def.format(e.rawValue),
        }),
      }))
    : [{ metric: "", message: t.topDefault }];

  // Needs Attention: achievement < 80, sorted asc (worst first)
  const poor = evaluated
    .filter((e) => e.ach < 80)
    .sort((a, b) => a.ach - b.ach)
    .slice(0, 2);

  const needsAttention: Insight[] = poor.length > 0
    ? poor.map((e) => ({
        metric: e.def.label[language],
        message: interpolate(t.needsAttention, {
          metric: e.def.label[language],
          achievement: Math.round(e.ach).toString(),
          value: e.def.format(e.rawValue),
        }),
      }))
    : [{ metric: "", message: t.attentionDefault }];

  // Pace Forecast: project Sales and Orders to month-end
  const paceForecast: Insight[] = [];
  const paceItems: { key: string; label: Record<InsightLanguage, string>; actual: number; target: number; format: (v: number) => string }[] = [
    { key: "sales", label: { en: "Sales", zh: "销售额", ms: "Jualan" }, actual: metrics.sales, target: kpi.sales, format: fmtRM },
    { key: "orders", label: { en: "Orders", zh: "订单", ms: "Pesanan" }, actual: metrics.orders, target: kpi.orders, format: (v) => String(Math.round(v)) },
  ];

  for (const item of paceItems) {
    const metricLabel = item.label[language];
    if (paceRatio >= 1) {
      // Full month: show actual vs target
      const gap = item.target - item.actual;
      if (item.actual >= item.target) {
        paceForecast.push({
          metric: metricLabel,
          message: interpolate(t.paceActualHit, {
            metric: metricLabel,
            value: item.format(item.actual),
            target: item.format(item.target),
          }),
        });
      } else {
        paceForecast.push({
          metric: metricLabel,
          message: interpolate(t.paceActualMiss, {
            metric: metricLabel,
            value: item.format(item.actual),
            target: item.format(item.target),
            gap: item.format(gap),
          }),
        });
      }
    } else {
      // Partial month: project forward
      const projected = paceRatio > 0 ? item.actual / paceRatio : 0;
      const gap = item.target - projected;
      if (projected >= item.target) {
        paceForecast.push({
          metric: metricLabel,
          message: interpolate(t.paceOnTrack, {
            metric: metricLabel,
            projected: item.format(projected),
            target: item.format(item.target),
          }),
        });
      } else {
        paceForecast.push({
          metric: metricLabel,
          message: interpolate(t.paceBehind, {
            metric: metricLabel,
            projected: item.format(projected),
            target: item.format(item.target),
            gap: item.format(gap),
          }),
        });
      }
    }
  }

  return {
    topPerformers,
    needsAttention,
    paceForecast,
    labels: CATEGORY_LABELS[language],
  };
}
