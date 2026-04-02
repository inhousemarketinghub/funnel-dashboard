# Funnel Dashboard MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web dashboard where marketing agencies view live funnel metrics from Google Sheets and generate Monthly/Weekly reports with one click.

**Architecture:** Next.js 14 App Router with Server Components fetching Google Sheets CSV data in real-time. Supabase handles auth (magic link) and stores client configs/KPI targets. A shared TypeScript metrics engine computes funnel analytics for both dashboard display and report generation.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase (Auth + PostgreSQL), Vercel Blob, Google Sheets CSV API

**Spec:** `docs/specs/2026-04-02-funnel-dashboard-design.md`

---

## File Structure

```
funnel-dashboard/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── page.tsx                      # Redirect to /clients
│   ├── login/page.tsx                # Auth page
│   ├── clients/
│   │   ├── page.tsx                  # Client list
│   │   └── new/page.tsx              # Add client form
│   ├── [clientId]/
│   │   ├── layout.tsx                # Client layout with topbar
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── report/
│   │   │   ├── monthly/page.tsx      # Monthly report preview + generate
│   │   │   └── weekly/page.tsx       # Weekly report preview + generate
│   │   └── settings/page.tsx         # Client KPI config
│   └── api/
│       └── report/
│           └── generate/route.ts     # Report generation API
├── components/
│   ├── ui/                           # shadcn/ui components (auto-generated)
│   ├── dashboard/
│   │   ├── hero-cards.tsx            # 4 top-level KPI cards
│   │   ├── funnel-flow.tsx           # Funnel with icons
│   │   ├── kpi-chart.tsx             # KPI achievement bars with hover
│   │   ├── mom-table.tsx             # MoM comparison table
│   │   └── client-switcher.tsx       # Client dropdown
│   └── reports/
│       ├── monthly-report.tsx        # Full monthly report component
│       ├── report-shell.tsx          # Sidebar + page structure
│       └── shared/
│           ├── funnel-flow-static.tsx # Static funnel for reports
│           ├── insight-card.tsx
│           ├── budget-scenarios.tsx
│           └── report-styles.css     # Warm Light theme for reports
├── lib/
│   ├── sheets.ts                     # Google Sheets CSV fetcher
│   ├── metrics.ts                    # Funnel metrics computation
│   ├── metrics.test.ts               # Metrics unit tests
│   ├── types.ts                      # Shared TypeScript types
│   ├── supabase/
│   │   ├── client.ts                 # Supabase browser client
│   │   ├── server.ts                 # Supabase server client
│   │   └── middleware.ts             # Auth middleware
│   └── utils.ts                      # Formatting helpers (fmt_rm, fmt_pct, etc.)
├── supabase/
│   └── migrations/
│       └── 001_initial.sql           # Database schema
├── .env.local.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.env.local.example`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/khoweijie/Documents/funnel-dashboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src=no --import-alias="@/*" --use-npm
```

Expected: Project created with App Router structure.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr recharts csv-parse
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button card input label table dialog dropdown-menu select toast tabs badge
```

- [ ] **Step 4: Create environment template**

Create `.env.local.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 5: Configure Warm Light theme in Tailwind**

Edit `tailwind.config.ts` — extend colors:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#7C6954", dark: "#63513C", bg: "#FBF8F4", bd: "#D6CBBE" },
        accent: { DEFAULT: "#B8860B", dark: "#9A7209" },
        surface: { DEFAULT: "#F5F1EB", card: "#FEFCF8", inset: "#F0EBE3" },
        status: { green: "#2D8A4E", yellow: "#B8860B", red: "#C53030" },
      },
      fontFamily: {
        sans: ["Open Sans", "sans-serif"],
        heading: ["Poppins", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
```

- [ ] **Step 6: Update root layout with fonts and theme**

Edit `app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Open_Sans, Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-sans" });
const poppins = Poppins({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-heading" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Funnel Dashboard",
  description: "Marketing agency performance dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${openSans.variable} ${poppins.variable} ${jetbrains.variable} font-sans bg-surface text-[#2A2019] antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000 — should see Next.js default page with Warm Light background.

- [ ] **Step 8: Commit**

```bash
git init
echo "node_modules\n.next\n.env.local" > .gitignore
git add -A
git commit -m "feat: project scaffolding — Next.js 14 + Tailwind + shadcn/ui + Warm Light theme"
```

---

## Task 2: Shared Types & Utility Functions

**Files:**
- Create: `lib/types.ts`, `lib/utils.ts`, `lib/utils.test.ts`

- [ ] **Step 1: Define core types**

Create `lib/types.ts`:
```typescript
export interface DailyMetric {
  date: Date;
  ad_spend: number;
  inquiry: number;
  contact: number;
  appointment: number;
  showup: number;
  orders: number;
  sales: number;
}

export interface Lead {
  appointment_date: Date | null;
  showed_up: boolean;
  sales: number;
  purchase_date: Date | null;
}

export interface FunnelMetrics {
  ad_spend: number;
  inquiry: number;
  contact: number;
  appointment: number;
  showup: number;
  est_showup: number;
  orders: number;
  sales: number;
  cpl: number;
  respond_rate: number;
  appt_rate: number;
  showup_rate: number;
  conv_rate: number;
  aov: number;
  roas: number;
  cpa_pct: number;
}

export interface KPIConfig {
  sales: number;
  orders: number;
  aov: number;
  cpl: number;
  respond_rate: number;
  appt_rate: number;
  showup_rate: number;
  conv_rate: number;
  ad_spend: number;
  daily_ad: number;
  roas: number;
  cpa_pct: number;
  target_contact: number;
  target_appt: number;
  target_showup: number;
}

export interface MoMResult {
  [key: string]: number | null;
}

export interface Achievement {
  [key: string]: number;
}

export interface BudgetScenario {
  spend: number;
  inquiry: number;
  new_contact: number;
  new_appt: number;
  pipeline: number;
  show_up: number;
  orders: number;
  sales: number;
  roas: number;
  cpa_pct: number;
  gap: number;
}

export interface ClientConfig {
  id: string;
  agency_id: string;
  name: string;
  sheet_id: string;
  logo_url: string | null;
  funnel_type: "appointment" | "walkin";
}

export type DateRange = [Date, Date];
```

- [ ] **Step 2: Write failing test for utility functions**

Create `lib/utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { fmtRM, fmtPct, fmtROAS, pct, momPct } from "./utils";

describe("fmtRM", () => {
  it("formats ringgit values", () => {
    expect(fmtRM(291220.5)).toBe("RM291,220.50");
    expect(fmtRM(0)).toBe("RM0.00");
    expect(fmtRM(25.23)).toBe("RM25.23");
  });
});

describe("fmtPct", () => {
  it("formats percentages", () => {
    expect(fmtPct(44.0)).toBe("44.0%");
    expect(fmtPct(null)).toBe("N/A");
  });
});

describe("fmtROAS", () => {
  it("formats ROAS multiplier", () => {
    expect(fmtROAS(36.5)).toBe("36.5x");
  });
});

describe("pct", () => {
  it("computes percentage", () => {
    expect(pct(8, 4)).toBe(200);
    expect(pct(0, 0)).toBe(0);
  });
});

describe("momPct", () => {
  it("computes MoM percentage change", () => {
    expect(momPct(316, 198)).toBeCloseTo(59.6, 1);
    expect(momPct(100, 0)).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run lib/utils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement utility functions**

Create `lib/utils.ts`:
```typescript
export function fmtRM(v: number): string {
  return `RM${v.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPct(v: number | null): string {
  if (v === null || v === undefined) return "N/A";
  return `${v.toFixed(1)}%`;
}

export function fmtROAS(v: number): string {
  return `${v.toFixed(1)}x`;
}

export function pct(numerator: number, denominator: number): number {
  return denominator ? (numerator / denominator) * 100 : 0;
}

export function momPct(current: number, previous: number): number | null {
  return previous ? ((current - previous) / previous) * 100 : null;
}

export function achEmoji(p: number): string {
  if (p >= 100) return "✅";
  if (p >= 80) return "⚠️";
  return "❌";
}

export function achLabel(p: number): string {
  if (p >= 100) return "ACHIEVED";
  if (p >= 80) return "CLOSE";
  return "MISSED";
}

export function kpiColorClass(tmRaw: number | null, kpiRaw: number | null, inverted: boolean): string {
  if (tmRaw === null || kpiRaw === null) return "";
  if (inverted) {
    if (tmRaw <= kpiRaw) return "text-status-green";
    if (tmRaw <= kpiRaw * 1.15) return "text-status-yellow";
    return "text-status-red";
  }
  if (tmRaw >= kpiRaw) return "text-status-green";
  if (tmRaw >= kpiRaw * 0.85) return "text-status-yellow";
  return "text-status-red";
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run lib/utils.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/utils.ts lib/utils.test.ts
git commit -m "feat: shared types and utility functions with tests"
```

---

## Task 3: Metrics Computation Engine

**Files:**
- Create: `lib/metrics.ts`, `lib/metrics.test.ts`

- [ ] **Step 1: Write failing tests for computeMetrics**

Create `lib/metrics.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario } from "./metrics";
import type { DailyMetric, KPIConfig } from "./types";

const sampleRows: DailyMetric[] = [
  { date: new Date("2026-03-01"), ad_spend: 250, inquiry: 10, contact: 5, appointment: 1, showup: 0, orders: 0, sales: 0 },
  { date: new Date("2026-03-02"), ad_spend: 260, inquiry: 12, contact: 4, appointment: 2, showup: 1, orders: 1, sales: 40000 },
];

describe("computeMetrics", () => {
  it("aggregates daily rows into funnel metrics", () => {
    const m = computeMetrics(sampleRows, 3);
    expect(m.ad_spend).toBe(510);
    expect(m.inquiry).toBe(22);
    expect(m.contact).toBe(9);
    expect(m.orders).toBe(1);
    expect(m.sales).toBe(40000);
    expect(m.cpl).toBeCloseTo(510 / 22, 2);
    expect(m.respond_rate).toBeCloseTo(9 / 22 * 100, 1);
    expect(m.showup_rate).toBeCloseTo(1 / 3 * 100, 1);
    expect(m.roas).toBeCloseTo(40000 / 510, 1);
  });

  it("handles zero denominators", () => {
    const empty: DailyMetric[] = [];
    const m = computeMetrics(empty, 0);
    expect(m.cpl).toBe(0);
    expect(m.roas).toBe(0);
    expect(m.aov).toBe(0);
  });
});

describe("computeMoM", () => {
  it("computes percentage changes", () => {
    const current = computeMetrics(sampleRows, 3);
    const previous = computeMetrics([sampleRows[0]], 1);
    const mom = computeMoM(current, previous);
    expect(mom.ad_spend).toBeCloseTo((510 - 250) / 250 * 100, 1);
    expect(mom.inquiry).toBeCloseTo((22 - 10) / 10 * 100, 1);
  });
});

const testKPI: KPIConfig = {
  sales: 300000, orders: 6, aov: 50000, cpl: 26, respond_rate: 30,
  appt_rate: 33, showup_rate: 90, conv_rate: 25, ad_spend: 7500,
  daily_ad: 250, roas: 40, cpa_pct: 2.5, target_contact: 80,
  target_appt: 27, target_showup: 24,
};

describe("computeAchievement", () => {
  it("returns percentage of KPI achieved", () => {
    const m = computeMetrics(sampleRows, 3);
    const ach = computeAchievement(m, testKPI);
    expect(ach.sales).toBeCloseTo(40000 / 300000 * 100, 1);
    expect(ach.orders).toBeCloseTo(1 / 6 * 100, 1);
  });
});

describe("budgetScenario", () => {
  it("projects next month sales from pipeline", () => {
    const m = computeMetrics(sampleRows, 3);
    const sc = budgetScenario(510, m, testKPI, 5);
    expect(sc.spend).toBe(510);
    expect(sc.inquiry).toBeCloseTo(510 / m.cpl, 0);
    expect(sc.pipeline).toBeGreaterThan(5); // est_su_next + new appts
    expect(sc.sales).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/metrics.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement metrics engine**

Create `lib/metrics.ts`:
```typescript
import type { DailyMetric, FunnelMetrics, KPIConfig, MoMResult, Achievement, BudgetScenario } from "./types";
import { pct, momPct } from "./utils";

export function computeMetrics(rows: DailyMetric[], estShowUp: number): FunnelMetrics {
  const sum = (fn: (r: DailyMetric) => number) => rows.reduce((a, r) => a + fn(r), 0);

  const ad_spend = sum((r) => r.ad_spend);
  const inquiry = sum((r) => r.inquiry);
  const contact = sum((r) => r.contact);
  const appointment = sum((r) => r.appointment);
  const showup = sum((r) => r.showup);
  const orders = sum((r) => r.orders);
  const sales = sum((r) => r.sales);

  return {
    ad_spend, inquiry, contact, appointment, showup, orders, sales,
    est_showup: estShowUp,
    cpl: inquiry ? ad_spend / inquiry : 0,
    respond_rate: pct(contact, inquiry),
    appt_rate: pct(appointment, contact),
    showup_rate: estShowUp ? pct(showup, estShowUp) : 0,
    conv_rate: showup ? pct(orders, showup) : 0,
    aov: orders ? sales / orders : 0,
    roas: ad_spend ? sales / ad_spend : 0,
    cpa_pct: sales ? pct(ad_spend, sales) : 0,
  };
}

const metricKeys: (keyof FunnelMetrics)[] = [
  "ad_spend", "inquiry", "contact", "appointment", "showup", "orders", "sales",
  "cpl", "respond_rate", "appt_rate", "showup_rate", "conv_rate", "aov", "roas", "cpa_pct",
];

export function computeMoM(current: FunnelMetrics, previous: FunnelMetrics): MoMResult {
  const result: MoMResult = {};
  for (const k of metricKeys) {
    result[k] = momPct(current[k] as number, previous[k] as number);
  }
  return result;
}

export function computeAchievement(m: FunnelMetrics, kpi: KPIConfig): Achievement {
  return {
    sales: pct(m.sales, kpi.sales),
    orders: pct(m.orders, kpi.orders),
    ad_spend: pct(m.ad_spend, kpi.ad_spend),
    cpl: m.cpl ? pct(kpi.cpl, m.cpl) : 0, // inverted
    respond_rate: pct(m.respond_rate, kpi.respond_rate),
    appt_rate: pct(m.appt_rate, kpi.appt_rate),
    showup_rate: pct(m.showup_rate, kpi.showup_rate),
    conv_rate: pct(m.conv_rate, kpi.conv_rate),
    aov: pct(m.aov, kpi.aov),
    roas: pct(m.roas, kpi.roas),
  };
}

export function budgetScenario(
  spend: number, metrics: FunnelMetrics, kpi: KPIConfig, estSUNext: number
): BudgetScenario {
  const inquiry = metrics.cpl ? spend / metrics.cpl : 0;
  const new_contact = inquiry * metrics.respond_rate / 100;
  const new_appt = new_contact * metrics.appt_rate / 100;
  const pipeline = estSUNext + new_appt;
  const show_up = pipeline * metrics.showup_rate / 100;
  const orders = show_up * metrics.conv_rate / 100;
  const sales = orders * metrics.aov;
  const roas = spend ? sales / spend : 0;
  const cpa_pct = sales ? pct(spend, sales) : 0;
  const gap = sales - kpi.sales;

  return { spend, inquiry, new_contact, new_appt, pipeline, show_up, orders, sales, roas, cpa_pct, gap };
}

export function computeWeeklyBreakdown(rows: DailyMetric[], year: number, month: number): FunnelMetrics[] {
  const w1 = rows.filter((r) => r.date.getDate() >= 1 && r.date.getDate() <= 7);
  const w2 = rows.filter((r) => r.date.getDate() >= 8 && r.date.getDate() <= 14);
  const w3 = rows.filter((r) => r.date.getDate() >= 15 && r.date.getDate() <= 21);
  const w4 = rows.filter((r) => r.date.getDate() >= 22);
  // Est show up per week not available at this level — pass 0
  return [w1, w2, w3, w4].map((w) => computeMetrics(w, 0));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/metrics.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics.ts lib/metrics.test.ts
git commit -m "feat: metrics computation engine with tests — migrated from Python"
```

---

## Task 4: Google Sheets Data Fetcher

**Files:**
- Create: `lib/sheets.ts`, `lib/sheets.test.ts`

- [ ] **Step 1: Write failing test**

Create `lib/sheets.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parsePerformanceCSV, parseLeadSalesCSV } from "./sheets";

const perfCSV = `Date,Taxed Ad Spend,Lead Funnel Ad Spend,Branding,PM (Inquiry),Unused,Unused,Contact Given,Appointment,Showed Up,u,u,u,u,Order Counts,u,u,u,Total Sales
01/03/2026,RM250.00,200,50,10,0,0,5,1,0,0,0,0,0,0,0,0,0,0
02/03/2026,RM260.00,210,50,12,0,0,4,2,1,0,0,0,0,1,0,0,0,RM40000`;

describe("parsePerformanceCSV", () => {
  it("parses CSV into DailyMetric array", () => {
    const rows = parsePerformanceCSV(perfCSV);
    expect(rows).toHaveLength(2);
    expect(rows[0].ad_spend).toBe(250);
    expect(rows[0].inquiry).toBe(10);
    expect(rows[1].sales).toBe(40000);
  });
});

const leadCSV = `Date,Source,Condition,Name,Phone,Property,Unit,Size,Req,Budget,Appt Person,Appt Location,Appointment Date,Appt Time,Notes
01/01/2026,FB,New,John,012,Condo,A,1000,Reno,50k,Ali,Office,15/03/2026,10am,test
02/01/2026,FB,New,Jane,013,Condo,B,800,Reno,30k,Ali,Office,05/04/2026,2pm,test`;

describe("parseLeadSalesCSV", () => {
  it("counts appointments by month", () => {
    const leads = parseLeadSalesCSV(leadCSV);
    expect(leads).toHaveLength(2);
    expect(leads[0].appointment_date?.getMonth()).toBe(2); // March
    expect(leads[1].appointment_date?.getMonth()).toBe(3); // April
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run lib/sheets.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement sheets fetcher**

Create `lib/sheets.ts`:
```typescript
import type { DailyMetric, Lead } from "./types";

const SHEETS_CSV_URL = (id: string, tab: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;

function parseRM(val: string): number {
  if (!val || val.trim() === "") return 0;
  const v = val.replace(/[^\d.\-]/g, "");
  return parseFloat(v) || 0;
}

function parseInt2(val: string): number {
  if (!val || val.trim() === "") return 0;
  return parseInt(val.replace(/[^\d]/g, ""), 10) || 0;
}

function parseDate(val: string): Date | null {
  if (!val || val.trim() === "") return null;
  val = val.trim();
  for (const fmt of ["dd/mm/yyyy", "yyyy-mm-dd", "mm/dd/yyyy"]) {
    try {
      const parts = val.split(/[\/\-]/);
      if (parts.length !== 3) continue;
      let y: number, m: number, d: number;
      if (fmt === "dd/mm/yyyy") { d = +parts[0]; m = +parts[1] - 1; y = +parts[2]; }
      else if (fmt === "yyyy-mm-dd") { y = +parts[0]; m = +parts[1] - 1; d = +parts[2]; }
      else { m = +parts[0] - 1; d = +parts[1]; y = +parts[2]; }
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime()) && date.getFullYear() > 2000) return date;
    } catch { continue; }
  }
  return null;
}

export function parsePerformanceCSV(csv: string): DailyMetric[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const rows: DailyMetric[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, ""));
    const date = parseDate(cols[0]);
    if (!date) continue;
    rows.push({
      date,
      ad_spend: parseRM(cols[1]),
      inquiry: parseInt2(cols[4]),
      contact: parseInt2(cols[6]),
      appointment: parseInt2(cols[7]),
      showup: parseInt2(cols[8]),
      orders: parseInt2(cols[13]),
      sales: parseRM(cols[17]),
    });
  }
  return rows;
}

export function parseLeadSalesCSV(csv: string): Lead[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const leads: Lead[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/^"|"$/g, ""));
    if (cols.length <= 12) continue;
    leads.push({
      appointment_date: parseDate(cols[12]),
      showed_up: (cols[17] || "").toLowerCase() === "yes",
      sales: parseRM(cols[27] || "0"),
      purchase_date: parseDate(cols[24] || ""),
    });
  }
  return leads;
}

export async function fetchSheetCSV(sheetId: string, tabName: string): Promise<string> {
  const url = SHEETS_CSV_URL(sheetId, tabName);
  const res = await fetch(url, { next: { revalidate: 300 } }); // 5 min cache
  if (!res.ok) throw new Error(`Failed to fetch sheet ${tabName}: ${res.status}`);
  return res.text();
}

export async function fetchPerformanceData(sheetId: string): Promise<DailyMetric[]> {
  const csv = await fetchSheetCSV(sheetId, "Performance Tracker");
  return parsePerformanceCSV(csv);
}

export async function fetchLeadData(sheetId: string): Promise<Lead[]> {
  const csv = await fetchSheetCSV(sheetId, "Lead & Sales Tracker");
  return parseLeadSalesCSV(csv);
}

export function countEstShowUp(leads: Lead[], start: Date, end: Date): number {
  return leads.filter((l) =>
    l.appointment_date && l.appointment_date >= start && l.appointment_date <= end
  ).length;
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run lib/sheets.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/sheets.ts lib/sheets.test.ts
git commit -m "feat: Google Sheets CSV fetcher with parsers and tests"
```

---

## Task 5: Supabase Setup & Auth

**Files:**
- Create: `supabase/migrations/001_initial.sql`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, `app/login/page.tsx`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com/dashboard, create project "funnel-dashboard". Copy URL and anon key to `.env.local`.

- [ ] **Step 2: Create database migration**

Create `supabase/migrations/001_initial.sql`:
```sql
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  sheet_id text NOT NULL,
  logo_url text,
  funnel_type text DEFAULT 'appointment',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE kpi_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  month date NOT NULL,
  sales numeric DEFAULT 300000,
  orders integer DEFAULT 6,
  aov numeric DEFAULT 50000,
  cpl numeric DEFAULT 26,
  respond_rate numeric DEFAULT 30,
  appt_rate numeric DEFAULT 33,
  showup_rate numeric DEFAULT 90,
  conv_rate numeric DEFAULT 25,
  ad_spend numeric DEFAULT 7500,
  daily_ad numeric DEFAULT 250,
  roas numeric DEFAULT 40,
  cpa_pct numeric DEFAULT 2.5,
  target_contact integer DEFAULT 80,
  target_appt integer DEFAULT 27,
  target_showup integer DEFAULT 24,
  UNIQUE(client_id, month)
);

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  period text NOT NULL,
  html_url text,
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own agency" ON agencies FOR SELECT USING (email = auth.jwt()->>'email');
CREATE POLICY "Users can read own clients" ON clients FOR SELECT USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can insert own clients" ON clients FOR INSERT WITH CHECK (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can update own clients" ON clients FOR UPDATE USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can delete own clients" ON clients FOR DELETE USING (agency_id IN (SELECT id FROM agencies WHERE email = auth.jwt()->>'email'));
CREATE POLICY "Users can manage own kpi_configs" ON kpi_configs FOR ALL USING (client_id IN (SELECT c.id FROM clients c JOIN agencies a ON c.agency_id = a.id WHERE a.email = auth.jwt()->>'email'));
CREATE POLICY "Users can manage own reports" ON reports FOR ALL USING (client_id IN (SELECT c.id FROM clients c JOIN agencies a ON c.agency_id = a.id WHERE a.email = auth.jwt()->>'email'));
```

Run via Supabase dashboard SQL editor or CLI.

- [ ] **Step 3: Create Supabase clients**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
}
```

- [ ] **Step 4: Create auth middleware**

Create `middleware.ts` (project root):
```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|login).*)"] };
```

- [ ] **Step 5: Create login page**

Create `app/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/clients` },
    });
    setLoading(false);
    if (!error) setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <Card className="w-full max-w-md bg-surface-card border-primary-bd">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl text-[#2A2019]">Funnel Dashboard</CardTitle>
          <CardDescription>Marketing agency performance platform</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-center text-sm text-[#504034]">Check your email for the magic link.</p>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" className="w-full bg-accent hover:bg-accent-dark text-white" disabled={loading}>
                {loading ? "Sending..." : "Send Magic Link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Verify login page renders**

```bash
npm run dev
```

Open http://localhost:3000/login — should see login card with Warm Light theme.

- [ ] **Step 7: Commit**

```bash
git add supabase/ lib/supabase/ middleware.ts app/login/
git commit -m "feat: Supabase auth with magic link + database schema + middleware"
```

---

## Task 6: Client Management Pages

**Files:**
- Create: `app/clients/page.tsx`, `app/clients/new/page.tsx`, `app/[clientId]/settings/page.tsx`

- [ ] **Step 1: Create client list page**

Create `app/clients/page.tsx`:
```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const { data: user } = await supabase.auth.getUser();
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-surface p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-heading text-2xl font-bold text-[#2A2019]">Clients</h1>
          <Link href="/clients/new">
            <Button className="bg-accent hover:bg-accent-dark text-white">+ Add Client</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients?.map((client) => (
            <Link key={client.id} href={`/${client.id}`}>
              <Card className="bg-surface-card border-primary-bd hover:border-accent cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{client.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[#8A7D72] font-mono">Sheet: {client.sheet_id.slice(0, 20)}...</p>
                  <p className="text-xs text-[#8A7D72] mt-1">Funnel: {client.funnel_type}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!clients || clients.length === 0) && (
            <p className="text-[#8A7D72] col-span-2 text-center py-12">No clients yet. Add your first client to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create add-client page**

Create `app/clients/new/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get or create agency
    let { data: agency } = await supabase.from("agencies").select("id").eq("email", user.email).single();
    if (!agency) {
      const { data } = await supabase.from("agencies").insert({ email: user.email!, name: user.email!.split("@")[0] }).select("id").single();
      agency = data;
    }
    if (!agency) return;

    // Create client
    const { data: client } = await supabase.from("clients").insert({
      agency_id: agency.id, name, sheet_id: sheetId,
    }).select("id").single();

    if (client) {
      // Create default KPI config for current month
      const now = new Date();
      const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      await supabase.from("kpi_configs").insert({ client_id: client.id, month });
      router.push(`/${client.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-surface p-8 flex justify-center">
      <Card className="w-full max-w-lg bg-surface-card border-primary-bd">
        <CardHeader>
          <CardTitle className="font-heading">Add New Client</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Brand Name</Label>
              <Input placeholder="Dream Crafter" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Google Sheet ID</Label>
              <Input placeholder="1cmT6hRKa5USiFv2GoiF57cp_D5x5offlV5aVHJc3VyQ" value={sheetId} onChange={(e) => setSheetId(e.target.value)} required />
              <p className="text-xs text-[#8A7D72] mt-1">The long ID from your Google Sheet URL</p>
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent-dark text-white" disabled={loading}>
              {loading ? "Creating..." : "Create Client"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify pages render**

```bash
npm run dev
```

Navigate to /clients and /clients/new.

- [ ] **Step 4: Commit**

```bash
git add app/clients/
git commit -m "feat: client management — list and create pages"
```

---

## Task 7: Dashboard Home Page

**Files:**
- Create: `app/[clientId]/layout.tsx`, `app/[clientId]/page.tsx`, `components/dashboard/hero-cards.tsx`, `components/dashboard/funnel-flow.tsx`, `components/dashboard/kpi-chart.tsx`, `components/dashboard/mom-table.tsx`

This is the largest task. Each component is a separate file, but they compose into one dashboard page.

- [ ] **Step 1: Create client layout with topbar**

Create `app/[clientId]/layout.tsx`:
```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: { clientId: string } }) {
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.clientId).single();
  if (!client) notFound();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 bg-surface-card border-b border-primary-bd px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients" className="text-[#8A7D72] hover:text-accent text-sm">← All Clients</Link>
          <h1 className="font-heading font-bold text-lg text-[#2A2019]">{client.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${params.clientId}/settings`} className="text-sm text-[#8A7D72] hover:text-accent">Settings</Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create Hero Cards component**

Create `components/dashboard/hero-cards.tsx`:
```tsx
import type { FunnelMetrics, KPIConfig, Achievement } from "@/lib/types";
import { fmtRM, fmtROAS, achEmoji } from "@/lib/utils";

interface Props {
  metrics: FunnelMetrics;
  kpi: KPIConfig;
  achievement: Achievement;
}

export function HeroCards({ metrics, kpi, achievement }: Props) {
  const cards = [
    { label: "TOTAL SALES", value: fmtRM(metrics.sales), sub: `KPI: ${fmtRM(kpi.sales)} · ${achEmoji(achievement.sales)} ${achievement.sales.toFixed(0)}%` },
    { label: "ROAS", value: fmtROAS(metrics.roas), sub: `KPI: ${fmtROAS(kpi.roas)} · CPA% ${metrics.cpa_pct.toFixed(2)}%` },
    { label: "ORDERS", value: String(metrics.orders), sub: `KPI: ${kpi.orders} · ${achEmoji(achievement.orders)} ${achievement.orders.toFixed(0)}%` },
    { label: "CPL", value: fmtRM(metrics.cpl), sub: `KPI: ${fmtRM(kpi.cpl)} · ${achEmoji(achievement.cpl)}` },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-surface-card border border-primary-bd rounded-xl p-5 hover:border-accent hover:-translate-y-0.5 transition-all cursor-default">
          <div className="text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono mb-1">{c.label}</div>
          <div className="text-2xl font-bold text-accent font-mono">{c.value}</div>
          <div className="text-[11px] text-[#504034] mt-1">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create Funnel Flow component**

Create `components/dashboard/funnel-flow.tsx`:
```tsx
import type { FunnelMetrics } from "@/lib/types";
import { fmtRM } from "@/lib/utils";

const STEPS = [
  { key: "ad_spend", label: "AD SPEND", icon: "💲", fmt: (v: number) => fmtRM(v) },
  { key: "inquiry", label: "INQUIRY", icon: "💬", fmt: (v: number) => String(v) },
  { key: "contact", label: "CONTACT", icon: "👥", fmt: (v: number) => String(v) },
  { key: "appointment", label: "APPT", icon: "📅", fmt: (v: number) => String(v) },
  { key: "showup", label: "SHOW UP", icon: "📍", fmt: (v: number) => String(v) },
  { key: "orders", label: "ORDERS", icon: "✅", fmt: (v: number) => String(v) },
  { key: "sales", label: "SALES", icon: "💵", fmt: (v: number) => fmtRM(v) },
] as const;

export function FunnelFlow({ metrics }: { metrics: FunnelMetrics }) {
  return (
    <div className="flex items-center flex-wrap gap-0 bg-surface-card border border-primary-bd rounded-xl p-5 mb-6">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <div className="text-center px-3 py-2 rounded-lg hover:bg-primary-bg hover:-translate-y-0.5 transition-all cursor-default">
            <div className="text-2xl mb-1">{step.icon}</div>
            <div className="text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono">{step.label}</div>
            <div className="text-sm font-semibold text-[#2A2019] font-mono">{step.fmt(metrics[step.key] as number)}</div>
          </div>
          {i < STEPS.length - 1 && (
            <svg width="16" height="16" viewBox="0 0 20 20" className="text-primary-bd mx-1 flex-shrink-0">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create MoM Table component**

Create `components/dashboard/mom-table.tsx`:
```tsx
"use client";
import type { FunnelMetrics, KPIConfig, MoMResult } from "@/lib/types";
import { fmtRM, fmtPct, fmtROAS, kpiColorClass } from "@/lib/utils";

interface FunnelRow {
  label: string;
  tmFmt: string;
  lmFmt: string;
  mom: number | null;
  kpiFmt: string;
  inverted: boolean;
  tmRaw: number | null;
  kpiRaw: number | null;
}

function buildRows(tm: FunnelMetrics, lm: FunnelMetrics, mom: MoMResult, kpi: KPIConfig): FunnelRow[] {
  return [
    { label: "Total Sales", tmFmt: fmtRM(tm.sales), lmFmt: fmtRM(lm.sales), mom: mom.sales ?? null, kpiFmt: fmtRM(kpi.sales), inverted: false, tmRaw: tm.sales, kpiRaw: kpi.sales },
    { label: "Total Ad Spend", tmFmt: fmtRM(tm.ad_spend), lmFmt: fmtRM(lm.ad_spend), mom: mom.ad_spend ?? null, kpiFmt: fmtRM(kpi.ad_spend), inverted: false, tmRaw: tm.ad_spend, kpiRaw: kpi.ad_spend },
    { label: "Online Inquiry", tmFmt: String(tm.inquiry), lmFmt: String(lm.inquiry), mom: mom.inquiry ?? null, kpiFmt: String(Math.round(kpi.ad_spend / kpi.cpl)), inverted: false, tmRaw: tm.inquiry, kpiRaw: kpi.ad_spend / kpi.cpl },
    { label: "CPL", tmFmt: fmtRM(tm.cpl), lmFmt: fmtRM(lm.cpl), mom: mom.cpl ?? null, kpiFmt: fmtRM(kpi.cpl), inverted: true, tmRaw: tm.cpl, kpiRaw: kpi.cpl },
    { label: "Contact Given", tmFmt: String(tm.contact), lmFmt: String(lm.contact), mom: mom.contact ?? null, kpiFmt: String(kpi.target_contact), inverted: false, tmRaw: tm.contact, kpiRaw: kpi.target_contact },
    { label: "Respond Rate", tmFmt: `${tm.respond_rate.toFixed(1)}%`, lmFmt: `${lm.respond_rate.toFixed(1)}%`, mom: mom.respond_rate ?? null, kpiFmt: `${kpi.respond_rate}%`, inverted: false, tmRaw: tm.respond_rate, kpiRaw: kpi.respond_rate },
    { label: "Appointment", tmFmt: String(tm.appointment), lmFmt: String(lm.appointment), mom: mom.appointment ?? null, kpiFmt: String(kpi.target_appt), inverted: false, tmRaw: tm.appointment, kpiRaw: kpi.target_appt },
    { label: "Appt Rate", tmFmt: `${tm.appt_rate.toFixed(1)}%`, lmFmt: `${lm.appt_rate.toFixed(1)}%`, mom: mom.appt_rate ?? null, kpiFmt: `${kpi.appt_rate}%`, inverted: false, tmRaw: tm.appt_rate, kpiRaw: kpi.appt_rate },
    { label: "Est. Show Up", tmFmt: String(tm.est_showup), lmFmt: String(lm.est_showup), mom: null, kpiFmt: "—", inverted: false, tmRaw: null, kpiRaw: null },
    { label: "Show Up", tmFmt: String(tm.showup), lmFmt: String(lm.showup), mom: mom.showup ?? null, kpiFmt: String(kpi.target_showup), inverted: false, tmRaw: tm.showup, kpiRaw: kpi.target_showup },
    { label: "Show Up Rate", tmFmt: `${tm.showup_rate.toFixed(1)}%`, lmFmt: `${lm.showup_rate.toFixed(1)}%`, mom: mom.showup_rate ?? null, kpiFmt: `${kpi.showup_rate}%`, inverted: false, tmRaw: tm.showup_rate, kpiRaw: kpi.showup_rate },
    { label: "Orders", tmFmt: String(tm.orders), lmFmt: String(lm.orders), mom: mom.orders ?? null, kpiFmt: String(kpi.orders), inverted: false, tmRaw: tm.orders, kpiRaw: kpi.orders },
    { label: "Conv Rate", tmFmt: `${tm.conv_rate.toFixed(1)}%`, lmFmt: `${lm.conv_rate.toFixed(1)}%`, mom: mom.conv_rate ?? null, kpiFmt: `${kpi.conv_rate}%`, inverted: false, tmRaw: tm.conv_rate, kpiRaw: kpi.conv_rate },
    { label: "AOV", tmFmt: fmtRM(tm.aov), lmFmt: fmtRM(lm.aov), mom: mom.aov ?? null, kpiFmt: fmtRM(kpi.aov), inverted: false, tmRaw: tm.aov, kpiRaw: kpi.aov },
    { label: "ROAS", tmFmt: fmtROAS(tm.roas), lmFmt: fmtROAS(lm.roas), mom: mom.roas ?? null, kpiFmt: fmtROAS(kpi.roas), inverted: false, tmRaw: tm.roas, kpiRaw: kpi.roas },
    { label: "CPA%", tmFmt: `${tm.cpa_pct.toFixed(2)}%`, lmFmt: `${lm.cpa_pct.toFixed(2)}%`, mom: mom.cpa_pct ?? null, kpiFmt: `${kpi.cpa_pct}%`, inverted: true, tmRaw: tm.cpa_pct, kpiRaw: kpi.cpa_pct },
  ];
}

function momColor(v: number | null, inv: boolean): string {
  if (v === null) return "text-[#8A7D72]";
  const improving = (v > 0 && !inv) || (v < 0 && inv);
  if (Math.abs(v) < 5) return "text-status-yellow font-semibold";
  return improving ? "text-status-green font-semibold" : "text-status-red font-semibold";
}

export function MoMTable({ tm, lm, mom, kpi, thisMonth, lastMonth }: {
  tm: FunnelMetrics; lm: FunnelMetrics; mom: MoMResult; kpi: KPIConfig; thisMonth: string; lastMonth: string;
}) {
  const rows = buildRows(tm, lm, mom, kpi);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gradient-to-b from-[#FAF7F3] to-[#F3EDE5]">
            <th className="text-left p-3 text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono border-b border-primary-bd">Metric</th>
            <th className="text-left p-3 text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono border-b border-primary-bd">{thisMonth}</th>
            <th className="text-left p-3 text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono border-b border-primary-bd">{lastMonth}</th>
            <th className="text-left p-3 text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono border-b border-primary-bd">MoM%</th>
            <th className="text-left p-3 text-[10px] uppercase tracking-wider text-[#8A7D72] font-mono border-b border-primary-bd">KPI Target</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="hover:bg-primary-bg transition-colors border-b border-[#EDE7DD]">
              <td className="p-3 font-semibold text-[#2A2019] whitespace-nowrap">{r.label}</td>
              <td className={`p-3 font-mono ${kpiColorClass(r.tmRaw, r.kpiRaw, r.inverted)}`}>{r.tmFmt}</td>
              <td className="p-3 font-mono text-[#504034]">{r.lmFmt}</td>
              <td className={`p-3 font-mono ${momColor(r.mom, r.inverted)}`}>
                {r.mom !== null ? `${r.mom > 0 ? "+" : ""}${r.mom.toFixed(1)}%` : "N/A"}
              </td>
              <td className="p-3 font-mono text-[#8A7D72]">{r.kpiFmt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create KPI Achievement Chart component**

Create `components/dashboard/kpi-chart.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { Achievement } from "@/lib/types";

interface KPIItem {
  label: string;
  value: number;
  target: string;
  actual: string;
}

export function KPIChart({ items }: { items: KPIItem[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxPct = 120;

  return (
    <div className="bg-surface-card border border-primary-bd rounded-xl p-6">
      <h3 className="font-heading font-bold text-[15px] mb-1">KPI Achievement</h3>
      <p className="text-[11px] text-[#8A7D72] mb-4">Red line = KPI target · Hover for details</p>
      <div className="space-y-2">
        {items.map((item, i) => {
          const barPct = Math.min(item.value / maxPct * 100, 100);
          const color = item.value >= 100 ? "#2D8A4E" : item.value >= 80 ? "#B8860B" : "#C53030";
          return (
            <div key={item.label} className="flex items-center gap-3 h-8 relative"
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div className="w-28 text-right text-[11px] font-semibold text-[#504034] font-mono shrink-0">{item.label}</div>
              <div className="flex-1 h-5 bg-surface-inset rounded-md relative cursor-pointer">
                <div className="h-full rounded-md transition-all duration-300 flex items-center justify-end pr-2"
                  style={{ width: `${barPct}%`, background: color }}>
                  {barPct >= 30 && <span className="text-[11px] font-bold text-white font-mono">{item.value.toFixed(0)}%</span>}
                </div>
                {barPct < 30 && (
                  <span className="absolute text-[11px] font-bold font-mono" style={{ left: `${barPct + 1}%`, top: "50%", transform: "translateY(-50%)", color }}>{item.value.toFixed(0)}%</span>
                )}
                <div className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-status-red" style={{ left: `${100 / maxPct * 100}%` }} />
                {hovered === i && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-card border border-primary-bd rounded-lg p-3 shadow-lg z-10 min-w-[180px]">
                    <div className="font-bold text-[13px] text-[#2A2019] mb-2 pb-1 border-b border-primary-bd">{item.label}</div>
                    <div className="flex justify-between text-[12px] font-mono text-[#504034] py-0.5"><span>KPI Target</span><b className="text-[#2A2019]">{item.target}</b></div>
                    <div className="flex justify-between text-[12px] font-mono text-[#504034] py-0.5"><span>Actual</span><b className="text-[#2A2019]">{item.actual}</b></div>
                    <div className="flex justify-between text-[12px] font-mono text-[#504034] py-0.5"><span>Achievement</span><b style={{ color }}>{item.value.toFixed(0)}%</b></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create Dashboard page composing all components**

Create `app/[clientId]/page.tsx`:
```tsx
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchLeadData, countEstShowUp } from "@/lib/sheets";
import { computeMetrics, computeMoM, computeAchievement } from "@/lib/metrics";
import { fmtRM, fmtPct, fmtROAS } from "@/lib/utils";
import { HeroCards } from "@/components/dashboard/hero-cards";
import { FunnelFlow } from "@/components/dashboard/funnel-flow";
import { KPIChart } from "@/components/dashboard/kpi-chart";
import { MoMTable } from "@/components/dashboard/mom-table";
import type { KPIConfig } from "@/lib/types";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardPage({ params }: { params: { clientId: string } }) {
  const supabase = await createServerSupabase();
  const { data: client } = await supabase.from("clients").select("*").eq("id", params.clientId).single();
  if (!client) return <p>Client not found</p>;

  // Get KPI config for current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  let { data: kpiRow } = await supabase.from("kpi_configs").select("*").eq("client_id", client.id).eq("month", monthStr).single();
  if (!kpiRow) {
    // Fallback: get latest config
    const { data } = await supabase.from("kpi_configs").select("*").eq("client_id", client.id).order("month", { ascending: false }).limit(1).single();
    kpiRow = data;
  }
  const kpi: KPIConfig = kpiRow || {
    sales: 300000, orders: 6, aov: 50000, cpl: 26, respond_rate: 30,
    appt_rate: 33, showup_rate: 90, conv_rate: 25, ad_spend: 7500,
    daily_ad: 250, roas: 40, cpa_pct: 2.5, target_contact: 80, target_appt: 27, target_showup: 24,
  };

  // Fetch data
  const [perfData, leadData] = await Promise.all([
    fetchPerformanceData(client.sheet_id),
    fetchLeadData(client.sheet_id),
  ]);

  // Current month boundaries
  const reportEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
  const reportStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth(), 1);
  const prevEnd = new Date(reportStart.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);

  const thisMonthRows = perfData.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const lastMonthRows = perfData.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const estSU = countEstShowUp(leadData, reportStart, reportEnd);
  const estSULast = countEstShowUp(leadData, prevStart, prevEnd);

  const tm = computeMetrics(thisMonthRows, estSU);
  const lm = computeMetrics(lastMonthRows, estSULast);
  const mom = computeMoM(tm, lm);
  const ach = computeAchievement(tm, kpi);

  const thisMonthName = reportStart.toLocaleDateString("en", { month: "long", year: "numeric" });
  const lastMonthName = prevStart.toLocaleDateString("en", { month: "long", year: "numeric" });

  const kpiItems = [
    { label: "Sales", value: ach.sales, target: fmtRM(kpi.sales), actual: fmtRM(tm.sales) },
    { label: "Ad Spend", value: ach.ad_spend, target: fmtRM(kpi.ad_spend), actual: fmtRM(tm.ad_spend) },
    { label: "AOV", value: ach.aov, target: fmtRM(kpi.aov), actual: fmtRM(tm.aov) },
    { label: "CPL", value: ach.cpl, target: fmtRM(kpi.cpl), actual: fmtRM(tm.cpl) },
    { label: "Respond Rate", value: ach.respond_rate, target: `${kpi.respond_rate}%`, actual: `${tm.respond_rate.toFixed(1)}%` },
    { label: "Appt Rate", value: ach.appt_rate, target: `${kpi.appt_rate}%`, actual: `${tm.appt_rate.toFixed(1)}%` },
    { label: "Show Up Rate", value: ach.showup_rate, target: `${kpi.showup_rate}%`, actual: `${tm.showup_rate.toFixed(1)}%` },
    { label: "Conv Rate", value: Math.min(ach.conv_rate, 200), target: `${kpi.conv_rate}%`, actual: `${tm.conv_rate.toFixed(1)}%` },
    { label: "CPA%", value: tm.cpa_pct ? (kpi.cpa_pct / tm.cpa_pct) * 100 : 0, target: `${kpi.cpa_pct}%`, actual: `${tm.cpa_pct.toFixed(2)}%` },
  ];

  return (
    <div>
      <HeroCards metrics={tm} kpi={kpi} achievement={ach} />
      <FunnelFlow metrics={tm} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-surface-card border border-primary-bd rounded-xl p-6">
          <h3 className="font-heading font-bold text-[15px] mb-4">MoM Funnel Comparison</h3>
          <MoMTable tm={tm} lm={lm} mom={mom} kpi={kpi} thisMonth={thisMonthName} lastMonth={lastMonthName} />
        </div>
        <KPIChart items={kpiItems} />
      </div>

      <div className="flex gap-3">
        <Link href={`/${params.clientId}/report/monthly`}>
          <Button className="bg-accent hover:bg-accent-dark text-white">Generate Monthly Report</Button>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify dashboard renders with Dream Crafter data**

Add Dream Crafter as a test client via /clients/new with sheet ID `1cmT6hRKa5USiFv2GoiF57cp_D5x5offlV5aVHJc3VyQ`. Navigate to dashboard.

- [ ] **Step 8: Commit**

```bash
git add app/\[clientId\]/ components/dashboard/
git commit -m "feat: dashboard home with hero cards, funnel flow, MoM table, KPI chart"
```

---

## Task 8: Monthly Report Generation API

**Files:**
- Create: `app/api/report/generate/route.ts`, `app/[clientId]/report/monthly/page.tsx`, `components/reports/monthly-report.tsx`

- [ ] **Step 1: Create report generation API route**

Create `app/api/report/generate/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchPerformanceData, fetchLeadData, countEstShowUp } from "@/lib/sheets";
import { computeMetrics, computeMoM, computeAchievement, budgetScenario } from "@/lib/metrics";

export async function POST(request: NextRequest) {
  const { clientId, type } = await request.json();
  const supabase = await createServerSupabase();

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Fetch fresh data (no cache for report generation)
  const [perfData, leadData] = await Promise.all([
    fetchPerformanceData(client.sheet_id),
    fetchLeadData(client.sheet_id),
  ]);

  // Get KPI
  const now = new Date();
  const reportEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const reportStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth(), 1);
  const prevEnd = new Date(reportStart.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);

  const monthStr = `${reportStart.getFullYear()}-${String(reportStart.getMonth() + 1).padStart(2, "0")}-01`;
  let { data: kpiRow } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).eq("month", monthStr).single();
  if (!kpiRow) {
    const { data } = await supabase.from("kpi_configs").select("*").eq("client_id", clientId).order("month", { ascending: false }).limit(1).single();
    kpiRow = data;
  }

  const thisMonthRows = perfData.filter((r) => r.date >= reportStart && r.date <= reportEnd);
  const lastMonthRows = perfData.filter((r) => r.date >= prevStart && r.date <= prevEnd);
  const estSU = countEstShowUp(leadData, reportStart, reportEnd);
  const estSULast = countEstShowUp(leadData, prevStart, prevEnd);

  const tm = computeMetrics(thisMonthRows, estSU);
  const lm = computeMetrics(lastMonthRows, estSULast);
  const mom = computeMoM(tm, lm);
  const ach = computeAchievement(tm, kpiRow);

  // Next month est show up
  const nextStart = new Date(reportEnd.getFullYear(), reportEnd.getMonth() + 1, 1);
  const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
  const estSUNext = countEstShowUp(leadData, nextStart, nextEnd);

  const s1 = budgetScenario(tm.ad_spend, tm, kpiRow, estSUNext);
  const s2 = budgetScenario(tm.ad_spend * 1.2, tm, kpiRow, estSUNext);
  const s3 = budgetScenario(tm.ad_spend * 0.8, tm, kpiRow, estSUNext);

  // Return computed data — frontend will render the report
  return NextResponse.json({
    client, kpi: kpiRow, tm, lm, mom, ach, s1, s2, s3, estSUNext,
    reportMonth: reportStart.toLocaleDateString("en", { month: "long", year: "numeric" }),
    prevMonth: prevStart.toLocaleDateString("en", { month: "long", year: "numeric" }),
  });
}
```

- [ ] **Step 2: Create monthly report page with generate button**

Create `app/[clientId]/report/monthly/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useParams } from "next/navigation";

export default function MonthlyReportPage() {
  const { clientId } = useParams();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  async function generateReport() {
    setLoading(true);
    const res = await fetch("/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, type: "monthly" }),
    });
    const data = await res.json();
    setReportData(data);
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#2A2019]">Monthly Report</h1>
          <p className="text-sm text-[#8A7D72]">Generate and preview the monthly performance report</p>
        </div>
        <Button onClick={generateReport} className="bg-accent hover:bg-accent-dark text-white" disabled={loading}>
          {loading ? "Generating..." : "Generate Report"}
        </Button>
      </div>
      {reportData && (
        <div className="bg-surface-card border border-primary-bd rounded-xl p-6">
          <p className="text-sm text-[#504034] mb-4">
            Report generated for <b>{reportData.reportMonth}</b> · {reportData.client.name}
          </p>
          <p className="text-[#8A7D72] text-sm">
            Sales: <b className="text-[#2A2019] font-mono">{reportData.tm.sales.toLocaleString("en", { style: "currency", currency: "MYR" })}</b> ·
            Orders: <b className="text-[#2A2019] font-mono">{reportData.tm.orders}</b> ·
            ROAS: <b className="text-[#2A2019] font-mono">{reportData.tm.roas.toFixed(1)}x</b>
          </p>
          {/* Full report rendering will be added in Phase 2 */}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify report generation works**

Navigate to /[clientId]/report/monthly, click "Generate Report". Should see computed data.

- [ ] **Step 4: Commit**

```bash
git add app/api/report/ app/\[clientId\]/report/
git commit -m "feat: monthly report generation API + preview page"
```

---

## Task 9: Root Redirect & Final Wiring

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Set up root redirect**

Edit `app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/clients");
}
```

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { globals: true },
  resolve: { alias: { "@": path.resolve(__dirname) } },
});
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests in `lib/utils.test.ts`, `lib/metrics.test.ts`, `lib/sheets.test.ts` PASS.

- [ ] **Step 4: Verify full flow end-to-end**

1. `npm run dev`
2. Go to /login → enter email → click magic link
3. Go to /clients → Add Dream Crafter with Sheet ID
4. Dashboard loads with live data
5. Click "Generate Monthly Report" → see computed metrics

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete MVP — auth, client management, dashboard, report generation"
```

---

## Verification Checklist

- [ ] `npm run dev` starts without errors
- [ ] `npx vitest run` — all tests pass
- [ ] Login flow works (magic link)
- [ ] Client list shows clients
- [ ] Dashboard loads Dream Crafter data from Google Sheet
- [ ] Hero cards show correct Sales, ROAS, Orders, CPL
- [ ] Funnel flow displays 7 steps with icons
- [ ] MoM table has conditional formatting (green/yellow/red)
- [ ] KPI chart bars scale correctly, hover shows tooltip
- [ ] Generate Monthly Report returns computed data
- [ ] `npm run build` succeeds (production build)
