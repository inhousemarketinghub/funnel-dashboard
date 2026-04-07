"use client";

import { useState, type ReactNode } from "react";

interface Props {
  tabs: string[];
  contents: ReactNode[];
}

export function ReportTabs({ tabs, contents }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (tabs.length <= 1) return <>{contents[0]}</>;

  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--border)] mb-8 no-print">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveIdx(i)}
            className={`text-[13px] font-medium pb-2 px-4 border-b-2 transition-colors ${
              activeIdx === i
                ? "border-[var(--blue)] text-[var(--t1)]"
                : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {contents.map((content, i) => (
        <div key={i} style={{ display: activeIdx === i ? "block" : "none" }}>
          {content}
        </div>
      ))}
    </div>
  );
}
