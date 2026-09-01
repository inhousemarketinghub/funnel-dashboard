"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar, type SidebarProps } from "./sidebar";

const COLLAPSE_KEY = "sidebar_collapsed";

/**
 * Desktop shell: owns the sidebar-collapsed state so the toggle can live at
 * the top-left of the CONTENT area (the seam between sidebar and page).
 * The toggle — and, when collapsed, the client identity chip — sit in a
 * zero-height sticky rail, so they stay reachable no matter how far the page
 * scrolls. Glass backgrounds keep them legible over passing content.
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: Omit<SidebarProps, "collapsed">;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Read persisted state after mount (SSR always renders expanded).
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);
  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  return (
    <div className="md:flex">
      <Sidebar {...sidebar} collapsed={collapsed} />
      <div className="relative min-w-0 flex-1">
        {/* Sticky control rail: h-0 keeps page layout untouched; children float.
            print:hidden so /report printouts don't carry the chrome. */}
        <div className="sticky top-[3px] z-40 hidden h-0 md:block print:hidden pointer-events-none">
          <div className="flex items-center gap-2 px-2 pt-2">
            <button
              onClick={toggle}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--glass)] text-[var(--t4)] backdrop-blur-md transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            {collapsed && (
              <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--glass)] py-[3px] pl-[3px] pr-3 backdrop-blur-md">
                {sidebar.logoUrl ? (
                  <img src={sidebar.logoUrl} alt="" className="h-[22px] w-[22px] rounded-full bg-white object-contain p-[2px]" />
                ) : (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--sand)] font-heading text-[11px] font-semibold text-[var(--t2)]">
                    {sidebar.clientName.charAt(0)}
                  </span>
                )}
                <span className="max-w-[220px] truncate text-[12px] font-semibold text-[var(--t1)]">{sidebar.clientName}</span>
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
