"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Settings, Activity, Calculator,
  SlidersHorizontal, LayoutGrid, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Check,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import { t, type Lang } from "@/lib/i18n";

interface ProjectItem {
  id: string;
  name: string;
  logo_url?: string | null;
}

interface Props {
  clientId: string;
  clientName: string;
  logoUrl?: string | null;
  email?: string | null;
  canSettings: boolean;
  lang: Lang;
  projects: ProjectItem[];
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** exact: only highlight on exact path match (the overview root) */
  exact?: boolean;
}

const COLLAPSE_KEY = "sidebar_collapsed";

/**
 * Desktop-only left sidebar (ERP-style). Mobile keeps MobileNav untouched.
 * Colors ride the pre-existing --sidebar-* variables (theme-adaptive). The
 * brand block is a project quick-switcher; collapse state persists in
 * localStorage. Class `app-sidebar` is referenced by the print rules.
 */
export function Sidebar({ clientId, clientName, logoUrl, email, canSettings, lang, projects }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Read persisted state after mount (SSR always renders expanded).
  useEffect(() => {
    if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
  }, []);
  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  const dataItems: NavItem[] = [
    { href: `/${clientId}`, labelKey: "overviewTab", icon: LayoutDashboard, exact: true },
    { href: `/${clientId}/trends`, labelKey: "trends", icon: TrendingUp },
  ];
  const planningItems: NavItem[] = canSettings
    ? [{ href: `/${clientId}/projection`, labelKey: "adsProjection", icon: Calculator }]
    : [];
  const adminItems: NavItem[] = canSettings
    ? [
        { href: `/${clientId}/customization`, labelKey: "projectCustomization", icon: SlidersHorizontal },
        { href: `/${clientId}/diagnostics`, labelKey: "diagnostics", icon: Activity },
        { href: `/${clientId}/settings`, labelKey: "settings", icon: Settings },
      ]
    : [];

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  function renderItem(item: NavItem) {
    const active = isActive(item);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? t(lang, item.labelKey) : undefined}
        className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium no-underline transition-colors ${
          collapsed ? "justify-center px-0" : ""
        } ${
          active
            ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
            : "text-[var(--t2)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && t(lang, item.labelKey)}
      </Link>
    );
  }

  function groupLabel(key: string) {
    if (collapsed) return <div className="mt-4 mb-1 border-t border-[var(--sidebar-border)]" />;
    return (
      <div className="font-label px-3 pt-5 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--t4)]">
        {t(lang, key)}
      </div>
    );
  }

  const logoBlock = logoUrl ? (
    <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-[8px] border border-[var(--sidebar-border)] bg-white object-contain p-[3px]" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--sand)] font-heading text-[15px] font-semibold text-[var(--t2)]">
      {clientName.charAt(0)}
    </div>
  );

  return (
    <aside
      className={`app-sidebar hidden md:flex shrink-0 flex-col sticky top-[3px] h-[calc(100dvh-3px)] z-[90] bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] py-4 overflow-y-auto transition-[width] duration-200 ${
        collapsed ? "w-[64px] px-2" : "w-[232px] px-3"
      }`}
    >
      {/* Brand block = project quick-switcher dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-[var(--sidebar-accent)] ${
            collapsed ? "justify-center px-0" : ""
          }`}
          title={collapsed ? clientName : undefined}
        >
          {logoBlock}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight text-[var(--sidebar-foreground)]">{clientName}</div>
                <div className="font-label text-[9px] uppercase tracking-widest text-[var(--t4)]">Performance Tracker</div>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--t4)]" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[210px]">
          {projects.map((p) => (
            <DropdownMenuItem
              key={p.id}
              className="flex items-center gap-2.5 text-[13px]"
              onClick={() => router.push(`/${p.id}`)}
            >
              {p.logo_url ? (
                <img src={p.logo_url} alt="" className="h-5 w-5 rounded-[4px] bg-white object-contain" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[var(--sand)] text-[10px] font-semibold text-[var(--t2)]">
                  {p.name.charAt(0)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.id === clientId && <Check className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Nav groups */}
      {groupLabel("navData")}
      <nav className="flex flex-col gap-0.5">{dataItems.map(renderItem)}</nav>
      {planningItems.length > 0 && (
        <>
          {groupLabel("navPlanning")}
          <nav className="flex flex-col gap-0.5">{planningItems.map(renderItem)}</nav>
        </>
      )}
      {adminItems.length > 0 && (
        <>
          {groupLabel("navAdmin")}
          <nav className="flex flex-col gap-0.5">{adminItems.map(renderItem)}</nav>
        </>
      )}

      <div className="flex-1" />

      {/* Bottom: overview of all projects, toggles, identity, collapse */}
      <div className={`flex flex-col gap-2 border-t border-[var(--sidebar-border)] pt-3 ${collapsed ? "items-center" : ""}`}>
        <Link
          href="/projects"
          title={collapsed ? t(lang, "projectOverview") : undefined}
          className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--t2)] no-underline transition-colors hover:bg-[var(--sidebar-accent)] ${
            collapsed ? "justify-center px-0 w-full" : ""
          }`}
        >
          <LayoutGrid className="h-4 w-4 shrink-0" />
          {!collapsed && t(lang, "projectOverview")}
        </Link>
        {!collapsed && (
          <>
            <div className="flex items-center gap-2 px-3">
              <LanguageToggle lang={lang} />
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between gap-2 px-3 pb-1">
              <span className="num min-w-0 truncate text-[10px] text-[var(--t4)]">{email}</span>
              <LogoutButton lang={lang} />
            </div>
          </>
        )}
        <button
          onClick={toggleCollapsed}
          className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[12px] text-[var(--t4)] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--t1)] ${
            collapsed ? "justify-center px-0 w-full" : ""
          }`}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && (lang === "zh" ? "收起侧栏" : "Collapse")}
        </button>
      </div>
    </aside>
  );
}
