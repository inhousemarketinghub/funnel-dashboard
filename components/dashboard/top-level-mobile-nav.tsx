"use client";

import Link from "next/link";
import { LayoutGrid, Menu } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { LogoutButton } from "./logout-button";
import { t, type Lang } from "@/lib/i18n";

interface Props {
  email?: string | null;
  lang: Lang;
  unread: number;
  canManageAccess: boolean;
  canCreate: boolean;
}

const ITEM =
  "block text-[14px] px-2.5 py-2 rounded-md text-[var(--t1)] hover:bg-[var(--bg3)] transition-colors no-underline";

/** Mobile top bar for the workspace-level pages — the top-level twin of MobileNav. */
export function TopLevelMobileNav({ email, lang, unread, canManageAccess, canCreate }: Props) {
  return (
    <div
      className="md:hidden sticky top-[3px] z-[101] flex h-[52px] items-center justify-between gap-2 px-4"
      style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <Link href="/projects" className="flex min-w-0 items-center gap-2 no-underline">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[6px] bg-[var(--t1)] text-[var(--bg)]">
          <LayoutGrid className="h-4 w-4" />
        </span>
        <span className="truncate font-heading text-[16px] font-semibold text-[var(--t1)]">Performance Tracker</span>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-1">
        <NotificationBell lang={lang} initialUnread={unread} variant="icon" />
        <Popover>
          <PopoverTrigger
            render={
              <button
                aria-label="Menu"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] text-[var(--t2)] hover:bg-[var(--bg3)] transition-colors cursor-pointer"
              >
                <Menu className="h-5 w-5" />
              </button>
            }
          />
          <PopoverContent align="end" sideOffset={6} className="w-52 p-1.5">
            <div className="flex flex-col gap-0.5">
              <Link href="/projects" className={ITEM}>{t(lang, "projectOverview")}</Link>
              {canManageAccess && <Link href="/projects/access" className={ITEM}>{t(lang, "manageAccessNav")}</Link>}
              {canCreate && <Link href="/projects/new" className={ITEM}>{t(lang, "newClientNav")}</Link>}
              <Link href="/account" className={ITEM}>{t(lang, "myAccount")}</Link>

              <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] px-2.5 pt-2">
                <span className="text-[13px] text-[var(--t3)]">{t(lang, "theme")}</span>
                <div className="flex items-center gap-2">
                  <LanguageToggle lang={lang} />
                  <ThemeToggle />
                </div>
              </div>

              <div className="mt-1 border-t border-[var(--border)] px-2.5 pt-2">
                {email && <div className="num mb-1 truncate text-[11px] text-[var(--t4)]">{email}</div>}
                <LogoutButton lang={lang} />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
