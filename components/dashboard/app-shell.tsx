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
        {/* Collapsed sidebar hides the client name — surface it at the top of
            the content area (the spot the owner marked) so you always know
            which project you're looking at. */}
        {collapsed && (
          <div className="absolute left-11 top-2 z-40 hidden md:flex h-7 items-center text-[13px] font-semibold text-[var(--t1)]">
            {sidebar.clientName}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
