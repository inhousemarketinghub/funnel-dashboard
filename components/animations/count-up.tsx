"use client";
import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1200,
  delay = 0,
  className = "",
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasRun = useRef(false);
  const [display, setDisplay] = useState(`${prefix}0${suffix}`);

  // When value changes AFTER initial animation, update instantly
  useEffect(() => {
    if (hasRun.current) {
      setDisplay(prefix + value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !hasRun.current) {
            hasRun.current = true;
            obs.unobserve(el);
            const start = performance.now();
            setTimeout(() => {
              function frame(now: number) {
                const elapsed = now - start - delay;
                if (elapsed < 0) { requestAnimationFrame(frame); return; }
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3.5);
                const current = value * eased;
                setDisplay(
                  prefix +
                  current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                  suffix
                );
                if (progress < 1) requestAnimationFrame(frame);
                else setDisplay(
                  prefix +
                  value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
                  suffix
                );
              }
              requestAnimationFrame(frame);
            }, delay);
          }
        });
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, prefix, suffix, decimals, duration, delay]);

  return <span ref={ref} className={`num ${className}`}>{display}</span>;
}
