"use client";
import { useState, Fragment } from "react";
import { ChevronDown } from "lucide-react";
import type { KPIConfig } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { fmtRM } from "@/lib/utils";

export interface HistoryRow {
  month: string;
  target: { sales: number; ad_spend: number; cpa_pct: number; cpl: number } | null;
  actual: { sales: number; ad_spend: number; cpa_pct: number; cpl: number };
  changes: { id: string; effective_from: string; source: "save" | "backfill"; snapshot: KPIConfig }[];
}

const TD = "px-4 py-3 text-right num whitespace-nowrap";
const TH = "px-4 py-2 font-label text-[10px] uppercase tracking-wider text-[var(--t4)] whitespace-nowrap";

export function KpiHistoryClient({ rows, lang }: { rows: HistoryRow[]; lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null);
  const tgtAct = `${t(lang, "targetCol")} / ${t(lang, "actualCol")}`;

  return (
    <div>
      <h1 className="mb-1 font-heading text-2xl font-bold tracking-tight text-[var(--t1)]">{t(lang, "kpiHistory")}</h1>
      <p className="mb-6 text-[13px] text-[var(--t3)]">{tgtAct}</p>
      <div className="overflow-x-auto rounded-[12px] border border-[var(--border)] bg-[var(--bg2)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--bg3)]">
            <tr>
              <th className={`${TH} text-left`}>{t(lang, "monthCol")}</th>
              <th className={`${TH} text-right`}>Sales</th>
              <th className={`${TH} text-right`}>Ad Spend</th>
              <th className={`${TH} text-right`}>CPA%</th>
              <th className={`${TH} text-right`}>CPL</th>
              <th className={TH}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.month}>
                <tr className="border-t border-[var(--border)]">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--t1)] num">{r.month}</td>
                  <td className={TD}>{r.target ? fmtRM(r.target.sales) : "—"}<span className="text-[var(--t4)]"> / {fmtRM(r.actual.sales)}</span></td>
                  <td className={TD}>{r.target ? fmtRM(r.target.ad_spend) : "—"}<span className="text-[var(--t4)]"> / {fmtRM(r.actual.ad_spend)}</span></td>
                  <td className={TD}>{r.target ? `${r.target.cpa_pct.toFixed(1)}%` : "—"}<span className="text-[var(--t4)]"> / {r.actual.cpa_pct.toFixed(1)}%</span></td>
                  <td className={TD}>{r.target ? fmtRM(r.target.cpl) : "—"}<span className="text-[var(--t4)]"> / {fmtRM(r.actual.cpl)}</span></td>
                  <td className="px-4 py-3 text-right">
                    {r.changes.length > 0 && (
                      <button onClick={() => setOpen(open === r.month ? null : r.month)} className="text-[var(--t4)] transition-colors hover:text-[var(--t1)]" title={`${r.changes.length}`}>
                        <ChevronDown className={`h-4 w-4 transition-transform ${open === r.month ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </td>
                </tr>
                {open === r.month && (
                  <tr className="bg-[var(--bg3)]/40">
                    <td colSpan={6} className="px-4 py-2">
                      {r.changes.map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--border)] py-1.5 text-[12px] text-[var(--t2)] last:border-0">
                          <span className="num text-[var(--t3)]">{new Date(c.effective_from).toLocaleDateString()}</span>
                          {c.source === "backfill" && <span className="rounded-full bg-[var(--bg2)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
                          <span className="num">Sales {fmtRM(c.snapshot.sales)}</span>
                          <span className="num">Ad Spend {fmtRM(c.snapshot.ad_spend)}</span>
                          <span className="num">CPA% {c.snapshot.cpa_pct.toFixed(1)}%</span>
                          <span className="num">CPL {fmtRM(c.snapshot.cpl)}</span>
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
    </div>
  );
}
