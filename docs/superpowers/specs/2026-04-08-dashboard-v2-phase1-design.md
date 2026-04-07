# Funnel Dashboard v2 — Phase 1 Design Spec

> Management Foundation: Onboarding Wizard + Team Management + Multi-Client Overview

## Context

The funnel dashboard (deployed on Vercel) tracks sales funnel KPIs for appointment-based businesses. It pulls data from Google Sheets, computes metrics, and displays them in a responsive dashboard per client.

**Current pain points:**
1. Data not intuitive enough for clients to self-serve
2. Management efficiency low — manual client setup, permissions via DB
3. Missing features — no PDF export, no notifications, no historical trends

**Iteration strategy:** 3 phases, each deployed independently.
- **Phase 1 (this spec):** Management foundation — Onboarding, Team, Overview
- **Phase 2 (future):** Client experience — Dashboard data redesign + Historical trends
- **Phase 3 (future):** Output capabilities — PDF export + Notification system

## Phase 1 Scope

### 1. Multi-Client Overview Page

**Route:** `/clients` (replace existing simple card grid)

**Layout:**
- **Summary stats bar** (top): 4 metric cards in a row
  - Active Clients (count)
  - Need Attention (count, red background when > 0)
  - Total Ad Spend (sum across all clients for current month)
  - Total Sales (sum across all clients for current month)
- **KPI card grid** (main): One card per client, 2-column grid on desktop, 1-column on mobile

**Client KPI card contents:**
- Client name + logo (top-left)
- Overall achievement badge (top-right, colored: green ≥80%, yellow 60-79%, red <60%)
- 4 key metrics: Sales, CPL, ROAS, Conv% — each color-coded by achievement
- Sales achievement progress bar (bottom)
- Click → navigates to `/[clientId]` dashboard

**Data source:** For each client, fetch current month's performance data and KPI config, compute achievement. Cache with 5-minute TTL to avoid hitting Google Sheets API on every page load.

**Health status logic:**
- **Good** (green): Average achievement across Sales + CPL + ROAS + Conv% ≥ 80%
- **Watch** (yellow): Average achievement 60-79%
- **Alert** (red): Average achievement < 60%

### 2. Onboarding Wizard

**Route:** `/clients/new` (replace existing basic form)

**5-step wizard flow:**

#### Step 1: Basic Info
- Client name (required)
- Industry (optional, dropdown: Beauty, Education, Property, F&B, Health, Other)
- Logo upload (optional, drag-and-drop, max 2MB PNG/JPG, uploads to Supabase `logos` bucket)

#### Step 2: Connect Google Sheet
- Input: Google Sheet URL or ID (required)
- Action: Call existing `/api/scan-sheet` endpoint
- Display: Auto-detection results
  - Which tabs found (Performance Tracker, Lead & Sales Tracker, KPI Indicator)
  - Detected brands
  - Detected funnel type (Appointment vs Walk-in)
- Error state: If scan fails, show specific error (sheet not shared, tabs not found, etc.)

#### Step 3: Verify Data Mapping
- Display auto-detected column mappings from `detectPerfColumns()` and `detectLeadColumns()`
- Each mapping shown as: Field name → Detected column (with confidence indicator)
- User can confirm each mapping or override with a column selector dropdown
- Preview: Show first 5 rows of parsed data to verify correctness
- Fields requiring mapping:
  - Performance: Date, Ad Spend, Inquiry, Contact, Appointment*, Show Up*, Orders, Sales
  - Lead: Person, Appointment Date, Sales Person, Showed Up, Purchase Date, Sales, Brand
  - (* = only for Appointment funnel type)

#### Step 4: Set KPI Targets
- Pre-fill from industry template if industry was selected in Step 1
- "Import from template" dropdown for manual template selection
- 15 KPI fields organized in 4 groups:
  - Revenue: Monthly Sales, Orders, AOV
  - Ad Performance: Ad Spend, Daily Ad Budget, CPL, ROAS, CPA%
  - Funnel Rates: Respond Rate, Appointment Rate, Show Up Rate, Conversion Rate
  - Pipeline: Target Contact, Target Appointment, Target Show Up
- All fields editable with numeric input
- Month selector (defaults to current month)

#### Step 5: Invite Team
- Email input + role selector (Manager / Viewer)
- "+ Invite" button to add to list
- Show current invite list with status
- "Complete Onboarding" button to finalize

**Wizard behavior:**
- State persisted in React state (not URL) — refreshing returns to Step 1
- Back button on each step
- Steps 1-2 required to proceed; Steps 3-5 can be skipped (with defaults)
- On completion: Create client record → save KPI config → create project_access → send invitations → redirect to new client dashboard

### 3. Team Management Center

**Route:** `/settings/team` (new global page)

**Navigation change:**
- Top-level nav adds two global tabs: "Overview" (→ `/clients`) and "Team" (→ `/settings/team`)
- These tabs are visible on the overview and team pages
- When navigating into a specific client (`/[clientId]`), the nav switches to client-level navigation (existing behavior)

**Page layout:**

**Header:** "Team Members" title + description + "+ Invite Member" button

**Member list:** Card-based, one card per member, ordered by role (Owner → Manager → Viewer)

Each member card shows:
- Avatar circle (initials, colored by role: amber=Owner, blue=Manager, green=Viewer)
- Name + email
- Role dropdown (Manager/Viewer, not editable for Owner)
- "Remove" action (not available for Owner)
- Assigned client tags (colored badges)
- "+ Assign Client" action to add more clients

**Pending invitations:** Displayed below active members with dashed border styling
- Shows email + "Invite pending" status + sent time
- Actions: "Resend" and "Revoke"

**Invite dialog** (triggered by "+ Invite Member" button):
- Email input (required)
- Role selection: Card-based toggle (Manager vs Viewer), showing permission summary
- Client assignment: Checkbox list of all clients
- "Send Invite" button

**Invite flow:**
1. Owner fills email + role + clients
2. System creates `invitations` record with unique token (expires in 7 days)
3. Email sent via Supabase `inviteUserByEmail()` or custom email with invite link
4. Recipient clicks link → lands on `/login?invite=TOKEN`
5. Registers or logs in → token validated → `project_access` records created automatically
6. Invitation marked as accepted

## Data Model Changes

### Modified Tables

#### `agencies`
```sql
ALTER TABLE agencies ADD COLUMN plan TEXT DEFAULT 'free';
ALTER TABLE agencies ADD COLUMN max_members INTEGER DEFAULT 10;
```

#### `clients`
```sql
ALTER TABLE clients ADD COLUMN status TEXT DEFAULT 'active'
  CHECK (status IN ('onboarding', 'active', 'paused'));
ALTER TABLE clients ADD COLUMN onboarded_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN industry TEXT;
ALTER TABLE clients ADD COLUMN column_mapping JSONB;
```
- `status`: Tracks client lifecycle. Set to 'onboarding' during wizard, 'active' on completion
- `column_mapping`: Stores confirmed column mappings from Step 3 for reliable future data fetching

#### `project_access`
```sql
ALTER TABLE project_access ADD COLUMN role TEXT DEFAULT 'viewer'
  CHECK (role IN ('owner', 'manager', 'viewer'));
ALTER TABLE project_access ADD COLUMN invited_by UUID REFERENCES auth.users(id);
ALTER TABLE project_access ADD COLUMN invited_at TIMESTAMPTZ DEFAULT now();
```

### New Tables

#### `invitations`
```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager', 'viewer')),
  client_ids UUID[] NOT NULL,
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted BOOLEAN DEFAULT false,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `activity_log`
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  client_id UUID REFERENCES clients(id),
  action TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_activity_log_agency ON activity_log(agency_id, created_at DESC);
```
- Actions logged: `client.created`, `client.updated`, `member.invited`, `member.removed`, `kpi.updated`, `invitation.accepted`

### RLS Policies

All new tables use agency-scoped RLS:
- `invitations`: Owner can CRUD where `agency_id` matches
- `activity_log`: Owner and Manager can SELECT where `agency_id` matches; INSERT via service role only

## Role Permission Matrix

| Capability | Owner | Manager | Viewer |
|---|---|---|---|
| View Dashboard | ✅ | ✅ | ✅ |
| View Historical Trends (Phase 2) | ✅ | ✅ | ✅ |
| Download Reports (Phase 3) | ✅ | ✅ | ✅ |
| Edit KPI Settings | ✅ | ✅ | ❌ |
| Manage Team Members | ✅ | ❌ | ❌ |
| Create/Delete Clients | ✅ | ❌ | ❌ |
| Onboard New Clients | ✅ | ❌ | ❌ |
| View Activity Log | ✅ | ✅ | ❌ |
| Access Multi-Client Overview | ✅ | ✅ | ❌ |

Note: Viewers only see the clients they are assigned to. They land directly on the client dashboard if assigned to a single client, or see a simplified client selector if assigned to multiple.

## New File Structure

```
app/
├── clients/
│   ├── page.tsx              # REWRITE: Multi-client overview
│   └── new/
│       └── page.tsx          # REWRITE: Onboarding wizard
├── settings/
│   └── team/
│       └── page.tsx          # NEW: Team management
├── api/
│   ├── scan-sheet/route.ts   # EXISTING (no change)
│   ├── invitations/
│   │   ├── route.ts          # NEW: POST create, GET list
│   │   └── [token]/
│   │       └── route.ts      # NEW: POST accept invitation
│   └── team/
│       └── route.ts          # NEW: GET members, PATCH role, DELETE member
components/
├── dashboard/                # EXISTING (no change in Phase 1)
├── onboarding/
│   ├── wizard-shell.tsx      # NEW: Step container + progress bar
│   ├── step-basic-info.tsx   # NEW
│   ├── step-connect-sheet.tsx# NEW
│   ├── step-verify-mapping.tsx# NEW
│   ├── step-set-kpi.tsx      # NEW
│   └── step-invite-team.tsx  # NEW
├── overview/
│   ├── stats-bar.tsx         # NEW: Summary statistics bar
│   └── client-kpi-card.tsx   # NEW: Individual client card
└── team/
    ├── member-card.tsx       # NEW
    ├── invite-dialog.tsx     # NEW
    └── client-assign.tsx     # NEW
lib/
├── permissions.ts            # NEW: Role checking utilities
└── invitations.ts            # NEW: Token generation + validation
```

## Design System Compliance

All new components follow the existing DESIGN.md guidelines:
- **Colors:** Stone palette + Amber accent. Status colors: green/yellow/red as defined
- **Typography:** Geist (headings), DM Sans (labels), Noto Sans SC (body), Geist Mono (numbers)
- **Cards:** 1px stone-300/50 border, hover amber-500/30 + shadow lift
- **Buttons:** Primary amber-600, secondary ghost, 8px border-radius
- **Motion:** Spring physics transitions, staggered reveals (40ms cascade)
- **Responsive:** Mobile-first, single column < 768px, touch targets 44px minimum
- **Anti-patterns respected:** No emoji in UI chrome, no 3-column equal grids, no pure black

## Phase 2 & 3 Preview (Not in Scope)

### Phase 2: Client Experience
- Dashboard layout redesign for data intuitiveness
- Historical trends page (`/[clientId]/trends`) with cross-month line charts
- Improved funnel visualization with conversion drop-off highlights

### Phase 3: Output Capabilities
- PDF report generation with branded template
- Notification system (Telegram/Email) for KPI anomalies
- Scheduled report delivery

## Testing Strategy

- Unit tests for new lib functions (permissions.ts, invitations.ts)
- Integration tests for API routes (invitation CRUD, team management)
- E2E test for onboarding wizard flow (happy path)
- Existing 17 tests must continue passing
