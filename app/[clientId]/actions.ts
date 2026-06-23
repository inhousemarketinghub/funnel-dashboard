"use server";

import { updateTag } from "next/cache";

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
