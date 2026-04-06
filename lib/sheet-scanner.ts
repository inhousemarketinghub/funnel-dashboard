import { listSheetTabs, fetchSheetData } from "./sheets";

export interface BrandInfo {
  name: string;
  perfTab: string;
  funnelType: "appointment" | "walkin";
}

export interface SheetScanResult {
  brands: BrandInfo[];
  funnelType: "appointment" | "walkin";
  hasKPI: boolean;
  hasLeadTracker: boolean;
}

export async function scanSheet(sheetId: string): Promise<SheetScanResult> {
  const tabs = await listSheetTabs(sheetId);

  // Find performance tracker tabs (excluding "Filter" tabs)
  const perfTabs = tabs.filter(
    (t) =>
      t.name.toLowerCase().includes("performance tracker") &&
      !t.name.toLowerCase().includes("filter")
  );

  // Detect brands from tab names
  const brands: BrandInfo[] = [];
  for (const tab of perfTabs) {
    const match = tab.name.match(/@(.+)$/);
    const brandName = match ? match[1] : null;
    const funnelType = await detectFunnelType(sheetId, tab.name);
    brands.push({
      name: brandName || "(Default)",
      perfTab: tab.name,
      funnelType,
    });
  }

  // Overall funnel type = first brand's type (or appointment as default)
  const funnelType = brands.length > 0 ? brands[0].funnelType : "appointment";

  // Check for KPI and Lead tabs
  const hasKPI = tabs.some((t) => t.name.toLowerCase().includes("kpi"));
  const hasLeadTracker = tabs.some(
    (t) =>
      t.name.toLowerCase().includes("lead") &&
      !t.name.toLowerCase().includes("filter")
  );

  return { brands, funnelType, hasKPI, hasLeadTracker };
}

async function detectFunnelType(
  sheetId: string,
  tabName: string
): Promise<"appointment" | "walkin"> {
  try {
    const rows = await fetchSheetData(sheetId, tabName);
    // Merge first 3 rows to build headers
    const headers: string[] = [];
    for (let ci = 0; ci < 25; ci++) {
      const parts: string[] = [];
      for (let ri = 0; ri < Math.min(3, rows.length); ri++) {
        if (rows[ri]?.[ci]?.trim()) parts.push(rows[ri][ci].trim());
      }
      headers[ci] = parts.join(" ").toLowerCase();
    }

    const hasAppointment = headers.some(
      (h) => h.includes("appointment") && !h.includes("rate")
    );
    const hasShowroom = headers.some((h) => h.includes("showroom") || h.includes("visit"));

    return hasAppointment ? "appointment" : hasShowroom ? "walkin" : "appointment";
  } catch {
    return "appointment";
  }
}
