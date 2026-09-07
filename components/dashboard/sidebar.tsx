"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, TrendingUp, Settings, Activity, Calculator,
  SlidersHorizontal, LayoutGrid, ChevronsUpDown, Check,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MonthPickerDialog } from "./month-picker-dialog";
import { NotificationBell } from "./notification-bell";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import { t, type Lang } from "@/lib/i18n";

interface ProjectItem {
  id: string;
  name: string;
  logo_url?: string | null;
}

export interface SidebarProps {
  clientId: string;
  clientName: string;
  logoUrl?: string | null;
  email?: string | null;
  features: string[];
  lang: Lang;
  projects: ProjectItem[];
  collapsed: boolean;
  unread: number;
  /** Peek mode: floating over content (shadow + higher z), width owned by wrapper */
  overlaying?: boolean;
  onSwitcherOpenChange?: (open: boolean) => void;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** exact: only highlight on exact path match (the overview root) */
  exact?: boolean;
}

/**
 * Desktop-only left sidebar (ERP-style). Mobile keeps MobileNav untouched.
 * Colors ride the pre-existing --sidebar-* variables (theme-adaptive). The
 * brand block is a project quick-switcher; collapse state persists in
 * localStorage. Class `app-sidebar` is referenced by the print rules.
 */
export function Sidebar({ clientId, clientName, logoUrl, email, features, lang, projects, collapsed, unread, overlaying = false, onSwitcherOpenChange }: SidebarProps) {
  const can = (k: string) => features.includes(k);
  const pathname = usePathname();
  const router = useRouter();
  // Fixed-geometry reveal: the inner column is ALWAYS laid out at full width;
  // the aside's animated width just clips it. Labels fade so nothing pops.
  const fade = "whitespace-nowrap transition-opacity duration-150 " + (collapsed ? "opacity-0" : "opacity-100 delay-100");

  const dataItems: NavItem[] = [
    { href: `/${clientId}`, labelKey: "overviewTab", icon: LayoutDashboard, exact: true },
    ...(can("view_trends") ? [{ href: `/${clientId}/trends`, labelKey: "trends", icon: TrendingUp }] : []),
  ];
  const planningItems: NavItem[] = can("view_projection")
    ? [{ href: `/${clientId}/projection`, labelKey: "adsProjection", icon: Calculator }]
    : [];
  const adminItems: NavItem[] = [
    ...(can("edit_customization") ? [{ href: `/${clientId}/customization`, labelKey: "projectCustomization", icon: SlidersHorizontal }] : []),
    ...(can("view_diagnostics") ? [{ href: `/${clientId}/diagnostics`, labelKey: "diagnostics", icon: Activity }] : []),
  ];

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
          active
            ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
            : "text-[var(--t2)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className={fade}>{t(lang, item.labelKey)}</span>
      </Link>
    );
  }

  function groupLabel(key: string) {
    return (
      <div className={`font-label px-3 pt-5 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--t4)] ${fade}`}>
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
      className={`app-sidebar hidden md:flex flex-col sticky top-[3px] h-[calc(100dvh-3px)] bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] py-4 px-3 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out ${
        overlaying ? "z-50 shadow-[8px_0_32px_rgba(0,0,0,0.14)]" : "z-30"
      } ${
        collapsed ? "w-[64px]" : "w-[232px]"
      }`}
    >
      {/* Inner column laid out at FULL width regardless of aside width — the
          width animation is pure clipping, so nothing reflows frame-to-frame */}
      <div className="flex w-[208px] shrink-0 grow flex-col">
      {/* Project Overview — top exit, above the brand block */}
      <Link
        href="/projects"
        title={collapsed ? t(lang, "projectOverview") : undefined}
        className="mb-2 flex items-center gap-2.5 rounded-[8px] px-3 py-1.5 text-[12px] text-[var(--t4)] no-underline transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--t1)]"
      >
        <LayoutGrid className="h-4 w-4 shrink-0" />
        <span className={fade}>{t(lang, "projectOverview")}</span>
      </Link>

      {/* Brand block = project quick-switcher dropdown */}
      <DropdownMenu onOpenChange={onSwitcherOpenChange}>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-3 rounded-[10px] py-2 pl-1 pr-2 text-left transition-colors hover:bg-[var(--sidebar-accent)]"
          title={collapsed ? clientName : undefined}
        >
          {logoBlock}
          <div className={`min-w-0 flex-1 ${fade}`}>
            <div className="truncate text-[13px] font-semibold leading-tight text-[var(--sidebar-foreground)]">{clientName}</div>
            <div className="font-label text-[9px] uppercase tracking-widest text-[var(--t4)]">Performance Tracker</div>
          </div>
          <ChevronsUpDown className={`h-3.5 w-3.5 shrink-0 text-[var(--t4)] ${fade}`} />
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

      {/* 通知中心: daily health digests (bell + unread dot) */}
      <NotificationBell lang={lang} initialUnread={unread} variant="nav" collapsed={collapsed} />

      {/* Nav groups */}
      {groupLabel("navData")}
      <nav className="flex flex-col gap-0.5">
        {dataItems.map(renderItem)}
        {can("view_report") && <MonthPickerDialog clientId={clientId} lang={lang} variant="nav" collapsed={collapsed} />}
      </nav>
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
      <div className="flex flex-col gap-2 border-t border-[var(--sidebar-border)] pt-3">
        {can("edit_settings") && (
          <Link
            href={`/${clientId}/settings`}
            title={collapsed ? t(lang, "settings") : undefined}
            className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium no-underline transition-colors ${
              pathname.startsWith(`/${clientId}/settings`)
                ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
                : "text-[var(--t2)] hover:bg-[var(--sidebar-accent)]"
            }`}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className={fade}>{t(lang, "settings")}</span>
          </Link>
        )}
        <div className={`${fade} ${collapsed ? "pointer-events-none" : ""}`}>
          <div className="flex items-center gap-2 px-3">
            <LanguageToggle lang={lang} />
            <ThemeToggle />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-3 pb-1">
            <span className="num min-w-0 truncate text-[10px] text-[var(--t4)]">{email}</span>
            <LogoutButton lang={lang} />
          </div>
        </div>
      </div>
      </div>
    </aside>
  );
}
