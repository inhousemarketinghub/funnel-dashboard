"use client";
import { useState, useMemo } from "react";
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
  { key: "ad_spend", label: "Ad Spend · Incl SST", kind: "rm" },
  { key: "sales", label: "Sales", kind: "rm" },
  { key: "orders", label: "Orders", kind: "count" },
  { key: "aov", label: "AOV", kind: "rm" },
  { key: "cpa_pct", label: "CPA %", kind: "pct" },
  { key: "cpl", label: "CPL · Incl SST", kind: "rm" },
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
// UTC ISO → Malaysia time (UTC+8), deterministic (no toLocale*; SSR-safe).
function toMYT(iso: string): { date: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}
function stamp(effective_from: string, source: string): string {
  const { date, time } = toMYT(effective_from);
  return source === "backfill" ? date : `${date} ${time}`;
}
function monthLabel(ym: string, lang: Lang): string {
  return lang === "zh" ? `${ym.slice(0, 4)} · ${ym.slice(5)}月` : ym;
}

export function KpiHistoryClient({ rows, dailyBudget, funnel, lang }: {
  rows: HistoryRow[]; dailyBudget: BudgetChange[]; funnel: "walkin" | "appointment"; lang: Lang;
}) {
  const [openKpi, setOpenKpi] = useState<Set<string>>(new Set());
  const [year, setYear] = useState<string>("all");
  const toggleKpi = (m: string) =>
    setOpenKpi((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      return next;
    });
  const cols: Col[] = [...COMMON, ...(funnel === "walkin" ? WALKIN_EXTRA : APPT_EXTRA), ROAS_COL];
  const changeWord = (n: number) => `${n} ${n === 1 ? t(lang, "changeOne") : t(lang, "changesSuffix")}`;

  const years = useMemo(() => {
    const ys = new Set<string>();
    rows.forEach((r) => ys.add(r.month.slice(0, 4)));
    dailyBudget.forEach((b) => ys.add(b.effective_from.slice(0, 4)));
    return [...ys].sort().reverse();
  }, [rows, dailyBudget]);

  const shownRows = year === "all" ? rows : rows.filter((r) => r.month.startsWith(year));
  const budgetByMonth = useMemo(() => {
    const groups = new Map<string, BudgetChange[]>();
    for (const b of dailyBudget) {
      if (year !== "all" && !b.effective_from.startsWith(year)) continue;
      const m = b.effective_from.slice(0, 7);
      (groups.get(m) ?? groups.set(m, []).get(m)!).push(b);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [dailyBudget, year]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
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

      {/* ── KPI: one collapsible row per month (collapsed by default to keep the page short) ── */}
      <div className="flex flex-col gap-2.5">
        {shownRows.map((r) => {
          const expanded = openKpi.has(r.month);
          return (
            <div key={r.month} className="overflow-hidden rounded-[12px] bg-[var(--bg2)] shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
              {/* collapsed header — always visible, toggles the month open */}
              <button onClick={() => toggleKpi(r.month)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[var(--bg3)]">
                <span className="min-w-[88px] font-heading text-[17px] font-semibold text-[var(--t1)]">{monthLabel(r.month, lang)}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">Sales</span>
                  <span className="num text-[14px] font-semibold text-[var(--t1)]">{fmt("rm", r.actual.sales)}</span>
                  <span className="num text-[12px] text-[var(--t4)]">/ {t(lang, "targetCol")} {r.target ? fmt("rm", r.target.sales) : "—"}</span>
                </span>
                <span className="ml-auto flex items-center gap-3">
                  {r.changes.length > 0 && (
                    <span className="rounded-full bg-[var(--bg3)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--t3)]">{changeWord(r.changes.length)}</span>
                  )}
                  <ChevronDown className={`h-4 w-4 text-[var(--t4)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                </span>
              </button>

              {expanded && (
                <div className="border-t border-[var(--border)] px-5 pb-5 pt-4">
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 md:grid-cols-4">
                    {cols.map((c) => (
                      <div key={c.key}>
                        <div className="font-label mb-1 text-[10px] uppercase tracking-wider text-[var(--t4)]">{c.label}</div>
                        <div className="num text-[15px] font-semibold text-[var(--t1)]">{fmt(c.kind, r.actual[c.key])}</div>
                        <div className="num text-[12px] text-[var(--t4)]">{r.target ? fmt(c.kind, r.target[c.key]) : "—"}</div>
                      </div>
                    ))}
                  </div>

                  {r.changes.length > 0 && (
                    <div className="mt-5 border-t border-[var(--border)] pt-4">
                      <div className="font-label mb-2 text-[10px] uppercase tracking-wider text-[var(--t4)]">{t(lang, "changesThisMonth")}</div>
                      {r.changes.map((c, idx) => (
                        <div key={c.id} className="border-b border-[var(--border)] py-2.5 last:border-0">
                          <div className="mb-2 flex items-center gap-2 text-[12px] text-[var(--t3)]">
                            <span className="num font-medium text-[var(--t2)]">#{idx + 1}</span>
                            <span className="num">{stamp(c.effective_from, c.source)}</span>
                            {c.source === "backfill" && <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
                            {cols.map((col) => (
                              <div key={col.key} className="flex items-baseline justify-between gap-2">
                                <span className="text-[11px] text-[var(--t4)]">{col.label}</span>
                                <span className="num text-[12px] font-medium text-[var(--t1)]">{fmt(col.kind, c.target[col.key])}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Daily budget, grouped by month ── */}
      <div className="mt-10">
        <h2 className="mb-4 font-heading text-[18px] font-semibold text-[var(--t1)]">{t(lang, "dailyBudgetHistory")}</h2>
        {budgetByMonth.length === 0 ? (
          <p className="text-[13px] text-[var(--t4)]">{t(lang, "noBudgetChanges")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {budgetByMonth.map(([m, changes]) => (
              <div key={m} className="card-base">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-heading text-[16px] font-semibold text-[var(--t1)]">{monthLabel(m, lang)}</span>
                  <span className="rounded-full bg-[var(--bg3)] px-3 py-1 text-[11px] font-medium text-[var(--t3)]">{changeWord(changes.length)}</span>
                </div>
                {changes.map((b) => {
                  const up = b.from !== null && b.daily_ad > b.from;
                  const delta = b.from !== null ? Math.abs(b.daily_ad - b.from) : 0;
                  return (
                    <div key={b.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[var(--border)] py-2.5 last:border-0">
                      <span className="num text-[16px] font-semibold text-[var(--t1)]">{fmtRM(b.daily_ad)}</span>
                      <span className="text-[11px] text-[var(--t4)]">{t(lang, "perDay")}</span>
                      {b.from !== null && (
                        <span className="num text-[12px] text-[var(--t3)]">
                          <span className="text-[var(--t4)]">{fmtRM(b.from)}</span> → <span className="font-medium text-[var(--t1)]">{fmtRM(b.daily_ad)}</span>
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[var(--t4)]">
                            {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{fmtRM(delta)}
                          </span>
                        </span>
                      )}
                      <span className="num ml-auto text-[12px] text-[var(--t3)]">{stamp(b.effective_from, b.source)}</span>
                      {b.source === "backfill" && <span className="text-[10px] text-[var(--t4)]">· {lang === "zh" ? "月度" : "monthly"}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
