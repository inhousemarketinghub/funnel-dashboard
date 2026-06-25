import type { FunnelMetrics, KPIConfig, MoMResult } from "@/lib/types";
import { fmtRM, fmtROAS } from "@/lib/utils";
import { t, type Lang } from "@/lib/i18n";
import { MoMBadge } from "@/components/shared/mom-badge";

interface FunnelRow {
  label: string;
  tmFmt: string;
  lmFmt: string;
  mom: number | null;
  kpiFmt: string;
  inverted: boolean;
}

function buildRows(
  tm: FunnelMetrics,
  lm: FunnelMetrics,
  mom: MoMResult,
  kpi: KPIConfig,
  funnelType: string = "appointment",
  lang: Lang = "en",
): FunnelRow[] {
  const isWalkin = funnelType === "walkin";
  const walkinConvRate = tm.contact > 0 ? (tm.orders / tm.contact) * 100 : 0;
  const walkinConvRatePrev = lm.contact > 0 ? (lm.orders / lm.contact) * 100 : 0;
  const walkinConvMom = walkinConvRatePrev > 0 ? ((walkinConvRate - walkinConvRatePrev) / walkinConvRatePrev) * 100 : null;
  const visitRate = tm.inquiry > 0 ? (tm.contact / tm.inquiry) * 100 : 0;
  const visitRatePrev = lm.inquiry > 0 ? (lm.contact / lm.inquiry) * 100 : 0;
  const visitRateMom = visitRatePrev > 0 ? ((visitRate - visitRatePrev) / visitRatePrev) * 100 : null;
  const tmCPL = tm.inquiry > 0 ? tm.ad_spend / tm.inquiry : 0;
  const lmCPL = lm.inquiry > 0 ? lm.ad_spend / lm.inquiry : 0;
  const cplMom = lmCPL > 0 ? ((tmCPL - lmCPL) / lmCPL) * 100 : null;

  const rows: FunnelRow[] = [
    { label: t(lang, "adSpend"), tmFmt: fmtRM(tm.ad_spend), lmFmt: fmtRM(lm.ad_spend), mom: mom.ad_spend ?? null, kpiFmt: fmtRM(kpi.ad_spend), inverted: false },
    { label: t(lang, "inquiryPM"), tmFmt: String(tm.inquiry), lmFmt: String(lm.inquiry), mom: mom.inquiry ?? null, kpiFmt: kpi.cpl > 0 ? String(Math.round(kpi.ad_spend / kpi.cpl)) : "—", inverted: false },
    { label: t(lang, "cpl"), tmFmt: fmtRM(tmCPL), lmFmt: fmtRM(lmCPL), mom: cplMom, kpiFmt: kpi.cpl > 0 ? fmtRM(kpi.cpl) : "—", inverted: true },
    { label: isWalkin ? t(lang, "visit") : t(lang, "contact"), tmFmt: String(tm.contact), lmFmt: String(lm.contact), mom: mom.contact ?? null, kpiFmt: String(kpi.target_contact), inverted: false },
    { label: isWalkin ? t(lang, "visitRate") : t(lang, "respondRate"), tmFmt: isWalkin ? `${visitRate.toFixed(1)}%` : `${tm.respond_rate.toFixed(1)}%`, lmFmt: isWalkin ? `${visitRatePrev.toFixed(1)}%` : `${lm.respond_rate.toFixed(1)}%`, mom: isWalkin ? visitRateMom : (mom.respond_rate ?? null), kpiFmt: `${kpi.respond_rate}%`, inverted: false },
  ];

  if (!isWalkin) {
    rows.push(
      { label: t(lang, "appointment"), tmFmt: String(tm.appointment), lmFmt: String(lm.appointment), mom: mom.appointment ?? null, kpiFmt: String(kpi.target_appt), inverted: false },
      { label: t(lang, "apptRate"), tmFmt: `${tm.appt_rate.toFixed(1)}%`, lmFmt: `${lm.appt_rate.toFixed(1)}%`, mom: mom.appt_rate ?? null, kpiFmt: `${kpi.appt_rate}%`, inverted: false },
      { label: t(lang, "estShowUp"), tmFmt: String(tm.est_showup), lmFmt: String(lm.est_showup), mom: null, kpiFmt: "\u2014", inverted: false },
      { label: t(lang, "showUp"), tmFmt: String(tm.showup), lmFmt: String(lm.showup), mom: mom.showup ?? null, kpiFmt: String(kpi.target_showup), inverted: false },
      { label: t(lang, "showUpRate"), tmFmt: `${tm.showup_rate.toFixed(1)}%`, lmFmt: `${lm.showup_rate.toFixed(1)}%`, mom: mom.showup_rate ?? null, kpiFmt: `${kpi.showup_rate}%`, inverted: false },
    );
  }

  rows.push(
    { label: t(lang, "orders"), tmFmt: String(tm.orders), lmFmt: String(lm.orders), mom: mom.orders ?? null, kpiFmt: String(kpi.orders), inverted: false },
    { label: t(lang, "convRate"), tmFmt: isWalkin ? `${walkinConvRate.toFixed(1)}%` : `${tm.conv_rate.toFixed(1)}%`, lmFmt: isWalkin ? `${walkinConvRatePrev.toFixed(1)}%` : `${lm.conv_rate.toFixed(1)}%`, mom: isWalkin ? walkinConvMom : (mom.conv_rate ?? null), kpiFmt: `${kpi.conv_rate}%`, inverted: false },
    { label: t(lang, "sales"), tmFmt: fmtRM(tm.sales), lmFmt: fmtRM(lm.sales), mom: mom.sales ?? null, kpiFmt: fmtRM(kpi.sales), inverted: false },
    { label: t(lang, "aov"), tmFmt: fmtRM(tm.aov), lmFmt: fmtRM(lm.aov), mom: mom.aov ?? null, kpiFmt: fmtRM(kpi.aov), inverted: false },
    { label: t(lang, "roas"), tmFmt: fmtROAS(tm.roas), lmFmt: fmtROAS(lm.roas), mom: mom.roas ?? null, kpiFmt: fmtROAS(kpi.roas), inverted: false },
    { label: t(lang, "cpaPct"), tmFmt: `${tm.cpa_pct.toFixed(2)}%`, lmFmt: `${lm.cpa_pct.toFixed(2)}%`, mom: mom.cpa_pct ?? null, kpiFmt: `${kpi.cpa_pct}%`, inverted: true },
  );

  return rows;
}

const TH =
  "font-label text-[10px] uppercase tracking-widest text-[var(--t4)] text-left";
const TD = "text-[13px] text-[var(--t1)] num";

export function MoMTable({
  tm,
  lm,
  mom,
  kpi,
  thisMonth,
  lastMonth,
  funnelType = "appointment",
  lang = "en",
}: {
  tm: FunnelMetrics;
  lm: FunnelMetrics;
  mom: MoMResult;
  kpi: KPIConfig;
  thisMonth: string;
  lastMonth: string;
  funnelType?: string;
  lang?: Lang;
}) {
  const rows = buildRows(tm, lm, mom, kpi, funnelType, lang);

  return (
    <div className="overflow-x-auto">
      <table className="w-full mom-table" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {t(lang, "metric")}
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {thisMonth}
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {lastMonth}
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {t(lang, "pop")}
            </th>
            <th className={TH} style={{ padding: "10px 16px" }}>
              {t(lang, "kpiCol")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-b border-[var(--border)] hover:bg-[var(--bg3)] transition-colors"
            >
              <td
                className="text-[13px] font-medium text-[var(--t1)]"
                style={{ padding: "12px 16px" }}
              >
                {r.label}
              </td>
              <td className={TD} style={{ padding: "12px 16px" }}>
                {r.tmFmt}
              </td>
              <td
                className="text-[13px] text-[var(--t4)] num"
                style={{ padding: "12px 16px" }}
              >
                {r.lmFmt}
              </td>
              <td style={{ padding: "12px 16px" }}>
                <MoMBadge value={r.mom} inverted={r.inverted} />
              </td>
              <td
                className="text-[13px] text-[var(--t4)] num"
                style={{ padding: "12px 16px" }}
              >
                {r.kpiFmt}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
