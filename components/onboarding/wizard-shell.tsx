"use client";

import { useState, type ReactNode } from "react";
import type { OnboardingState, MemberRole } from "@/lib/types";

interface WizardShellProps {
  children: (props: {
    state: OnboardingState;
    setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
    next: () => void;
    back: () => void;
  }) => ReactNode;
}

const STEPS = [
  "Basic Info",
  "Connect Sheet",
  "Verify Mapping",
  "Set KPI",
  "Invite Team",
];

const initialState: OnboardingState = {
  step: 1,
  name: "",
  industry: "",
  logoFile: null,
  sheetId: "",
  scanResult: null,
  columnMapping: null,
  kpiConfig: {},
  invites: [],
};

export function WizardShell({ children }: WizardShellProps) {
  const [state, setState] = useState<OnboardingState>(initialState);

  function next() {
    setState((s) => ({ ...s, step: Math.min(s.step + 1, STEPS.length) }));
  }

  function back() {
    setState((s) => ({ ...s, step: Math.max(s.step - 1, 1) }));
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      {/* Bauhaus stripe */}
      <div
        className="bauhaus-stripe"
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }}
      >
        <div />
        <div />
        <div />
        <div />
      </div>

      {/* Progress bar */}
      <div className="pt-8 pb-0 px-6 flex justify-center">
        <div className="w-full max-w-2xl mt-6">
          <div className="flex items-center">
            {STEPS.map((label, idx) => {
              const stepNum = idx + 1;
              const isActive = state.step === stepNum;
              const isCompleted = state.step > stepNum;

              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  {/* Step circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold transition-all duration-300"
                      style={{
                        background: isCompleted
                          ? "var(--blue)"
                          : isActive
                          ? "var(--blue)"
                          : "var(--bg3)",
                        color: isCompleted || isActive ? "#fff" : "var(--t4)",
                        border: isActive
                          ? "2px solid var(--blue)"
                          : isCompleted
                          ? "2px solid var(--blue)"
                          : "2px solid var(--border)",
                      }}
                    >
                      {isCompleted ? "✓" : stepNum}
                    </div>
                    <span
                      className="font-label text-[10px] uppercase tracking-wide mt-1 whitespace-nowrap"
                      style={{
                        color: isActive
                          ? "var(--blue)"
                          : isCompleted
                          ? "var(--t2)"
                          : "var(--t4)",
                      }}
                    >
                      {label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {idx < STEPS.length - 1 && (
                    <div
                      className="flex-1 h-[2px] mx-2 mb-5 transition-all duration-300"
                      style={{
                        background:
                          state.step > stepNum ? "var(--blue)" : "var(--border)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex justify-center px-4 py-6">
        <div className="card-base w-full max-w-2xl" style={{ padding: 28 }}>
          {children({ state, setState, next, back })}
        </div>
      </div>
    </div>
  );
}
