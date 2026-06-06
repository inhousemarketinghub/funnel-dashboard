"use client";

export interface MetricOption {
  key: string;
  label: string;
  group: "Frontend" | "Midend" | "Backend";
  unit: "currency" | "percent" | "number";
  color: string;
}

// Muted earth-tone palette — distinct enough to overlay, harmonised with the Anthropic skin.
export const METRIC_OPTIONS: MetricOption[] = [
  // Frontend
  { key: "ad_spend", label: "Ad Spend", group: "Frontend", unit: "currency", color: "#C15F3C" },
  { key: "cpl", label: "CPL", group: "Frontend", unit: "currency", color: "#5F6BA6" },
  // Midend
  { key: "respond_rate", label: "Respond Rate", group: "Midend", unit: "percent", color: "#C9952F" },
  { key: "appt_rate", label: "Appt Rate", group: "Midend", unit: "percent", color: "#B0683F" },
  { key: "showup_rate", label: "Show Up Rate", group: "Midend", unit: "percent", color: "#A23A2C" },
  // Backend
  { key: "sales", label: "Sales", group: "Backend", unit: "currency", color: "#5E7A4F" },
  { key: "orders", label: "Orders", group: "Backend", unit: "number", color: "#4F8077" },
  { key: "conv_rate", label: "Conv Rate", group: "Backend", unit: "percent", color: "#7E5EA0" },
  { key: "aov", label: "AOV", group: "Backend", unit: "currency", color: "#A65779" },
  { key: "cpa_pct", label: "CPA%", group: "Backend", unit: "percent", color: "#8A8073" },
];


/**
 * Walk-in funnels skip the appointment / show-up stage (orders convert from contact = visit).
 * Hide appt_rate + showup_rate; rename respond_rate → "Visit Rate".
 */
export function getMetricOptionsForFunnel(funnelType: string): MetricOption[] {
  const isWalkin = funnelType === "walkin";
  if (!isWalkin) return METRIC_OPTIONS;
  return METRIC_OPTIONS
    .filter((opt) => opt.key !== "appt_rate" && opt.key !== "showup_rate")
    .map((opt) => (opt.key === "respond_rate" ? { ...opt, label: "Visit Rate" } : opt));
}

const GROUPS: ("Frontend" | "Midend" | "Backend")[] = ["Frontend", "Midend", "Backend"];

interface MetricSelectorProps {
  selected: string[];
  onChange: (keys: string[]) => void;
  maxSelect?: number;
  funnelType?: string;
}

export function MetricSelector({ selected, onChange, maxSelect = 5, funnelType = "appointment" }: MetricSelectorProps) {
  const atMax = selected.length >= maxSelect;
  const visibleOptions = getMetricOptionsForFunnel(funnelType);

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
        const options = visibleOptions.filter((m) => m.group === group);
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
