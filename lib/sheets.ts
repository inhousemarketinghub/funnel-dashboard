import type { DailyMetric, Lead } from "./types";

const SHEETS_CSV_URL = (id: string, tab: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

function parseRM(val: string): number {
  if (!val || val.trim() === "") return 0;
  const v = val.replace(/[^\d.\-]/g, "");
  return parseFloat(v) || 0;
}

function parseInt2(val: string): number {
  if (!val || val.trim() === "") return 0;
  return parseInt(val.replace(/[^\d]/g, ""), 10) || 0;
}

function parseDate(val: string): Date | null {
  if (!val || val.trim() === "") return null;
  val = val.trim();
  const parts = val.split(/[\/\-]/);
  if (parts.length !== 3) return null;
  // Try dd/mm/yyyy first (most common in MY sheets)
  let d = +parts[0], m = +parts[1] - 1, y = +parts[2];
  let date = new Date(y, m, d);
  if (!isNaN(date.getTime()) && date.getFullYear() > 2000) return date;
  // Try yyyy-mm-dd
  y = +parts[0]; m = +parts[1] - 1; d = +parts[2];
  date = new Date(y, m, d);
  if (!isNaN(date.getTime()) && date.getFullYear() > 2000) return date;
  return null;
}

export function parsePerformanceCSV(csv: string): DailyMetric[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const rows: DailyMetric[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Handle quoted CSV fields
    const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, "")) || lines[i].split(",").map(c => c.replace(/^"|"$/g, ""));
    const date = parseDate(cols[0]);
    if (!date) continue;
    rows.push({
      date,
      ad_spend: parseRM(cols[1]),
      inquiry: parseInt2(cols[4]),
      contact: parseInt2(cols[6]),
      appointment: parseInt2(cols[7]),
      showup: parseInt2(cols[8]),
      orders: parseInt2(cols[13]),
      sales: parseRM(cols[17]),
    });
  }
  return rows;
}

export function parseLeadSalesCSV(csv: string): Lead[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const leads: Lead[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(c => c.replace(/^"|"$/g, "")) || lines[i].split(",").map(c => c.replace(/^"|"$/g, ""));
    if (cols.length <= 12) continue;
    leads.push({
      appointment_date: parseDate(cols[12]),
      showed_up: (cols[17] || "").toLowerCase() === "yes",
      sales: parseRM(cols[27] || "0"),
      purchase_date: parseDate(cols[24] || ""),
    });
  }
  return leads;
}

export async function fetchSheetCSV(sheetId: string, tabName: string): Promise<string> {
  const url = SHEETS_CSV_URL(sheetId, tabName);
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Failed to fetch sheet ${tabName}: ${res.status}`);
  return res.text();
}

export async function fetchPerformanceData(sheetId: string): Promise<DailyMetric[]> {
  const csv = await fetchSheetCSV(sheetId, "Performance Tracker");
  return parsePerformanceCSV(csv);
}

export async function fetchLeadData(sheetId: string): Promise<Lead[]> {
  const csv = await fetchSheetCSV(sheetId, "Lead & Sales Tracker");
  return parseLeadSalesCSV(csv);
}

export function countEstShowUp(leads: Lead[], start: Date, end: Date): number {
  return leads.filter((l) =>
    l.appointment_date && l.appointment_date >= start && l.appointment_date <= end
  ).length;
}
