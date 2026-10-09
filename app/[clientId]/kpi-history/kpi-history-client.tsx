"use client";
import { useState, Fragment } from "react";
import { ChevronDown } from "lucide-react";
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
  changes: { id: string; effective_from: string; source: "save" | "backfill"; target: MetricSet }[];
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
  const cols: Col[] = [...COMMON, ...(funnel === "walkin" ? WALKIN_EXTRA : APPT_EXTRA), ROAS_COL];

  return (
    <div>
      <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight text-[var(--t1)]">{t(lang, "kpiHistory")}</h1>
      <p className="mb-5 text-[12px] text-[var(--t4)]">{t(lang, "tgtActLegend")}</p>

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
            {rows.map((r) => (
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
                      <button onClick={() => setOpen(open === r.month ? null : r.month)} className="text-[var(--t4)] transition-colors hover:text-[var(--t1)]" title={String(r.changes.length)}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${open === r.month ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </td>
                </tr>
                {open === r.month && (
                  <tr className="bg-[var(--bg3)]/40">
                    <td colSpan={cols.length + 2} className="px-4 py-3">
                      <div className="mb-2 font-label text-[10px] uppercase tracking-wider text-[var(--t4)]">{t(lang, "changesThisMonth")}</div>
                      {r.changes.map((c) => (
                        <div key={c.id} className="border-b border-[var(--border)] py-2 last:border-0">
                          <div className="mb-1 flex items-center gap-2 text-[12px] text-[var(--t3)]">
                            <span className="num">{c.effective_from.slice(0, 10)}</span>
                            {c.source === "backfill" && <span className="rounded-full bg-[var(--bg2)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[var(--t2)]">
                            {cols.map((col) => (
                              <span key={col.key} className="num">{col.label}: {fmt(col.kind, c.target[col.key])}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily budget change log — separate from the per-month target rows. */}
      <div className="mt-8">
        <h2 className="mb-3 font-heading text-[17px] font-semibold text-[var(--t1)]">{t(lang, "dailyBudgetHistory")}</h2>
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg2)] p-4">
          {dailyBudget.length === 0 ? (
            <p className="text-[12px] text-[var(--t4)]">{t(lang, "noBudgetChanges")}</p>
          ) : (
            dailyBudget.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border)] py-2 text-[13px] last:border-0">
                <span className="num w-[90px] text-[var(--t3)]">{b.effective_from.slice(0, 10)}</span>
                <span className="num font-medium text-[var(--t1)]">{fmtRM(b.daily_ad)}{t(lang, "perDay")}</span>
                {b.from !== null && b.from !== b.daily_ad && (
                  <span className="num text-[12px] text-[var(--t4)]">({fmtRM(b.from)} → {fmtRM(b.daily_ad)})</span>
                )}
                {b.source === "backfill" && <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
