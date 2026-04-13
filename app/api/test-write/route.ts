import { NextResponse } from "next/server";
import { findKPICellAddresses, writeKPIValues, detectBrandsOrdered } from "@/lib/sheets";

// Temporary test endpoint — DELETE after confirming writes work
export async function GET() {
  const sheetId = "1H2vytbxLtQRwATUiZlf07oLqJL5-jhnSPeZ-ABPANTY"; // Carress Shop

  try {
    const brands = await detectBrandsOrdered(sheetId);
    const brandName = brands.length > 1 ? brands[0] : (brands[0] || undefined);
    const cellMap = await findKPICellAddresses(sheetId, brandName);

    // Write daily_ad = 280
    await writeKPIValues(sheetId, { daily_ad: 280 }, brandName);

    // Read back
    const { getSheetsClient } = await import("@/lib/google-auth");
    const sheets = getSheetsClient();
    const cell = cellMap?.cells.daily_ad;
    let readBack = "N/A";
    if (cell && cellMap) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${cellMap.tabName}'!${cell}`,
      });
      readBack = res.data.values?.[0]?.[0] || "empty";
    }

    return NextResponse.json({
      success: true,
      brandName,
      cellMap: cellMap?.cells || null,
      wrote: { daily_ad: 280, cell },
      readBack,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
