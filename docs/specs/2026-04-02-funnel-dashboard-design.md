# Funnel Dashboard SaaS — Design Spec

**Date:** 2026-04-02
**Status:** Draft
**Author:** khoweijie + Claude

## Overview

A SaaS dashboard for marketing agencies managing appointment-based lead generation clients (renovation, property, consulting). Replaces the current workflow of Google Sheet + Python script + static HTML report with a web app that provides real-time dashboards and one-click report generation.

### Problem
- Data lives in Google Sheets, reports generated manually via Python scripts
- No real-time dashboard — agency must run scripts to see current performance
- Report generation is technical (requires CLI), not accessible to non-technical team members
- No multi-client management — each client requires separate script configuration

### Solution
Web app where agencies log in, switch between clients, see live dashboards, and generate Weekly/Monthly reports with one click. Google Sheets remain the data entry layer (sales teams already use them), the system reads data in real-time.

## Architecture

```
Next.js 14 (Vercel)
├── App Router (Server Components + Client Components)
├── Google Sheets API (read-only, CSV export endpoint)
├── TypeScript metrics engine (shared lib)
├── Report renderer (React → HTML → optional PDF)
└── Supabase (Auth + Config storage)
```

### Key Design Decisions
1. **Google Sheet = data layer** — System never writes to Sheet. Sales teams continue using familiar Sheets. System reads via CSV export endpoint.
2. **Supabase = config only** — No business data in DB. Only stores: user accounts, client configurations (Sheet ID, KPI targets, brand info), report history.
3. **TypeScript metrics engine** — Migrated from existing Python `gen_report_html.py`. Shared between Dashboard rendering and Report generation.
4. **Same components, two uses** — Dashboard pages use interactive React components. Report generation uses the same components rendered to static HTML.

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | Next.js 14 (App Router) | SSR, API routes, Vercel native |
| UI | shadcn/ui + Tailwind CSS | Warm Light theme via CSS variables |
| Charts | Recharts | React ecosystem, SSR compatible |
| Tables | TanStack Table | Sorting, filtering, conditional formatting |
| Auth | Supabase Auth | Magic link email, free tier |
| Database | Supabase PostgreSQL | Config storage, report history |
| Data Source | Google Sheets API (CSV export) | Zero migration, sales teams keep using Sheets |
| PDF | Puppeteer (Vercel Serverless) | HTML → PDF conversion |
| File Storage | Vercel Blob | Generated report HTML/PDF files |
| Deployment | Vercel | Zero-config, free tier sufficient for MVP |

## Database Schema (Supabase)

```sql
-- Agency accounts
agencies (
  id          uuid PK default gen_random_uuid(),
  email       text UNIQUE NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz default now()
)

-- Client brands managed by agency
clients (
  id          uuid PK default gen_random_uuid(),
  agency_id   uuid FK → agencies.id ON DELETE CASCADE,
  name        text NOT NULL,
  sheet_id    text NOT NULL,
  logo_url    text,
  funnel_type text default 'appointment', -- 'appointment' | 'walkin'
  created_at  timestamptz default now()
)

-- Monthly KPI targets (adjustable per month)
kpi_configs (
  id              uuid PK default gen_random_uuid(),
  client_id       uuid FK → clients.id ON DELETE CASCADE,
  month           date NOT NULL,
  sales           numeric default 300000,
  orders          integer default 6,
  aov             numeric default 50000,
  cpl             numeric default 26,
  respond_rate    numeric default 30,
  appt_rate       numeric default 33,
  showup_rate     numeric default 90,
  conv_rate       numeric default 25,
  ad_spend        numeric default 7500,
  daily_ad        numeric default 250,
  roas            numeric default 40,
  cpa_pct         numeric default 2.5,
  target_contact  integer default 80,
  target_appt     integer default 27,
  target_showup   integer default 24,
  UNIQUE(client_id, month)
)

-- Generated report history
reports (
  id          uuid PK default gen_random_uuid(),
  client_id   uuid FK → clients.id ON DELETE CASCADE,
  type        text NOT NULL,  -- 'weekly' | 'monthly'
  period      text NOT NULL,  -- 'March 2026' | 'W1 Mar 2026'
  html_url    text,
  pdf_url     text,
  created_at  timestamptz default now()
)
```

## Page Structure

| Route | Purpose | Auth |
|-------|---------|------|
| `/login` | Email magic link login | Public |
| `/clients` | Client list (cards with key metrics) | Agency |
| `/clients/new` | Add client (bind Sheet ID + KPI config) | Agency |
| `/[clientId]` | Dashboard home | Agency |
| `/[clientId]/funnel` | Funnel detail page | Agency |
| `/[clientId]/report/weekly` | Preview + generate Weekly Report | Agency |
| `/[clientId]/report/monthly` | Preview + generate Monthly Report | Agency |
| `/[clientId]/settings` | Client config (KPI, Sheet, Logo) | Agency |

## Dashboard Home (`/[clientId]`)

### Layout
```
┌──────────────────────────────────────────────────┐
│ Topbar: Client Switcher | Date Range | 🌙 Theme  │
├──────────────────────────────────────────────────┤
│ Hero Cards: Sales | ROAS | Orders | CPL           │
├──────────────────────────────────────────────────┤
│ Funnel Flow (icons per step, matching report)     │
├────────────────────────┬─────────────────────────┤
│ Conversion Rate Trends │ KPI Achievement Bars     │
│ (Recharts line chart)  │ (hover tooltip)          │
├────────────────────────┴─────────────────────────┤
│ MoM Comparison Table (conditional formatting)     │
├──────────────────────────────────────────────────┤
│ Quick Actions: [Weekly Report] [Monthly Report]   │
└──────────────────────────────────────────────────┘
```

### Interactive Features
- Client switcher dropdown in topbar
- Date range picker (auto-detects current month/week)
- Hero cards with number counter animation
- Funnel steps with icons ($ → 💬 → 👥 → 📅 → 📍 → ✅ → 💵)
- KPI bars with hover popup (Target / Actual / Achievement %)
- MoM table with green/yellow/red conditional formatting
- Dark mode toggle (persisted)

## Google Sheets Integration

### Data Fetching
```typescript
// lib/sheets.ts
const SHEETS_CSV_URL = (id: string, tab: string) =>
  `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`

async function fetchSheetCSV(sheetId: string, tabName: string): Promise<Row[]>
async function fetchPerformanceTracker(sheetId: string): Promise<DailyMetric[]>
async function fetchLeadSales(sheetId: string): Promise<Lead[]>
async function fetchKPIIndicator(sheetId: string): Promise<SheetKPI>
```

### Sheet Tab Structure (per client)
- **Performance Tracker** — Daily: Date, Ad Spend, Inquiry, Contact, Appointment, Show Up, Orders, Sales
- **Lead & Sales Tracker** — Per-lead: Name, Phone, Appointment Date/Time, Show Up status, Sales amount
- **KPI Indicator** — Monthly targets, brand info, cost calculations

### Caching Strategy
- Dashboard: SWR with 5-minute revalidation (stale-while-revalidate)
- Report generation: Always fetch fresh (no cache)

## Metrics Computation Engine

```typescript
// lib/metrics.ts — migrated from Python gen_report_html.py

interface FunnelMetrics {
  ad_spend: number; inquiry: number; contact: number;
  appointment: number; showup: number; est_showup: number;
  orders: number; sales: number;
  cpl: number; respond_rate: number; appt_rate: number;
  showup_rate: number; conv_rate: number; aov: number;
  roas: number; cpa_pct: number;
}

function computeMetrics(rows: DailyMetric[], estShowUp: number): FunnelMetrics
function computeWeeklyBreakdown(rows: DailyMetric[], weeks: DateRange[]): FunnelMetrics[]
function computeMoM(current: FunnelMetrics, previous: FunnelMetrics): Record<string, number | null>
function computeAchievement(metrics: FunnelMetrics, kpi: KPIConfig): Record<string, number>
function budgetScenario(spend: number, metrics: FunnelMetrics, kpi: KPIConfig, estSUNext: number): BudgetScenario
```

### Business Rules (carried from existing system)
1. Show Up Rate = Show Up ÷ Est. Show Up (from Appointment Date in Lead & Sales Tracker)
2. CPL is a ratio metric — compute per period, never average daily CPLs
3. Conv Rate can exceed 100% (orders from prior-period pipeline)
4. Budget projections use: (Est.ShowUp next month + new Appointments) × SUR × CR × AOV
5. Under-spending on ads = BAD (pipeline starved), not good
6. MoM for rate metrics: relative % change (not absolute pp change)

## Report Generation

### Flow
```
[Generate Report] button → Confirmation modal
  → API Route: POST /api/report/generate
    1. Read client config + KPI from Supabase
    2. Fetch fresh CSVs from Google Sheet
    3. computeMetrics() for all required periods
    4. renderToString(<MonthlyReport data={...} />)
    5. Inject self-contained CSS → complete HTML file
    6. (Optional) Puppeteer → PDF
    7. Upload to Vercel Blob Storage
    8. Insert record in reports table
    9. Return { htmlUrl, pdfUrl }
```

### Report Components (shared with Dashboard)
```
components/reports/
├── MonthlyReport.tsx
├── WeeklyReport.tsx
└── shared/
    ├── FunnelFlow.tsx
    ├── KPIAchievementChart.tsx
    ├── MoMTable.tsx
    ├── BudgetScenarios.tsx
    ├── InsightCard.tsx
    ├── RecommendationCard.tsx
    ├── Sidebar.tsx
    └── theme.css (Warm Light variables)
```

### Output Formats
- **HTML**: Self-contained single file (inline CSS, no external deps)
- **PDF**: A4 landscape, via Puppeteer
- **Share link**: Public URL for Brand Owner to view (no login required)

## Design System

### Warm Light Theme (carried from existing reports)
```css
:root {
  --primary: #7C6954;
  --accent: #B8860B;
  --bg: #F5F1EB;
  --bg-card: #FEFCF8;
  --txt: #2A2019;
  --green: #2D8A4E;
  --yellow: #B8860B;
  --red: #C53030;
}
```

### Dark Mode
```css
[data-theme="dark"] {
  --primary: #C9A96E;
  --accent: #D4A017;
  --bg: #141210;
  --bg-card: #1C1915;
  --txt: #E8DFD4;
}
```

### Typography
- Headings: Poppins (600/700)
- Body: Open Sans (400/500)
- Numbers/Code: JetBrains Mono (400/600)

## Phased Delivery

### Phase 1 — MVP (~2 weeks)
- Project scaffolding: Next.js 14 + Supabase + Tailwind + shadcn/ui
- Auth: Email magic link
- Client CRUD: Add/edit clients, bind Sheet ID, configure KPI
- Dashboard: Hero cards, Funnel flow, MoM table, KPI chart
- Monthly report generation (HTML output)

### Phase 2 — Polish (~1 week)
- Weekly report generation
- PDF export via Puppeteer
- Report history + download page
- Dark mode
- Date range selector

### Phase 3 — Growth (future)
- Brand Owner read-only share links
- Meta Ads API integration (auto-pull ad data)
- Scheduled auto-generation + Email/Telegram delivery
- Multi-brand comparison view
- Stripe subscription billing

## Verification Plan
1. Set up local dev with `npm run dev`
2. Create test client pointing to Dream Crafter Google Sheet
3. Verify Dashboard loads live data correctly
4. Generate monthly report → compare output with existing `monthly_report_mar2026.html`
5. Verify all metrics match existing Python-generated report
6. Test on mobile viewport
7. Deploy to Vercel, verify production build
