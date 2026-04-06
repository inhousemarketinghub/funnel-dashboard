"use client";
import { useState, type ReactNode } from "react";

export function Accordion({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={open ? "accordion-open" : ""} onClick={() => setOpen(!open)}>
      {children}
      <span
        className="accordion-hint"
        style={{
          position: "absolute",
          bottom: 8,
          right: 12,
        }}
      >
        &#9662;
      </span>
    </div>
  );
}

export function AccordionDetail({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`accordion-detail ${className}`}>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 14 }}>
        {children}
      </div>
    </div>
  );
}
