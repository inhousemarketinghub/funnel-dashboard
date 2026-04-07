# Phase 1: Management Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-client overview page, 5-step onboarding wizard, and team management with role-based permissions (Owner/Manager/Viewer) to the funnel dashboard.

**Architecture:** Extend the existing Supabase data layer with new tables (invitations, activity_log) and columns (role, status, column_mapping). Build new React components for overview, onboarding, and team management pages. Permission logic centralized in `lib/permissions.ts`. All new pages follow existing Server/Client Component patterns.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (auth + DB + storage), Tailwind CSS v4, shadcn/ui, Vitest 4

**Spec:** `docs/superpowers/specs/2026-04-08-dashboard-v2-phase1-design.md`

**Codebase patterns to follow:**
- Server Supabase: `createServerSupabase()` from `@/lib/supabase/server`
- Client Supabase: `createClient()` from `@/lib/supabase/client`
- Auth: `getUserRole()` from `@/lib/auth` returns `{ email, role, agencyId }`
- CSS variables: `--bg`, `--t1`–`--t4`, `--border`, `--blue`, `--green`, `--red`, `--sand`, `--bg3`
- Class patterns: `card-base`, `topbar-btn`, `font-heading`, `font-label`, `num`, `bauhaus-stripe`
- Existing tables: `agencies`, `clients`, `kpi_configs`, `project_access`

---

## File Structure

### New Files
```
lib/permissions.ts              — Role checking, permission gates
lib/invitations.ts              — Token generation, validation, acceptance
lib/overview.ts                 — Fetch + compute overview data for all clients

app/api/team/route.ts           — GET members, PATCH role, DELETE member
app/api/invitations/route.ts    — POST create, GET list invitations
app/api/invitations/[token]/route.ts — POST accept invitation

app/settings/team/page.tsx      — Team management page

components/overview/stats-bar.tsx       — Summary statistics bar (4 cards)
components/overview/client-kpi-card.tsx  — Individual client KPI card

components/onboarding/wizard-shell.tsx       — Step container + progress indicator
components/onboarding/step-basic-info.tsx    — Step 1: name + industry + logo
components/onboarding/step-connect-sheet.tsx — Step 2: sheet URL + scan
components/onboarding/step-verify-mapping.tsx — Step 3: column mapping review
components/onboarding/step-set-kpi.tsx       — Step 4: KPI targets
components/onboarding/step-invite-team.tsx   — Step 5: invite members

components/team/member-card.tsx      — Single team member display
components/team/invite-dialog.tsx    — Invite member modal
```

### Modified Files
```
lib/types.ts                    — Add new types (Role, Invitation, MemberInfo, etc.)
lib/auth.ts                     — Extend getUserRole to return new role type
app/clients/page.tsx            — Rewrite as multi-client overview
app/clients/new/page.tsx        — Rewrite as onboarding wizard
middleware.ts                   — Allow /settings/* routes
```

---

## Task 1: Extend Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add new type definitions to lib/types.ts**

Append these types at the end of the file:

```typescript
// --- Phase 1: Management Foundation ---

export type MemberRole = "owner" | "manager" | "viewer";

export interface MemberInfo {
  id: string;
  email: string;
  name: string | null;
  role: MemberRole;
  clients: { id: string; name: string }[];
  invited_at: string | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: MemberRole;
  client_ids: string[];
  client_names: string[];
  token: string;
  expires_at: string;
  created_at: string;
}

export interface ClientOverview {
  id: string;
  name: string;
  logo_url: string | null;
  status: "onboarding" | "active" | "paused";
  metrics: {
    sales: number;
    cpl: number;
    roas: number;
    conv_rate: number;
    ad_spend: number;
  };
  achievement: {
    sales: number;
    cpl: number;
    roas: number;
    conv_rate: number;
    average: number;
  };
  health: "good" | "watch" | "alert";
}

export interface OverviewStats {
  activeClients: number;
  needAttention: number;
  totalAdSpend: number;
  totalSales: number;
}

export interface ColumnMapping {
  performance: Record<string, string>;
  lead: Record<string, string>;
}

export interface OnboardingState {
  step: number;
  name: string;
  industry: string;
  logoFile: File | null;
  sheetId: string;
  scanResult: import("@/lib/sheet-scanner").SheetScanResult | null;
  columnMapping: ColumnMapping | null;
  kpiConfig: Partial<KPIConfig>;
  invites: { email: string; role: MemberRole }[];
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add Phase 1 types (MemberRole, ClientOverview, OnboardingState)"
```

---

## Task 2: Permissions Library

**Files:**
- Create: `lib/permissions.ts`
- Test: `lib/__tests__/permissions.test.ts`
- Modify: `lib/auth.ts`

- [ ] **Step 1: Write failing tests for permissions**

Create `lib/__tests__/permissions.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { canEditSettings, canManageTeam, canCreateClient, canViewOverview, ROLE_PERMISSIONS } from "../permissions";
import type { MemberRole } from "../types";

describe("ROLE_PERMISSIONS", () => {
  it("owner has all permissions", () => {
    expect(ROLE_PERMISSIONS.owner).toContain("view_dashboard");
    expect(ROLE_PERMISSIONS.owner).toContain("edit_settings");
    expect(ROLE_PERMISSIONS.owner).toContain("manage_team");
    expect(ROLE_PERMISSIONS.owner).toContain("create_client");
    expect(ROLE_PERMISSIONS.owner).toContain("view_overview");
  });

  it("manager can edit settings but not manage team", () => {
    expect(ROLE_PERMISSIONS.manager).toContain("view_dashboard");
    expect(ROLE_PERMISSIONS.manager).toContain("edit_settings");
    expect(ROLE_PERMISSIONS.manager).toContain("view_overview");
    expect(ROLE_PERMISSIONS.manager).not.toContain("manage_team");
    expect(ROLE_PERMISSIONS.manager).not.toContain("create_client");
  });

  it("viewer can only view dashboard", () => {
    expect(ROLE_PERMISSIONS.viewer).toContain("view_dashboard");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("edit_settings");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("manage_team");
    expect(ROLE_PERMISSIONS.viewer).not.toContain("view_overview");
  });
});

describe("permission helpers", () => {
  it("canEditSettings returns true for owner and manager", () => {
    expect(canEditSettings("owner")).toBe(true);
    expect(canEditSettings("manager")).toBe(true);
    expect(canEditSettings("viewer")).toBe(false);
  });

  it("canManageTeam returns true only for owner", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("manager")).toBe(false);
    expect(canManageTeam("viewer")).toBe(false);
  });

  it("canCreateClient returns true only for owner", () => {
    expect(canCreateClient("owner")).toBe(true);
    expect(canCreateClient("manager")).toBe(false);
    expect(canCreateClient("viewer")).toBe(false);
  });

  it("canViewOverview returns true for owner and manager", () => {
    expect(canViewOverview("owner")).toBe(true);
    expect(canViewOverview("manager")).toBe(true);
    expect(canViewOverview("viewer")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx vitest run lib/__tests__/permissions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement permissions library**

Create `lib/permissions.ts`:

```typescript
import type { MemberRole } from "./types";

type Permission =
  | "view_dashboard"
  | "view_report"
  | "edit_settings"
  | "manage_team"
  | "create_client"
  | "view_overview"
  | "view_activity_log";

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    "view_dashboard",
    "view_report",
    "edit_settings",
    "manage_team",
    "create_client",
    "view_overview",
    "view_activity_log",
  ],
  manager: [
    "view_dashboard",
    "view_report",
    "edit_settings",
    "view_overview",
    "view_activity_log",
  ],
  viewer: [
    "view_dashboard",
    "view_report",
  ],
};

function hasPermission(role: MemberRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canEditSettings(role: MemberRole): boolean {
  return hasPermission(role, "edit_settings");
}

export function canManageTeam(role: MemberRole): boolean {
  return hasPermission(role, "manage_team");
}

export function canCreateClient(role: MemberRole): boolean {
  return hasPermission(role, "create_client");
}

export function canViewOverview(role: MemberRole): boolean {
  return hasPermission(role, "view_overview");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx vitest run lib/__tests__/permissions.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Update lib/auth.ts to use MemberRole**

Replace the `UserRole` type and update `getUserRole()` to also return `MemberRole`:

```typescript
import { createServerSupabase } from "./supabase/server";
import type { MemberRole } from "./types";

export type UserRole = "owner" | "user" | null;

const ALL_PERMISSIONS = ["view_dashboard", "view_report", "edit_settings", "manage_access"];

export async function getUserRole(): Promise<{
  email: string | null;
  role: UserRole;
  memberRole: MemberRole | null;
  agencyId: string | null;
}> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { email: null, role: null, memberRole: null, agencyId: null };

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, role")
    .eq("email", user.email)
    .single();

  if (agency?.role === "owner") {
    return { email: user.email, role: "owner", memberRole: "owner", agencyId: agency.id };
  }

  // Check if user has project_access with a role
  if (agency) {
    const { data: access } = await supabase
      .from("project_access")
      .select("role")
      .eq("agency_id", agency.id)
      .limit(1)
      .single();

    const memberRole = (access?.role as MemberRole) || "viewer";
    return { email: user.email, role: "user", memberRole, agencyId: agency.id };
  }

  return { email: user.email, role: null, memberRole: null, agencyId: null };
}

export async function getProjectPermissions(clientId: string): Promise<string[]> {
  const { role, agencyId } = await getUserRole();
  if (role === "owner") return ALL_PERMISSIONS;
  if (!agencyId) return [];

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("project_access")
    .select("permissions")
    .eq("client_id", clientId)
    .eq("agency_id", agencyId)
    .single();

  return (data?.permissions as string[]) || ["view_dashboard"];
}
```

- [ ] **Step 6: Run existing tests to make sure nothing broke**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx vitest run`
Expected: All existing 17 tests + 7 new tests PASS

- [ ] **Step 7: Commit**

```bash
git add lib/permissions.ts lib/__tests__/permissions.test.ts lib/auth.ts
git commit -m "feat: add role-based permission system (Owner/Manager/Viewer)"
```

---

## Task 3: Invitation Utilities

**Files:**
- Create: `lib/invitations.ts`
- Test: `lib/__tests__/invitations.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/__tests__/invitations.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { generateToken, isTokenExpired } from "../invitations";

describe("generateToken", () => {
  it("returns a 48-char hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
  });

  it("generates unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("isTokenExpired", () => {
  it("returns false for future date", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isTokenExpired(future)).toBe(false);
  });

  it("returns true for past date", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isTokenExpired(past)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx vitest run lib/__tests__/invitations.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement invitation utilities**

Create `lib/invitations.ts`:

```typescript
import { randomBytes } from "crypto";

export function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function getExpiryDate(days: number = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx vitest run lib/__tests__/invitations.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/invitations.ts lib/__tests__/invitations.test.ts
git commit -m "feat: add invitation token utilities"
```

---

## Task 4: Overview Data Fetching

**Files:**
- Create: `lib/overview.ts`

This module fetches KPI data for all clients and computes the overview cards. It is called by the overview page (Server Component).

- [ ] **Step 1: Create lib/overview.ts**

```typescript
import { createServerSupabase } from "./supabase/server";
import { fetchPerformanceData, fetchKPIData } from "./sheets";
import { computeMetrics, computeAchievement } from "./metrics";
import type { ClientOverview, OverviewStats, KPIConfig, ClientConfig } from "./types";

export async function fetchAllClientsOverview(): Promise<{
  clients: ClientOverview[];
  stats: OverviewStats;
}> {
  const supabase = await createServerSupabase();
  const { data: dbClients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (!dbClients?.length) {
    return {
      clients: [],
      stats: { activeClients: 0, needAttention: 0, totalAdSpend: 0, totalSales: 0 },
    };
  }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = now;
  const monthStr = from.toISOString().split("T")[0];

  const overviews: ClientOverview[] = [];

  for (const client of dbClients) {
    try {
      const [rows, kpiRow] = await Promise.all([
        fetchPerformanceData(client.sheet_id, from, to, null),
        (async () => {
          const { data } = await supabase
            .from("kpi_configs")
            .select("*")
            .eq("client_id", client.id)
            .eq("month", monthStr)
            .single();
          return data;
        })(),
      ]);

      const metrics = computeMetrics(rows, 0);
      const kpi: KPIConfig = kpiRow || {
        sales: 0, orders: 0, aov: 0, cpl: 0, respond_rate: 0, appt_rate: 0,
        showup_rate: 0, conv_rate: 0, ad_spend: 0, daily_ad: 0, roas: 0,
        cpa_pct: 0, target_contact: 0, target_appt: 0, target_showup: 0,
      };

      const achievement = computeAchievement(metrics, kpi);
      const avgAch = [
        achievement.sales || 0,
        achievement.cpl || 0,
        achievement.roas || 0,
        achievement.conv_rate || 0,
      ].filter((v) => v > 0);
      const avg = avgAch.length > 0 ? avgAch.reduce((a, b) => a + b, 0) / avgAch.length : 0;

      const health: ClientOverview["health"] =
        avg >= 80 ? "good" : avg >= 60 ? "watch" : "alert";

      overviews.push({
        id: client.id,
        name: client.name,
        logo_url: client.logo_url,
        status: client.status || "active",
        metrics: {
          sales: metrics.sales,
          cpl: metrics.cpl,
          roas: metrics.roas,
          conv_rate: metrics.conv_rate,
          ad_spend: metrics.ad_spend,
        },
        achievement: {
          sales: achievement.sales || 0,
          cpl: achievement.cpl || 0,
          roas: achievement.roas || 0,
          conv_rate: achievement.conv_rate || 0,
          average: avg,
        },
        health,
      });
    } catch {
      // Client data fetch failed — show with zeroed metrics
      overviews.push({
        id: client.id,
        name: client.name,
        logo_url: client.logo_url,
        status: (client.status as ClientOverview["status"]) || "active",
        metrics: { sales: 0, cpl: 0, roas: 0, conv_rate: 0, ad_spend: 0 },
        achievement: { sales: 0, cpl: 0, roas: 0, conv_rate: 0, average: 0 },
        health: "alert",
      });
    }
  }

  const activeClients = overviews.filter((c) => c.status === "active").length;
  const needAttention = overviews.filter((c) => c.health === "alert").length;
  const totalAdSpend = overviews.reduce((s, c) => s + c.metrics.ad_spend, 0);
  const totalSales = overviews.reduce((s, c) => s + c.metrics.sales, 0);

  return {
    clients: overviews,
    stats: { activeClients, needAttention, totalAdSpend, totalSales },
  };
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/overview.ts
git commit -m "feat: add overview data fetching for multi-client summary"
```

---

## Task 5: Overview Page Components

**Files:**
- Create: `components/overview/stats-bar.tsx`
- Create: `components/overview/client-kpi-card.tsx`

- [ ] **Step 1: Create StatsBar component**

Create `components/overview/stats-bar.tsx`:

```tsx
import type { OverviewStats } from "@/lib/types";

function fmt(n: number): string {
  if (n >= 1000) return `RM ${(n / 1000).toFixed(0)}K`;
  return `RM ${n.toFixed(0)}`;
}

export function StatsBar({ stats }: { stats: OverviewStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="card-base text-center" style={{ padding: "14px 12px" }}>
        <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)]">Active Clients</div>
        <div className="num text-[22px] font-bold text-[var(--t1)] mt-1">{stats.activeClients}</div>
      </div>
      <div
        className="card-base text-center"
        style={{
          padding: "14px 12px",
          background: stats.needAttention > 0 ? "var(--red-bg)" : undefined,
        }}
      >
        <div className="font-label text-[10px] uppercase tracking-widest" style={{ color: stats.needAttention > 0 ? "var(--red)" : "var(--t4)" }}>
          Need Attention
        </div>
        <div className="num text-[22px] font-bold mt-1" style={{ color: stats.needAttention > 0 ? "var(--red)" : "var(--t1)" }}>
          {stats.needAttention}
        </div>
      </div>
      <div className="card-base text-center" style={{ padding: "14px 12px" }}>
        <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)]">Total Ad Spend</div>
        <div className="num text-[22px] font-bold text-[var(--t1)] mt-1">{fmt(stats.totalAdSpend)}</div>
      </div>
      <div className="card-base text-center" style={{ padding: "14px 12px" }}>
        <div className="font-label text-[10px] uppercase tracking-widest text-[var(--t4)]">Total Sales</div>
        <div className="num text-[22px] font-bold text-[var(--green)] mt-1">{fmt(stats.totalSales)}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ClientKpiCard component**

Create `components/overview/client-kpi-card.tsx`:

```tsx
import Link from "next/link";
import type { ClientOverview } from "@/lib/types";

const HEALTH_STYLES = {
  good: { bg: "var(--green-bg)", color: "var(--green)", label: "Good" },
  watch: { bg: "var(--yellow-bg)", color: "var(--yellow)", label: "Watch" },
  alert: { bg: "var(--red-bg)", color: "var(--red)", label: "Alert" },
} as const;

function fmtMetric(value: number, type: "currency" | "rate" | "multiplier"): string {
  if (type === "currency") {
    if (value >= 1000) return `RM ${(value / 1000).toFixed(0)}K`;
    return `RM ${value.toFixed(0)}`;
  }
  if (type === "rate") return `${(value * 100).toFixed(0)}%`;
  return `${value.toFixed(1)}x`;
}

function achColor(pct: number): string {
  if (pct >= 80) return "var(--green)";
  if (pct >= 60) return "var(--yellow)";
  return "var(--red)";
}

export function ClientKpiCard({ client }: { client: ClientOverview }) {
  const hs = HEALTH_STYLES[client.health];
  const metrics = [
    { label: "Sales", value: fmtMetric(client.metrics.sales, "currency"), ach: client.achievement.sales },
    { label: "CPL", value: fmtMetric(client.metrics.cpl, "currency"), ach: client.achievement.cpl },
    { label: "ROAS", value: fmtMetric(client.metrics.roas, "multiplier"), ach: client.achievement.roas },
    { label: "Conv%", value: fmtMetric(client.metrics.conv_rate, "rate"), ach: client.achievement.conv_rate },
  ];

  return (
    <Link href={`/${client.id}`} className="block">
      <div className="card-base hover:border-[var(--amber-border)] transition-all duration-200" style={{ padding: 16, cursor: "pointer" }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            {client.logo_url ? (
              <img src={client.logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--sand)] flex items-center justify-center text-[11px] font-semibold text-[var(--t3)]">
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-label text-[14px] font-medium text-[var(--t1)]">{client.name}</span>
          </div>
          <span
            className="num text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: hs.bg, color: hs.color }}
          >
            {client.achievement.average.toFixed(0)}%
          </span>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] text-[var(--t4)] font-label">{m.label}</div>
              <div className="num text-[14px] font-semibold" style={{ color: achColor(m.ach) }}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Achievement bar */}
        <div className="h-2 rounded-full bg-[var(--bg3)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(client.achievement.sales, 100)}%`,
              background: achColor(client.achievement.sales),
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--t4)]">Sales Achievement</span>
          <span className="num text-[10px]" style={{ color: achColor(client.achievement.sales) }}>
            {client.achievement.sales.toFixed(0)}%
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/overview/stats-bar.tsx components/overview/client-kpi-card.tsx
git commit -m "feat: add StatsBar and ClientKpiCard overview components"
```

---

## Task 6: Rewrite Clients Overview Page

**Files:**
- Modify: `app/clients/page.tsx`

- [ ] **Step 1: Rewrite the clients page**

Replace the full contents of `app/clients/page.tsx`:

```tsx
import { getUserRole } from "@/lib/auth";
import { fetchAllClientsOverview } from "@/lib/overview";
import { canViewOverview, canCreateClient } from "@/lib/permissions";
import { StatsBar } from "@/components/overview/stats-bar";
import { ClientKpiCard } from "@/components/overview/client-kpi-card";
import { LogoutButton } from "@/components/dashboard/logout-button";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ClientsPage() {
  const { email, role, memberRole, agencyId } = await getUserRole();
  if (!email || !memberRole) redirect("/login");

  const isOwner = role === "owner";
  const showOverview = canViewOverview(memberRole);

  const { clients, stats } = await fetchAllClientsOverview();

  // Viewers with single client: redirect directly
  if (!showOverview && clients.length === 1) {
    redirect(`/${clients[0].id}`);
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)]" style={{ transition: "background 500ms ease" }}>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <div className="max-w-5xl mx-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-heading text-[28px] font-semibold tracking-tight text-[var(--t1)]">
              {showOverview ? "Performance Overview" : "Your Projects"}
            </h1>
            <p className="text-[13px] text-[var(--t3)] mt-1">
              {showOverview
                ? `${stats.activeClients} active client${stats.activeClients !== 1 ? "s" : ""} this month`
                : "Select a project to view performance"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isOwner && (
              <>
                <Link href="/settings/team" className="topbar-btn">Team</Link>
                <Link href="/clients/new" className="topbar-btn" style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}>
                  + New Client
                </Link>
              </>
            )}
            <span className="text-[11px] text-[var(--t4)] num">{email}</span>
            <LogoutButton />
          </div>
        </div>

        {/* Stats bar (owner/manager only) */}
        {showOverview && <StatsBar stats={stats} />}

        {/* Client grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clients.map((client) => (
            <ClientKpiCard key={client.id} client={client} />
          ))}
          {clients.length === 0 && (
            <div className="col-span-2 text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--sand)] flex items-center justify-center text-[22px] text-[var(--t4)]">+</div>
              {isOwner ? (
                <>
                  <p className="text-[var(--t2)] text-[15px] font-medium mb-1">No projects yet</p>
                  <p className="text-[var(--t4)] text-[13px] mb-4">Create your first project to start tracking performance</p>
                  <Link href="/clients/new" className="topbar-btn inline-flex" style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}>
                    + New Client
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-[var(--t2)] text-[15px] font-medium mb-1">No projects assigned</p>
                  <p className="text-[var(--t4)] text-[13px]">Contact your admin to get access to a project</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run build check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/clients/page.tsx
git commit -m "feat: rewrite clients page as multi-client KPI overview"
```

---

## Task 7: Onboarding Wizard Shell

**Files:**
- Create: `components/onboarding/wizard-shell.tsx`

- [ ] **Step 1: Create wizard shell component**

Create `components/onboarding/wizard-shell.tsx`:

```tsx
"use client";
import { useState, type ReactNode } from "react";
import type { OnboardingState } from "@/lib/types";

const STEPS = [
  { num: 1, label: "Basic Info" },
  { num: 2, label: "Connect Sheet" },
  { num: 3, label: "Verify Mapping" },
  { num: 4, label: "Set KPI" },
  { num: 5, label: "Invite Team" },
];

interface WizardShellProps {
  children: (props: {
    state: OnboardingState;
    setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
    next: () => void;
    back: () => void;
  }) => ReactNode;
}

const INITIAL_STATE: OnboardingState = {
  step: 1,
  name: "",
  industry: "",
  logoFile: null,
  sheetId: "",
  scanResult: null,
  columnMapping: null,
  kpiConfig: {},
  invites: [],
};

export function WizardShell({ children }: WizardShellProps) {
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);

  const next = () => setState((s) => ({ ...s, step: Math.min(s.step + 1, 5) }));
  const back = () => setState((s) => ({ ...s, step: Math.max(s.step - 1, 1) }));

  return (
    <div className="min-h-dvh bg-[var(--bg)] p-8 flex justify-center">
      <div className="bauhaus-stripe" style={{ position: "fixed", top: 0, left: 0, right: 0 }}>
        <div /><div /><div /><div />
      </div>
      <div className="w-full max-w-2xl mt-12">
        {/* Progress bar */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : undefined }}>
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors duration-200"
                  style={{
                    background: state.step >= s.num ? "var(--blue)" : "var(--bg3)",
                    color: state.step >= s.num ? "white" : "var(--t4)",
                  }}
                >
                  {state.step > s.num ? "✓" : s.num}
                </div>
                <span
                  className="text-[11px] font-label hidden md:inline"
                  style={{ color: state.step >= s.num ? "var(--blue)" : "var(--t4)" }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="h-px flex-1 mx-2 transition-colors duration-200"
                  style={{ background: state.step > s.num ? "var(--blue)" : "var(--border)" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="card-base" style={{ padding: 28 }}>
          {children({ state, setState, next, back })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/wizard-shell.tsx
git commit -m "feat: add onboarding wizard shell with step progress indicator"
```

---

## Task 8: Onboarding Steps 1-3

**Files:**
- Create: `components/onboarding/step-basic-info.tsx`
- Create: `components/onboarding/step-connect-sheet.tsx`
- Create: `components/onboarding/step-verify-mapping.tsx`

- [ ] **Step 1: Create Step 1 — Basic Info**

Create `components/onboarding/step-basic-info.tsx`:

```tsx
"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState } from "@/lib/types";

const INDUSTRIES = ["Beauty", "Education", "Property", "F&B", "Health", "Other"];

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
}

export function StepBasicInfo({ state, setState, next }: Props) {
  const canProceed = state.name.trim().length > 0;

  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">Basic Info</h2>
      <p className="text-[13px] text-[var(--t3)] mb-6">Tell us about your client</p>

      <div className="space-y-4">
        <div>
          <Label className="text-[var(--t3)] text-sm">Client Name *</Label>
          <Input
            placeholder="Dream Crafter Sdn Bhd"
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            className="border-[var(--border)] focus-visible:ring-[var(--blue)] mt-1"
          />
        </div>

        <div>
          <Label className="text-[var(--t3)] text-sm">Industry</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => setState((s) => ({ ...s, industry: s.industry === ind ? "" : ind }))}
                className="px-3 py-1.5 rounded-lg text-[12px] border transition-colors duration-150"
                style={{
                  background: state.industry === ind ? "var(--blue)" : "transparent",
                  color: state.industry === ind ? "white" : "var(--t3)",
                  borderColor: state.industry === ind ? "var(--blue)" : "var(--border)",
                }}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-[var(--t3)] text-sm">Logo (optional)</Label>
          <div className="mt-1 border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center">
            {state.logoFile ? (
              <div className="flex items-center justify-center gap-2">
                <span className="text-[13px] text-[var(--t2)]">{state.logoFile.name}</span>
                <button
                  type="button"
                  onClick={() => setState((s) => ({ ...s, logoFile: null }))}
                  className="text-[var(--red)] text-[12px]"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <span className="text-[13px] text-[var(--t4)]">Drop file or click to upload · PNG/JPG · Max 2MB</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && file.size <= 2 * 1024 * 1024) {
                      setState((s) => ({ ...s, logoFile: file }));
                    }
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={next}
          disabled={!canProceed}
          className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Step 2 — Connect Sheet**

Create `components/onboarding/step-connect-sheet.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingState } from "@/lib/types";

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
  back: () => void;
}

function extractSheetId(input: string): string {
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

export function StepConnectSheet({ state, setState, next, back }: Props) {
  const [url, setUrl] = useState(state.sheetId ? `https://docs.google.com/spreadsheets/d/${state.sheetId}` : "");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    const sheetId = extractSheetId(url);
    if (!sheetId) return;

    setScanning(true);
    setError(null);

    try {
      const res = await fetch("/api/scan-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      setState((s) => ({
        ...s,
        sheetId,
        scanResult: data,
        name: s.name || (data.brands.length === 1 && data.brands[0].name !== "(Default)" ? data.brands[0].name : s.name),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan sheet. Make sure it's shared as 'Anyone with the link can view'.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">Connect Google Sheet</h2>
      <p className="text-[13px] text-[var(--t3)] mb-6">Paste the sheet URL and we'll auto-detect your data structure</p>

      <div className="mb-4">
        <Label className="text-[var(--t3)] text-sm">Google Sheet URL *</Label>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            className="border-[var(--border)] focus-visible:ring-[var(--blue)] num text-sm flex-1"
          />
          <Button
            onClick={handleScan}
            disabled={!url.trim() || scanning}
            className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-5 shrink-0"
          >
            {scanning ? "Scanning..." : "Scan"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg border border-[var(--red)] bg-[var(--red-bg)] text-[var(--red)] text-[12px]">
          {error}
        </div>
      )}

      {state.scanResult && (
        <div className="p-4 rounded-lg bg-[var(--bg3)] border border-[var(--border)] mb-4">
          <div className="text-[13px] font-semibold text-[var(--t1)] mb-3">Detection Results</div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {state.scanResult.hasKPI && <span className="text-[var(--green)]">✓ KPI Indicator found</span>}
            {!state.scanResult.hasKPI && <span className="text-[var(--red)]">✗ KPI Indicator not found</span>}
            {state.scanResult.hasLeadTracker && <span className="text-[var(--green)]">✓ Lead Tracker found</span>}
            {!state.scanResult.hasLeadTracker && <span className="text-[var(--red)]">✗ Lead Tracker not found</span>}
            <span className="text-[var(--green)]">✓ {state.scanResult.brands.length} brand(s) detected</span>
            <span className="text-[var(--blue)]">Funnel: {state.scanResult.funnelType}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={back}>← Back</Button>
        <Button
          onClick={next}
          disabled={!state.scanResult}
          className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Step 3 — Verify Mapping**

Create `components/onboarding/step-verify-mapping.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { OnboardingState, ColumnMapping } from "@/lib/types";

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
  back: () => void;
}

const PERF_FIELDS = [
  { key: "date", label: "Date" },
  { key: "ad_spend", label: "Ad Spend" },
  { key: "inquiry", label: "Inquiry (PM)" },
  { key: "contact", label: "Contact" },
  { key: "appointment", label: "Appointment" },
  { key: "showup", label: "Show Up" },
  { key: "orders", label: "Orders" },
  { key: "sales", label: "Sales" },
];

const LEAD_FIELDS = [
  { key: "person", label: "Person" },
  { key: "appointment_date", label: "Appointment Date" },
  { key: "sales_person", label: "Sales Person" },
  { key: "showed_up", label: "Showed Up" },
  { key: "purchase_date", label: "Purchase Date" },
  { key: "sales", label: "Sales Amount" },
  { key: "brand", label: "Brand" },
];

export function StepVerifyMapping({ state, setState, next, back }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(
    state.columnMapping || { performance: {}, lead: {} }
  );

  const isWalkin = state.scanResult?.funnelType === "walkin";
  const perfFields = isWalkin
    ? PERF_FIELDS.filter((f) => !["appointment", "showup"].includes(f.key))
    : PERF_FIELDS;

  function updatePerf(key: string, value: string) {
    setMapping((m) => ({ ...m, performance: { ...m.performance, [key]: value } }));
  }

  function updateLead(key: string, value: string) {
    setMapping((m) => ({ ...m, lead: { ...m.lead, [key]: value } }));
  }

  function handleNext() {
    setState((s) => ({ ...s, columnMapping: mapping }));
    next();
  }

  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">Verify Data Mapping</h2>
      <p className="text-[13px] text-[var(--t3)] mb-6">
        Confirm or adjust the auto-detected column mappings. You can also skip this step to use defaults.
      </p>

      <div className="mb-6">
        <h3 className="font-label text-[12px] uppercase tracking-widest text-[var(--t4)] mb-3">Performance Tracker Columns</h3>
        <div className="space-y-2">
          {perfFields.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-[13px] text-[var(--t2)] w-32 shrink-0">{f.label}</span>
              <input
                type="text"
                value={mapping.performance[f.key] || ""}
                onChange={(e) => updatePerf(f.key, e.target.value)}
                placeholder="Auto-detected"
                className="flex-1 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-md bg-[var(--bg3)] text-[var(--t2)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)]"
              />
              <span className="text-[var(--green)] text-[12px]">✓</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="font-label text-[12px] uppercase tracking-widest text-[var(--t4)] mb-3">Lead Tracker Columns</h3>
        <div className="space-y-2">
          {LEAD_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <span className="text-[13px] text-[var(--t2)] w-32 shrink-0">{f.label}</span>
              <input
                type="text"
                value={mapping.lead[f.key] || ""}
                onChange={(e) => updateLead(f.key, e.target.value)}
                placeholder="Auto-detected"
                className="flex-1 px-3 py-1.5 text-[12px] border border-[var(--border)] rounded-md bg-[var(--bg3)] text-[var(--t2)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)]"
              />
              <span className="text-[var(--green)] text-[12px]">✓</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-lg bg-[var(--blue-bg)] text-[var(--blue)] text-[12px] mb-4">
        Column mapping is optional — the system uses intelligent auto-detection by default. Only override if you see issues.
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={back}>← Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setState((s) => ({ ...s, columnMapping: null })); next(); }}>
            Skip
          </Button>
          <Button onClick={handleNext} className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6">
            Confirm & Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/step-basic-info.tsx components/onboarding/step-connect-sheet.tsx components/onboarding/step-verify-mapping.tsx
git commit -m "feat: add onboarding steps 1-3 (basic info, connect sheet, verify mapping)"
```

---

## Task 9: Onboarding Steps 4-5 + Completion

**Files:**
- Create: `components/onboarding/step-set-kpi.tsx`
- Create: `components/onboarding/step-invite-team.tsx`

- [ ] **Step 1: Create Step 4 — Set KPI**

Create `components/onboarding/step-set-kpi.tsx`:

```tsx
"use client";
import { Button } from "@/components/ui/button";
import type { OnboardingState, KPIConfig } from "@/lib/types";

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  next: () => void;
  back: () => void;
}

const KPI_GROUPS = [
  {
    label: "Revenue Targets",
    fields: [
      { key: "sales", label: "Monthly Sales (RM)", placeholder: "80000" },
      { key: "orders", label: "Orders", placeholder: "30" },
      { key: "aov", label: "AOV (RM)", placeholder: "2500" },
    ],
  },
  {
    label: "Ad Performance",
    fields: [
      { key: "ad_spend", label: "Monthly Ad Spend (RM)", placeholder: "25000" },
      { key: "daily_ad", label: "Daily Budget (RM)", placeholder: "833" },
      { key: "cpl", label: "Target CPL (RM)", placeholder: "20" },
      { key: "roas", label: "Target ROAS", placeholder: "4.0" },
      { key: "cpa_pct", label: "CPA %", placeholder: "25" },
    ],
  },
  {
    label: "Funnel Rates",
    fields: [
      { key: "respond_rate", label: "Respond Rate (%)", placeholder: "50" },
      { key: "appt_rate", label: "Appointment Rate (%)", placeholder: "60" },
      { key: "showup_rate", label: "Show Up Rate (%)", placeholder: "70" },
      { key: "conv_rate", label: "Conversion Rate (%)", placeholder: "30" },
    ],
  },
  {
    label: "Pipeline Targets",
    fields: [
      { key: "target_contact", label: "Target Contacts", placeholder: "200" },
      { key: "target_appt", label: "Target Appointments", placeholder: "120" },
      { key: "target_showup", label: "Target Show Ups", placeholder: "84" },
    ],
  },
];

export function StepSetKpi({ state, setState, next, back }: Props) {
  function updateKpi(key: string, value: string) {
    const num = parseFloat(value) || 0;
    setState((s) => ({ ...s, kpiConfig: { ...s.kpiConfig, [key]: num } }));
  }

  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">Set KPI Targets</h2>
      <p className="text-[13px] text-[var(--t3)] mb-6">
        Set monthly targets. You can adjust these later in Settings.
      </p>

      <div className="space-y-6">
        {KPI_GROUPS.map((group) => (
          <div key={group.label}>
            <h3 className="font-label text-[11px] uppercase tracking-widest text-[var(--t4)] mb-3">{group.label}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {group.fields.map((f) => (
                <div key={f.key} className="border border-[var(--border)] rounded-lg p-3">
                  <div className="text-[10px] text-[var(--t4)] uppercase tracking-wider font-label">{f.label}</div>
                  <input
                    type="number"
                    step="any"
                    value={(state.kpiConfig as Record<string, number>)[f.key] || ""}
                    onChange={(e) => updateKpi(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full num text-[15px] font-semibold text-[var(--t1)] mt-1 bg-transparent border-none outline-none placeholder:text-[var(--t4)]/40"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={back}>← Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={next}>Skip</Button>
          <Button onClick={next} className="bg-[var(--blue)] hover:bg-[#153D7A] text-white px-6">
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Step 5 — Invite Team**

Create `components/onboarding/step-invite-team.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingState, MemberRole } from "@/lib/types";

interface Props {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
  back: () => void;
  onComplete: () => void;
  completing: boolean;
}

export function StepInviteTeam({ state, setState, back, onComplete, completing }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");

  function addInvite() {
    if (!email.trim() || !email.includes("@")) return;
    if (state.invites.some((i) => i.email === email.trim())) return;
    setState((s) => ({
      ...s,
      invites: [...s.invites, { email: email.trim(), role }],
    }));
    setEmail("");
  }

  function removeInvite(emailToRemove: string) {
    setState((s) => ({
      ...s,
      invites: s.invites.filter((i) => i.email !== emailToRemove),
    }));
  }

  return (
    <div>
      <h2 className="font-heading text-[20px] font-semibold text-[var(--t1)] mb-1">Invite Team</h2>
      <p className="text-[13px] text-[var(--t3)] mb-6">
        Add team members or clients who should access this dashboard. You can also do this later.
      </p>

      <div className="flex gap-2 mb-4">
        <Input
          type="email"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addInvite()}
          className="border-[var(--border)] focus-visible:ring-[var(--blue)] flex-1"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          className="px-3 py-2 border border-[var(--border)] rounded-lg text-[12px] bg-[var(--bg)]"
        >
          <option value="viewer">Viewer</option>
          <option value="manager">Manager</option>
        </select>
        <Button onClick={addInvite} variant="outline">+ Add</Button>
      </div>

      {state.invites.length > 0 && (
        <div className="border border-[var(--border)] rounded-lg overflow-hidden mb-4">
          {state.invites.map((inv) => (
            <div key={inv.email} className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-b-0">
              <div>
                <span className="text-[13px] text-[var(--t1)]">{inv.email}</span>
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg3)] text-[var(--t3)]">
                  {inv.role}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeInvite(inv.email)}
                className="text-[var(--red)] text-[12px]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {state.invites.length === 0 && (
        <div className="text-center py-8 text-[var(--t4)] text-[13px]">
          No invites added yet. You can skip this step and invite later.
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={back}>← Back</Button>
        <Button
          onClick={onComplete}
          disabled={completing}
          className="text-white px-6"
          style={{ background: "var(--green)" }}
        >
          {completing ? "Creating..." : "Complete Onboarding ✓"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/step-set-kpi.tsx components/onboarding/step-invite-team.tsx
git commit -m "feat: add onboarding steps 4-5 (KPI targets, invite team)"
```

---

## Task 10: Rewrite Onboarding Page

**Files:**
- Modify: `app/clients/new/page.tsx`

- [ ] **Step 1: Rewrite the new client page as wizard**

Replace the full contents of `app/clients/new/page.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import { StepBasicInfo } from "@/components/onboarding/step-basic-info";
import { StepConnectSheet } from "@/components/onboarding/step-connect-sheet";
import { StepVerifyMapping } from "@/components/onboarding/step-verify-mapping";
import { StepSetKpi } from "@/components/onboarding/step-set-kpi";
import { StepInviteTeam } from "@/components/onboarding/step-invite-team";
import type { OnboardingState } from "@/lib/types";

export default function NewClientPage() {
  const [completing, setCompleting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleComplete(state: OnboardingState) {
    setCompleting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get or create agency
      let { data: agency } = await supabase
        .from("agencies")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!agency) {
        const { data } = await supabase
          .from("agencies")
          .insert({ email: user.email!, name: user.email!.split("@")[0] })
          .select("id")
          .single();
        agency = data;
      }
      if (!agency) throw new Error("Failed to create agency");

      // Create client
      const { data: client } = await supabase
        .from("clients")
        .insert({
          agency_id: agency.id,
          name: state.name.trim(),
          sheet_id: state.sheetId,
          funnel_type: state.scanResult?.funnelType || "appointment",
          status: "active",
          onboarded_at: new Date().toISOString(),
          industry: state.industry || null,
          column_mapping: state.columnMapping || null,
        })
        .select("id")
        .single();

      if (!client) throw new Error("Failed to create client");

      // Upload logo if provided
      if (state.logoFile) {
        const ext = state.logoFile.name.split(".").pop();
        const path = `${client.id}/logo.${ext}`;
        await supabase.storage.from("logos").upload(path, state.logoFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
        if (urlData) {
          await supabase.from("clients").update({ logo_url: urlData.publicUrl }).eq("id", client.id);
        }
      }

      // Save KPI config
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const kpiData = { client_id: client.id, month, ...state.kpiConfig };
      await supabase.from("kpi_configs").upsert(kpiData, { onConflict: "client_id,month" });

      // Send invitations
      for (const inv of state.invites) {
        await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inv.email,
            role: inv.role,
            client_ids: [client.id],
          }),
        });
      }

      router.push(`/${client.id}`);
    } catch (err) {
      console.error("Onboarding failed:", err);
      setCompleting(false);
    }
  }

  return (
    <WizardShell>
      {({ state, setState, next, back }) => (
        <>
          {state.step === 1 && <StepBasicInfo state={state} setState={setState} next={next} />}
          {state.step === 2 && <StepConnectSheet state={state} setState={setState} next={next} back={back} />}
          {state.step === 3 && <StepVerifyMapping state={state} setState={setState} next={next} back={back} />}
          {state.step === 4 && <StepSetKpi state={state} setState={setState} next={next} back={back} />}
          {state.step === 5 && (
            <StepInviteTeam
              state={state}
              setState={setState}
              back={back}
              onComplete={() => handleComplete(state)}
              completing={completing}
            />
          )}
        </>
      )}
    </WizardShell>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/clients/new/page.tsx
git commit -m "feat: rewrite new client page as 5-step onboarding wizard"
```

---

## Task 11: Invitation API Routes

**Files:**
- Create: `app/api/invitations/route.ts`
- Create: `app/api/invitations/[token]/route.ts`

- [ ] **Step 1: Create invitation CRUD route**

Create `app/api/invitations/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";
import { generateToken, getExpiryDate } from "@/lib/invitations";

// POST: Create invitation
export async function POST(req: NextRequest) {
  const { role: userRole, agencyId } = await getUserRole();
  if (userRole !== "owner" || !agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { email, role, client_ids } = await req.json();
  if (!email || !role || !client_ids?.length) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const token = generateToken();
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      agency_id: agencyId,
      email,
      role,
      client_ids,
      token,
      invited_by: user!.id,
      expires_at: getExpiryDate(7),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// GET: List invitations
export async function GET() {
  const { role, agencyId } = await getUserRole();
  if (role !== "owner" || !agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("agency_id", agencyId)
    .eq("accepted", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: Create invitation accept route**

Create `app/api/invitations/[token]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isTokenExpired } from "@/lib/invitations";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerSupabase();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Find invitation
  const { data: invitation } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .eq("accepted", false)
    .single();

  if (!invitation) return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  if (isTokenExpired(invitation.expires_at)) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  // Get or create agency record for the invited user
  let { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("email", user.email)
    .single();

  if (!agency) {
    const { data } = await supabase
      .from("agencies")
      .insert({ email: user.email!, name: user.email!.split("@")[0], role: "user" })
      .select("id")
      .single();
    agency = data;
  }
  if (!agency) return NextResponse.json({ error: "Failed to create user record" }, { status: 500 });

  // Create project_access for each client
  const accessRecords = invitation.client_ids.map((clientId: string) => ({
    agency_id: agency!.id,
    client_id: clientId,
    role: invitation.role,
    permissions: invitation.role === "manager"
      ? ["view_dashboard", "view_report", "edit_settings"]
      : ["view_dashboard", "view_report"],
    invited_by: invitation.invited_by,
    invited_at: invitation.created_at,
  }));

  await supabase.from("project_access").upsert(accessRecords, { onConflict: "agency_id,client_id" });

  // Mark invitation as accepted
  await supabase
    .from("invitations")
    .update({ accepted: true, accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return NextResponse.json({ success: true, client_ids: invitation.client_ids });
}
```

- [ ] **Step 3: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/api/invitations/route.ts app/api/invitations/\[token\]/route.ts
git commit -m "feat: add invitation API routes (create, list, accept)"
```

---

## Task 12: Team API Route

**Files:**
- Create: `app/api/team/route.ts`

- [ ] **Step 1: Create team management route**

Create `app/api/team/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth";

// GET: List all team members with their client assignments
export async function GET() {
  const { role, agencyId } = await getUserRole();
  if (!agencyId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = await createServerSupabase();

  // Get all agencies that have project_access to our clients
  const { data: clients } = await supabase.from("clients").select("id, name").eq("agency_id", agencyId);
  if (!clients) return NextResponse.json([]);

  const clientIds = clients.map((c) => c.id);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));

  // Get the owner agency
  const { data: ownerAgency } = await supabase.from("agencies").select("*").eq("id", agencyId).single();

  // Get all project_access records for our clients
  const { data: accessRecords } = await supabase
    .from("project_access")
    .select("agency_id, client_id, role, invited_at")
    .in("client_id", clientIds);

  // Get agency info for each unique agency_id
  const agencyIds = [...new Set((accessRecords || []).map((a) => a.agency_id))];
  const { data: agencies } = agencyIds.length > 0
    ? await supabase.from("agencies").select("id, email, name").in("id", agencyIds)
    : { data: [] };

  const agencyMap = Object.fromEntries((agencies || []).map((a) => [a.id, a]));

  // Build member list
  const members: Record<string, {
    id: string; email: string; name: string | null; role: string;
    clients: { id: string; name: string }[]; invited_at: string | null;
  }> = {};

  // Add owner first
  if (ownerAgency) {
    members[ownerAgency.id] = {
      id: ownerAgency.id,
      email: ownerAgency.email,
      name: ownerAgency.name,
      role: "owner",
      clients: clients.map((c) => ({ id: c.id, name: c.name })),
      invited_at: null,
    };
  }

  // Add members from access records
  for (const access of accessRecords || []) {
    const agency = agencyMap[access.agency_id];
    if (!agency || access.agency_id === agencyId) continue;

    if (!members[access.agency_id]) {
      members[access.agency_id] = {
        id: access.agency_id,
        email: agency.email,
        name: agency.name,
        role: access.role || "viewer",
        clients: [],
        invited_at: access.invited_at,
      };
    }
    members[access.agency_id].clients.push({
      id: access.client_id,
      name: clientMap[access.client_id] || "Unknown",
    });
  }

  return NextResponse.json(Object.values(members));
}

// PATCH: Update member role
export async function PATCH(req: NextRequest) {
  const { role: userRole, agencyId } = await getUserRole();
  if (userRole !== "owner" || !agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { memberId, newRole } = await req.json();
  if (!memberId || !newRole) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const supabase = await createServerSupabase();
  const permissions = newRole === "manager"
    ? ["view_dashboard", "view_report", "edit_settings"]
    : ["view_dashboard", "view_report"];

  const { error } = await supabase
    .from("project_access")
    .update({ role: newRole, permissions })
    .eq("agency_id", memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: Remove member
export async function DELETE(req: NextRequest) {
  const { role: userRole, agencyId } = await getUserRole();
  if (userRole !== "owner" || !agencyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("project_access")
    .delete()
    .eq("agency_id", memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/team/route.ts
git commit -m "feat: add team management API (list, update role, remove member)"
```

---

## Task 13: Team Management Page Components

**Files:**
- Create: `components/team/member-card.tsx`
- Create: `components/team/invite-dialog.tsx`

- [ ] **Step 1: Create MemberCard component**

Create `components/team/member-card.tsx`:

```tsx
"use client";
import type { MemberInfo, MemberRole } from "@/lib/types";

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: "var(--amber, #D97706)",
  manager: "var(--blue)",
  viewer: "var(--green)",
};

interface Props {
  member: MemberInfo;
  onRoleChange: (memberId: string, role: MemberRole) => void;
  onRemove: (memberId: string) => void;
}

export function MemberCard({ member, onRoleChange, onRemove }: Props) {
  const initials = (member.name || member.email)
    .split(/[\s@]/)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join("");

  const isOwner = member.role === "owner";

  return (
    <div className="card-base" style={{ padding: 16 }}>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold"
            style={{ background: ROLE_COLORS[member.role] }}
          >
            {initials}
          </div>
          <div>
            <div className="text-[14px] font-medium text-[var(--t1)]">{member.name || member.email.split("@")[0]}</div>
            <div className="text-[12px] text-[var(--t4)]">{member.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isOwner ? (
            <span
              className="text-[11px] font-semibold px-3 py-1 rounded-full text-white"
              style={{ background: ROLE_COLORS.owner }}
            >
              Owner
            </span>
          ) : (
            <>
              <select
                value={member.role}
                onChange={(e) => onRoleChange(member.id, e.target.value as MemberRole)}
                className="px-2 py-1 border border-[var(--border)] rounded-md text-[12px] bg-[var(--bg)]"
              >
                <option value="manager">Manager</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="button"
                onClick={() => onRemove(member.id)}
                className="text-[var(--red)] text-[12px]"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>

      {/* Client tags */}
      <div className="mt-3 flex gap-1.5 flex-wrap">
        {isOwner ? (
          <span className="text-[11px] text-[var(--t4)]">All clients (Owner)</span>
        ) : (
          member.clients.map((c) => (
            <span
              key={c.id}
              className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg3)] text-[var(--t3)]"
            >
              {c.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create InviteDialog component**

Create `components/team/invite-dialog.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MemberRole } from "@/lib/types";

interface Props {
  clients: { id: string; name: string }[];
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: MemberRole, clientIds: string[]) => Promise<void>;
}

export function InviteDialog({ clients, open, onClose, onInvite }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("viewer");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  if (!open) return null;

  function toggleClient(id: string) {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    if (!email.trim() || !selectedClients.length) return;
    setSending(true);
    await onInvite(email.trim(), role, selectedClients);
    setSending(false);
    setEmail("");
    setSelectedClients([]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div
        className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-heading text-[18px] font-semibold text-[var(--t1)] mb-1">Invite New Member</h3>
        <p className="text-[12px] text-[var(--t4)] mb-5">They'll receive an email with a link to join</p>

        <div className="space-y-4">
          <div>
            <label className="text-[12px] text-[var(--t3)] font-label">Email *</label>
            <Input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-[var(--border)] mt-1"
            />
          </div>

          <div>
            <label className="text-[12px] text-[var(--t3)] font-label">Role *</label>
            <div className="flex gap-2 mt-1">
              {(["manager", "viewer"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="flex-1 p-3 rounded-lg border-2 text-left transition-colors"
                  style={{
                    borderColor: role === r ? "var(--blue)" : "var(--border)",
                    background: role === r ? "var(--blue-bg)" : "transparent",
                  }}
                >
                  <div className="text-[13px] font-semibold capitalize">{r}</div>
                  <div className="text-[11px] text-[var(--t4)] mt-0.5">
                    {r === "manager" ? "View + Edit KPI" : "View only"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-[var(--t3)] font-label">Assign Clients *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClient(c.id)}
                  className="px-3 py-1.5 rounded-md text-[12px] border transition-colors"
                  style={{
                    background: selectedClients.includes(c.id) ? "var(--blue-bg)" : "transparent",
                    color: selectedClients.includes(c.id) ? "var(--blue)" : "var(--t3)",
                    borderColor: selectedClients.includes(c.id) ? "var(--blue)" : "var(--border)",
                  }}
                >
                  {selectedClients.includes(c.id) ? "✓ " : ""}{c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!email.trim() || !selectedClients.length || sending}
            className="bg-[var(--blue)] hover:bg-[#153D7A] text-white"
          >
            {sending ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run type check**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add components/team/member-card.tsx components/team/invite-dialog.tsx
git commit -m "feat: add MemberCard and InviteDialog team components"
```

---

## Task 14: Team Management Page

**Files:**
- Create: `app/settings/team/page.tsx`
- Modify: `middleware.ts`

- [ ] **Step 1: Create team management page**

Create `app/settings/team/page.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MemberCard } from "@/components/team/member-card";
import { InviteDialog } from "@/components/team/invite-dialog";
import { LogoutButton } from "@/components/dashboard/logout-button";
import type { MemberInfo, MemberRole, PendingInvitation } from "@/lib/types";
import Link from "next/link";

export default function TeamPage() {
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [membersRes, invitesRes, clientsRes] = await Promise.all([
      fetch("/api/team"),
      fetch("/api/invitations"),
      (async () => {
        const supabase = createClient();
        const { data } = await supabase.from("clients").select("id, name").order("name");
        return data || [];
      })(),
    ]);

    if (membersRes.ok) setMembers(await membersRes.json());
    if (invitesRes.ok) setInvitations(await invitesRes.json());
    setClients(clientsRes);
    setLoading(false);
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    await fetch("/api/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, newRole }),
    });
    loadData();
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member? They will lose access to all assigned clients.")) return;
    await fetch("/api/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    loadData();
  }

  async function handleInvite(email: string, role: MemberRole, clientIds: string[]) {
    await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, client_ids: clientIds }),
    });
    loadData();
  }

  async function handleResendInvite(invId: string) {
    // For now, just show a toast — full email resend requires Supabase edge function
    alert("Invite link copied. Send it manually to the team member.");
  }

  async function handleRevokeInvite(invId: string) {
    const supabase = createClient();
    await supabase.from("invitations").delete().eq("id", invId);
    loadData();
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)]" style={{ transition: "background 500ms ease" }}>
      <div className="bauhaus-stripe"><div /><div /><div /><div /></div>
      <div className="max-w-4xl mx-auto p-8">
        {/* Nav */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <span className="font-heading text-[18px] font-semibold text-[var(--t1)]">Funnel Dashboard</span>
            <Link href="/clients" className="text-[13px] text-[var(--t3)] hover:text-[var(--t1)] transition-colors">Overview</Link>
            <span className="text-[13px] font-medium text-[var(--blue)] border-b-2 border-[var(--blue)] pb-0.5">Team</span>
          </div>
          <LogoutButton />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="font-heading text-[24px] font-semibold text-[var(--t1)]">Team Members</h1>
            <p className="text-[13px] text-[var(--t3)] mt-1">Manage your team and their client access</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="topbar-btn"
            style={{ background: "var(--blue)", color: "white", borderColor: "var(--blue)" }}
          >
            + Invite Member
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card-base animate-pulse" style={{ padding: 16, height: 80 }} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Active members */}
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                onRoleChange={handleRoleChange}
                onRemove={handleRemove}
              />
            ))}

            {/* Pending invitations */}
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="border border-dashed border-[var(--yellow)] rounded-xl"
                style={{ padding: 16 }}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--bg3)] flex items-center justify-center text-[var(--t4)] text-[16px]">
                      ✉
                    </div>
                    <div>
                      <div className="text-[14px] text-[var(--t3)]">{inv.email}</div>
                      <div className="text-[11px] text-[var(--yellow)]">
                        Invite pending · {inv.role} · sent {new Date(inv.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleResendInvite(inv.id)}
                      className="text-[12px] text-[var(--blue)]"
                    >
                      Resend
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-[12px] text-[var(--red)]"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {members.length === 0 && invitations.length === 0 && (
              <div className="text-center py-12 text-[var(--t4)] text-[13px]">
                No team members yet. Click &quot;+ Invite Member&quot; to get started.
              </div>
            )}
          </div>
        )}
      </div>

      <InviteDialog
        clients={clients}
        open={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={handleInvite}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update middleware to allow /settings routes**

In `middleware.ts`, the current matcher already allows all routes except static assets and login/auth. Verify `/settings/team` is accessible by checking the matcher pattern: `/((?!_next/static|_next/image|favicon.ico|login|auth).*)`. This pattern allows `/settings/team` — no change needed.

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/settings/team/page.tsx
git commit -m "feat: add team management page with invite, role change, and remove"
```

---

## Task 15: Invitation Accept Flow in Login

**Files:**
- Modify: `middleware.ts`
- Modify: `app/login/page.tsx` (minor: check for invite param after login)

- [ ] **Step 1: Add invite token handling to login redirect**

After login, if URL has `?invite=TOKEN`, automatically call the accept endpoint. Add this logic after the auth callback in `app/auth/callback/route.ts`.

Read the current `app/auth/callback/route.ts` and add invitation acceptance logic at the end, after user creation:

```typescript
// After the existing user/agency creation logic, add:
const inviteToken = requestUrl.searchParams.get("invite");
if (inviteToken) {
  await fetch(`${requestUrl.origin}/api/invitations/${inviteToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return NextResponse.redirect(new URL("/clients", requestUrl.origin));
}
```

- [ ] **Step 2: Run type check and existing tests**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx tsc --noEmit && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: auto-accept invitation on login with invite token"
```

---

## Task 16: Database Migrations

**Files:**
- Create: `supabase/migrations/20260408_phase1_management.sql`

This task creates the SQL migration file. **The migration must be applied manually** via the Supabase SQL Editor (per project reference: direct DB connection is blocked).

- [ ] **Step 1: Write migration file**

Create `supabase/migrations/20260408_phase1_management.sql`:

```sql
-- Phase 1: Management Foundation
-- Apply via Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Extend agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 10;

-- 2. Extend clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS column_mapping JSONB;

-- 3. Extend project_access table
ALTER TABLE project_access ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer';
ALTER TABLE project_access ADD COLUMN IF NOT EXISTS invited_by UUID;
ALTER TABLE project_access ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT now();

-- 4. Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'viewer')),
  client_ids UUID[] NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  user_id UUID,
  client_id UUID REFERENCES clients(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_agency ON activity_log(agency_id, created_at DESC);

-- 6. Enable RLS on new tables
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for invitations
CREATE POLICY "Agency owners can manage invitations"
  ON invitations FOR ALL
  USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt() ->> 'email' AND role = 'owner'));

-- 8. RLS policies for activity_log
CREATE POLICY "Agency members can view activity log"
  ON activity_log FOR SELECT
  USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt() ->> 'email'));

-- 9. Set existing project_access records to 'owner' role where applicable
UPDATE project_access pa
SET role = 'owner'
FROM agencies a, clients c
WHERE pa.agency_id = a.id
  AND pa.client_id = c.id
  AND c.agency_id = a.id
  AND a.role = 'owner'
  AND (pa.role IS NULL OR pa.role = 'viewer');
```

- [ ] **Step 2: Commit migration file**

```bash
git add supabase/migrations/20260408_phase1_management.sql
git commit -m "feat: add Phase 1 database migration (invitations, activity_log, role columns)"
```

- [ ] **Step 3: Apply migration**

Open Supabase Dashboard > SQL Editor > paste and run the migration.
Verify: Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'invitations';` — should show all columns.

---

## Task 17: Full Integration Test

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npx vitest run`
Expected: All existing 17 tests + new permissions (7) + invitations (4) = 28 tests PASS

- [ ] **Step 2: Run build**

Run: `cd /Users/khoweijie/Documents/funnel-dashboard && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual smoke test**

Start dev server: `cd /Users/khoweijie/Documents/funnel-dashboard && npm run dev`

Test these flows:
1. **Overview page** — `/clients` shows summary stats bar + KPI card grid
2. **Onboarding wizard** — `/clients/new` walks through 5 steps
3. **Team page** — `/settings/team` shows member list + invite dialog
4. **Permission gating** — Viewer role cannot see Team link or overview stats

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address integration test feedback"
```
