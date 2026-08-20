<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The Google Sheet is the data contract

Every number on the dashboard is parsed out of a client's Google Sheet by
**matching header text**, not by column position — client sheets have different
column counts and orderings. `lib/sheets.ts` holds all of it.

## Where each funnel figure comes from

| Dashboard figure | Tab | Column |
|---|---|---|
| Ad Spend, PM/Inquiry, Contact, Appointment, Order, Sales | Performance Tracker | daily rows, summed over the selected range |
| **Est. Show Up** | Performance Tracker | `Est.Show Up` |
| **Showed Up** | Performance Tracker | `Showed Up` |
| Per-person performance | Lead & Sales Tracker | the daily tracker has no per-person split |
| Next-month budget projection | Lead & Sales Tracker | a daily tracker has no future-dated rows |

Est. Show Up and Showed Up both come from the Performance Tracker **on purpose**,
and the two tabs are expected to disagree — **that is not missing data**. The
Performance Tracker can be scoped to a subset of the business: on Rygis it counts
**Paid Ads leads only** (Facebook / Instagram / WhatsApp), while the Lead & Sales
Tracker is the data-entry log for **every** lead including organic. Counting
appointment dates in the Lead tracker therefore inflated Est. Show Up with
non-paid leads — the funnel's numerator and denominator described different
populations. Never "reconcile" the two tabs 1:1 and never treat a Performance
Tracker gap as a data-entry omission without checking the lead's Source.

Note the features that still read the Lead & Sales Tracker do so **across all
sources** (no Source filter): per-person performance and the next-month budget
projection. For paid-ads-scoped clients like Rygis these figures include organic
leads — flag this to the user before building anything on top of them.

If a sheet lacks the `Est.Show Up` column the figure reports 0 — "not tracked" —
rather than silently substituting a differently-scoped number from another tab.

## Header matching is substring-based — watch for overlapping names

`findCol()` returns the **first** header containing a keyword. When one header
name contains another, the shorter pattern wins and the longer column is never
reached.

This shipped as a real bug: `Est.Show Up` sits immediately before `Showed Up` on
the Rygis and Dream Crafter sheets, and `"Est.Show Up"` contains the substring
`"show up"`. Scanning for `"show up"` stopped on the estimate, so the dashboard
reported estimates as actuals for months. It went unnoticed because sheets with
only one `Showed Up` column were unaffected. Fixed by matching the distinct
`"showed up"` wording first and excluding `"est"` (`detectPerfColumns`).

**Before adding any paired column** to a client sheet — `Est.X` / `Actual X`,
`New X` / `Repeat X`, `X` / `X Rate` — check `detectPerfColumns` and
`detectLeadColumns` can still tell them apart, and add a regression case to
`lib/sheets.test.ts` covering both the paired and unpaired sheet shapes.

## Client sheets are not uniform

| Client | Funnel | `Est.Show Up` column |
|---|---|---|
| Rygis Private Gym, Dream Crafter | appointment | yes |
| Carress@BD Recruitment, Good Brand | appointment | **no** → Est. Show Up and Show Up Rate read 0 |
| 2990's, Carres Signature, Carress@Kelana Jaya | walk-in | n/a — no appointment stage |

Funnel type is inferred from the headers, not configured: a Performance Tracker
with no `Appointment` column is treated as walk-in, where orders convert from
Contact/Visit directly (`detectFunnelTypeFromColumns`).

## Verifying a data bug

Sheet parsing can't be judged from the code alone — pull the real tab and
compare against what the client sees:

```bash
export $(grep '^GOOGLE_SHEETS_API_KEY=' .env.local | xargs)
curl -s "https://sheets.googleapis.com/v4/spreadsheets/$SHEET_ID?key=$GOOGLE_SHEETS_API_KEY&fields=sheets.properties" \
  | jq -r '.sheets[].properties.title'
curl -s "https://sheets.googleapis.com/v4/spreadsheets/$SHEET_ID/values/Performance%20Tracker?key=$GOOGLE_SHEETS_API_KEY&valueRenderOption=FORMATTED_VALUE" \
  | jq -r '.values[0:2] | to_entries[] | "R\(.key): " + (.value | to_entries | map(select(.value != "") | "[\(.key)]\(.value)") | join(" | "))'
```

Client `sheet_id`s live in the Supabase `clients` table. When the dashboard and
the sheet disagree, confirm which column the parser actually resolved to before
touching any formula — the arithmetic is usually fine and the column is wrong.
