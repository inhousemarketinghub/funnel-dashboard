"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ThemeToggle } from "./theme-toggle";
import { LogoutButton } from "./logout-button";

interface Props {
  clientId: string;
  clientName: string;
  logoUrl?: string | null;
  email?: string | null;
  canSettings: boolean;
}

const ITEM =
  "block text-[14px] px-2.5 py-2 rounded-md text-[var(--t1)] hover:bg-[var(--bg3)] transition-colors no-underline";

/**
 * Compact mobile-only top bar: client identity on the left, a hamburger menu on
 * the right that collapses all the desktop topbar actions (Summary / Trends /
 * Settings / theme / sign out). Replaces the desktop topbar below md, which
 * eliminates the cramped, overlapping wrapped bar.
 */
export function MobileNav({ clientId, clientName, logoUrl, email, canSettings }: Props) {
  return (
    <div
      className="md:hidden sticky top-[3px] z-[101] flex h-[52px] items-center justify-between gap-2 px-4"
      style={{
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="h-7 w-7 flex-shrink-0 rounded-[6px] bg-white object-contain p-[2px]"
          />
        )}
        <span className="truncate font-heading text-[16px] font-semibold text-[var(--t1)]">
          {clientName}
        </span>
      </div>

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
            <Link href={`/${clientId}`} className={ITEM}>Summary</Link>
            <Link href={`/${clientId}/trends`} className={ITEM}>Trends</Link>
            {canSettings && (
              <Link href={`/${clientId}/settings`} className={ITEM}>Settings</Link>
            )}
            <Link href="/projects" className={ITEM}>Project Overview</Link>

            <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] px-2.5 pt-2">
              <span className="text-[13px] text-[var(--t3)]">Theme</span>
              <ThemeToggle />
            </div>

            <div className="mt-1 border-t border-[var(--border)] px-2.5 pt-2">
              {email && (
                <div className="num mb-1 truncate text-[11px] text-[var(--t4)]">{email}</div>
              )}
              <LogoutButton />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
