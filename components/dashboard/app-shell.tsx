"use client";

import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Sidebar, type SidebarProps } from "./sidebar";

const COLLAPSE_KEY = "sidebar_collapsed";

/**
 * Desktop shell: owns the sidebar-collapsed state so the toggle can live at
 * the top-left of the CONTENT area, plus hover-peek: when collapsed, resting
 * the mouse on the icon rail floats the full sidebar OVER the content
 * (no reflow); leaving collapses it again. The pinned state is unchanged —
 * peek is transient. Enter/leave are debounced to avoid flicker, and an open
 * project-switcher menu holds the peek (the menu portals outside the aside,
 * so a naive mouseleave would yank its anchor away).
 */
export function AppShell({
  sidebar,
  children,
}: {
  sidebar: Omit<SidebarProps, "collapsed">;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read persisted state after mount (SSR always renders expanded).
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
    setPeek(false);
  }

  function handleEnter() {
    if (!collapsed) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    enterTimer.current = setTimeout(() => setPeek(true), 60);
  }
  function handleLeave() {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    leaveTimer.current = setTimeout(() => setPeek(false), 250);
  }

  const showExpanded = !collapsed || peek || switcherOpen;
  const overlaying = collapsed && showExpanded; // peeking over content

  return (
    <div className="md:flex">
      {/* Layout placeholder: keeps the rail's 64px footprint while the peeked
          sidebar overflows it and floats over the content. */}
      <div
        className="relative hidden shrink-0 transition-[width] duration-200 md:block"
        style={{ width: collapsed ? 64 : 232 }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <Sidebar
          {...sidebar}
          collapsed={!showExpanded}
          overlaying={overlaying}
          onSwitcherOpenChange={setSwitcherOpen}
        />
      </div>
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
        {/* Collapsed: the floating chip needs headroom at the TOP of the page
            (it was covering the page title before any scroll); once scrolling,
            gliding over content is the intended glass behavior. */}
        <div className={collapsed ? "md:pt-9" : ""}>{children}</div>
      </div>
    </div>
  );
}
