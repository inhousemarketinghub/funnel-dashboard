import type { InsightGroup } from "@/lib/types";
import { BlurText } from "@/components/animations/blur-text";

interface Props {
  insights: InsightGroup;
}

const CARDS: { category: keyof Omit<InsightGroup, "labels">; labelKey: keyof InsightGroup["labels"]; color: string; bg: string }[] = [
  { category: "topPerformers", labelKey: "topPerformer", color: "var(--green)", bg: "var(--green-bg)" },
  { category: "needsAttention", labelKey: "needsAttention", color: "var(--red)", bg: "var(--red-bg)" },
  { category: "paceForecast", labelKey: "paceForecast", color: "var(--blue)", bg: "var(--blue-bg)" },
];

export function SummaryCards({ insights }: Props) {
  return (
    <>
      {CARDS.map(({ category, labelKey, color, bg }) => (
        <div
          key={category}
          className="stagger-child card-base"
          style={{ borderLeft: `4px solid ${color}`, background: `linear-gradient(90deg, ${bg} 0%, transparent 8%)`, transform: "translateY(20px)", transition: "opacity 700ms ease, transform 700ms ease" }}
        >
          <BlurText>
            <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t3)] mb-2">
              {insights.labels[labelKey]}
            </div>
          </BlurText>
          {insights[category].map((insight, i) => (
            <div key={i} className="text-[13px] text-[var(--t1)] mb-1 leading-[1.6]">
              <span style={{ color }}>●</span>{" "}
              {insight.message}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
