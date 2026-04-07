"use client";
import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}

export function ScrollReveal({ children, className = "", delay = 0, threshold = 0.1 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => {
              el.style.opacity = "1";
              el.style.transform = "translateY(0)";
            }, delay);
            obs.unobserve(el);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -30px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay, threshold]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: "translateY(10px)",
        transition: "opacity 600ms ease, transform 600ms ease",
      }}
    >
      {children}
    </div>
  );
}
