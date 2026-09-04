import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole, getProjectPermissions } from "@/lib/auth";
import { todayKL } from "@/lib/dates";
import { fetchKPIData, fetchDerivedKPI, writeKPIValues, detectBrandsOrdered } from "@/lib/sheets";
import { readKPIMirror, pickKPIMirrorEntry } from "@/lib/data-source";
import { refreshKPIMirror } from "@/lib/sync";
import { revalidateTag } from "next/cache";

// GET /api/kpi?clientId=xxx&brand=yyy
// Reads KPI values from Google Sheet for the Settings page
export async function GET(req: NextRequest) {
  try {
    const { role } = await getUserRole();
    if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientId = req.nextUrl.searchParams.get("clientId");
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
    const perms = await getProjectPermissions(clientId);
    if (!perms.includes("view_projection")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabase();
    const { data: client } = await supabase
      .from("clients")
      .select("sheet_id, funnel_type")
      .eq("id", clientId)
      .single();

    if (!client?.sheet_id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const brandParam = req.nextUrl.searchParams.get("brand") || undefined;

    // Mirror-first (speed project C): when the KPI mirror exists it serves
    // EVERY client regardless of data_source — Projection is the owner's
    // planning tool, and the mirror refreshes daily plus on every save.
    // Empty mirror (pre-first-sync) falls through to the live-sheet path.
    const entries = await readKPIMirror(clientId);
    if (entries.length > 0) {
      const named = entries.filter((e) => e.brand !== "").map((e) => e.brand);
      const isMulti = named.length > 1;
      const wanted = isMulti ? brandParam : named[0] || undefined;
      const hit = pickKPIMirrorEntry(entries, wanted);
      return NextResponse.json({
        kpi: hit?.kpi ?? {},
        derived: hit?.derived ?? {},
        funnelType: client.funnel_type,
        brands: isMulti ? named : [],
      });
    }

    const brands = await detectBrandsOrdered(client.sheet_id);
    const isMultiBrand = brands.length > 1;

    // For single-brand, use the only brand; for multi-brand, use selected brand
    const brandName = isMultiBrand ? brandParam : brands[0] || undefined;
    const [kpi, derived] = await Promise.all([
      fetchKPIData(client.sheet_id, brandName),
      fetchDerivedKPI(client.sheet_id, brandName),
    ]);

    return NextResponse.json({
      kpi: kpi || {},
      derived: derived || {},
      funnelType: client.funnel_type,
      brands: isMultiBrand ? brands : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to read KPI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/kpi
// Writes KPI values to Google Sheet + Supabase
export async function POST(req: NextRequest) {
  try {
    const { role } = await getUserRole();
    if (!role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clientId, fields, brand } = await req.json();
    if (!clientId || !fields) {
      return NextResponse.json({ error: "clientId and fields required" }, { status: 400 });
    }
    // Writing targets back to the Google Sheet is its own permission —
    // viewing the calculators does not imply it.
    const perms = await getProjectPermissions(clientId);
    if (!perms.includes("save_projection")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createServerSupabase();
    const { data: client } = await supabase
      .from("clients")
      .select("sheet_id, funnel_type")
      .eq("id", clientId)
      .single();

    if (!client?.sheet_id) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Determine brand for multi-brand sheets
    const brands = await detectBrandsOrdered(client.sheet_id);
    const isMultiBrand = brands.length > 1;
    const brandName = isMultiBrand ? (brand || undefined) : (brands[0] || undefined);

    // Write to Google Sheet
    await writeKPIValues(client.sheet_id, fields, brandName);

    // Write-through (speed project C): rebuild this client's KPI mirror fresh
    // so the follow-up GET (refreshDerived) is read-your-own-writes, and bust
    // the sheet cache for pages still reading the live path — fixes the
    // longstanding "saved but still seeing old values" staleness.
    try {
      await refreshKPIMirror(clientId, client.sheet_id);
    } catch (err) {
      console.error("kpi_mirror refresh after save:", err);
    }
    revalidateTag(`sheet:${client.sheet_id}`, "max");

    // Compute derived values for Supabase cache
    const sales = fields.sales ?? 0;
    const aov = fields.aov ?? 0;
    const orders = aov > 0 ? Math.round(sales / aov) : 0;
    const dailyAdExcl = fields.daily_ad ?? 0;
    const dailyAdIncl = dailyAdExcl * 1.08;
    const now = todayKL();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const adSpend = dailyAdIncl * daysInMonth;
    const roas = adSpend > 0 ? sales / adSpend : 0;
    const cpl = fields.cpl ?? (adSpend > 0 && fields.respond_rate ? adSpend / 100 : 0);

    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Upsert to Supabase as cache
    const { error: dbError } = await supabase.from("kpi_configs").upsert(
      {
        client_id: clientId,
        month: currentMonth,
        sales,
        orders,
        aov,
        cpl,
        respond_rate: fields.respond_rate ?? 0,
        appt_rate: fields.appt_rate ?? 0,
        showup_rate: fields.showup_rate ?? 0,
        conv_rate: fields.conv_rate ?? 0,
        ad_spend: adSpend,
        daily_ad: dailyAdIncl,
        roas: Math.round(roas * 100) / 100,
        cpa_pct: fields.cpa_pct ?? 0,
        target_contact: 0,
        target_appt: 0,
        target_showup: 0,
      },
      { onConflict: "client_id,month" },
    );

    if (dbError) {
      console.error("Supabase upsert error:", dbError);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to write KPI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
