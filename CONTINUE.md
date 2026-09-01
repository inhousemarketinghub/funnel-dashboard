# Continue here

Start with **AGENTS.md** (the sheet data contract + hard-won gotchas), then
the C-tier PRD at `docs/prd/2026-08-23-c-tier-data-foundation.md`. The repo is
the source of truth for code; project history lives in the owner's Claude
memory.

## State (2026-09-01)

- **Phase 1 — sheets → Supabase mirror — DONE.** Daily cron 08:30 MYT;
  dispatcher/worker fan-out (own 60s budget per client, Hobby ceiling);
  stale-run janitor; audit trail in `data_changes`.
- **Phase 2 — dual-path reads — DONE.** `lib/data-source.ts` branches on
  `clients.profile.data_source` (`"sheets"` default | `"db"`); admin-only
  `?ds=db` test switch; refresh button triggers a mirror sync for db clients;
  staleness-triggered background sync (>60 min); all today/month boundaries
  pinned to Asia/Kuala_Lumpur; reconciliation tool
  (`npx tsx scripts/reconcile.mts`) — **zero-diff verified 2026-09-01 across
  Rygis + 2990's + Kelana Jaya × Jun/Jul/Aug (1,907 comparisons)**.
- **Phase 3 — next.** Flip Rygis to `"db"`, 1-week soak, then per-client
  rollout with owner sign-off; audit surfacing + diagnostics sync-status card.
  **HARD GATE before any flip: rotate the Supabase service-role key.**

## Login / secrets

Credentials and keys live in the owner's password manager and Vercel env —
never in this repo.
