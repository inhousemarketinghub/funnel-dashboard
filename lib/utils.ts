import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtRM(v: number): string {
  return `RM${v.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  return `${v.toFixed(1)}%`;
}

export function fmtROAS(v: number): string {
  return `${v.toFixed(1)}x`;
}

export function pct(numerator: number, denominator: number): number {
  return denominator ? (numerator / denominator) * 100 : 0;
}

export function momPct(current: number, previous: number): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

export function achEmoji(p: number): string {
  if (p >= 100) return "●";
  if (p >= 80) return "◐";
  return "○";
}

export function achLabel(p: number): string {
  if (p >= 100) return "ACHIEVED";
  if (p >= 80) return "CLOSE";
  return "MISSED";
}

export function kpiColorClass(tmRaw: number | null, kpiRaw: number | null, inverted: boolean): string {
  if (tmRaw === null || kpiRaw === null) return "";
  if (inverted) {
    if (tmRaw <= kpiRaw) return "text-[var(--blue)]";
    if (tmRaw <= kpiRaw * 1.15) return "text-[var(--yellow)]";
    return "text-[var(--red)]";
  }
  if (tmRaw >= kpiRaw) return "text-[var(--blue)]";
  if (tmRaw >= kpiRaw * 0.85) return "text-[var(--yellow)]";
  return "text-[var(--red)]";
}
