"use client";
import { useState, useMemo, Fragment } from "react";
import { ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import { fmtRM } from "@/lib/utils";

export interface MetricSet {
  ad_spend: number; sales: number; orders: number; aov: number; cpa_pct: number;
  cpl: number; conv_rate: number; respond_rate: number; appt_rate: number; showup_rate: number; roas: number;
}
export interface HistoryRow {
  month: string;
  target: MetricSet | null;
  actual: MetricSet;
  changes: { id: string; effective_from: string; source: "save" | "backfill"; target: MetricSet; prev: MetricSet | null }[];
}
export interface BudgetChange {
  id: string; effective_from: string; source: "save" | "backfill"; daily_ad: number; from: number | null;
}

type Kind = "rm" | "pct" | "count" | "roas";
interface Col { key: keyof MetricSet; label: string; kind: Kind }

const COMMON: Col[] = [
  { key: "ad_spend", label: "Ad Spend (Incl SST)", kind: "rm" },
  { key: "sales", label: "Sales", kind: "rm" },
  { key: "orders", label: "Orders", kind: "count" },
  { key: "aov", label: "AOV", kind: "rm" },
  { key: "cpa_pct", label: "CPA%", kind: "pct" },
  { key: "cpl", label: "CPL (Incl SST)", kind: "rm" },
  { key: "conv_rate", label: "Conv Rate", kind: "pct" },
];
const WALKIN_EXTRA: Col[] = [{ key: "respond_rate", label: "Visit Rate", kind: "pct" }];
const APPT_EXTRA: Col[] = [
  { key: "respond_rate", label: "Respond Rate", kind: "pct" },
  { key: "appt_rate", label: "Appt Rate", kind: "pct" },
  { key: "showup_rate", label: "Show Up Rate", kind: "pct" },
];
const ROAS_COL: Col = { key: "roas", label: "ROAS", kind: "roas" };

function fmt(kind: Kind, v: number): string {
  if (kind === "rm") return fmtRM(v);
  if (kind === "pct") return `${v.toFixed(1)}%`;
  if (kind === "roas") return `${v.toFixed(1)}x`;
  return String(Math.round(v));
}

export function KpiHistoryClient({ rows, dailyBudget, funnel, lang }: {
  rows: HistoryRow[]; dailyBudget: BudgetChange[]; funnel: "walkin" | "appointment"; lang: Lang;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [year, setYear] = useState<string>("all");
  const cols: Col[] = [...COMMON, ...(funnel === "walkin" ? WALKIN_EXTRA : APPT_EXTRA), ROAS_COL];

  const years = useMemo(() => [...new Set(rows.map((r) => r.month.slice(0, 4)))].sort().reverse(), [rows]);
  const shown = year === "all" ? rows : rows.filter((r) => r.month.startsWith(year));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight text-[var(--t1)]">{t(lang, "kpiHistory")}</h1>
          <p className="text-[12px] text-[var(--t4)]">{t(lang, "tgtActLegend")}</p>
        </div>
        {years.length >= 1 && (
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="h-9 rounded-full border border-[var(--border)] bg-[var(--bg2)] px-4 text-[12px] font-medium text-[var(--t2)] outline-none transition-colors hover:bg-[var(--bg3)]">
            <option value="all">{t(lang, "allYears")}</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-[var(--border)] bg-[var(--bg2)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--bg3)]">
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--bg3)] px-4 py-2 text-left font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">{t(lang, "monthCol")}</th>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-4 py-2 text-right font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">{c.label}</th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Fragment key={r.month}>
                <tr className="border-t border-[var(--border)]">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-[var(--bg2)] px-4 py-3 font-medium text-[var(--t1)] num">{r.month}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-4 py-3 text-right num">
                      <div className="font-medium text-[var(--t1)]">{r.target ? fmt(c.kind, r.target[c.key]) : "—"}</div>
                      <div className="text-[var(--t4)]">{fmt(c.kind, r.actual[c.key])}</div>
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right">
                    {r.changes.length > 0 && (
                      <button onClick={() => setOpen(open === r.month ? null : r.month)}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-[var(--t3)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)]">
                        {r.changes.length}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open === r.month ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </td>
                </tr>
                {open === r.month && (
                  <tr className="bg-[var(--bg3)]/40">
                    <td colSpan={cols.length + 2} className="px-4 py-3">
                      <div className="mb-2 font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">
                        {t(lang, "changesThisMonth")} · {r.changes.length}
                      </div>
                      {r.changes.map((c, idx) => {
                        const changed = cols.filter((col) => c.prev === null || c.prev[col.key] !== c.target[col.key]);
                        return (
                          <div key={c.id} className="border-b border-[var(--border)] py-2 last:border-0">
                            <div className="mb-1 flex items-center gap-2 text-[12px] text-[var(--t3)]">
                              <span className="num font-medium text-[var(--t2)]">#{idx + 1}</span>
                              <span className="num">{c.effective_from.slice(0, 10)}</span>
                              {c.source === "backfill" && <span className="rounded-full bg-[var(--bg2)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
                            </div>
                            {c.prev === null ? (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[var(--t2)]">
                                <span className="text-[var(--t4)]">{t(lang, "initialSet")}:</span>
                                {cols.map((col) => <span key={col.key} className="num">{col.label} {fmt(col.kind, c.target[col.key])}</span>)}
                              </div>
                            ) : changed.length === 0 ? (
                              <span className="text-[12px] text-[var(--t4)]">{t(lang, "noChangeThisRow")}</span>
                            ) : (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[var(--t2)]">
                                {changed.map((col) => (
                                  <span key={col.key} className="num">
                                    {col.label}: <span className="text-[var(--t4)]">{fmt(col.kind, c.prev![col.key])}</span> → <span className="font-medium text-[var(--t1)]">{fmt(col.kind, c.target[col.key])}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily budget change log — a clean vertical timeline, separate from the rows. */}
      <div className="mt-8">
        <h2 className="mb-4 font-heading text-[18px] font-semibold text-[var(--t1)]">{t(lang, "dailyBudgetHistory")}</h2>
        {dailyBudget.length === 0 ? (
          <p className="text-[13px] text-[var(--t4)]">{t(lang, "noBudgetChanges")}</p>
        ) : (
          <div className="relative">
            {dailyBudget.map((b, i) => {
              const up = b.from !== null && b.daily_ad > b.from;
              const down = b.from !== null && b.daily_ad < b.from;
              const delta = b.from !== null ? Math.abs(b.daily_ad - b.from) : 0;
              const last = i === dailyBudget.length - 1;
              return (
                <div key={b.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                  {/* rail */}
                  <div className="relative flex w-3 flex-shrink-0 justify-center pt-1.5">
                    <span className={`z-10 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-[var(--blue)]" : "bg-[var(--t4)]"}`} />
                    {!last && <span className="absolute top-3 bottom-[-24px] w-px bg-[var(--border)]" />}
                  </div>
                  {/* content */}
                  <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-heading text-[18px] font-semibold text-[var(--t1)] num">{fmtRM(b.daily_ad)}</span>
                    <span className="text-[12px] text-[var(--t4)]">{t(lang, "perDay")}</span>
                    {(up || down) && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--bg3)] px-2 py-0.5 text-[11px] font-medium text-[var(--t3)]">
                        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {fmtRM(delta)}
                      </span>
                    )}
                    <span className="num ml-auto text-[12px] text-[var(--t3)]">{b.effective_from.slice(0, 10)}</span>
                    {b.source === "backfill" && <span className="text-[10px] text-[var(--t4)]">· {lang === "zh" ? "月度" : "monthly"}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
