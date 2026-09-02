import { t, type Lang } from "@/lib/i18n";
import type { ChangeItem } from "@/lib/report-audit";

/**
 * ⚠「本月数据在报告生成后有更新」(PRD §3 审计留痕). Server-renderable:
 * a <details> disclosure, no client JS. Renders nothing when the month has
 * no post-snapshot changes. The list wraps — never truncates (house rule).
 */
export function DataChangedBadge({ changes, lang }: { changes: ChangeItem[]; lang: Lang }) {
  if (changes.length === 0) return null;
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 rounded-full bg-[var(--yellow)]/15 px-3 py-1 text-[12px] font-medium text-[var(--yellow)]">
        ⚠ {t(lang, "dataChangedSinceReport")}
      </summary>
      <div className="absolute left-0 z-30 mt-2 w-[360px] max-w-[88vw] rounded-lg border border-[var(--border)] bg-[var(--bg2)] p-3 shadow-lg">
        <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--t4)]">
          {t(lang, "changeList")} · {changes.length}
        </div>
        <ul className="flex max-h-[300px] flex-col gap-1 overflow-y-auto text-[12.5px] text-[var(--t2)]">
          {changes.map((c, i) => (
            <li key={i}>
              {c.metric_date}
              {c.brand ? ` · ${c.brand}` : ""} · {c.metric}: {c.old_value ?? "—"} → {c.new_value ?? "—"}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
