import { NextRequest, NextResponse } from "next/server";
import {
  fetchPerformanceData,
  fetchLeadData,
  fetchKPIData,
  fetchPersonData,
  detectBrandsOrdered,
  fetchOverallKPI,
} from "@/lib/sheets";

// [PERF DIAG] temporary diagnostic endpoint — preview only, removed before merge.
// Mirrors the Dashboard data layer (Sheets fetches + Overall KPI) without
// Supabase/auth. Lets a server tester hit it via curl to measure cold vs
// warm timings without involving the user.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Never serve in production
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "perf-test disabled in production" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sheetId = searchParams.get("sheetId");
  const brand = searchParams.get("brand"); // null or "Overall" = no specific brand

  if (!sheetId) {
    return NextResponse.json({ error: "sheetId query param required" }, { status: 400 });
  }

  const brandFromUrl = brand && brand !== "Overall" ? brand : undefined;
  const t0 = Date.now();
  const timings: Record<string, number> = {};

  let perfResult, leadData, sheetKPI, personData, brands;
  try {
    const ts = [Date.now(), Date.now(), Date.now(), Date.now(), Date.now()];
    [perfResult, leadData, sheetKPI, personData, brands] = await Promise.all([
      fetchPerformanceData(sheetId, brandFromUrl).then((r) => { timings.fetchPerformanceData = Date.now() - ts[0]; return r; }),
      fetchLeadData(sheetId, brandFromUrl).then((r) => { timings.fetchLeadData = Date.now() - ts[1]; return r; }),
      fetchKPIData(sheetId, brandFromUrl).then((r) => { timings.fetchKPIData = Date.now() - ts[2]; return r; }),
      fetchPersonData(sheetId, undefined, undefined, brandFromUrl).then((r) => { timings.fetchPersonData = Date.now() - ts[3]; return r; }),
      detectBrandsOrdered(sheetId).then((r) => { timings.detectBrandsOrdered = Date.now() - ts[4]; return r; }),
    ]);
    timings.promiseAll = Date.now() - t0;

    const selectedBrand = brandFromUrl ?? (brands.length === 1 ? brands[0] : undefined);
    if (brands.length > 1 && !selectedBrand) {
      const ot = Date.now();
      sheetKPI = await fetchOverallKPI(sheetId, brands);
      timings.fetchOverallKPI = Date.now() - ot;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed", timings },
      { status: 500 },
    );
  }

  timings.total = Date.now() - t0;

  return NextResponse.json({
    ok: true,
    request: {
      sheetId,
      brand: brand ?? "Overall",
      env: process.env.VERCEL_ENV ?? "local",
      timestamp: new Date().toISOString(),
    },
    timings,
    data: {
      perfRows: perfResult?.data.length ?? 0,
      leadRows: leadData?.length ?? 0,
      brandCount: brands?.length ?? 0,
      hasOverallKPI: timings.fetchOverallKPI !== undefined,
    },
  });
}
