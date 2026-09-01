// ── Phase 2 reconciliation tool (PRD L85) ───────────────────────
//
// For a given client + month, pulls the SAME figures through both read paths
// — live Google Sheet and the Supabase mirror — and diffs them at three
// levels: per-day per-field, computed funnel metrics, and person aggregation.
// Zero diff across 3 clients × 3 months is Phase 2's exit gate.
//
// Run locally (never in CI — needs real credentials from .env.local):
//   npx tsx scripts/reconcile.mts [--json out.json]
//
// Read-only on both sides. Uses lib/data-source.ts verbatim, so what is
// compared is exactly what the pages render.

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load .env.local before importing anything that reads env at call time.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

const { getPerformanceData, getPersonData, getLeadData } = await import("../lib/data-source");
const { computeMetrics } = await import("../lib/metrics");
const { countEstShowUp } = await import("../lib/sheets");
const { formatDateParam } = await import("../lib/dates");
const { createAdminSupabase } = await import("../lib/supabase/admin");
const { syncClient } = await import("../lib/sync");

type Diff = { where: string; field: string; sheet: unknown; db: unknown };

const CLIENT_NAMES = ["Rygis Private Gym", "2990's@Petaling Jaya", "Carress@Kelana Jaya"];
const MONTHS: [number, number][] = [[2026, 6], [2026, 7], [2026, 8]];
const EPS = 1e-9;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
const numEq = (a: unknown, b: unknown) => {
  const x = num(a), y = num(b);
  if (Number.isNaN(x) && Number.isNaN(y)) return true;
  return Math.abs(x - y) <= EPS * Math.max(1, Math.abs(x), Math.abs(y));
};

function diffRecords(where: string, sheet: Record<string, unknown>, db: Record<string, unknown>, out: Diff[]) {
  for (const k of new Set([...Object.keys(sheet), ...Object.keys(db)])) {
    const a = sheet[k], b = db[k];
    const same = typeof a === "number" || typeof b === "number" ? numEq(a, b) : JSON.stringify(a) === JSON.stringify(b);
    if (!same) out.push({ where, field: k, sheet: a, db: b });
  }
}

async function main() {
  const db = createAdminSupabase();
  const { data: clientRows, error } = await db.from("clients")
    .select("id, name, sheet_id, profile").in("name", CLIENT_NAMES);
  if (error) throw new Error(error.message);
  const clients = CLIENT_NAMES.map((n) => {
    const c = (clientRows ?? []).find((r) => r.name === n);
    if (!c) throw new Error(`client not found: ${n}`);
    return c;
  });

  const report: Record<string, { compared: number; diffs: Diff[] }> = {};
  let totalDiffs = 0;
  let totalCompared = 0;

  for (const client of clients) {
    // Fresh mirror first: clear the lead hash (forces a lead-tab rewrite that
    // backfills row_no + cell marks) and run one sync, so the comparison is
    // live-vs-current, not live-vs-this-morning.
    await db.from("client_states").update({ lead_hash: "" }).eq("client_id", client.id);
    const sync = await syncClient(client.id, client.sheet_id, "manual");
    if (!sync.ok) throw new Error(`sync failed for ${client.name}: ${sync.error}`);
    console.log(`synced ${client.name}: ${JSON.stringify(sync.stats)}`);

    // Whole-history pulls once per client; month windows slice in memory.
    const [sheetPerf, dbPerf, sheetLead, dbLead] = await Promise.all([
      getPerformanceData(client, "sheets"),
      getPerformanceData(client, "db"),
      getLeadData(client, "sheets"),
      getLeadData(client, "db"),
    ]);

    for (const [y, m] of MONTHS) {
      const label = `${client.name} ${y}-${String(m).padStart(2, "0")}`;
      const from = new Date(y, m - 1, 1), to = new Date(y, m, 0);
      const diffs: Diff[] = [];
      let compared = 0;

      // 1) Per-day per-field
      const inMonth = (r: { date: Date }) => r.date >= from && r.date <= to;
      const byDate = (rows: { date: Date }[]) =>
        new Map(rows.filter(inMonth).map((r) => [formatDateParam(r.date), r as unknown as Record<string, unknown>]));
      const sMap = byDate(sheetPerf.data), dMap = byDate(dbPerf.data);
      for (const key of new Set([...sMap.keys(), ...dMap.keys()])) {
        compared++;
        const s = sMap.get(key), d = dMap.get(key);
        if (!s || !d) {
          diffs.push({ where: `daily ${key}`, field: "(row)", sheet: s ? "present" : "MISSING", db: d ? "present" : "MISSING" });
          continue;
        }
        const { date: _s, ...sf } = s; const { date: _d, ...df } = d;
        diffRecords(`daily ${key}`, sf, df, diffs);
      }

      // 2) Funnel metrics (each path with its own funnelType, as the pages do)
      compared++;
      if (sheetPerf.funnelType !== dbPerf.funnelType) {
        diffs.push({ where: "meta", field: "funnelType", sheet: sheetPerf.funnelType, db: dbPerf.funnelType });
      }
      diffRecords("meta.tracked", sheetPerf.tracked as unknown as Record<string, unknown>, dbPerf.tracked as unknown as Record<string, unknown>, diffs);
      const sm = computeMetrics(sheetPerf.data.filter(inMonth), sheetPerf.funnelType);
      const dm = computeMetrics(dbPerf.data.filter(inMonth), dbPerf.funnelType);
      diffRecords("metrics", sm as unknown as Record<string, unknown>, dm as unknown as Record<string, unknown>, diffs);

      // 3) Person aggregation (unfiltered; the dashboard's default view)
      compared++;
      const [sp, dp] = await Promise.all([
        getPersonData(client, "sheets", from, to),
        getPersonData(client, "db", from, to),
      ]);
      const norm = (p: typeof sp) => JSON.parse(JSON.stringify({
        appointmentPersons: p.appointmentPersons,
        salesPersons: p.salesPersons,
        brandBreakdowns: Object.fromEntries(Object.entries(p.brandBreakdowns).sort()),
        availableSources: p.availableSources,
      }));
      const spn = norm(sp), dpn = norm(dp);
      if (JSON.stringify(spn) !== JSON.stringify(dpn)) {
        for (const section of ["appointmentPersons", "salesPersons", "brandBreakdowns", "availableSources"] as const) {
          if (JSON.stringify(spn[section]) !== JSON.stringify(dpn[section])) {
            diffs.push({ where: "person", field: section, sheet: spn[section], db: dpn[section] });
          }
        }
      }

      // 4) Est.Show Up count (budget projection input)
      compared++;
      const sCount = countEstShowUp(sheetLead, from, to);
      const dCount = countEstShowUp(dbLead, from, to);
      if (sCount !== dCount) diffs.push({ where: "estShowUp", field: "count", sheet: sCount, db: dCount });

      report[label] = { compared, diffs };
      totalDiffs += diffs.length;
      totalCompared += compared;
      console.log(`${diffs.length === 0 ? "✅" : "❌"} ${label}: ${compared} comparisons, ${diffs.length} diffs`);
      for (const d of diffs.slice(0, 10)) {
        console.log(`   · ${d.where} [${d.field}] sheet=${JSON.stringify(d.sheet)} db=${JSON.stringify(d.db)}`);
      }
      if (diffs.length > 10) console.log(`   · … ${diffs.length - 10} more`);
    }
  }

  // Per-brand pass for the multi-brand sample (Kelana Jaya)
  for (const client of clients) {
    const { data: states } = await db.from("brand_states").select("brand").eq("client_id", client.id);
    const brandList = (states ?? []).map((s) => String(s.brand)).filter(Boolean);
    if (brandList.length <= 1) continue;
    for (const b of brandList) {
      const [sB, dB] = await Promise.all([
        getPerformanceData(client, "sheets", b),
        getPerformanceData(client, "db", b),
      ]);
      const diffs: Diff[] = [];
      const sMap = new Map(sB.data.map((r) => [formatDateParam(r.date), r as unknown as Record<string, unknown>]));
      const dMap = new Map(dB.data.map((r) => [formatDateParam(r.date), r as unknown as Record<string, unknown>]));
      for (const key of new Set([...sMap.keys(), ...dMap.keys()])) {
        const s = sMap.get(key), d = dMap.get(key);
        if (!s || !d) { diffs.push({ where: `daily ${key}`, field: "(row)", sheet: s ? "present" : "MISSING", db: d ? "present" : "MISSING" }); continue; }
        const { date: _s, ...sf } = s; const { date: _d, ...df } = d;
        diffRecords(`daily ${key}`, sf, df, diffs);
      }
      const label = `${client.name} @${b} (all time)`;
      report[label] = { compared: sMap.size, diffs };
      totalDiffs += diffs.length;
      totalCompared += sMap.size;
      console.log(`${diffs.length === 0 ? "✅" : "❌"} ${label}: ${sMap.size} days, ${diffs.length} diffs`);
      for (const d of diffs.slice(0, 5)) {
        console.log(`   · ${d.where} [${d.field}] sheet=${JSON.stringify(d.sheet)} db=${JSON.stringify(d.db)}`);
      }
    }
  }

  console.log(`\n${totalDiffs === 0 ? "🟢 ZERO-DIFF" : "🔴 DIFFS FOUND"}: ${totalCompared} comparisons, ${totalDiffs} diffs total`);
  const jsonIdx = process.argv.indexOf("--json");
  if (jsonIdx >= 0 && process.argv[jsonIdx + 1]) {
    writeFileSync(process.argv[jsonIdx + 1], JSON.stringify({ generatedAt: new Date().toISOString(), totalCompared, totalDiffs, report }, null, 2));
    console.log(`report written to ${process.argv[jsonIdx + 1]}`);
  }
  process.exit(totalDiffs === 0 ? 0 : 1);
}

await main();
