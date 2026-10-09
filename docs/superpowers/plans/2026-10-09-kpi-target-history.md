# KPI Target History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ads Projection KPI targets a full, append-only history so past-month targets can be shown against that month's actuals, on both the dashboard and a new KPI History page.

**Architecture:** A new append-only `kpi_target_versions` table stores a full target snapshot per save. The save path (`/api/kpi` POST) appends a version additively. A pure resolver returns the target "in effect as of" any date (carry-forward built in). The dashboard and a new KPI History page read through that resolver. Existing tables (`kpi_configs`, `kpi_mirror`, sheet) are untouched.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres), TypeScript, Vitest (unit), Playwright + system Chrome (UI QA), Supabase MCP for migrations.

## Global Constraints

- Next.js 16 — read `node_modules/next/dist/docs/` before touching framework APIs; "middleware" is "proxy".
- Full precision in all target/metric math; round only at display (mirrors `lib/kpi-calculator.ts`).
- Additive only: no change to existing `kpi_configs`/`kpi_mirror`/sheet writes or reads. Current-month dashboard output must stay byte-for-byte unchanged.
- Snapshot shape == `KPIConfig` (`lib/types.ts`) so a snapshot is a drop-in target for `MoMTable`/`HeroCards`.
- Supabase project id: `sqhcagwakxhcwbsytmab`. Migrations: write SQL to `supabase/migrations/` AND apply via Supabase MCP `apply_migration`.
- Permissions: reuse `view_projection` feature key (no new key). Writes via service-role (`createAdminSupabase`), reads via the pattern already used by the surface.
- Verify against `next build` output (dev HMR serves stale chunks). Clean up any throwaway test data after QA.

---

### Task 1: `kpi_target_versions` table + type

**Files:**
- Create: `supabase/migrations/20261009_kpi_target_versions.sql`
- Modify: `lib/types.ts` (append `KpiTargetVersion`)

**Interfaces:**
- Produces: table `kpi_target_versions(id, client_id, brand, effective_from, snapshot jsonb, source, changed_by, created_at)`; TS type `KpiTargetVersion { id: string; client_id: string; brand: string; effective_from: string; snapshot: KPIConfig; source: "save" | "backfill"; changed_by: string | null }`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20261009_kpi_target_versions.sql
-- Append-only history of Ads Projection KPI target saves. Never updated/deleted.
create table if not exists kpi_target_versions (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id) on delete cascade,
  brand          text not null default '',
  effective_from timestamptz not null,
  snapshot       jsonb not null,
  source         text not null default 'save' check (source in ('save','backfill')),
  changed_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists kpi_target_versions_lookup
  on kpi_target_versions (client_id, brand, effective_from desc);
alter table kpi_target_versions enable row level security;
-- Read: any member with access to the client (same shape as project_access reads).
create policy kpi_target_versions_select on kpi_target_versions
  for select using (
    exists (
      select 1 from project_access pa
      join agencies a on a.id = pa.agency_id
      where pa.client_id = kpi_target_versions.client_id
        and a.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1 from clients c
      join agencies a on a.id = c.agency_id
      where c.id = kpi_target_versions.client_id
        and a.email = auth.jwt() ->> 'email'
    )
  );
-- Writes happen via the service role only (no INSERT/UPDATE/DELETE policy).
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (name `kpi_target_versions`, project `sqhcagwakxhcwbsytmab`) with the SQL above.

- [ ] **Step 3: Verify the table exists**

Run (MCP `execute_sql`):
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='kpi_target_versions' order by ordinal_position;
```
Expected: the 8 columns above.

- [ ] **Step 4: Add the TS type**

In `lib/types.ts`, after `KPIConfig`:
```ts
export interface KpiTargetVersion {
  id: string;
  client_id: string;
  brand: string;
  effective_from: string;   // ISO timestamp
  snapshot: KPIConfig;      // full target set at save time
  source: "save" | "backfill";
  changed_by: string | null;
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261009_kpi_target_versions.sql lib/types.ts
git commit -m "feat(kpi-history): add kpi_target_versions table + type"
```

---

### Task 2: Pure resolvers (`lib/kpi-history.ts`) — TDD

**Files:**
- Create: `lib/kpi-history.ts`
- Test: `lib/kpi-history.test.ts`

**Interfaces:**
- Consumes: `KpiTargetVersion`, `KPIConfig` from `lib/types.ts`.
- Produces:
  - `effectiveVersionAsOf(versions: KpiTargetVersion[], asOf: Date): KpiTargetVersion | null`
  - `versionsInRange(versions: KpiTargetVersion[], start: Date, end: Date): KpiTargetVersion[]` (ascending; includes the carry-in version effective at `start`)
  - `diffSnapshots(prev: KPIConfig | null, next: KPIConfig): { key: keyof KPIConfig; from: number | null; to: number }[]`
  - `monthStartsBetween(earliest: Date, now: Date): Date[]` (UTC month starts, ascending, inclusive)

- [ ] **Step 1: Write the failing tests**

```ts
// lib/kpi-history.test.ts
import { describe, it, expect } from "vitest";
import { effectiveVersionAsOf, versionsInRange, diffSnapshots, monthStartsBetween } from "./kpi-history";
import type { KpiTargetVersion, KPIConfig } from "./types";

function snap(over: Partial<KPIConfig>): KPIConfig {
  return { sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0,
    showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0, cpa_pct: 0,
    target_contact: 0, target_appt: 0, target_showup: 0, ...over };
}
function v(id: string, iso: string, over: Partial<KPIConfig>): KpiTargetVersion {
  return { id, client_id: "c", brand: "", effective_from: iso, snapshot: snap(over), source: "save", changed_by: null };
}
const vs = [
  v("1", "2026-07-01T00:00:00Z", { ad_spend: 3000 }),
  v("2", "2026-09-01T10:00:00Z", { ad_spend: 3000 }),
  v("3", "2026-09-15T14:00:00Z", { ad_spend: 5000 }),
];

describe("effectiveVersionAsOf", () => {
  it("returns the latest version at or before asOf", () => {
    expect(effectiveVersionAsOf(vs, new Date("2026-09-30T23:59:59Z"))?.id).toBe("3");
  });
  it("carries forward across gap months (Aug has no version → July's)", () => {
    expect(effectiveVersionAsOf(vs, new Date("2026-08-31T23:59:59Z"))?.id).toBe("1");
  });
  it("returns null before the first version", () => {
    expect(effectiveVersionAsOf(vs, new Date("2026-06-01T00:00:00Z"))).toBeNull();
  });
});

describe("versionsInRange", () => {
  it("includes the carry-in version plus any changes inside the range", () => {
    const got = versionsInRange(vs, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-30T23:59:59Z")).map((x) => x.id);
    expect(got).toEqual(["2", "3"]); // #2 effective at start, #3 mid-month change
  });
});

describe("diffSnapshots", () => {
  it("lists only changed fields with from/to", () => {
    const d = diffSnapshots(snap({ ad_spend: 3000, cpa_pct: 8 }), snap({ ad_spend: 5000, cpa_pct: 8 }));
    expect(d).toEqual([{ key: "ad_spend", from: 3000, to: 5000 }]);
  });
  it("prev null → all non-zero fields are 'from null' (initial set)", () => {
    const d = diffSnapshots(null, snap({ ad_spend: 3000 }));
    expect(d).toEqual([{ key: "ad_spend", from: null, to: 3000 }]);
  });
});

describe("monthStartsBetween", () => {
  it("lists UTC month-starts inclusive", () => {
    const got = monthStartsBetween(new Date("2026-07-15T00:00:00Z"), new Date("2026-10-02T00:00:00Z"))
      .map((d) => d.toISOString().slice(0, 7));
    expect(got).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/kpi-history.test.ts`
Expected: FAIL (module not found / functions undefined).

- [ ] **Step 3: Implement `lib/kpi-history.ts` (pure functions only)**

```ts
import type { KpiTargetVersion, KPIConfig } from "./types";

const SNAPSHOT_KEYS: (keyof KPIConfig)[] = [
  "sales", "orders", "aov", "cpl", "respond_rate", "appt_rate", "showup_rate",
  "conv_rate", "ad_spend", "daily_ad", "roas", "cpa_pct",
  "target_contact", "target_appt", "target_showup",
];

function sortedDesc(versions: KpiTargetVersion[]): KpiTargetVersion[] {
  return [...versions].sort((a, b) => b.effective_from.localeCompare(a.effective_from));
}

/** Latest version whose effective_from <= asOf (carry-forward). null if none. */
export function effectiveVersionAsOf(versions: KpiTargetVersion[], asOf: Date): KpiTargetVersion | null {
  const cut = asOf.getTime();
  return sortedDesc(versions).find((v) => new Date(v.effective_from).getTime() <= cut) ?? null;
}

/** Ascending: the version in effect at `start` (carry-in) + any versions inside (start,end]. */
export function versionsInRange(versions: KpiTargetVersion[], start: Date, end: Date): KpiTargetVersion[] {
  const s = start.getTime(), e = end.getTime();
  const carryIn = effectiveVersionAsOf(versions, start);
  const inside = versions.filter((v) => {
    const t = new Date(v.effective_from).getTime();
    return t > s && t <= e;
  });
  const all = carryIn ? [carryIn, ...inside] : inside;
  // de-dup (carryIn could equal an inside boundary) + ascending
  const seen = new Set<string>();
  return all
    .filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)))
    .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
}

/** Changed numeric fields between two snapshots. prev=null => initial set (from null). */
export function diffSnapshots(prev: KPIConfig | null, next: KPIConfig): { key: keyof KPIConfig; from: number | null; to: number }[] {
  const out: { key: keyof KPIConfig; from: number | null; to: number }[] = [];
  for (const key of SNAPSHOT_KEYS) {
    const to = Number(next[key] ?? 0);
    const from = prev ? Number(prev[key] ?? 0) : null;
    if (from === null ? to !== 0 : from !== to) out.push({ key, from, to });
  }
  return out;
}

/** UTC month-start Dates from earliest's month through now's month, inclusive, ascending. */
export function monthStartsBetween(earliest: Date, now: Date): Date[] {
  const out: Date[] = [];
  let y = earliest.getUTCFullYear(), m = earliest.getUTCMonth();
  const endY = now.getUTCFullYear(), endM = now.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    out.push(new Date(Date.UTC(y, m, 1)));
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/kpi-history.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add lib/kpi-history.ts lib/kpi-history.test.ts
git commit -m "feat(kpi-history): pure effective-target + diff resolvers (tested)"
```

---

### Task 3: Write path — append a version on save

**Files:**
- Modify: `lib/kpi-history.ts` (add DB writer)
- Modify: `app/api/kpi/route.ts` (call it after the existing writes)

**Interfaces:**
- Consumes: `createAdminSupabase` (`lib/supabase/admin`), `getUserRole` (`lib/auth`).
- Produces: `appendTargetVersion(clientId: string, brand: string, snapshot: KPIConfig, changedBy: string | null): Promise<void>`.

- [ ] **Step 1: Add the writer to `lib/kpi-history.ts`**

```ts
import { createAdminSupabase } from "./supabase/admin";
// ...existing pure functions above...

/** Append one immutable target snapshot. Service-role; never updates existing rows. */
export async function appendTargetVersion(
  clientId: string, brand: string, snapshot: KPIConfig, changedBy: string | null,
): Promise<void> {
  const db = createAdminSupabase();
  const { error } = await db.from("kpi_target_versions").insert({
    client_id: clientId,
    brand: brand || "",
    effective_from: new Date().toISOString(),
    snapshot,
    source: "save",
    changed_by: changedBy,
  });
  if (error) throw new Error(`kpi_target_versions insert: ${error.message}`);
}
```

- [ ] **Step 2: Wire it into `/api/kpi` POST**

In `app/api/kpi/route.ts`, the POST already builds the `kpi_configs` upsert object. After that upsert (around `:161`), append a version using the SAME computed values. Add near the top of POST: resolve the agency id — `const { agencyId } = await getUserRole();` (import `getUserRole` from `@/lib/auth`; it's already used in GET). Then after the `kpi_configs` upsert:

```ts
// Append an immutable history snapshot (additive — does not affect anything above).
try {
  await appendTargetVersion(clientId, brandName ?? "", {
    sales, orders, aov, cpl,
    respond_rate: fields.respond_rate ?? 0,
    appt_rate: fields.appt_rate ?? 0,
    showup_rate: fields.showup_rate ?? 0,
    conv_rate: fields.conv_rate ?? 0,
    ad_spend: adSpend, daily_ad: dailyAdIncl,
    roas: Math.round(roas * 100) / 100,
    cpa_pct: fields.cpa_pct ?? 0,
    target_contact: 0, target_appt: 0, target_showup: 0,
  }, agencyId);
} catch (err) {
  console.error("kpi_target_versions append after save:", err);
}
```
Add the import: `import { appendTargetVersion } from "@/lib/kpi-history";`

- [ ] **Step 3: Verify tsc + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -3`
Expected: no TS errors; build completes.

- [ ] **Step 4: Integration check (save appends exactly one row)**

Start `next start -p 3100` (prod build). With a throwaway owner + client + `kpi_mirror` row (see the session's QA pattern), POST `/api/kpi` once via the Projection save, then:
```sql
select count(*), max(effective_from) from kpi_target_versions where client_id = '<throwaway-id>';
```
Expected: count 1, recent timestamp. Delete throwaway data after.

- [ ] **Step 5: Commit**

```bash
git add lib/kpi-history.ts app/api/kpi/route.ts
git commit -m "feat(kpi-history): append a target snapshot on every save"
```

---

### Task 4: Backfill existing history from `kpi_configs`

**Files:**
- Create: `supabase/migrations/20261009_kpi_target_versions_backfill.sql`

**Interfaces:**
- Consumes: existing `kpi_configs` rows.
- Produces: one `source='backfill'` version per `kpi_configs` row, dated to month-start.

- [ ] **Step 1: Write the backfill SQL**

```sql
-- supabase/migrations/20261009_kpi_target_versions_backfill.sql
-- One-time seed: each kpi_configs row -> a backfilled snapshot dated to month start.
-- Idempotent: skip if a backfill row already exists for that client/month.
insert into kpi_target_versions (client_id, brand, effective_from, snapshot, source, changed_by)
select
  k.client_id, '',
  date_trunc('month', k.month)::timestamptz,
  jsonb_build_object(
    'sales', coalesce(k.sales,0), 'orders', coalesce(k.orders,0), 'aov', coalesce(k.aov,0),
    'cpl', coalesce(k.cpl,0), 'respond_rate', coalesce(k.respond_rate,0),
    'appt_rate', coalesce(k.appt_rate,0), 'showup_rate', coalesce(k.showup_rate,0),
    'conv_rate', coalesce(k.conv_rate,0), 'ad_spend', coalesce(k.ad_spend,0),
    'daily_ad', coalesce(k.daily_ad,0), 'roas', coalesce(k.roas,0), 'cpa_pct', coalesce(k.cpa_pct,0),
    'target_contact', coalesce(k.target_contact,0), 'target_appt', coalesce(k.target_appt,0),
    'target_showup', coalesce(k.target_showup,0)
  ),
  'backfill', null
from kpi_configs k
where not exists (
  select 1 from kpi_target_versions v
  where v.client_id = k.client_id and v.source = 'backfill'
    and v.effective_from = date_trunc('month', k.month)::timestamptz
);
```

- [ ] **Step 2: Apply the migration**

Apply via Supabase MCP `apply_migration` (name `kpi_target_versions_backfill`).

- [ ] **Step 3: Verify backfill counts**

Run:
```sql
select c.name, count(*) as backfilled
from kpi_target_versions v join clients c on c.id = v.client_id
where v.source = 'backfill' group by c.name order by backfilled desc;
```
Expected: 3–7 rows per active client (matches the earlier `kpi_configs` month counts).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261009_kpi_target_versions_backfill.sql
git commit -m "feat(kpi-history): backfill history from kpi_configs"
```

---

### Task 5: Dashboard — period-accurate target

**Files:**
- Modify: `lib/kpi-history.ts` (add `fetchEffectiveTarget`)
- Modify: `app/[clientId]/page.tsx` (use it)

**Interfaces:**
- Consumes: `effectiveVersionAsOf`, `createAdminSupabase`, `KPIConfig`.
- Produces: `fetchEffectiveTarget(clientId: string, brand: string, asOf: Date): Promise<KPIConfig | null>`.

- [ ] **Step 1: Add `fetchEffectiveTarget`**

```ts
export async function fetchTargetVersions(clientId: string, brand: string): Promise<KpiTargetVersion[]> {
  const db = createAdminSupabase();
  const { data } = await db
    .from("kpi_target_versions")
    .select("id, client_id, brand, effective_from, snapshot, source, changed_by")
    .eq("client_id", clientId)
    .in("brand", brand ? [brand, ""] : [""])     // brand rows + '' (backfill / single-brand)
    .order("effective_from", { ascending: false });
  return (data ?? []) as KpiTargetVersion[];
}

export async function fetchEffectiveTarget(clientId: string, brand: string, asOf: Date): Promise<KPIConfig | null> {
  const versions = await fetchTargetVersions(clientId, brand);
  return effectiveVersionAsOf(versions, asOf)?.snapshot ?? null;
}
```

- [ ] **Step 2: Use it in `app/[clientId]/page.tsx`**

Find the `kpi` resolution (`const kpi = sheetKPI || kpiRow || defaults;`, ~`:148`). Before it, compute the effective historical target as of the selected range end (`reportEnd` is the existing range-end Date in that file):
```ts
const effectiveKpi = await fetchEffectiveTarget(clientId, selectedBrand ?? "", reportEnd);
```
Then change the resolution so the historical target wins when present, falling back to live:
```ts
const kpi = effectiveKpi || sheetKPI || kpiRow || defaults;
```
Add import: `import { fetchEffectiveTarget } from "@/lib/kpi-history";`

- [ ] **Step 3: Verify tsc + build**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -3`
Expected: clean.

- [ ] **Step 4: Regression QA (current month unchanged; past month historical)**

Prod build on 3100. With a throwaway client that has TWO versions (one effective 2026-07, one effective now, different `ad_spend`) + `daily_metrics` for July and the current month:
- Load the dashboard for the CURRENT month → KPI target column shows the latest version (== current). Screenshot.
- Switch the date range to July → KPI target column shows July's version (the older `ad_spend`). Screenshot, confirm it differs.
Expected: current unchanged; past shows historical. Clean up throwaway data.

- [ ] **Step 5: Commit**

```bash
git add lib/kpi-history.ts "app/[clientId]/page.tsx"
git commit -m "feat(kpi-history): dashboard shows the target in effect for the viewed period"
```

---

### Task 6: Dashboard — "Target changes this period" timeline

**Files:**
- Create: `components/dashboard/target-change-timeline.tsx`
- Modify: `app/[clientId]/page.tsx` (fetch range versions, render the component)
- Modify: `lib/i18n.ts` (labels)

**Interfaces:**
- Consumes: `versionsInRange`, `diffSnapshots`, `fetchTargetVersions`, `KpiTargetVersion`.
- Produces: `<TargetChangeTimeline versions={KpiTargetVersion[]} lang={Lang} />` (client component, collapsible).

- [ ] **Step 1: Add i18n keys**

In `lib/i18n.ts` dict:
```ts
targetChanges: { en: "Target changes this period", zh: "本期目标变更" },
backfilledTag: { en: "backfilled · monthly", zh: "历史回填 · 月度" },
noTargetChanges: { en: "No target changes in this period.", zh: "本期内目标无变更。" },
```

- [ ] **Step 2: Create the component**

```tsx
"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { versionsInRange, diffSnapshots } from "@/lib/kpi-history";
import type { KpiTargetVersion } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { fmtRM } from "@/lib/utils";

const RM_KEYS = new Set(["sales", "aov", "cpl", "ad_spend", "daily_ad"]);
function fmtVal(key: string, v: number | null) {
  if (v === null) return "—";
  if (RM_KEYS.has(key)) return fmtRM(v);
  if (key === "roas") return `${v.toFixed(1)}x`;
  if (key.endsWith("_rate") || key === "cpa_pct") return `${v.toFixed(1)}%`;
  return String(Math.round(v));
}

export function TargetChangeTimeline({ versions, rangeStart, rangeEnd, lang }: {
  versions: KpiTargetVersion[]; rangeStart: string; rangeEnd: string; lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const inRange = versionsInRange(versions, new Date(rangeStart), new Date(rangeEnd));
  return (
    <div className="mt-4 rounded-[10px] border border-[var(--border)] bg-[var(--bg2)]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-2.5 text-[13px] font-medium text-[var(--t2)]">
        {t(lang, "targetChanges")} ({inRange.length})
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {inRange.length === 0 ? (
            <p className="text-[12px] text-[var(--t4)]">{t(lang, "noTargetChanges")}</p>
          ) : inRange.map((v, i) => {
            const prev = i === 0 ? null : inRange[i - 1].snapshot;
            const diffs = diffSnapshots(prev, v.snapshot);
            return (
              <div key={v.id} className="border-b border-[var(--border)] py-2 last:border-0">
                <div className="flex items-center gap-2 text-[12px] text-[var(--t3)]">
                  <span className="num">{new Date(v.effective_from).toLocaleDateString()}</span>
                  {v.source === "backfill" && <span className="rounded-full bg-[var(--bg3)] px-2 py-0.5 text-[10px] text-[var(--t4)]">{t(lang, "backfilledTag")}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[var(--t2)]">
                  {diffs.length === 0 ? <span className="text-[var(--t4)]">—</span> : diffs.map((d) => (
                    <span key={String(d.key)} className="num">{String(d.key)}: {fmtVal(String(d.key), d.from)} → {fmtVal(String(d.key), d.to)}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render it in `app/[clientId]/page.tsx`**

Fetch all versions once (reuse for both the effective target and the timeline):
```ts
import { fetchTargetVersions } from "@/lib/kpi-history";
import { effectiveVersionAsOf } from "@/lib/kpi-history";
// ... replace the fetchEffectiveTarget call from Task 5 with:
const targetVersions = await fetchTargetVersions(clientId, selectedBrand ?? "");
const effectiveKpi = effectiveVersionAsOf(targetVersions, reportEnd)?.snapshot ?? null;
```
Render the timeline under the `MoMTable` (pass ISO strings for `reportStart`/`reportEnd`):
```tsx
<TargetChangeTimeline
  versions={targetVersions}
  rangeStart={reportStart.toISOString()}
  rangeEnd={reportEnd.toISOString()}
  lang={lang}
/>
```
Add import: `import { TargetChangeTimeline } from "@/components/dashboard/target-change-timeline";`

- [ ] **Step 4: Verify tsc + build + QA**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -3`. Then on the throwaway client from Task 5, confirm the timeline expands and shows the July→now `ad_spend` change with correct from→to. Screenshot. Clean up.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/target-change-timeline.tsx "app/[clientId]/page.tsx" lib/i18n.ts
git commit -m "feat(kpi-history): collapsible target-change timeline on the dashboard"
```

---

### Task 7: KPI History page + nav

**Files:**
- Create: `app/[clientId]/kpi-history/page.tsx` (server)
- Create: `app/[clientId]/kpi-history/kpi-history-client.tsx` (client table + expand)
- Modify: `components/dashboard/sidebar.tsx` + `components/dashboard/mobile-nav.tsx` (nav item, `view_projection`-gated)
- Modify: `lib/i18n.ts` (labels)

**Interfaces:**
- Consumes: `fetchTargetVersions`, `effectiveVersionAsOf`, `monthStartsBetween`, `getPerformanceData`, `computeMetrics` (existing), `getProjectPermissions`.
- Produces: route `/[clientId]/kpi-history`; nav key `kpiHistory`.

- [ ] **Step 1: Add i18n keys**

```ts
kpiHistory: { en: "KPI History", zh: "KPI 历史" },
monthCol: { en: "Month", zh: "月份" },
targetCol: { en: "Target", zh: "目标" },
actualCol: { en: "Actual", zh: "实际" },
```

- [ ] **Step 2: Build the server page**

```tsx
// app/[clientId]/kpi-history/page.tsx
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getProjectPermissions } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeLang, LANG_COOKIE } from "@/lib/i18n";
import { resolveDataSource, getPerformanceData } from "@/lib/data-source";
import { computeMetrics } from "@/lib/metrics";
import { fetchTargetVersions, effectiveVersionAsOf, monthStartsBetween } from "@/lib/kpi-history";
import { KpiHistoryClient, type HistoryRow } from "./kpi-history-client";

export const dynamic = "force-dynamic";

export default async function KpiHistoryPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const perms = await getProjectPermissions(clientId);
  if (!perms.includes("view_projection")) redirect(`/${clientId}`);

  const lang = normalizeLang((await cookies()).get(LANG_COOKIE)?.value);
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) notFound();

  const versions = await fetchTargetVersions(clientId, "");
  const perf = await getPerformanceData(client, resolveDataSource(client));
  const now = new Date();
  const earliest = versions.length ? new Date(versions[versions.length - 1].effective_from) : now;

  const rows: HistoryRow[] = monthStartsBetween(earliest, now).reverse().map((mStart) => {
    const mEnd = new Date(Date.UTC(mStart.getUTCFullYear(), mStart.getUTCMonth() + 1, 0, 23, 59, 59));
    const target = effectiveVersionAsOf(versions, mEnd)?.snapshot ?? null;
    const monthRows = perf.data.filter((r) => r.date >= mStart && r.date <= mEnd);
    const actual = computeMetrics(monthRows, client.funnel_type === "walkin" ? "walkin" : "appointment");
    const changes = versions.filter((v) => {
      const t = new Date(v.effective_from);
      return t >= mStart && t <= mEnd;
    });
    return {
      month: mStart.toISOString().slice(0, 7),
      target: target ? { sales: target.sales, ad_spend: target.ad_spend, cpa_pct: target.cpa_pct, cpl: target.cpl } : null,
      actual: { sales: actual.sales, ad_spend: actual.ad_spend, cpa_pct: actual.cpa_pct, cpl: actual.cpl },
      changes: changes.map((v) => ({ id: v.id, effective_from: v.effective_from, source: v.source, snapshot: v.snapshot })),
    };
  });

  return <KpiHistoryClient rows={rows} lang={lang} />;
}
```

- [ ] **Step 3: Build the client table**

```tsx
// app/[clientId]/kpi-history/kpi-history-client.tsx
"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { diffSnapshots } from "@/lib/kpi-history";
import type { KPIConfig } from "@/lib/types";
import { t, type Lang } from "@/lib/i18n";
import { fmtRM } from "@/lib/utils";

export interface HistoryRow {
  month: string;
  target: { sales: number; ad_spend: number; cpa_pct: number; cpl: number } | null;
  actual: { sales: number; ad_spend: number; cpa_pct: number; cpl: number };
  changes: { id: string; effective_from: string; source: "save" | "backfill"; snapshot: KPIConfig }[];
}

export function KpiHistoryClient({ rows, lang }: { rows: HistoryRow[]; lang: Lang }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <h1 className="mb-6 font-heading text-2xl font-bold text-[var(--t1)]">{t(lang, "kpiHistory")}</h1>
      <div className="overflow-x-auto rounded-[12px] border border-[var(--border)]">
        <table className="w-full text-[13px]">
          <thead className="bg-[var(--bg3)] text-[var(--t4)]">
            <tr>
              <th className="px-4 py-2 text-left font-label text-[10px] uppercase">{t(lang, "monthCol")}</th>
              <th className="px-4 py-2 text-right font-label text-[10px] uppercase">Sales ({t(lang, "targetCol")}/{t(lang, "actualCol")})</th>
              <th className="px-4 py-2 text-right font-label text-[10px] uppercase">Ad Spend</th>
              <th className="px-4 py-2 text-right font-label text-[10px] uppercase">CPA%</th>
              <th className="px-4 py-2 text-right font-label text-[10px] uppercase">CPL</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <>
                <tr key={r.month} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--t1)] num">{r.month}</td>
                  <td className="px-4 py-3 text-right num">{r.target ? fmtRM(r.target.sales) : "—"} / {fmtRM(r.actual.sales)}</td>
                  <td className="px-4 py-3 text-right num">{r.target ? fmtRM(r.target.ad_spend) : "—"} / {fmtRM(r.actual.ad_spend)}</td>
                  <td className="px-4 py-3 text-right num">{r.target ? `${r.target.cpa_pct.toFixed(1)}%` : "—"} / {r.actual.cpa_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right num">{r.target ? fmtRM(r.target.cpl) : "—"} / {fmtRM(r.actual.cpl)}</td>
                  <td className="px-4 py-3 text-right">
                    {r.changes.length > 0 && (
                      <button onClick={() => setOpen(open === r.month ? null : r.month)} className="text-[var(--t4)]">
                        <ChevronDown className={`h-4 w-4 transition-transform ${open === r.month ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </td>
                </tr>
                {open === r.month && (
                  <tr key={r.month + "-exp"} className="bg-[var(--bg2)]">
                    <td colSpan={6} className="px-4 py-2">
                      {r.changes.map((c, i) => {
                        const prev = i === 0 ? null : r.changes[i - 1].snapshot;
                        const diffs = diffSnapshots(prev, c.snapshot);
                        return (
                          <div key={c.id} className="py-1 text-[12px] text-[var(--t2)]">
                            <span className="num text-[var(--t3)]">{new Date(c.effective_from).toLocaleDateString()}</span>
                            {" — "}
                            {diffs.length === 0 ? "—" : diffs.map((d) => `${String(d.key)}: ${d.from ?? "—"}→${d.to}`).join(", ")}
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the nav item**

In `components/dashboard/sidebar.tsx`, add to `adminItems` (gated `view_projection`):
```ts
...(can("view_projection") ? [{ href: `/${clientId}/kpi-history`, labelKey: "kpiHistory", icon: History }] : []),
```
Import `History` from lucide-react. Mirror the same link in `components/dashboard/mobile-nav.tsx`.

- [ ] **Step 5: Verify tsc + build + QA**

Run: `npx tsc --noEmit && npx next build 2>&1 | tail -3`. On the throwaway client (with 2 versions + daily_metrics), load `/[clientId]/kpi-history`: table lists months with target/actual; the month with the mid-period change expands to show the diff. Screenshot both. Clean up throwaway data.

- [ ] **Step 6: Commit**

```bash
git add "app/[clientId]/kpi-history" components/dashboard/sidebar.tsx components/dashboard/mobile-nav.tsx lib/i18n.ts
git commit -m "feat(kpi-history): KPI History overview page + sidebar entry"
```

---

## Self-Review

**Spec coverage:**
- Append-only snapshot table → Task 1. ✓
- Append on save → Task 3. ✓
- Backfill from kpi_configs → Task 4. ✓
- Effective-target resolver + carry-forward → Task 2 (pure) + Task 5 (DB). ✓
- Dashboard period-accurate → Task 5. ✓
- Change timeline (mid-month policy display) → Task 6. ✓
- KPI History page + nav + view_projection gate → Task 7. ✓
- Multi-brand caveat (brand '' backfill; brand+'' read in `fetchTargetVersions`) → Task 5 Step 1. ✓
- Out-of-scope items (charts/edit/notify/export) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step has real code. ✓

**Type consistency:** `KpiTargetVersion.snapshot: KPIConfig` used uniformly; `effectiveVersionAsOf`/`versionsInRange`/`diffSnapshots`/`monthStartsBetween`/`appendTargetVersion`/`fetchTargetVersions`/`fetchEffectiveTarget` signatures match across tasks. `HistoryRow` defined in Task 7 and imported by its page. ✓

**Note for the implementer:** confirm the exact variable names `reportStart`/`reportEnd`/`selectedBrand`/`sheetKPI`/`kpiRow` in `app/[clientId]/page.tsx` before editing (per the explore, the KPI merge is ~`:148`); adapt if the local names differ.
