"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { TopLevelSidebar, type TopLevelSidebarProps } from "./top-level-sidebar";

const COLLAPSE_KEY = "sidebar_collapsed";

/**
 * Desktop shell for the top-level (workspace) pages. Mirrors AppShell — same
 * collapse toggle, same hover-peek-over-content behavior, same persisted
 * COLLAPSE_KEY so the sidebar stays collapsed/expanded consistently whether
 * you're at the workspace level or inside a client. No project switcher here,
 * so the peek logic is simpler (no menu to hold it open).
 */
export function WorkspaceAppShell({
  sidebar,
  children,
}: {
  sidebar: Omit<TopLevelSidebarProps, "collapsed">;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [peek, setPeek] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showExpanded = !collapsed || peek;
  const overlaying = collapsed && showExpanded;

  return (
    <div className="md:flex">
      <div
        className="relative hidden shrink-0 transition-[width] duration-200 md:block"
        style={{ width: collapsed ? 64 : 232 }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <TopLevelSidebar {...sidebar} collapsed={!showExpanded} overlaying={overlaying} />
      </div>
      <div className="relative min-w-0 flex-1">
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
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--t1)] text-[var(--bg)]">
                  <LayoutGrid className="h-[13px] w-[13px]" />
                </span>
                <span className="max-w-[220px] truncate text-[12px] font-semibold text-[var(--t1)]">Performance Tracker</span>
              </div>
            )}
          </div>
        </div>
        <div className={collapsed ? "md:pt-9" : ""}>{children}</div>
      </div>
    </div>
  );
}
