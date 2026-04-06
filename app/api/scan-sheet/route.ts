import { NextResponse } from "next/server";
import { scanSheet } from "@/lib/sheet-scanner";

export async function POST(req: Request) {
  try {
    const { sheetId } = await req.json();
    if (!sheetId || typeof sheetId !== "string") {
      return NextResponse.json({ error: "sheetId is required" }, { status: 400 });
    }

    const result = await scanSheet(sheetId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
