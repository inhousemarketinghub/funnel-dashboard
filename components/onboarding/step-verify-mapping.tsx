"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState, ColumnMapping } from "@/lib/types";

interface FieldDef {
  key: string;
  label: string;
  hiddenForWalkin?: boolean;
}

const PERFORMANCE_FIELDS: FieldDef[] = [
  { key: "date", label: "Date" },
  { key: "ad_spend", label: "Ad Spend" },
  { key: "inquiry", label: "Inquiry" },
  { key: "contact", label: "Contact" },
  { key: "appointment", label: "Appointment", hiddenForWalkin: true },
  { key: "showup", label: "Show Up", hiddenForWalkin: true },
  { key: "orders", label: "Orders" },
  { key: "sales", label: "Sales" },
];

const LEAD_FIELDS: FieldDef[] = [
  { key: "person", label: "Person" },
  { key: "appointment_date", label: "Appointment Date" },
  { key: "sales_person", label: "Sales Person" },
  { key: "showed_up", label: "Showed Up" },
  { key: "purchase_date", label: "Purchase Date" },
  { key: "sales_amount", label: "Sales Amount" },
  { key: "brand", label: "Brand" },
];

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
  back: () => void;
}

export function StepVerifyMapping({ state, setState, next, back }: Props) {
  const isWalkin = state.scanResult?.funnelType === "walkin";

  const [perfMap, setPerfMap] = useState<Record<string, string>>(() => {
    const existing = state.columnMapping?.performance ?? {};
    return Object.fromEntries(
      PERFORMANCE_FIELDS.map((f) => [f.key, existing[f.key] ?? ""])
    );
  });

  const [leadMap, setLeadMap] = useState<Record<string, string>>(() => {
    const existing = state.columnMapping?.lead ?? {};
    return Object.fromEntries(
      LEAD_FIELDS.map((f) => [f.key, existing[f.key] ?? ""])
    );
  });

  function handleSkip() {
    setState((s) => ({ ...s, columnMapping: null }));
    next();
  }

  function handleConfirm() {
    const mapping: ColumnMapping = {
      performance: Object.fromEntries(
        Object.entries(perfMap).filter(([, v]) => v.trim() !== "")
      ),
      lead: Object.fromEntries(
        Object.entries(leadMap).filter(([, v]) => v.trim() !== "")
      ),
    };
    setState((s) => ({ ...s, columnMapping: mapping }));
    next();
  }

  const visiblePerfFields = PERFORMANCE_FIELDS.filter(
    (f) => !(isWalkin && f.hiddenForWalkin)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">
          Verify Column Mapping
        </h2>
        <p className="text-[13px] text-[var(--t3)]">
          Confirm or adjust auto-detected column names from your sheet.
        </p>
      </div>

      {/* Info box */}
      <div
        className="p-3 rounded-[8px] border text-[12px]"
        style={{
          borderColor: "var(--blue)",
          background: "var(--blue-bg)",
          color: "var(--blue)",
        }}
      >
        Column mapping is optional — you can skip this step and the dashboard will
        use default column names. Fill in only if your sheet uses custom names.
      </div>

      {/* Performance Tracker Section */}
      <div>
        <div
          className="font-label text-[11px] uppercase tracking-widest mb-3 pb-1 border-b"
          style={{ color: "var(--t3)", borderColor: "var(--border)" }}
        >
          Performance Tracker
        </div>
        <div className="space-y-2">
          {visiblePerfFields.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <Label
                className="text-[12px] min-w-[140px] shrink-0"
                style={{ color: "var(--t2)" }}
              >
                {f.label}
              </Label>
              <div className="flex-1 relative">
                <Input
                  placeholder="Auto-detected"
                  value={perfMap[f.key]}
                  onChange={(e) =>
                    setPerfMap((m) => ({ ...m, [f.key]: e.target.value }))
                  }
                  className="border-[var(--border)] focus-visible:ring-[var(--blue)] text-sm pr-7"
                />
                {perfMap[f.key].trim() && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px]"
                    style={{ color: "var(--green)" }}
                  >
                    ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Tracker Section */}
      <div>
        <div
          className="font-label text-[11px] uppercase tracking-widest mb-3 pb-1 border-b"
          style={{ color: "var(--t3)", borderColor: "var(--border)" }}
        >
          Lead Tracker
        </div>
        <div className="space-y-2">
          {LEAD_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <Label
                className="text-[12px] min-w-[140px] shrink-0"
                style={{ color: "var(--t2)" }}
              >
                {f.label}
              </Label>
              <div className="flex-1 relative">
                <Input
                  placeholder="Auto-detected"
                  value={leadMap[f.key]}
                  onChange={(e) =>
                    setLeadMap((m) => ({ ...m, [f.key]: e.target.value }))
                  }
                  className="border-[var(--border)] focus-visible:ring-[var(--blue)] text-sm pr-7"
                />
                {leadMap[f.key].trim() && (
                  <span
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px]"
                    style={{ color: "var(--green)" }}
                  >
                    ✓
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

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
            onClick={handleConfirm}
            className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
          >
            Confirm & Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
