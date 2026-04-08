"use client";

export interface MetricOption {
  key: string;
  label: string;
  group: "Frontend" | "Midend" | "Backend";
  unit: "currency" | "percent" | "number";
  color: string;
}

export const METRIC_OPTIONS: MetricOption[] = [
  // Frontend
  { key: "ad_spend", label: "Ad Spend", group: "Frontend", unit: "currency", color: "#1B4F9B" },
  { key: "cpl", label: "CPL", group: "Frontend", unit: "currency", color: "#6366F1" },
  // Midend
  { key: "respond_rate", label: "Respond Rate", group: "Midend", unit: "percent", color: "#D97706" },
  { key: "appt_rate", label: "Appt Rate", group: "Midend", unit: "percent", color: "#EA580C" },
  { key: "showup_rate", label: "Show Up Rate", group: "Midend", unit: "percent", color: "#DC2626" },
  // Backend
  { key: "sales", label: "Sales", group: "Backend", unit: "currency", color: "#16A34A" },
  { key: "orders", label: "Orders", group: "Backend", unit: "number", color: "#0D9488" },
  { key: "conv_rate", label: "Conv Rate", group: "Backend", unit: "percent", color: "#7C3AED" },
  { key: "aov", label: "AOV", group: "Backend", unit: "currency", color: "#BE185D" },
  { key: "cpa_pct", label: "CPA%", group: "Backend", unit: "percent", color: "#78716C" },
];

const GROUPS: ("Frontend" | "Midend" | "Backend")[] = ["Frontend", "Midend", "Backend"];

interface MetricSelectorProps {
  selected: string[];
  onChange: (keys: string[]) => void;
  maxSelect?: number;
}

export function MetricSelector({ selected, onChange, maxSelect = 5 }: MetricSelectorProps) {
  const atMax = selected.length >= maxSelect;

  function toggle(key: string) {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else if (!atMax) {
      onChange([...selected, key]);
    }
  }

  return (
    <div className="flex flex-wrap gap-4">
      {GROUPS.map((group) => {
        const options = METRIC_OPTIONS.filter((m) => m.group === group);
        return (
          <div key={group} className="flex flex-col gap-[6px]">
            <span className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)]">{group}</span>
            <div className="flex flex-wrap gap-[6px]">
              {options.map((opt) => {
                const isSelected = selected.includes(opt.key);
                const isDisabled = !isSelected && atMax;
                return (
                  <button
                    key={opt.key}
                    onClick={() => toggle(opt.key)}
                    disabled={isDisabled}
                    style={
                      isSelected
                        ? { backgroundColor: opt.color, borderColor: opt.color, color: "#fff" }
                        : { backgroundColor: "transparent", borderColor: "var(--border)", color: "var(--t2)" }
                    }
                    className={[
                      "px-3 py-[5px] rounded-full border text-[12px] font-label transition-all",
                      isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
