"use client";
import { useEffect, useRef } from "react";

interface TextPart {
  text: string;
  accent?: boolean;
}

interface SplitTextProps {
  text: string;
  parts?: TextPart[];
  className?: string;
}

export function SplitText({ text, parts, className = "" }: SplitTextProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";

    let charIndex = 0;

    if (parts && parts.length > 0) {
      // Multi-part mode: supports accent colors and line breaks
      parts.forEach((part) => {
        if (part.text === "\n") {
          el.appendChild(document.createElement("br"));
          return;
        }
        part.text.split("").forEach((ch) => {
          const span = document.createElement("span");
          span.style.display = "inline-block";
          span.style.opacity = "0";
          span.style.transform = "translateY(8px)";
          span.style.transition = `opacity 500ms ease ${200 + charIndex * 40}ms, transform 500ms ease ${200 + charIndex * 40}ms`;
          span.textContent = ch === " " ? "\u00A0" : ch;
          if (part.accent) span.style.color = "var(--red)";
          el.appendChild(span);
          charIndex++;
        });
      });
    } else {
      // Simple mode: single text string
      text.split("").forEach((ch) => {
        const span = document.createElement("span");
        span.style.display = "inline-block";
        span.style.opacity = "0";
        span.style.transform = "translateY(8px)";
        span.style.transition = `opacity 500ms ease ${200 + charIndex * 40}ms, transform 500ms ease ${200 + charIndex * 40}ms`;
        span.textContent = ch === " " ? "\u00A0" : ch;
        el.appendChild(span);
        charIndex++;
      });
    }

    requestAnimationFrame(() => {
      el.querySelectorAll("span").forEach((s) => {
        (s as HTMLElement).style.opacity = "1";
        (s as HTMLElement).style.transform = "translateY(0)";
      });
    });
  }, [text, parts]);

  return <h1 ref={ref} className={`font-heading text-[32px] font-semibold tracking-tight leading-[1.15] text-[var(--t1)] ${className}`} />;
}
