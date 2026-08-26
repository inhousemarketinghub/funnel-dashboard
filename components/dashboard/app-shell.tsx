"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar, type SidebarProps } from "./sidebar";

const COLLAPSE_KEY = "sidebar_collapsed";

/**
 * Desktop shell: owns the sidebar-collapsed state so the toggle can live at
 * the top-left of the CONTENT area (the seam between sidebar and page —
 * where the owner asked for it), outside the sidebar itself.
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
        {/* Collapse toggle at the sidebar/content seam, top-left */}
        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute left-2 top-2 z-40 hidden md:flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--t4)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
        {/* Collapsed sidebar hides the client identity — surface logo + name
            above the page title, inside the SAME container as the page content
            so it left-aligns with "Performance Overview" exactly. */}
        {collapsed && (
          <div className="hidden md:block">
            <div className="mx-auto flex max-w-[1280px] items-center gap-2.5 px-4 pt-6 sm:px-8">
              {sidebar.logoUrl ? (
                <img src={sidebar.logoUrl} alt="" className="h-7 w-7 rounded-[6px] border border-[var(--border)] bg-white object-contain p-[2px]" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[var(--sand)] font-heading text-[13px] font-semibold text-[var(--t2)]">
                  {sidebar.clientName.charAt(0)}
                </span>
              )}
              <span className="text-[14px] font-semibold text-[var(--t1)]">{sidebar.clientName}</span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
