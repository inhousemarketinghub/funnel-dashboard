export function MoMBadge({ value, inverted }: { value: number | null; inverted: boolean }) {
  if (value === null) return <span className="text-[13px] text-[var(--t4)] num">N/A</span>;
  const isGood = inverted ? value < 0 : value > 0;
  const cls = isGood ? "chg chg-up" : "chg chg-dn";
  const sign = value > 0 ? "+" : "";
  return <span className={cls}>{sign}{value.toFixed(1)}%</span>;
}

export const INVERTED_METRICS = new Set(["cpl", "cpa_pct"]);
