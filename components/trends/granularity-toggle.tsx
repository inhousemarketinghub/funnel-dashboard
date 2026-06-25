"use client";

import type { Granularity } from "@/lib/dates";
import { t, type Lang } from "@/lib/i18n";

interface Props {
  value: Granularity;
  onChange: (next: Granularity) => void;
  pending?: boolean;
  lang?: Lang;
}

export function GranularityToggle({ value, onChange, pending = false, lang = "en" }: Props) {
  const options: { key: Granularity; label: string }[] = [
    { key: "monthly", label: t(lang, "monthlyGran") },
    { key: "weekly", label: t(lang, "weeklyGran") },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg2)] p-[3px] ${
        pending ? "opacity-60 pointer-events-none" : ""
      }`}
      role="group"
      aria-label="Granularity"
    >
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => !active && onChange(opt.key)}
            className={`px-4 py-1.5 text-[12px] font-medium rounded-full transition-colors cursor-pointer ${
              active
                ? "bg-[var(--bg)] text-[var(--t1)] shadow-sm"
                : "text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
