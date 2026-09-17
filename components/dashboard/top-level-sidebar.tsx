"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShieldCheck, PlusCircle } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";
import { t, type Lang } from "@/lib/i18n";

export interface TopLevelSidebarProps {
  email?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  lang: Lang;
  unread: number;
  canManageAccess: boolean;
  canCreate: boolean;
  collapsed: boolean;
  overlaying?: boolean;
}

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

/**
 * Workspace-level sidebar for the top-level pages (Overview / Access / Team /
 * Account). Deliberately mirrors the client Sidebar's look (same --sidebar-*
 * tokens, same collapse-fade geometry) so switching between the two levels
 * feels like one product. Class `app-sidebar` hooks the print rules.
 */
export function TopLevelSidebar({
  email, userName, userAvatar, lang, unread, canManageAccess, canCreate, collapsed, overlaying = false,
}: TopLevelSidebarProps) {
  const pathname = usePathname();
  const fade = "whitespace-nowrap transition-opacity duration-150 " + (collapsed ? "opacity-0" : "opacity-100 delay-100");

  const items: NavItem[] = [
    { href: "/projects", labelKey: "projectOverview", icon: LayoutGrid, exact: true },
    ...(canManageAccess ? [{ href: "/projects/access", labelKey: "manageAccessNav", icon: ShieldCheck }] : []),
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

  const accountActive = pathname === "/account";

  return (
    <aside
      className={`app-sidebar hidden md:flex flex-col sticky top-[3px] h-[calc(100dvh-3px)] bg-[var(--sidebar)] border-r border-[var(--sidebar-border)] py-4 px-3 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ease-out ${
        overlaying ? "z-50 shadow-[8px_0_32px_rgba(0,0,0,0.14)]" : "z-30"
      } ${collapsed ? "w-[64px]" : "w-[232px]"}`}
    >
      <div className="flex w-[208px] shrink-0 grow flex-col">
        {/* Workspace brand */}
        <div className="mb-1 flex items-center gap-3 rounded-[10px] py-2 pl-1 pr-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--t1)] text-[var(--bg)]">
            <LayoutGrid className="h-[18px] w-[18px]" />
          </div>
          <div className={`min-w-0 flex-1 ${fade}`}>
            <div className="truncate text-[13px] font-semibold leading-tight text-[var(--sidebar-foreground)]">Performance Tracker</div>
            <div className="font-label text-[9px] uppercase tracking-widest text-[var(--t4)]">{t(lang, "workspaceLabel")}</div>
          </div>
        </div>

        <NotificationBell lang={lang} initialUnread={unread} variant="nav" collapsed={collapsed} />

        <nav className="mt-2 flex flex-col gap-0.5">
          {items.map(renderItem)}
        </nav>

        {canCreate && (
          <Link
            href="/projects/new"
            title={collapsed ? t(lang, "newClientNav") : undefined}
            className="mt-1 flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-[13px] font-medium text-[var(--t2)] no-underline transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className={fade}>{t(lang, "newClientNav")}</span>
          </Link>
        )}

        <div className="flex-1" />

        {/* Bottom: toggles + account chip + logout (mirrors client sidebar) */}
        <div className="flex flex-col gap-2 border-t border-[var(--sidebar-border)] pt-3">
          <div className={`${fade} ${collapsed ? "pointer-events-none" : ""}`}>
            <div className="flex items-center gap-2 px-3">
              <LanguageToggle lang={lang} />
              <ThemeToggle />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 px-1 pb-1">
              <Link
                href="/account"
                title={email ?? t(lang, "myAccount")}
                className={`flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-2 py-1.5 no-underline transition-colors ${
                  accountActive ? "bg-[var(--sidebar-accent)]" : "hover:bg-[var(--sidebar-accent)]"
                }`}
              >
                {userAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userAvatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sand)] text-[11px] font-semibold text-[var(--t2)]">
                    {(userName || email || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--t2)]">{userName || email}</span>
              </Link>
              <LogoutButton lang={lang} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
