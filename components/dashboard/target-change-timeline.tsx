"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { versionsInRange, effectiveVersionAsOf, diffSnapshots } from "@/lib/kpi-history";
import type { KpiTargetVersion } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { fmtRM } from "@/lib/utils";

const RM_KEYS = new Set(["sales", "aov", "cpl", "ad_spend", "daily_ad"]);
function fmtVal(key: string, v: number | null) {
  if (v === null) return "—";
  if (RM_KEYS.has(key)) return fmtRM(v);
  if (key === "roas") return `${v.toFixed(1)}x`;
  if (key.endsWith("_rate") || key === "cpa_pct") return `${v.toFixed(1)}%`;
  return String(Math.round(v));
}

export function TargetChangeTimeline({ versions, rangeStart, rangeEnd, lang }: {
  versions: KpiTargetVersion[]; rangeStart: string; rangeEnd: string; lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const start = new Date(rangeStart);
  const inRange = versionsInRange(versions, start, new Date(rangeEnd));
  // Baseline = the target in effect at the start of the range (not shown as a row;
  // used to diff the first in-range change against the prior value).
  const baseline = effectiveVersionAsOf(versions, start)?.snapshot ?? null;

  return (
    <div className="mt-4 rounded-[10px] border border-[var(--border)] bg-[var(--bg2)]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium text-[var(--t2)]">
        {t(lang, "targetChanges")} ({inRange.length})
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {inRange.length === 0 ? (
            <p className="text-[12px] text-[var(--t4)]">{t(lang, "noTargetChanges")}</p>
          ) : inRange.map((v, i) => {
            const prev = i === 0 ? baseline : inRange[i - 1].snapshot;
            const diffs = diffSnapshots(prev, v.snapshot);
            return (
              <div key={v.id} className="border-b border-[var(--border)] py-2 last:border-0">
                <div className="flex items-center gap-2 text-[12px] text-[var(--t3)]">
                  <span className="num">{v.effective_from.slice(0, 10)}</span>
                  {v.source === "backfill" && <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[var(--t2)]">
                  {diffs.length === 0 ? <span className="text-[var(--t4)]">—</span> : diffs.map((d) => (
                    <span key={String(d.key)} className="num">{String(d.key)}: {fmtVal(String(d.key), d.from)} → {fmtVal(String(d.key), d.to)}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
