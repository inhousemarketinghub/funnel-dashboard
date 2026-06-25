"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { LANG_COOKIE, normalizeLang, type Lang } from "@/lib/i18n";

/**
 * Persist the viewer's language choice in the `dashboard_lang` cookie (server-side
 * write, so SSR renders the chosen language with no hydration flash). Called by the
 * header LanguageToggle, followed by router.refresh() on the client.
 */
export async function setLanguage(lang: Lang): Promise<void> {
  (await cookies()).set(LANG_COOKIE, normalizeLang(lang), {
    path: "/",
    maxAge: 31536000, // 1 year
    sameSite: "lax",
  });
}

/**
 * Force-refresh a client's Google Sheet data on demand (the "立即刷新数据" button).
 *
 * The sheet fetches in `lib/sheets.ts` are cached for 5 minutes and tagged with
 * `sheet:${sheetId}`. `updateTag` immediately expires that tag, so the next
 * render (triggered by the button's router.refresh()) re-pulls fresh data from
 * Google instead of serving stale cache — i.e. a single click shows the latest
 * numbers (read-your-own-writes), not stale-while-revalidate.
 *
 * `updateTag` can only run inside a Server Action, which this is.
 */
export async function refreshSheet(sheetId: string): Promise<void> {
  updateTag(`sheet:${sheetId}`);
}
