"use client";
import { useEffect, useRef } from "react";

export function SplitText({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";
    text.split("").forEach((ch, i) => {
      const span = document.createElement("span");
      span.style.display = "inline-block";
      span.style.opacity = "0";
      span.style.transform = "translateY(8px)";
      span.style.transition = `opacity 500ms ease ${200 + i * 40}ms, transform 500ms ease ${200 + i * 40}ms`;
      span.textContent = ch === " " ? "\u00A0" : ch;
      el.appendChild(span);
    });
    requestAnimationFrame(() => {
      el.querySelectorAll("span").forEach((s) => {
        s.style.opacity = "1";
        s.style.transform = "translateY(0)";
      });
    });
  }, [text]);

  return <h1 ref={ref} className={`font-heading text-[32px] font-semibold tracking-tight leading-[1.15] text-[var(--t1)] ${className}`} />;
}
