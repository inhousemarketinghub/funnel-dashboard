import { NextResponse } from "next/server";
import { findKPICellAddresses, writeKPIValues, detectBrandsOrdered } from "@/lib/sheets";

// Temporary test endpoint — no auth, tests writeKPIValues directly on Carress Shop
// DELETE THIS FILE after debugging
export async function GET() {
  const sheetId = "1H2vytbxLtQRwATUiZlf07oLqJL5-jhnSPeZ-ABPANTY"; // Carress Shop

  try {
    // Step 1: Detect brands
    const brands = await detectBrandsOrdered(sheetId);
    const brandName = brands.length > 1 ? brands[0] : (brands[0] || undefined);

    // Step 2: Find cell addresses
    const cellMap = await findKPICellAddresses(sheetId, brandName);

    // Step 3: Try writing daily_ad = 280
    const testFields = { daily_ad: 280 };
    await writeKPIValues(sheetId, testFields, brandName);

    // Step 4: Read back to verify
    const { getSheetsClient } = await import("@/lib/google-auth");
    const sheets = getSheetsClient();
    const dailyCell = cellMap?.cells.daily_ad;
    let readBack = "N/A";
    if (dailyCell && cellMap) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${cellMap.tabName}'!${dailyCell}`,
      });
      readBack = res.data.values?.[0]?.[0] || "empty";
    }

    return NextResponse.json({
      success: true,
      brands,
      brandName,
      cellMap: cellMap?.cells || null,
      testWrite: { field: "daily_ad", value: 280, cell: dailyCell },
      readBack,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined,
    }, { status: 500 });
  }
}
