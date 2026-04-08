"use client";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  staggerMs?: number;
  threshold?: number;
}

export function Stagger({ children, className = "", staggerMs = 60, threshold = 0.08 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const items = el.children;
            for (let i = 0; i < items.length; i++) {
              const child = items[i] as HTMLElement;
              setTimeout(() => {
                child.style.opacity = "1";
                child.style.transform = "translateY(0)";
              }, i * staggerMs);
            }
            obs.unobserve(el);
          }
        });
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [staggerMs, threshold]);

  return (
    <div ref={ref} className={className}>
      <style>{`
        .stagger-child {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 800ms cubic-bezier(0.215, 0.61, 0.355, 1), transform 800ms cubic-bezier(0.215, 0.61, 0.355, 1);
        }
      `}</style>
      {children}
    </div>
  );
}
