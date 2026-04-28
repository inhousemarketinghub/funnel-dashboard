import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { DailyMetric, Lead, KPIConfig } from "./types";

const API_KEY = process.env.GOOGLE_SHEETS_API_KEY || "";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// ── Google Sheets API helpers ──────────────────────────────────

interface SheetTab {
  name: string;
  hidden: boolean;
  gid: number;
}

// React `cache()` dedupes calls within a single Server Component render.
// Cross-request caching still flows through Next.js fetch with revalidate: 300.
// Combined effect: same (sheetId) request → 1 actual API call, even if 5
// callers ask. Critical for Dashboard where 5+ fetch helpers each used to
// independently call listSheetTabs.
export const listSheetTabs = cache(async (sheetId: string): Promise<SheetTab[]> => {
  const url = `${SHEETS_API}/${sheetId}?key=${API_KEY}&fields=sheets.properties`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to list tabs: ${res.status}`);
  const data = await res.json();
  return (data.sheets || []).map((s: { properties: { title: string; hidden?: boolean; sheetId: number } }) => ({
    name: s.properties.title,
    hidden: s.properties.hidden || false,
    gid: s.properties.sheetId,
  }));
});

// Cross-request cache for parsed sheet data. unstable_cache stores the FULL
// parsed result (including JSON.parse output), so subsequent calls within
// 5 minutes skip both network AND JSON parsing — critical for big sheets
// like Lead & Sales Tracker where JSON.parse alone costs 200-400ms.
const fetchSheetDataCached = unstable_cache(
  async (sheetId: string, tabName: string): Promise<string[][]> => {
    const url = `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(tabName)}?key=${API_KEY}&valueRenderOption=FORMATTED_VALUE`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Failed to fetch tab "${tabName}": ${res.status}`);
    const data = await res.json();
    return data.values || [];
  },
  ["sheet-data-v1"],
  { revalidate: 300 },
);

// Per-request dedup wrapper. Combined with unstable_cache:
// - Same render multiple callers → 1 Promise (React cache)
// - Across renders within 5 min → cached result (unstable_cache)
export const fetchSheetData = cache(async (sheetId: string, tabName: string): Promise<string[][]> => {
  const __t = Date.now();
  const rows = await fetchSheetDataCached(sheetId, tabName);
  // [PERF DIAG] temporary
  console.log(`[PERF SHEET] tab="${tabName}" ${Date.now() - __t}ms rows=${rows.length}`);
  return rows;
});

// ── Tab auto-discovery ─────────────────────────────────────────

async function findTab(sheetId: string, includes: string[], excludes: string[] = []): Promise<string | null> {
  const tabs = await listSheetTabs(sheetId);
  const match = tabs.find((t) =>
    includes.every((kw) => t.name.toLowerCase().includes(kw.toLowerCase())) &&
    !excludes.some((kw) => t.name.toLowerCase().includes(kw.toLowerCase()))
  );
  return match?.name ?? null;
}

async function findPerformanceTab(sheetId: string, brandName?: string): Promise<string | null> {
  if (brandName) {
    const tabs = await listSheetTabs(sheetId);
    const exact = tabs.find((t) => t.name.toLowerCase() === `performance tracker@${brandName.toLowerCase()}`);
    if (exact) return exact.name;
  }
  return findTab(sheetId, ["performance tracker"], ["filter"]);
}

async function findLeadSalesTab(sheetId: string): Promise<string | null> {
  return findTab(sheetId, ["lead"], ["filter"]);
}

async function findKPITab(sheetId: string): Promise<string | null> {
  return findTab(sheetId, ["kpi"]);
}

// ── Value parsers ──────────────────────────────────────────────

function parseRM(val: string | undefined): number {
  if (!val || val.trim() === "") return 0;
  const v = val.replace(/[^\d.\-]/g, "");
  return parseFloat(v) || 0;
}

function parseInt2(val: string | undefined): number {
  if (!val || val.trim() === "") return 0;
  return parseInt(val.replace(/[^\d]/g, ""), 10) || 0;
}

function parsePercent(val: string | undefined): number {
  if (!val || val.trim() === "") return 0;
  return parseFloat(val.replace(/[^\d.\-]/g, "")) || 0;
}

function parseDate(val: string | undefined): Date | null {
  if (!val || val.trim() === "") return null;
  val = val.trim();
  const parts = val.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  let d = +parts[0], m = +parts[1] - 1, y = +parts[2];
  let date = new Date(y, m, d);
  if (!isNaN(date.getTime()) && date.getFullYear() > 2000) return date;
  y = +parts[0]; m = +parts[1] - 1; d = +parts[2];
  date = new Date(y, m, d);
  if (!isNaN(date.getTime()) && date.getFullYear() > 2000) return date;
  return null;
}

// ── CSV parser (kept for tests) ────────────────────────────────

/** RFC 4180-compliant CSV line parser that preserves empty fields */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) { result.push(""); break; }
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === '"') {
          if (j + 1 < line.length && line[j + 1] === '"') { j += 2; continue; }
          break;
        }
        j++;
      }
      result.push(line.slice(i + 1, j).replace(/""/g, '"'));
      i = j + 2;
    } else {
      const next = line.indexOf(",", i);
      if (next === -1) { result.push(line.slice(i)); break; }
      result.push(line.slice(i, next));
      i = next + 1;
    }
  }
  return result;
}

// ── Header-based column detection ──────────────────────────────

interface PerfColumnMap {
  date: number;
  adSpend: number;
  inquiry: number;
  contact: number;
  appointment: number | null;
  showup: number | null;
  orders: number;
  sales: number;
}

function findCol(headers: string[], keywords: string[], exclude: string[] = []): number | null {
  for (let ci = 0; ci < headers.length; ci++) {
    const h = (headers[ci] || "").toLowerCase().replace(/\n/g, " ");
    if (keywords.some((kw) => h.includes(kw)) && !exclude.some((ex) => h.includes(ex))) {
      return ci;
    }
  }
  return null;
}

function detectPerfColumns(rows: string[][]): PerfColumnMap {
  // Merge first 3 rows to build a flat header (some headers span multiple rows)
  const merged: string[] = [];
  for (let ci = 0; ci < 30; ci++) {
    const parts: string[] = [];
    for (let ri = 0; ri < Math.min(3, rows.length); ri++) {
      if (rows[ri]?.[ci]?.trim()) parts.push(rows[ri][ci].trim());
    }
    merged[ci] = parts.join(" ").toLowerCase();
  }

  return {
    date: findCol(merged, ["date"]) ?? 0,
    adSpend: findCol(merged, ["taxed ad spend"]) ?? 1,
    inquiry: findCol(merged, ["pm"]) ?? 5,
    contact: findCol(merged, ["contact", "showroom", "visit"], ["rate"]) ?? 7,
    appointment: findCol(merged, ["appointment"], ["rate", "tracker"]),
    showup: findCol(merged, ["showed up", "show up"], ["rate"]),
    orders: findCol(merged, ["order count"]) ?? findCol(merged, ["order"], ["rate", "tracker", "new", "repeat", "upsell"]) ?? 14,
    sales: findCol(merged, ["total sales"]) ?? 18,
  };
}

/** Detect funnel type from performance tracker headers */
export function detectFunnelTypeFromColumns(colMap: PerfColumnMap): "appointment" | "walkin" {
  return colMap.appointment !== null ? "appointment" : "walkin";
}

// ── Performance data parsing ───────────────────────────────────

function parsePerformanceRows(rows: string[][]): DailyMetric[] {
  const colMap = detectPerfColumns(rows);
  const results: DailyMetric[] = [];
  for (const cols of rows) {
    const date = parseDate(cols[colMap.date]);
    if (!date) continue;
    results.push({
      date,
      ad_spend: parseRM(cols[colMap.adSpend]),
      inquiry: parseInt2(cols[colMap.inquiry]),
      contact: parseInt2(cols[colMap.contact]),
      appointment: colMap.appointment !== null ? parseInt2(cols[colMap.appointment]) : 0,
      showup: colMap.showup !== null ? parseInt2(cols[colMap.showup]) : 0,
      orders: parseInt2(cols[colMap.orders]),
      sales: parseRM(cols[colMap.sales]),
    });
  }
  return results;
}

/** CSV fallback parser (used by tests) */
export function parsePerformanceCSV(csv: string): DailyMetric[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const rows = lines.map((line) => parseCSVLine(line));
  return parsePerformanceRows(rows);
}

// ── Lead data parsing ──────────────────────────────────────────

interface LeadColumnMap {
  date: number;
  appointmentPerson: number | null;
  salesPerson: number | null;
  appointmentDate: number | null;
  showedUp: number | null;
  purchaseDate: number | null;
  sales: number | null;
  brand: number | null;
}

function detectLeadColumns(header: string[]): LeadColumnMap {
  const h = header.map((v) => (v || "").toLowerCase().replace(/\n/g, " "));
  return {
    date: h.findIndex((v) => v.includes("date") && !v.includes("appointment") && !v.includes("purchase") && !v.includes("week")) >= 0
      ? h.findIndex((v) => v.includes("date") && !v.includes("appointment") && !v.includes("purchase") && !v.includes("week"))
      : 0,
    appointmentPerson: h.findIndex((v) => v.includes("appointment") && v.includes("person")) >= 0
      ? h.findIndex((v) => v.includes("appointment") && v.includes("person")) : null,
    salesPerson: h.findIndex((v) => v.includes("sales person") || (v === "sales person")) >= 0
      ? h.findIndex((v) => v.includes("sales person")) : null,
    appointmentDate: h.findIndex((v) => v.includes("appointment") && v.includes("date")) >= 0
      ? h.findIndex((v) => v.includes("appointment") && v.includes("date")) : null,
    showedUp: h.findIndex((v) => v.includes("showed up") || v.includes("show up")) >= 0
      ? h.findIndex((v) => v.includes("showed up") || v.includes("show up")) : null,
    purchaseDate: h.findIndex((v) => v.includes("purchase") && v.includes("date")) >= 0
      ? h.findIndex((v) => v.includes("purchase") && v.includes("date")) : null,
    sales: h.findIndex((v) => v === "sales" || (v.includes("sales") && !v.includes("person") && !v.includes("new") && !v.includes("repeat") && !v.includes("total"))) >= 0
      ? h.findIndex((v) => v === "sales" || (v.includes("sales") && !v.includes("person") && !v.includes("new") && !v.includes("repeat") && !v.includes("total"))) : null,
    brand: h.findIndex((v) => v.includes("brand")) >= 0
      ? h.findIndex((v) => v.includes("brand")) : null,
  };
}

function parseLeadRows(rows: string[][]): Lead[] {
  if (rows.length < 2) return [];
  const colMap = detectLeadColumns(rows[0]);
  const leads: Lead[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length < 5) continue;
    leads.push({
      appointment_date: colMap.appointmentDate !== null ? parseDate(cols[colMap.appointmentDate]) : null,
      showed_up: colMap.showedUp !== null ? ["yes", "true"].includes((cols[colMap.showedUp] || "").toLowerCase()) : false,
      sales: colMap.sales !== null ? parseRM(cols[colMap.sales]) : 0,
      purchase_date: colMap.purchaseDate !== null ? parseDate(cols[colMap.purchaseDate]) : null,
    });
  }
  return leads;
}

export function parseLeadSalesCSV(csv: string): Lead[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const rows = lines.map((line) => parseCSVLine(line));
  return parseLeadRows(rows);
}

// ── Person Performance parsing ─────────────────────────────────

export interface ApptPersonMetrics {
  name: string;
  contactGiven: number;
  appointment: number;
  showUp: number;
  apptRate: number;
  orders: number;
  sales: number;
}

export interface SalesPersonMetrics {
  name: string;
  appointment: number;
  showUp: number;
  showUpRate: number;
  orders: number;
  convRate: number;
  sales: number;
  aov: number;
}

export interface PersonData {
  appointmentPersons: ApptPersonMetrics[];
  salesPersons: SalesPersonMetrics[];
  brandBreakdowns: Record<string, BrandSalesBreakdown[]>;
}

function aggregateApptPersons(
  rows: string[][],
  personCol: number,
  colMap: LeadColumnMap,
  startDate?: Date,
  endDate?: Date,
): ApptPersonMetrics[] {
  const map = new Map<string, { contacts: number; appts: number; showUps: number; orders: number; sales: number }>();

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const person = (cols[personCol] || "").trim();
    if (!person) continue;

    const leadDate = parseDate(cols[colMap.date]);
    const leadInRange = !startDate || !endDate || (!!leadDate && leadDate >= startDate && leadDate <= endDate);

    const purchaseDateStr = colMap.purchaseDate !== null ? (cols[colMap.purchaseDate] || "").trim() : "";
    const purchaseDate = purchaseDateStr ? parseDate(purchaseDateStr) : null;
    const purchaseInRange = !!purchaseDate && (!startDate || !endDate || (purchaseDate >= startDate && purchaseDate <= endDate));

    if (!leadInRange && !purchaseInRange) continue;

    if (!map.has(person)) map.set(person, { contacts: 0, appts: 0, showUps: 0, orders: 0, sales: 0 });
    const m = map.get(person)!;

    if (leadInRange) {
      m.contacts++;
      if (colMap.appointmentDate !== null && (cols[colMap.appointmentDate] || "").trim()) m.appts++;
      if (colMap.showedUp !== null && ["yes", "true"].includes((cols[colMap.showedUp] || "").toLowerCase())) m.showUps++;
    }

    if (purchaseInRange) {
      m.orders++;
      m.sales += colMap.sales !== null ? parseRM(cols[colMap.sales]) : 0;
    }
  }

  return Array.from(map.entries()).map(([name, m]) => ({
    name,
    contactGiven: m.contacts,
    appointment: m.appts,
    showUp: m.showUps,
    apptRate: m.contacts > 0 ? (m.appts / m.contacts) * 100 : 0,
    orders: m.orders,
    sales: m.sales,
  })).sort((a, b) => b.contactGiven - a.contactGiven);
}

function aggregateSalesPersons(
  rows: string[][],
  personCol: number,
  colMap: LeadColumnMap,
  startDate?: Date,
  endDate?: Date,
): SalesPersonMetrics[] {
  // Sales Person: filter by PURCHASE DATE (not lead date)
  // This captures all orders closed in the period regardless of when the lead came in
  const map = new Map<string, { estShowUp: number; showUps: number; orders: number; sales: number }>();
  const isWalkinFunnel = colMap.appointmentDate === null;

  // First pass: scan ALL rows for est.show up (appointment date in range) and visits (walk-in)
  // This matches countEstShowUp logic exactly
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const person = (cols[personCol] || "").trim();
    if (!person) continue;
    if (!map.has(person)) map.set(person, { estShowUp: 0, showUps: 0, orders: 0, sales: 0 });
    const m = map.get(person)!;

    if (isWalkinFunnel) {
      // Walk-in: count leads with leadDate in range
      const leadDate = parseDate(cols[colMap.date]);
      if (leadDate && (!startDate || !endDate || (leadDate >= startDate && leadDate <= endDate))) {
        m.estShowUp++;
      }
    } else {
      // Appointment: count leads with appointmentDate in range (same as countEstShowUp)
      if (colMap.appointmentDate !== null) {
        const apptDate = parseDate(cols[colMap.appointmentDate]);
        if (apptDate && (!startDate || !endDate || (apptDate >= startDate && apptDate <= endDate))) {
          m.estShowUp++;
        }
      }
    }

    // Show up + orders: filter by leadDate OR purchaseDate in range
    const leadDate = parseDate(cols[colMap.date]);
    const leadInRange = leadDate && (!startDate || !endDate || (leadDate >= startDate && leadDate <= endDate));
    const purchaseDateStr = colMap.purchaseDate !== null ? (cols[colMap.purchaseDate] || "").trim() : "";
    const purchaseDate = purchaseDateStr ? parseDate(purchaseDateStr) : null;
    const hasOrderInRange = purchaseDate && (!startDate || !endDate || (purchaseDate >= startDate && purchaseDate <= endDate));

    if (!leadInRange && !hasOrderInRange) continue;

    if (leadInRange && colMap.showedUp !== null && ["yes", "true"].includes((cols[colMap.showedUp] || "").toLowerCase())) m.showUps++;
    if (hasOrderInRange) {
      m.orders++;
      m.sales += colMap.sales !== null ? parseRM(cols[colMap.sales]) : 0;
    }
  }

  return Array.from(map.entries())
    .filter(([, m]) => m.estShowUp > 0 || m.orders > 0 || m.showUps > 0)
    .map(([name, m]) => ({
      name,
      appointment: m.estShowUp,
      showUp: m.showUps,
      showUpRate: m.estShowUp > 0 ? (m.showUps / m.estShowUp) * 100 : 0,
      orders: m.orders,
      convRate: isWalkinFunnel ? (m.estShowUp > 0 ? (m.orders / m.estShowUp) * 100 : 0) : (m.showUps > 0 ? (m.orders / m.showUps) * 100 : 0),
      sales: m.sales,
      aov: m.orders > 0 ? m.sales / m.orders : 0,
    })).sort((a, b) => b.orders - a.orders);
}

// ── KPI Indicator parsing ──────────────────────────────────────

function parseKPIRows(rows: string[][], brandName?: string): KPIConfig {
  const kpi: KPIConfig = {
    sales: 0, orders: 0, aov: 0, cpl: 0,
    respond_rate: 0, appt_rate: 0, showup_rate: 0, conv_rate: 0,
    ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0,
    target_contact: 0, target_appt: 0, target_showup: 0,
  };

  // For multi-brand sheets, find the column offset for this brand
  // Section headers can be on any of the first few rows (e.g., row 0 or row 2)
  // Format: "Carress - KPI Stimulator (Targeted CPL)" at col 3/10/17
  let colOffset = 3; // default: col 3 (single brand)
  if (brandName) {
    for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
      for (let ci = 0; ci < (rows[ri]?.length || 0); ci++) {
        const h = (rows[ri][ci] || "").toLowerCase();
        if (h.includes(brandName.toLowerCase()) && (h.includes("kpi") || h.includes("stimulator"))) {
          colOffset = ci;
          break;
        }
      }
      if (colOffset !== 3) break;
    }
  }

  for (const cols of rows) {
    const label = (cols[colOffset] || "").toLowerCase().trim();
    const val4 = cols[colOffset + 1] || "";
    const val6 = cols[colOffset + 3] || "";
    const val8 = cols[colOffset + 5] || "";

    if (label.includes("targeted sales") && !label.includes("total")) {
      kpi.sales = parseRM(val4);
      if ((cols[colOffset + 2] || "").toLowerCase().includes("aov")) kpi.aov = parseRM(val6);
      if ((cols[colOffset + 4] || "").toLowerCase().includes("order")) kpi.orders = parseInt2(val8);
    } else if (label.includes("targeted cpa")) {
      kpi.cpa_pct = parsePercent(val4);
    } else if (label.includes("targeted conversion rate")) {
      kpi.conv_rate = parsePercent(val4);
    } else if (label.includes("targeted show up rate")) {
      kpi.showup_rate = parsePercent(val4);
      if ((cols[colOffset + 4] || "").toLowerCase().includes("show up")) kpi.target_showup = parseInt2(val8);
    } else if (label.includes("targeted appointment rate")) {
      kpi.appt_rate = parsePercent(val4);
      if ((cols[colOffset + 4] || "").toLowerCase().includes("appointment")) kpi.target_appt = parseInt2(val8);
    } else if (label.includes("targeted respond rate") || label.includes("targeted visit rate")) {
      kpi.respond_rate = parsePercent(val4);
      const col4Label = (cols[colOffset + 4] || "").toLowerCase();
      if (col4Label.includes("contact") || col4Label.includes("visit")) kpi.target_contact = parseInt2(val8);
    } else if (label.includes("cpl")) {
      kpi.cpl = parseRM(val4);
    } else if (label.includes("targeted") && label.includes("ad spend") && !label.includes("daily")) {
      // First match = monthly ad spend, second = daily (fallback)
      if (kpi.ad_spend === 0) {
        kpi.ad_spend = parseRM(val4);
      } else {
        kpi.daily_ad = parseRM(val4);
      }
    } else if (label.includes("roas") && !label.includes("total")) {
      kpi.roas = parseFloat(val4.replace(/[^\d.\-]/g, "")) || 0;
    }
  }

  // "Current/Actual Daily Ad Spend (Included 8% SST)" lives in a separate vertical table
  // at the bottom of the sheet: header row has the label, data row below has brand + value
  // Key: match on "daily ad spend" + "included" (SST), as some sheets say "Current" others "Actual"
  let foundDailyHeader = false;
  for (let ri = 0; ri < rows.length && !foundDailyHeader; ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < (row?.length || 0); ci++) {
      const cell = (row[ci] || "").toLowerCase();
      if (cell.includes("daily ad spend") && cell.includes("included")) {
        foundDailyHeader = true;
        // Found the header — scan subsequent rows for matching brand or first data row
        for (let di = ri + 1; di < Math.min(ri + 10, rows.length); di++) {
          const dataRow = rows[di];
          if (!dataRow || dataRow.every((c) => !c || c.trim() === "")) continue;
          const rowBrand = (dataRow[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
          if (brandName) {
            if (rowBrand.includes(brandName.toLowerCase())) {
              kpi.daily_ad = parseRM(dataRow[ci]);
              break;
            }
          } else {
            // No brand specified — use first data row
            kpi.daily_ad = parseRM(dataRow[ci]);
            break;
          }
        }
        break;
      }
    }
  }

  return kpi;
}

// ── Derived KPI values (blue cells) ──────────────────────────

export interface DerivedKPI {
  orders: number;
  cp_acquisition: number;
  cp_showup: number;
  target_showup: number;
  cp_visit: number;
  target_visit: number;
  cpl: number;
  fb_leads: number;
  monthly_ad_incl: number;
  monthly_ad_excl: number;
  daily_ad_targeted_incl: number;
  daily_ad_targeted_excl: number;
  cpa_pct: number;
  roi: number;
  daily_ad_actual_incl: number;
  daily_ad_current_excl: number;  // The editable "Current Daily Ad Spend (Excluded 8% SST)"
  marketing_cost: number;         // "Marketing Service Cost" from sheet (for ROI calc)
}

function parseDerivedKPIRows(rows: string[][], brandName?: string): DerivedKPI {
  const d: DerivedKPI = {
    orders: 0, cp_acquisition: 0, cp_showup: 0, target_showup: 0,
    cp_visit: 0, target_visit: 0, cpl: 0, fb_leads: 0,
    monthly_ad_incl: 0, monthly_ad_excl: 0,
    daily_ad_targeted_incl: 0, daily_ad_targeted_excl: 0,
    cpa_pct: 0, roi: 0, daily_ad_actual_incl: 0, daily_ad_current_excl: 0, marketing_cost: 0,
  };

  // Determine column offset (same logic as parseKPIRows)
  let colOffset = 3;
  if (brandName) {
    for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
      for (let ci = 0; ci < (rows[ri]?.length || 0); ci++) {
        const h = (rows[ri][ci] || "").toLowerCase();
        if (h.includes(brandName.toLowerCase()) && (h.includes("kpi") || h.includes("stimulator"))) {
          colOffset = ci;
          break;
        }
      }
      if (colOffset !== 3) break;
    }
  }

  // Marketing Service Cost: typically in first few rows, col 0 label + col 1 value
  for (let ri = 0; ri < Math.min(10, rows.length); ri++) {
    const label0 = (rows[ri]?.[0] || "").toLowerCase();
    if (label0.includes("marketing") && label0.includes("cost")) {
      d.marketing_cost = parseRM(rows[ri]?.[1] || "");
      break;
    }
  }

  for (const cols of rows) {
    const label = (cols[colOffset] || "").toLowerCase().trim();
    const label4 = (cols[colOffset + 4] || "").toLowerCase().trim();

    if (label.includes("targeted sales") && !label.includes("total")) {
      // Orders at colOffset+5 (col 8 for default offset 3)
      d.orders = parseInt2(cols[colOffset + 5] || "");
    } else if (label.includes("targeted cpa")) {
      // CP.Acquisition at colOffset+3
      d.cp_acquisition = parseRM(cols[colOffset + 3] || "");
    } else if (label.includes("targeted conversion rate")) {
      // No derived values on this row
    } else if (label.includes("targeted show up rate")) {
      d.cp_showup = parseRM(cols[colOffset + 3] || "");
      d.target_showup = parseInt2(cols[colOffset + 5] || "");
    } else if (label.includes("targeted visit rate") || label.includes("targeted respond rate")) {
      d.cp_visit = parseRM(cols[colOffset + 3] || "");
      d.target_visit = parseInt2(cols[colOffset + 5] || "");
    } else if (label.includes("cpl")) {
      d.cpl = parseRM(cols[colOffset + 1] || "");
      d.fb_leads = parseInt2(cols[colOffset + 3] || "");
    } else if (label.includes("targeted") && label.includes("ad spend") && !label.includes("daily")) {
      if (d.monthly_ad_incl === 0) {
        d.monthly_ad_incl = parseRM(cols[colOffset + 1] || "");
        d.monthly_ad_excl = parseRM(cols[colOffset + 3] || "");
      } else {
        d.daily_ad_targeted_incl = parseRM(cols[colOffset + 1] || "");
        d.daily_ad_targeted_excl = parseRM(cols[colOffset + 3] || "");
      }
    } else if (label.includes("roas") && !label.includes("total")) {
      d.roi = parseFloat((cols[colOffset + 3] || "").replace(/[^\d.\-]/g, "")) || 0;
    }
  }

  // CPA% row: row after ROAS (check for standalone percentage value)
  for (let ri = 0; ri < rows.length; ri++) {
    const cols = rows[ri];
    const label = (cols[colOffset] || "").toLowerCase().trim();
    if (label.includes("roas") && !label.includes("total")) {
      // Next row has CPA% at colOffset+1
      const nextRow = rows[ri + 1];
      if (nextRow) {
        d.cpa_pct = parsePercent(nextRow[colOffset + 1] || "");
      }
      break;
    }
  }

  // Daily Ad Spend table at the bottom — read both excluded (col 1) and included (col 2)
  // Headers: [col 1] "Current Daily Ad Spend (Excluded 8% SST)" | [col 2] "Actual Daily Ad Spend (Included 8% SST)"
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < (row?.length || 0); ci++) {
      const cell = (row[ci] || "").toLowerCase();
      if (cell.includes("daily ad spend") && cell.includes("excluded")) {
        // Found "excluded" header — "included" header is at ci+1
        for (let di = ri + 1; di < Math.min(ri + 10, rows.length); di++) {
          const dataRow = rows[di];
          if (!dataRow || dataRow.every((c) => !c || c.trim() === "")) continue;
          const rowBrand = (dataRow[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
          if (brandName) {
            if (rowBrand.includes(brandName.toLowerCase())) {
              d.daily_ad_current_excl = parseRM(dataRow[ci]);
              d.daily_ad_actual_incl = parseRM(dataRow[ci + 1] || "");
              return d;
            }
          } else {
            d.daily_ad_current_excl = parseRM(dataRow[ci]);
            d.daily_ad_actual_incl = parseRM(dataRow[ci + 1] || "");
            return d;
          }
        }
        break;
      }
    }
  }

  return d;
}

export async function fetchDerivedKPI(sheetId: string, brandName?: string): Promise<DerivedKPI | null> {
  const tabName = await findKPITab(sheetId);
  if (!tabName) return null;
  const rows = await fetchSheetData(sheetId, tabName);
  return parseDerivedKPIRows(rows, brandName);
}

// ── KPI Cell Address Discovery (for write-back) ─────────────

function colToLetter(col: number): string {
  let s = "";
  let c = col;
  while (c >= 0) {
    s = String.fromCharCode((c % 26) + 65) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

function cellRef(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

export interface KPICellMap {
  tabName: string;
  cells: Partial<Record<
    "sales" | "aov" | "cpa_pct" | "conv_rate" | "showup_rate" | "appt_rate" | "respond_rate" | "daily_ad",
    string
  >>;
}

export async function findKPICellAddresses(
  sheetId: string,
  brandName?: string,
): Promise<KPICellMap | null> {
  const tabName = await findKPITab(sheetId);
  if (!tabName) return null;
  const rows = await fetchSheetData(sheetId, tabName);

  const cells: KPICellMap["cells"] = {};

  // Determine column offset (same logic as parseKPIRows)
  let colOffset = 3;
  if (brandName) {
    for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
      for (let ci = 0; ci < (rows[ri]?.length || 0); ci++) {
        const h = (rows[ri][ci] || "").toLowerCase();
        if (h.includes(brandName.toLowerCase()) && (h.includes("kpi") || h.includes("stimulator"))) {
          colOffset = ci;
          break;
        }
      }
      if (colOffset !== 3) break;
    }
  }

  // Scan rows for label matches — record cell addresses instead of values
  for (let ri = 0; ri < rows.length; ri++) {
    const cols = rows[ri];
    const label = (cols[colOffset] || "").toLowerCase().trim();

    if (label.includes("targeted sales") && !label.includes("total")) {
      cells.sales = cellRef(ri, colOffset + 1);
      if ((cols[colOffset + 2] || "").toLowerCase().includes("aov")) {
        cells.aov = cellRef(ri, colOffset + 3);
      }
    } else if (label.includes("targeted cpa")) {
      cells.cpa_pct = cellRef(ri, colOffset + 1);
    } else if (label.includes("targeted conversion rate")) {
      cells.conv_rate = cellRef(ri, colOffset + 1);
    } else if (label.includes("targeted show up rate")) {
      cells.showup_rate = cellRef(ri, colOffset + 1);
    } else if (label.includes("targeted appointment rate")) {
      cells.appt_rate = cellRef(ri, colOffset + 1);
    } else if (label.includes("targeted respond rate") || label.includes("targeted visit rate")) {
      cells.respond_rate = cellRef(ri, colOffset + 1);
    }
  }

  // Find Daily Ad Spend cell in the separate bottom table
  let foundDailyHeader = false;
  for (let ri = 0; ri < rows.length && !foundDailyHeader; ri++) {
    const row = rows[ri];
    for (let ci = 0; ci < (row?.length || 0); ci++) {
      const cell = (row[ci] || "").toLowerCase();
      if (cell.includes("daily ad spend") && cell.includes("excluded")) {
        foundDailyHeader = true;
        for (let di = ri + 1; di < Math.min(ri + 10, rows.length); di++) {
          const dataRow = rows[di];
          if (!dataRow || dataRow.every((c) => !c || c.trim() === "")) continue;
          const rowBrand = (dataRow[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
          if (brandName) {
            if (rowBrand.includes(brandName.toLowerCase())) {
              cells.daily_ad = cellRef(di, ci);
              break;
            }
          } else {
            cells.daily_ad = cellRef(di, ci);
            break;
          }
        }
        break;
      }
    }
  }

  // Fallback: if "excluded" not found, try "included" header (some sheets differ)
  if (!cells.daily_ad) {
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      for (let ci = 0; ci < (row?.length || 0); ci++) {
        const cell = (row[ci] || "").toLowerCase();
        if (cell.includes("daily ad spend") && cell.includes("included")) {
          for (let di = ri + 1; di < Math.min(ri + 10, rows.length); di++) {
            const dataRow = rows[di];
            if (!dataRow || dataRow.every((c) => !c || c.trim() === "")) continue;
            const rowBrand = (dataRow[0] || "").toLowerCase().replace(/\s+/g, " ").trim();
            if (brandName) {
              if (rowBrand.includes(brandName.toLowerCase())) {
                cells.daily_ad = cellRef(di, ci);
                break;
              }
            } else {
              cells.daily_ad = cellRef(di, ci);
              break;
            }
          }
          break;
        }
      }
      if (cells.daily_ad) break;
    }
  }

  return { tabName, cells };
}

// ── KPI Write-back ───────────────────────────────────────────

export async function writeKPIValues(
  sheetId: string,
  values: Partial<Record<string, number>>,
  brandName?: string,
): Promise<void> {
  const { getSheetsClient } = await import("./google-auth");
  const cellMap = await findKPICellAddresses(sheetId, brandName);
  if (!cellMap) throw new Error("KPI Indicator tab not found");

  const data: { range: string; values: (string | number)[][] }[] = [];

  for (const [key, val] of Object.entries(values)) {
    const cellAddr = cellMap.cells[key as keyof KPICellMap["cells"]];
    if (!cellAddr || val == null) continue;

    // Write raw numbers — cell formatting in Google Sheet handles display (RM, %)
    // Percentage cells store decimals (60% = 0.6), so divide by 100
    const isPercent = key.includes("rate") || key === "cpa_pct";
    const rawVal = isPercent ? val / 100 : val;

    data.push({
      range: `'${cellMap.tabName}'!${cellAddr}`,
      values: [[rawVal]],
    });
  }

  if (data.length === 0) return;

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}

// ── Public API ─────────────────────────────────────────────────

export interface PerfResult {
  data: DailyMetric[];
  funnelType: "appointment" | "walkin";
}

export async function fetchPerformanceData(sheetId: string, brandName?: string): Promise<PerfResult> {
  // If no brand specified, check if there are multiple brand tabs → merge all
  if (!brandName) {
    const tabs = await listSheetTabs(sheetId);
    const perfTabs = tabs.filter(t =>
      t.name.toLowerCase().includes("performance tracker") &&
      !t.name.toLowerCase().includes("filter") &&
      t.name.includes("@")
    );
    if (perfTabs.length > 1) {
      // Multi-brand Overall: fetch all performance tabs in parallel, then merge.
      // Previous sequential for-await meant 4 brands = 4x roundtrip latency stacked.
      const tabResults = await Promise.all(
        perfTabs.map(async (tab) => {
          const rows = await fetchSheetData(sheetId, tab.name);
          return { rows, colMap: detectPerfColumns(rows) };
        }),
      );
      let allData: DailyMetric[] = [];
      let funnelType: "appointment" | "walkin" = "appointment";
      for (const { rows, colMap } of tabResults) {
        funnelType = detectFunnelTypeFromColumns(colMap);
        allData = allData.concat(parsePerformanceRows(rows));
      }
      // Merge by date: sum metrics for the same date across brands
      const byDate = new Map<string, DailyMetric>();
      for (const row of allData) {
        const key = row.date.toISOString().slice(0, 10);
        if (byDate.has(key)) {
          const existing = byDate.get(key)!;
          existing.ad_spend += row.ad_spend;
          existing.inquiry += row.inquiry;
          existing.contact += row.contact;
          existing.appointment += row.appointment;
          existing.showup += row.showup;
          existing.orders += row.orders;
          existing.sales += row.sales;
        } else {
          byDate.set(key, { ...row });
        }
      }
      return { data: Array.from(byDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime()), funnelType };
    }
  }

  const tabName = await findPerformanceTab(sheetId, brandName);
  if (!tabName) throw new Error("No Performance Tracker tab found");
  const rows = await fetchSheetData(sheetId, tabName);
  const colMap = detectPerfColumns(rows);
  return {
    data: parsePerformanceRows(rows),
    funnelType: detectFunnelTypeFromColumns(colMap),
  };
}

// Serialized form for unstable_cache (Date → ISO string for JSON safety)
interface SerializedLead {
  appointment_date: string | null;
  showed_up: boolean;
  sales: number;
  purchase_date: string | null;
}
function serializeLead(l: Lead): SerializedLead {
  return {
    appointment_date: l.appointment_date ? l.appointment_date.toISOString() : null,
    showed_up: l.showed_up,
    sales: l.sales,
    purchase_date: l.purchase_date ? l.purchase_date.toISOString() : null,
  };
}
function deserializeLead(s: SerializedLead): Lead {
  return {
    appointment_date: s.appointment_date ? new Date(s.appointment_date) : null,
    showed_up: s.showed_up,
    sales: s.sales,
    purchase_date: s.purchase_date ? new Date(s.purchase_date) : null,
  };
}

// Inner: full fetch + parse + brand filter. Uses sheet-level cache (rows).
async function fetchLeadDataInner(sheetId: string, brandName?: string): Promise<Lead[]> {
  const tabName = await findLeadSalesTab(sheetId);
  if (!tabName) throw new Error("No Lead & Sales Tracker tab found");
  const rows = await fetchSheetData(sheetId, tabName);
  const leads = parseLeadRows(rows);

  if (brandName && rows.length > 0) {
    const header = rows[0].map((h) => (h || "").toLowerCase());
    const brandCol = header.findIndex((h) => h.includes("brand"));
    if (brandCol >= 0) {
      const filtered: Lead[] = [];
      const colMap = detectLeadColumns(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if ((cols[brandCol] || "").toLowerCase().trim() !== brandName.toLowerCase()) continue;
        if (!cols || cols.length < 5) continue;
        filtered.push({
          appointment_date: colMap.appointmentDate !== null ? parseDate(cols[colMap.appointmentDate]) : null,
          showed_up: colMap.showedUp !== null ? ["yes", "true"].includes((cols[colMap.showedUp] || "").toLowerCase()) : false,
          sales: colMap.sales !== null ? parseRM(cols[colMap.sales]) : 0,
          purchase_date: colMap.purchaseDate !== null ? parseDate(cols[colMap.purchaseDate]) : null,
        });
      }
      return filtered;
    }
  }
  return leads;
}

// Cached layer: stores serialized leads (ISO string dates) keyed by (sheetId, brand).
// 5-min TTL. Skips parseLeadRows (~700ms over 23K rows) on cache hit.
const fetchLeadDataCached = unstable_cache(
  async (sheetId: string, brandKey: string): Promise<SerializedLead[]> => {
    const brandName = brandKey === "__ALL__" ? undefined : brandKey;
    const leads = await fetchLeadDataInner(sheetId, brandName);
    return leads.map(serializeLead);
  },
  ["lead-data-v2"],
  { revalidate: 300 },
);

export async function fetchLeadData(sheetId: string, brandName?: string): Promise<Lead[]> {
  const serialized = await fetchLeadDataCached(sheetId, brandName ?? "__ALL__");
  return serialized.map(deserializeLead);
}

export interface BrandSalesBreakdown {
  brand: string;
  orders: number;
  sales: number;
}

// Inner: full aggregation logic. PersonData has no Date fields → safe for direct caching.
async function fetchPersonDataInner(sheetId: string, startDate?: Date, endDate?: Date, brandName?: string): Promise<PersonData> {
  const tabName = await findLeadSalesTab(sheetId);
  if (!tabName) return { appointmentPersons: [], salesPersons: [], brandBreakdowns: {} };
  const rows = await fetchSheetData(sheetId, tabName);
  if (rows.length < 2) return { appointmentPersons: [], salesPersons: [], brandBreakdowns: {} };

  const colMap = detectLeadColumns(rows[0]);

  // Filter rows by brand if needed
  let filteredRows = rows;
  if (brandName && colMap.brand !== null) {
    filteredRows = [rows[0], ...rows.slice(1).filter(cols =>
      (cols[colMap.brand!] || "").toLowerCase().trim() === brandName.toLowerCase()
    )];
  }

  const appointmentPersons = colMap.appointmentPerson !== null
    ? aggregateApptPersons(filteredRows, colMap.appointmentPerson, colMap, startDate, endDate)
    : [];

  const salesPersons = colMap.salesPerson !== null
    ? aggregateSalesPersons(filteredRows, colMap.salesPerson, colMap, startDate, endDate)
    : [];

  // Brand breakdown per Sales Person — IMPORTANT: iterates ALL rows (not filteredRows)
  // so that each sales person's cross-brand breakdown is preserved even when the
  // dashboard is filtered to a single brand. DO NOT change to filteredRows.
  const brandBreakdowns: Record<string, BrandSalesBreakdown[]> = {};
  if (colMap.brand !== null && colMap.salesPerson !== null) {
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      const person = (cols[colMap.salesPerson] || "").trim();
      const brand = (cols[colMap.brand!] || "").trim();
      if (!person || !brand) continue;

      // Date filter
      if (startDate && endDate) {
        const leadDate = parseDate(cols[colMap.date]);
        const purchaseDate = colMap.purchaseDate !== null ? parseDate(cols[colMap.purchaseDate]) : null;
        const inRange = (leadDate && leadDate >= startDate && leadDate <= endDate) ||
          (purchaseDate && purchaseDate >= startDate && purchaseDate <= endDate);
        if (!inRange) continue;
      }

      if (!brandBreakdowns[person]) brandBreakdowns[person] = [];
      let entry = brandBreakdowns[person].find(b => b.brand === brand);
      if (!entry) { entry = { brand, orders: 0, sales: 0 }; brandBreakdowns[person].push(entry); }

      if (colMap.purchaseDate !== null && (cols[colMap.purchaseDate] || "").trim()) {
        entry.orders++;
        entry.sales += colMap.sales !== null ? parseRM(cols[colMap.sales]) : 0;
      }
    }
  }

  return { appointmentPersons, salesPersons, brandBreakdowns };
}

// Cached layer: keyed by (sheetId, fromIso, toIso, brand). 5-min TTL.
// Skips parseDate × 23K rows × 3 aggregation loops on cache hit.
// PersonData has no Date fields so direct serialization is safe.
const fetchPersonDataCached = unstable_cache(
  async (sheetId: string, fromIso: string, toIso: string, brandKey: string): Promise<PersonData> => {
    const startDate = fromIso === "__NONE__" ? undefined : new Date(fromIso);
    const endDate = toIso === "__NONE__" ? undefined : new Date(toIso);
    const brandName = brandKey === "__ALL__" ? undefined : brandKey;
    return fetchPersonDataInner(sheetId, startDate, endDate, brandName);
  },
  ["person-data-v2"],
  { revalidate: 300 },
);

export async function fetchPersonData(sheetId: string, startDate?: Date, endDate?: Date, brandName?: string): Promise<PersonData> {
  const fromIso = startDate ? startDate.toISOString() : "__NONE__";
  const toIso = endDate ? endDate.toISOString() : "__NONE__";
  return fetchPersonDataCached(sheetId, fromIso, toIso, brandName ?? "__ALL__");
}

export async function fetchKPIData(sheetId: string, brandName?: string): Promise<KPIConfig | null> {
  const tabName = await findKPITab(sheetId);
  if (!tabName) return null;
  const rows = await fetchSheetData(sheetId, tabName);
  return parseKPIRows(rows, brandName);
}

export async function fetchOverallKPI(sheetId: string, brands: string[]): Promise<KPIConfig> {
  const kpis = await Promise.all(brands.map((b) => fetchKPIData(sheetId, b)));
  const valid = kpis.filter((k): k is KPIConfig => k !== null);
  if (valid.length === 0) return { sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0, showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0, target_contact: 0, target_appt: 0, target_showup: 0 };

  const sum = (fn: (k: KPIConfig) => number) => valid.reduce((a, k) => a + fn(k), 0);
  const avg = (fn: (k: KPIConfig) => number) => sum(fn) / valid.length;

  return {
    sales: sum((k) => k.sales),
    orders: sum((k) => k.orders),
    aov: avg((k) => k.aov),
    cpl: avg((k) => k.cpl),
    respond_rate: avg((k) => k.respond_rate),
    appt_rate: avg((k) => k.appt_rate),
    showup_rate: avg((k) => k.showup_rate),
    conv_rate: avg((k) => k.conv_rate),
    ad_spend: sum((k) => k.ad_spend),
    daily_ad: sum((k) => k.daily_ad),
    roas: avg((k) => k.roas),
    cpa_pct: avg((k) => k.cpa_pct),
    target_contact: sum((k) => k.target_contact),
    target_appt: sum((k) => k.target_appt),
    target_showup: sum((k) => k.target_showup),
  };
}

export async function detectBrandsOrdered(sheetId: string): Promise<string[]> {
  // Try KPI Indicator tab for brand order (section headers appear left-to-right)
  const kpiTab = await findKPITab(sheetId);
  if (kpiTab) {
    const rows = await fetchSheetData(sheetId, kpiTab);
    const ordered: string[] = [];
    for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
      for (let ci = 0; ci < (rows[ri]?.length || 0); ci++) {
        const h = (rows[ri][ci] || "").trim();
        if ((h.toLowerCase().includes("kpi") || h.toLowerCase().includes("stimulator")) && h.includes(" - ")) {
          const brandName = h.split(" - ")[0].trim();
          if (brandName && !ordered.includes(brandName)) ordered.push(brandName);
        }
      }
    }
    if (ordered.length > 0) return ordered;
  }
  return detectBrands(sheetId);
}

export async function detectBrands(sheetId: string): Promise<string[]> {
  const tabs = await listSheetTabs(sheetId);
  return tabs
    .filter((t) => t.name.toLowerCase().includes("performance tracker") && !t.name.toLowerCase().includes("filter"))
    .map((t) => { const m = t.name.match(/@(.+)$/); return m ? m[1] : null; })
    .filter((b): b is string => b !== null);
}

export function countEstShowUp(leads: Lead[], start: Date, end: Date): number {
  return leads.filter((l) =>
    l.appointment_date && l.appointment_date >= start && l.appointment_date <= end
  ).length;
}
