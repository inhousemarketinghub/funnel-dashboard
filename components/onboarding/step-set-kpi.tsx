"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingState, KPIConfig } from "@/lib/types";

interface KPIFieldDef {
  key: keyof KPIConfig;
  label: string;
  placeholder?: string;
}

interface KPIGroup {
  title: string;
  fields: KPIFieldDef[];
}

const KPI_GROUPS: KPIGroup[] = [
  {
    title: "Revenue",
    fields: [
      { key: "sales", label: "Monthly Sales", placeholder: "e.g. 50000" },
      { key: "orders", label: "Orders", placeholder: "e.g. 20" },
      { key: "aov", label: "AOV", placeholder: "e.g. 2500" },
    ],
  },
  {
    title: "Ad Performance",
    fields: [
      { key: "ad_spend", label: "Ad Spend", placeholder: "e.g. 5000" },
      { key: "daily_ad", label: "Daily Budget", placeholder: "e.g. 167" },
      { key: "cpl", label: "CPL", placeholder: "e.g. 25" },
      { key: "roas", label: "ROAS", placeholder: "e.g. 10" },
      { key: "cpa_pct", label: "CPA%", placeholder: "e.g. 10" },
    ],
  },
  {
    title: "Funnel Rates",
    fields: [
      { key: "respond_rate", label: "Respond Rate", placeholder: "e.g. 80" },
      { key: "appt_rate", label: "Appt Rate", placeholder: "e.g. 60" },
      { key: "showup_rate", label: "Show Up Rate", placeholder: "e.g. 80" },
      { key: "conv_rate", label: "Conv Rate", placeholder: "e.g. 30" },
    ],
  },
  {
    title: "Pipeline",
    fields: [
      { key: "target_contact", label: "Target Contacts", placeholder: "e.g. 200" },
      { key: "target_appt", label: "Target Appointments", placeholder: "e.g. 120" },
      { key: "target_showup", label: "Target Show Ups", placeholder: "e.g. 96" },
    ],
  },
];

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
  back: () => void;
}

export function StepSetKPI({ state, setState, next, back }: Props) {
  function handleChange(key: keyof KPIConfig, value: string) {
    const num = parseFloat(value);
    setState((s) => ({
      ...s,
      kpiConfig: {
        ...s.kpiConfig,
        [key]: isNaN(num) ? undefined : num,
      },
    }));
  }

  function handleSkip() {
    setState((s) => ({ ...s, kpiConfig: {} }));
    next();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">
          Set KPI Targets
        </h2>
        <p className="text-[13px] text-[var(--t3)]">
          Define monthly targets for this client. You can skip and set these later.
        </p>
      </div>

      {KPI_GROUPS.map((group) => (
        <div key={group.title}>
          <div
            className="font-label text-[11px] uppercase tracking-widest mb-3 pb-1 border-b"
            style={{ color: "var(--t3)", borderColor: "var(--border)" }}
          >
            {group.title}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {group.fields.map((field) => {
              const val = state.kpiConfig[field.key];
              return (
                <div
                  key={field.key}
                  className="card-base"
                  style={{ padding: "12px 14px" }}
                >
                  <div
                    className="font-label text-[10px] uppercase tracking-wide mb-2"
                    style={{ color: "var(--t3)" }}
                  >
                    {field.label}
                  </div>
                  <Input
                    type="number"
                    placeholder={field.placeholder ?? "—"}
                    value={val !== undefined ? String(val) : ""}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="border-[var(--border)] focus-visible:ring-[var(--blue)] num text-[14px] h-8 px-2"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Nav */}
      <div className="flex justify-between pt-2">
        <button type="button" onClick={back} className="topbar-btn">
          ← Back
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={handleSkip} className="topbar-btn">
            Skip
          </button>
          <Button
            onClick={next}
            className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
