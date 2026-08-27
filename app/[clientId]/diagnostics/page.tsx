import Link from "next/link";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { normalizeLang, LANG_COOKIE, type Lang } from "@/lib/i18n";
import { getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildDiagnosticsReport, type BrandDiagnosis } from "@/lib/diagnostics";
import { colToLetter, type SheetTab, type TabRule, type TrackedMetrics } from "@/lib/sheets";
import { RefreshButton } from "@/components/dashboard/refresh-button";

// Admin-only page: shows exactly what the parser resolved for this client's
// sheet — which tabs, which columns (with real header text), funnel-type
// sources, date coverage and sanity checks — so "the number looks wrong" can
// be self-diagnosed without reading code.

// Admin-facing page with self-contained strings; zh labels live here (keyed by
// the English source) rather than in the shared lib/i18n dict — same pattern
// as Settings.
const DIAG_ZH: Record<string, string> = {
  "Data Diagnostics": "数据诊断",
  "Dashboard": "仪表盘",
  "Data pulled at": "数据拉取于",
  "Source tabs": "数据源 Tab 解析",
  "Rule": "规则",
  "contains": "含",
  "excludes": "排",
  "selected": "选中",
  "no tab matched": "未找到匹配的 tab",
  "hidden": "隐藏",
  "Funnel type": "漏斗类型",
  "From headers (used by dashboard)": "表头推断（dashboard 实际使用）",
  "From database": "数据库设定",
  "From onboarding scanner": "接入扫描器判定",
  "Sources disagree — the dashboard uses the header-inferred value.": "来源不一致 —— dashboard 以表头推断值为准。",
  "Column resolution": "列解析",
  "Metric": "指标",
  "Column": "列",
  "Header text": "表头文字",
  "Status": "状态",
  "OK": "正常",
  "Not tracked": "未追踪",
  "Fallback": "兜底",
  "Fallback (positional guess — header not recognized)": "兜底（表头认不出，按默认列位猜测）",
  "Ambiguous": "歧义",
  "matched multiple different headers": "命中多个不同表头",
  "Date coverage": "当月日期覆盖",
  "days with data": "天有数据",
  "missing": "缺",
  "complete": "完整",
  "Sanity checks": "合理性检查",
  "No issues": "无异常",
  "Overall merge": "Overall 合并",
  "Brands merged": "参与合并的品牌",
  "tracked in": "追踪于",
  "Warning: only some brands track this metric — the Overall total is partial.": "注意：仅部分品牌追踪此指标 —— Overall 合计不完整。",
  "Note: merged funnel type follows the last tab (existing behavior).": "注：合并后的漏斗类型取最后一个 tab（现状行为）。",
  "Appointment": "预约",
  "Est.Show Up": "预计出席",
  "Showed Up": "实际出席",
};

const METRIC_LABELS: Record<string, string> = {
  date: "Date", adSpend: "Taxed Ad Spend", leadFunnelSpend: "Lead Funnel Spend",
  brandingSpend: "Branding Spend", inquiry: "PM / Inquiry", contact: "Contact / Visit",
  appointment: "Appointment", estShowup: "Est.Show Up", showup: "Showed Up",
  orders: "Orders", sales: "Sales",
};

const SANITY_TEXT: Record<string, { en: (v: Record<string, number>) => string; zh: (v: Record<string, number>) => string }> = {
  showup_exceeds_est: {
    en: (v) => `Showed Up (${v.showup}) exceeds Est.Show Up (${v.est_showup})`,
    zh: (v) => `实际出席 (${v.showup}) 大于预计出席 (${v.est_showup})`,
  },
  orders_exceed_showup: {
    en: (v) => `Orders (${v.orders}) exceed Showed Up (${v.showup})`,
    zh: (v) => `订单数 (${v.orders}) 大于实际出席 (${v.showup})`,
  },
  contact_exceeds_inquiry: {
    en: (v) => `Contact (${v.contact}) exceeds Inquiry (${v.inquiry})`,
    zh: (v) => `联系数 (${v.contact}) 大于询盘数 (${v.inquiry})`,
  },
  sales_without_orders: {
    en: (v) => `Sales RM${v.sales} recorded with 0 orders`,
    zh: (v) => `有销售额 RM${v.sales} 但订单数为 0`,
  },
};

function tabStatus(tab: SheetTab, rule: TabRule, selected: string | null): "selected" | "candidate" | "excluded" | "none" {
  const n = tab.name.toLowerCase();
  const included = rule.includes.every((kw) => n.includes(kw.toLowerCase()));
  if (!included) return "none";
  if (rule.excludes.some((kw) => n.includes(kw.toLowerCase()))) return "excluded";
  return tab.name === selected ? "selected" : "candidate";
}

const PILL = "inline-block rounded-full px-2 py-[1px] text-[11px] font-medium";

export default async function DiagnosticsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("view_diagnostics")) redirect(`/${clientId}`);

  const lang: Lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const tl = (s: string) => (lang === "zh" && DIAG_ZH[s]) || s;

  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const report = await buildDiagnosticsReport(client.sheet_id, client.funnel_type ?? null);

  const fetchedAtLabel = report.fetchedAt
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date(report.fetchedAt))
    : null;

  const monthLabel = `${report.brandSections[0]?.coverage.year ?? ""}-${String((report.brandSections[0]?.coverage.monthIdx ?? 0) + 1).padStart(2, "0")}`;

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mt-1 text-[22px] font-semibold text-[var(--t1)]">{tl("Data Diagnostics")}</h1>
          <div className="text-[13px] text-[var(--t3)]">
            {client.name}
            {fetchedAtLabel && <> · {tl("Data pulled at")} {fetchedAtLabel} (MYT)</>}
          </div>
        </div>
        <RefreshButton sheetId={client.sheet_id} fetchedAtLabel={null} lang={lang} />
      </div>

      {/* Card 1: source tab resolution */}
      <div className="card-base">
        <h2 className="font-label text-[12px] uppercase tracking-widest text-[var(--t4)] mb-3">{tl("Source tabs")}</h2>
        <div className="flex flex-col gap-4">
          {(["performance", "lead", "kpi"] as const).map((key) => {
            const s = report.sources[key];
            const label = key === "performance" ? "Performance Tracker" : key === "lead" ? "Lead & Sales Tracker" : "KPI Indicator";
            return (
              <div key={key}>
                <div className="flex flex-wrap items-baseline gap-2 text-[13px]">
                  <span className="font-medium text-[var(--t1)]">{label}</span>
                  <span className="text-[var(--t4)] text-[12px]">
                    ({tl("Rule")}: {tl("contains")} “{s.rule.includes.join('” + “')}”
                    {s.rule.excludes.length > 0 && <> · {tl("excludes")} “{s.rule.excludes.join('” “')}”</>})
                  </span>
                  {s.selected ? (
                    <span className="text-[var(--green)]">→ {s.selected}</span>
                  ) : (
                    <span className={`${PILL} bg-[var(--red)]/15 text-[var(--red)]`}>{tl("no tab matched")}</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {report.allTabs.map((tab) => {
                    const st = tabStatus(tab, s.rule, s.selected);
                    if (st === "none") return null;
                    const cls =
                      st === "selected" ? "bg-[var(--green)]/15 text-[var(--green)]" :
                      st === "excluded" ? "bg-[var(--bg3)] text-[var(--t4)] line-through" :
                      "bg-[var(--bg3)] text-[var(--t3)]";
                    return (
                      <span key={tab.gid} className={`${PILL} ${cls}`}>
                        {tab.name}{tab.hidden && <> · {tl("hidden")}</>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card 2..N: one per performance tab */}
      {report.brandSections.map((b) => (
        <BrandCard key={b.tabName} b={b} dbFunnelType={report.dbFunnelType} tl={tl} lang={lang} monthLabel={monthLabel} />
      ))}

      {/* Overall merge card (multi-brand only) */}
      {report.overall && (
        <div className="card-base">
          <h2 className="font-label text-[12px] uppercase tracking-widest text-[var(--t4)] mb-3">{tl("Overall merge")}</h2>
          <div className="text-[13px] text-[var(--t2)] mb-2">
            {tl("Brands merged")}: {report.overall.brands.join(", ")}
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[var(--t4)]">
                <th className="py-1 pr-3 font-normal">{tl("Metric")}</th>
                {report.overall.brands.map((br) => <th key={br} className="py-1 pr-3 font-normal">{br}</th>)}
              </tr>
            </thead>
            <tbody>
              {(["appointment", "est_showup", "showup"] as const).map((m) => {
                const label = m === "appointment" ? tl("Appointment") : m === "est_showup" ? tl("Est.Show Up") : tl("Showed Up");
                const partial =
                  report.overall!.brands.some((br) => report.overall!.perBrandTracked[br][m]) &&
                  report.overall!.brands.some((br) => !report.overall!.perBrandTracked[br][m]);
                return (
                  <tr key={m} className="border-t border-[var(--border)]">
                    <td className="py-1.5 pr-3 text-[var(--t2)]">
                      {label}
                      {partial && <span className={`${PILL} ml-2 bg-[var(--yellow)]/15 text-[var(--yellow)]`}>⚠</span>}
                    </td>
                    {report.overall!.brands.map((br) => (
                      <td key={br} className="py-1.5 pr-3">{report.overall!.perBrandTracked[br][m] ? "✓" : "—"}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(["appointment", "est_showup", "showup"] as const).some(
            (m) =>
              report.overall!.brands.some((br) => report.overall!.perBrandTracked[br][m]) &&
              report.overall!.brands.some((br) => !report.overall!.perBrandTracked[br][m]),
          ) && (
            <div className="mt-2 text-[12px] text-[var(--yellow)]">
              {tl("Warning: only some brands track this metric — the Overall total is partial.")}
            </div>
          )}
          <div className="mt-2 text-[12px] text-[var(--t4)]">
            {tl("Note: merged funnel type follows the last tab (existing behavior).")}
          </div>
        </div>
      )}
    </div>
  );
}

function BrandCard({
  b, dbFunnelType, tl, lang, monthLabel,
}: {
  b: BrandDiagnosis;
  dbFunnelType: string | null;
  tl: (s: string) => string;
  lang: Lang;
  monthLabel: string;
}) {
  const mismatch =
    (dbFunnelType !== null && b.funnelFromColumns !== dbFunnelType) ||
    (b.funnelFromScanner !== null && b.funnelFromScanner !== b.funnelFromColumns);

  const trackedFor = (metric: string): boolean | null => {
    if (metric === "appointment") return b.tracked.appointment;
    if (metric === "estShowup") return b.tracked.est_showup;
    if (metric === "showup") return b.tracked.showup;
    return null;
  };

  return (
    <div className="card-base">
      <h2 className="font-label text-[12px] uppercase tracking-widest text-[var(--t4)] mb-3">
        {b.tabName}
        {b.hidden && <span className={`${PILL} ml-2 bg-[var(--bg3)] text-[var(--t4)]`}>{tl("hidden")}</span>}
      </h2>

      {/* funnel type sources */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-[var(--t4)]">{tl("Funnel type")}:</span>
        <span className={`${PILL} bg-[var(--bg3)] text-[var(--t2)]`}>{tl("From headers (used by dashboard)")}: {b.funnelFromColumns}</span>
        {dbFunnelType !== null && (
          <span className={`${PILL} bg-[var(--bg3)] text-[var(--t2)]`}>{tl("From database")}: {dbFunnelType}</span>
        )}
        {b.funnelFromScanner !== null && (
          <span className={`${PILL} bg-[var(--bg3)] text-[var(--t2)]`}>{tl("From onboarding scanner")}: {b.funnelFromScanner}</span>
        )}
      </div>
      {mismatch && (
        <div className="mb-3 rounded-md bg-[var(--yellow)]/10 px-3 py-2 text-[12px] text-[var(--yellow)]">
          ⚠ {tl("Sources disagree — the dashboard uses the header-inferred value.")}
        </div>
      )}

      {/* column resolution table */}
      <h3 className="font-label text-[11px] uppercase tracking-widest text-[var(--t4)] mb-1.5">{tl("Column resolution")}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[var(--t4)]">
              <th className="py-1 pr-3 font-normal">{tl("Metric")}</th>
              <th className="py-1 pr-3 font-normal">{tl("Column")}</th>
              <th className="py-1 pr-3 font-normal">{tl("Header text")}</th>
              <th className="py-1 font-normal">{tl("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {b.diagnosis.columns.map((c) => {
              const tracked = trackedFor(c.metric);
              return (
                <tr key={c.metric} className="border-t border-[var(--border)]">
                  <td className="py-1.5 pr-3 text-[var(--t2)]">{METRIC_LABELS[c.metric] ?? c.metric}</td>
                  <td className="py-1.5 pr-3 num">{c.index !== null ? colToLetter(c.index) : "—"}</td>
                  <td className="py-1.5 pr-3 text-[var(--t3)]">{c.header ?? "—"}</td>
                  <td className="py-1.5">
                    {c.ambiguous ? (
                      <span className={`${PILL} bg-[var(--red)]/15 text-[var(--red)]`} title={c.matches.map((m) => `${colToLetter(m.index)}: ${m.header}`).join(" | ")}>
                        {tl("Ambiguous")} — {tl("matched multiple different headers")}:{" "}
                        {c.matches.map((m) => `${colToLetter(m.index)}“${m.header}”`).join(", ")}
                      </span>
                    ) : c.usedFallback ? (
                      <span className={`${PILL} bg-[var(--yellow)]/15 text-[var(--yellow)]`}>
                        {tl("Fallback (positional guess — header not recognized)")}
                      </span>
                    ) : c.index === null ? (
                      <span className={`${PILL} bg-[var(--bg3)] text-[var(--t4)]`}>{tracked === false ? tl("Not tracked") : "—"}</span>
                    ) : (
                      <span className={`${PILL} bg-[var(--green)]/15 text-[var(--green)]`}>{tl("OK")}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* date coverage */}
      <h3 className="font-label text-[11px] uppercase tracking-widest text-[var(--t4)] mt-4 mb-1.5">
        {tl("Date coverage")} ({monthLabel})
      </h3>
      {b.coverage.missingDays.length === 0 ? (
        <div className="text-[13px] text-[var(--green)]">
          ✓ {b.coverage.presentDays.length}/{b.coverage.lastCheckedDay} {tl("days with data")} · {tl("complete")}
        </div>
      ) : (
        <div className="text-[13px] text-[var(--yellow)]">
          {b.coverage.presentDays.length}/{b.coverage.lastCheckedDay} {tl("days with data")} · {tl("missing")}:{" "}
          {b.coverage.missingDays.join(", ")}
        </div>
      )}

      {/* sanity */}
      <h3 className="font-label text-[11px] uppercase tracking-widest text-[var(--t4)] mt-4 mb-1.5">{tl("Sanity checks")}</h3>
      {b.sanity.length === 0 ? (
        <div className="text-[13px] text-[var(--green)]">✓ {tl("No issues")}</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {b.sanity.map((issue) => (
            <li key={issue.code} className="text-[13px] text-[var(--red)]">
              ✗ {SANITY_TEXT[issue.code]?.[lang === "zh" ? "zh" : "en"](issue.values) ?? issue.code}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
