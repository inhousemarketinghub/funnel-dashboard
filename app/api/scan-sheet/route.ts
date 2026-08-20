import { NextResponse } from "next/server";
import { scanSheet } from "@/lib/sheet-scanner";
import { getUserRole } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // Middleware already gates on a session cookie, but API routes check the
    // role themselves too — defense in depth, matching /api/kpi.
    const { role } = await getUserRole();
    if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
