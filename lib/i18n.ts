// ── Dashboard i18n (EN/ZH) ──────────────────────────────────────
// Central translation dictionary. Per-viewer language lives in the
// `dashboard_lang` cookie (read server-side); components receive `lang` as a
// prop and call t(lang, key). Industry/sheet-aligned acronyms (CPL, AOV, CPA%,
// ROAS, KPI) are intentionally left untranslated in both languages.

export type Lang = "en" | "zh";

export const LANG_COOKIE = "dashboard_lang";

export function normalizeLang(v: string | undefined | null): Lang {
  return v === "zh" ? "zh" : "en";
}

type Dict = Record<string, { en: string; zh: string }>;

const D: Dict = {
  // ── Metrics / card labels ──
  totalSales: { en: "Total Sales", zh: "总销售额" },
  totalAdSpend: { en: "Total Ad Spend", zh: "总广告花费" },
  adSpend: { en: "Ad Spend", zh: "广告花费" },
  cpl: { en: "CPL", zh: "CPL" },
  cpaPct: { en: "CPA%", zh: "CPA%" },
  orders: { en: "Orders", zh: "订单数" },
  aov: { en: "AOV", zh: "AOV" },
  roas: { en: "ROAS", zh: "ROAS" },
  visitRate: { en: "Visit Rate", zh: "到访率" },
  respondRate: { en: "Respond Rate", zh: "回复率" },
  conversionRate: { en: "Conversion Rate", zh: "转化率" },
  convRate: { en: "Conv Rate", zh: "转化率" },
  apptRate: { en: "Appt Rate", zh: "预约率" },
  appointmentRate: { en: "Appointment Rate", zh: "预约率" },
  showUpRate: { en: "Show Up Rate", zh: "出席率" },

  // ── Funnel stages / breakdown counts ──
  inquiry: { en: "Inquiry", zh: "询问数" },
  inquiryPM: { en: "Inquiry (PM)", zh: "询问数 (PM)" },
  contact: { en: "Contact", zh: "联系" },
  contactGiven: { en: "Contact Given", zh: "已联系" },
  visit: { en: "Visit", zh: "到访" },
  appointment: { en: "Appointment", zh: "预约" },
  showUp: { en: "Show Up", zh: "出席" },
  estShowUp: { en: "Est. Show Up", zh: "预估出席" },
  estShowUpShort: { en: "Est.Show Up", zh: "预估出席" },
  sales: { en: "Sales", zh: "销售额" },

  // ── Status pills ──
  excellent: { en: "Excellent", zh: "优秀" },
  warning: { en: "Warning", zh: "警示" },
  poor: { en: "Poor", zh: "偏低" },

  // ── Target / pace sub-labels ──
  monthlyTarget: { en: "Monthly Target", zh: "月目标" },
  paceTarget: { en: "Pace Target", zh: "进度目标" },
  pace: { en: "Pace", zh: "进度" },
  target: { en: "Target", zh: "目标" },
  monthly: { en: "Monthly", zh: "月度" },
  prev: { en: "Prev", zh: "上期" },
  leadFunnelAdSpend: { en: "Lead Funnel Ad Spend", zh: "引流广告花费" },
  brandingAdSpend: { en: "Branding Ad Spend", zh: "品牌广告花费" },
  targetedDailyBudget: { en: "Targeted Daily Budget", zh: "目标日预算" },
  currentDailyBudget: { en: "Current Daily Budget", zh: "当前日预算" },
  avgDaily: { en: "Avg. Daily", zh: "日均花费" },

  // ── Hero group headers ──
  frontendAdPerformance: { en: "FRONTEND — Ad Performance", zh: "前端 — 广告表现" },
  midendLeadPipeline: { en: "MIDEND — Lead Pipeline", zh: "中端 — 线索管道" },
  backendRevenue: { en: "BACKEND — Revenue", zh: "后端 — 营收" },

  // ── Page section headers ──
  performanceOverview: { en: "Performance Overview", zh: "业绩总览" },
  conversion: { en: "Conversion", zh: "转化" },
  leadFunnel: { en: "Lead Funnel", zh: "线索漏斗" },
  analysis: { en: "Analysis", zh: "分析" },
  periodComparison: { en: "Period Comparison", zh: "周期对比" },
  targetsSection: { en: "Targets", zh: "目标" },
  kpiAchievement: { en: "KPI Achievement", zh: "KPI 达成" },
  team: { en: "Team", zh: "团队" },
  personPerformance: { en: "Person Performance", zh: "人员表现" },
  products: { en: "Products", zh: "产品" },
  brandPerformanceTitle: { en: "Brand Performance", zh: "品牌表现" },

  // ── MoM table headers ──
  metric: { en: "Metric", zh: "指标" },
  pop: { en: "PoP", zh: "环比" },
  kpiCol: { en: "KPI", zh: "KPI" },

  // ── Person Performance ──
  appointmentSetter: { en: "Appointment Setter", zh: "预约专员" },
  salesPersonLabel: { en: "Sales Person", zh: "销售人员" },
  all: { en: "All", zh: "全部" },
  personApptDistribution: { en: "Person Appt Distribution", zh: "各人预约分布" },
  personVisit: { en: "Person Visit", zh: "各人到访" },
  personEstShowUp: { en: "Person Est.Show Up", zh: "各人预估出席" },
  personSales: { en: "Person Sales", zh: "各人销售" },
  brandOrders: { en: "Brand Orders", zh: "品牌订单" },
  brandSales: { en: "Brand Sales", zh: "品牌销售" },
  appointmentsUnit: { en: "appointments", zh: "个预约" },
  visitsUnit: { en: "visits", zh: "次到访" },
  estShowUpUnit: { en: "est.show up", zh: "预估出席" },
  ordersUnit: { en: "orders", zh: "个订单" },

  // ── Brand Performance ──
  totalProductsSold: { en: "Total Products Sold", zh: "总售出产品数" },
  brandByQty: { en: "Brand · Qty", zh: "品牌 · 数量" },
  brandBySales: { en: "Brand · Sales", zh: "品牌 · 销售" },
  productByQty: { en: "Product · Qty", zh: "产品 · 数量" },
  productBySales: { en: "Product · Sales", zh: "产品 · 销售" },
  unitsUnit: { en: "units", zh: "件" },
  salesUnit: { en: "sales", zh: "销售" },

  // ── Top nav / layout ──
  projectOverview: { en: "Project Overview", zh: "项目总览" },
  settings: { en: "Settings", zh: "设置" },
  diagnostics: { en: "Diagnostics", zh: "数据诊断" },
  switchClient: { en: "Switch client", zh: "切换客户" },
  navData: { en: "Data", zh: "数据" },
  navAdmin: { en: "Admin", zh: "管理" },
  notTracked: { en: "Not tracked", zh: "未追踪" },
  notTrackedHint: { en: "Column missing in Performance Tracker", zh: "Performance Tracker 缺少该列" },
  source: { en: "Source", zh: "来源" },
  allSources: { en: "All sources", zh: "全部来源" },
  signOut: { en: "Sign Out", zh: "登出" },
  trends: { en: "Trends", zh: "趋势" },
  theme: { en: "Theme", zh: "主题" },

  // ── Refresh button ──
  refresh: { en: "Refresh", zh: "刷新" },
  refreshing: { en: "Refreshing…", zh: "刷新中…" },
  dataUpdatedAt: { en: "Updated at", zh: "数据更新于" },

  // ── Month picker / report ──
  monthlyPerformanceOverview: { en: "Monthly Performance Overview", zh: "月度业绩报告" },
  selectReportMonth: { en: "Select Report Month", zh: "选择报告月份" },
  monthField: { en: "Month", zh: "月份" },
  yearField: { en: "Year", zh: "年份" },
  generate: { en: "Generate", zh: "生成报告" },

  // ── Date range picker ──
  currentPeriodTab: { en: "Current Period", zh: "当前周期" },
  comparePeriodTab: { en: "Compare Period", zh: "对比周期" },
  apply: { en: "Apply", zh: "应用" },
  cancel: { en: "Cancel", zh: "取消" },
  selectDateRange: { en: "Select date range", zh: "选择日期范围" },
  comparePeriodHint: { en: "Select the period to compare against", zh: "选择要对比的周期" },
  vsLabel: { en: "vs.", zh: "对比" },

  // ── Brand selector ──
  overall: { en: "Overall", zh: "全部品牌" },

  // ── Error states ──
  unableToLoadData: { en: "Unable to load data", zh: "无法加载数据" },
  unableToLoadDataHint: {
    en: 'Make sure the Google Sheet is shared as "Anyone with the link can view" and contains the required tabs.',
    zh: "请确认 Google Sheet 已设为「任何有链接的人可查看」,且包含所需的分页。",
  },

  // ── Mobile dashboard ──
  overviewTab: { en: "Overview", zh: "总览" },
  funnelTab: { en: "Funnel", zh: "漏斗" },
  avgAchievement: { en: "avg achievement", zh: "平均达成" },
  allOnTrack: { en: "all on track", zh: "全部达标" },
  ofTarget: { en: "of target", zh: "占目标" },
  previous: { en: "Previous", zh: "上期" },
  close: { en: "Close", zh: "关闭" },

  // ── Trends page ──
  historicalTrends: { en: "Historical Trends", zh: "历史趋势" },
  allBrands: { en: "All Brands", zh: "全部品牌" },
  monthlyGran: { en: "Monthly", zh: "按月" },
  weeklyGran: { en: "Weekly", zh: "按周" },
  compareOff: { en: "Compare Off", zh: "关闭对比" },
  compareOn: { en: "Compare On", zh: "开启对比" },
  comparisonPeriod: { en: "Comparison period", zh: "对比周期" },
  frontendGroup: { en: "Frontend", zh: "前端" },
  midendGroup: { en: "Midend", zh: "中端" },
  backendGroup: { en: "Backend", zh: "后端" },
  performanceLabel: { en: "performance", zh: "业绩" },
  weeksUnit: { en: "weeks", zh: "周" },
  monthsUnit: { en: "months", zh: "个月" },
  metricsLabel: { en: "Metrics", zh: "指标" },
  periodAverage: { en: "Period Average", zh: "周期平均" },
  avgPrefix: { en: "Avg", zh: "平均" },
  incomplete: { en: "incomplete", zh: "未完整" },
  selectMetricHint: { en: "Select at least one metric to display the chart.", zh: "请至少选择一个指标以显示图表。" },
};

/** Translate a key for the given language; falls back to English then the key. */
export function t(lang: Lang, key: string): string {
  const entry = D[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en ?? key;
}
