"use client";

import { useState } from "react";

interface Props {
  tabs: string[];
  children: (activeTab: string) => React.ReactNode;
}

export function ReportTabs({ tabs, children }: Props) {
  const [active, setActive] = useState(tabs[0] || "");

  if (tabs.length <= 1) return <>{children(tabs[0] || "")}</>;

  return (
    <div>
      {/* Tab bar — sticky below topbar */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-8 no-print">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`text-[13px] font-medium pb-2 px-4 border-b-2 transition-colors ${
              active === tab
                ? "border-[var(--blue)] text-[var(--t1)]"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  );
}
