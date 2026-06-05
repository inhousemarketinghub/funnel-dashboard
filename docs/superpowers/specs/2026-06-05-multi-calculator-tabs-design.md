# Multi-Calculator Tabs — Design

**Date:** 2026-06-05
**Status:** Approved (chat), implementing in stages.

## Goal
Let the Settings page solve for different "unknowns" via calculator tabs, instead of
hand-rigging brand columns in the sheet. Same funnel equation, rearranged.

## Calculators
**Walk-in:**
- `cpl` (existing) — inputs: Sales, AOV, CPA, ConvRate, VisitRate → output **CPL**
- `visit_rate` — inputs: Sales, AOV, CPA, ConvRate, CPL → output **Visit Rate**
- `cpa` — inputs: Sales, AOV, ConvRate, VisitRate, CPL → output **CPA%**

**Appointment:**
- `cpl` (existing) — full rate set → output **CPL**
- `appt_rate` — same minus AppointmentRate, plus CPL → output **Appointment Rate**
- `cpa` — same minus CPA, plus CPL → output **CPA%**

## Core principle (formula-safe)
- The **app** owns the math. Each calculator solves the one unknown, producing a COMPLETE
  base-input set {Sales, AOV, CPA, ConvRate, rates}.
- `computeSettingsDerived` (Phase 1, tested, sheet-aligned, no intermediate rounding) then
  produces every derived value from that complete set.
- On **Save**: write ONLY the base-input cells to the sheet. **CPL is always a sheet FORMULA,
  never written by the app** → formulas stay intact, dashboard stays consistent.

## Key finding
The sheet's 3 brand columns are hand-rigged as different calculators and are NOT internally
consistent (e.g. Akemi CPA 4.63% does not reconcile with its CPL 14.58). So tests anchor to
**round-trip correctness** (forward → inverse recovers the input) plus the one consistent
sheet anchor (Couch Factory: cpl 14.5833 → Visit Rate 15%), not to hand-entered sheet values.

## UI
- Tab bar above KPI Targets, showing the 3 calculators for the client's funnel type.
- Active tab decides editable inputs vs the read-only solved output.
- The solved output gets a highlighted read-only "result"; the rest of Derived Values is shared.

## Build order
- **2A** App engine + tab UI, **walk-in** calculators. Verify with round-trip + sheet anchor tests.
- **2B** Add **appointment** calculators (math-derived; no sheet template exists).
- **2C** Back up the sheet → normalize Couch/Akemi columns to Carress's structure (base inputs as
  cells, CPL etc. as formulas) → wire Save & Sync to write base inputs.

## Decisions locked
- Every brand can use all calculators (requires 2C sheet normalization).
- Daily Ad Spend uses real days-in-month, NOT the sheet's /30 (Phase 1, choice B).
