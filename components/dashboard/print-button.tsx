"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="topbar-btn no-print"
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50 }}
    >
      Export PDF
    </button>
  );
}
