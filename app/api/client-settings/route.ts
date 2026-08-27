import { NextRequest, NextResponse } from "next/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { listSheetTabs } from "@/lib/sheets";

/** Accepts a full Google Sheets URL or a bare spreadsheet id. */
function extractSheetId(input: string): string | null {
  const fromUrl = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (fromUrl) return fromUrl;
  return /^[a-zA-Z0-9-_]{20,}$/.test(input) ? input : null;
}

// PUT /api/client-settings { clientId, name?, sheetUrl? } — project identity
// and connection settings. Gate = edit_settings (owner or manager); the write
// uses the service role because the clients UPDATE RLS policy is owner-only
// while managers legitimately manage project settings.
export async function PUT(req: NextRequest) {
  const { role } = await getUserRole();
  if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const clientId = body?.clientId;
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("edit_settings")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, string> = {};

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) {
      return NextResponse.json({ error: "Name must be 1-80 characters" }, { status: 400 });
    }
    update.name = name;
  }

  if (body?.sheetUrl !== undefined) {
    const sheetId = extractSheetId(String(body.sheetUrl ?? "").trim());
    if (!sheetId) {
      return NextResponse.json({ error: "Not a valid Google Sheet link or ID" }, { status: 400 });
    }
    // Pointing a project at the wrong sheet silently breaks every number —
    // refuse to save unless the service account can actually read it.
    try {
      await listSheetTabs(sheetId);
    } catch {
      return NextResponse.json(
        { error: "Cannot read that sheet — share it with the service account first" },
        { status: 400 },
      );
    }
    update.sheet_id = sheetId;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const db = createAdminSupabase();
  const { error } = await db.from("clients").update(update).eq("id", clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...update });
}
