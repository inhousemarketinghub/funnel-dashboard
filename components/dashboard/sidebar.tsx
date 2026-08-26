"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Settings, Activity, ArrowLeftRight } from "lucide-react";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import { t, type Lang } from "@/lib/i18n";

interface Props {
  clientId: string;
  clientName: string;
  logoUrl?: string | null;
  email?: string | null;
  canSettings: boolean;
  lang: Lang;
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
 * Colors ride the pre-existing --sidebar-* variables, so it follows the
 * light/dark theme automatically. Class `app-sidebar` is referenced by the
 * print rules in globals.css.
 */
export function Sidebar({ clientId, clientName, logoUrl, email, canSettings, lang }: Props) {
  const pathname = usePathname();

  const dataItems: NavItem[] = [
    { href: `/${clientId}`, labelKey: "overviewTab", icon: LayoutDashboard, exact: true },
    { href: `/${clientId}/trends`, labelKey: "trends", icon: TrendingUp },
  ];
  const adminItems: NavItem[] = canSettings
    ? [
        { href: `/${clientId}/settings`, labelKey: "settings", icon: Settings },
        { href: `/${clientId}/diagnostics`, labelKey: "diagnostics", icon: Activity },
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
        className={`flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium no-underline transition-colors ${
          active
            ? "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]"
            : "text-[var(--t2)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {t(lang, item.labelKey)}
      </Link>
    );
  }

  function groupLabel(key: string) {
    return (
      <div className="font-label px-3 pt-5 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--t4)]">
        {t(lang, key)}
      </div>
    );
  }

  return (
    <aside className="app-sidebar hidden md:flex w-[232px] shrink-0 flex-col sticky top-[3px] h-[calc(100dvh-3px)] z-[90] bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] px-3 py-4 overflow-y-auto">
      {/* Brand block: client identity, links back to overview */}
      <Link href={`/${clientId}`} className="flex items-center gap-3 rounded-[10px] px-2 py-2 no-underline hover:bg-[var(--sidebar-accent)] transition-colors">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-10 w-10 rounded-[8px] bg-white object-contain p-[3px] border border-[var(--sidebar-border)]" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[var(--sand)] font-heading text-[16px] font-semibold text-[var(--t2)]">
            {clientName.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight text-[var(--sidebar-foreground)]">{clientName}</div>
          <div className="font-label text-[9px] uppercase tracking-widest text-[var(--t4)]">Performance Tracker</div>
        </div>
      </Link>

      {/* Nav groups */}
      {groupLabel("navData")}
      <nav className="flex flex-col gap-0.5">{dataItems.map(renderItem)}</nav>
      {adminItems.length > 0 && (
        <>
          {groupLabel("navAdmin")}
          <nav className="flex flex-col gap-0.5">{adminItems.map(renderItem)}</nav>
        </>
      )}

      <div className="flex-1" />

      {/* Bottom: client switcher, toggles, identity */}
      <div className="flex flex-col gap-2 border-t border-[var(--sidebar-border)] pt-3">
        <Link
          href="/projects"
          className="flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--t2)] no-underline transition-colors hover:bg-[var(--sidebar-accent)]"
        >
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
          {t(lang, "switchClient")}
        </Link>
        <div className="flex items-center gap-2 px-3">
          <LanguageToggle lang={lang} />
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-2 px-3 pb-1">
          <span className="num min-w-0 truncate text-[10px] text-[var(--t4)]">{email}</span>
          <LogoutButton lang={lang} />
        </div>
      </div>
    </aside>
  );
}
