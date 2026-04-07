export interface DailyMetric {
  date: Date;
  ad_spend: number;
  inquiry: number;
  contact: number;
  appointment: number;
  showup: number;
  orders: number;
  sales: number;
}

export interface Lead {
  appointment_date: Date | null;
  showed_up: boolean;
  sales: number;
  purchase_date: Date | null;
}

export interface FunnelMetrics {
  ad_spend: number;
  inquiry: number;
  contact: number;
  appointment: number;
  showup: number;
  est_showup: number;
  orders: number;
  sales: number;
  cpl: number;
  respond_rate: number;
  appt_rate: number;
  showup_rate: number;
  conv_rate: number;
  aov: number;
  roas: number;
  cpa_pct: number;
}

export interface KPIConfig {
  sales: number;
  orders: number;
  aov: number;
  cpl: number;
  respond_rate: number;
  appt_rate: number;
  showup_rate: number;
  conv_rate: number;
  ad_spend: number;
  daily_ad: number;
  roas: number;
  cpa_pct: number;
  target_contact: number;
  target_appt: number;
  target_showup: number;
}

export interface MoMResult {
  [key: string]: number | null;
}

export interface Achievement {
  [key: string]: number;
}

export interface BudgetScenario {
  spend: number;
  inquiry: number;
  new_contact: number;
  new_appt: number;
  pipeline: number;
  show_up: number;
  orders: number;
  sales: number;
  roas: number;
  cpa_pct: number;
  gap: number;
}

export interface ClientConfig {
  id: string;
  agency_id: string;
  name: string;
  sheet_id: string;
  logo_url: string | null;
  funnel_type: "appointment" | "walkin";
  language?: InsightLanguage;
}

export type DateRange = [Date, Date];

export type InsightLanguage = "en" | "zh" | "ms";

export interface Insight {
  metric: string;
  message: string;
}

export interface InsightGroup {
  topPerformers: Insight[];
  needsAttention: Insight[];
  paceForecast: Insight[];
  labels: { topPerformer: string; needsAttention: string; paceForecast: string };
}
