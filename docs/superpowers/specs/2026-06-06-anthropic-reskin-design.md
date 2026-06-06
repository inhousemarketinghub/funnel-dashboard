# Anthropic Reskin — Design Spec

**Date:** 2026-06-06 · **Status:** Proposal (awaiting approval)
**Principle:** RESKIN, not redesign. Only the visual layer changes (color tokens, fonts,
the Bauhaus stripe). Layout, structure, markup, and all logic stay 100% untouched →
functionality unaffected. Verified by: existing tests pass + before/after screenshots + run app.

## Why it's low-risk
The theme is fully centralized in `app/globals.css` `:root` (≈15 color tokens, radius, shadows)
plus 3 fonts in `app/layout.tsx`. Re-mapping those values reskins the whole app. The only extra
work: ~50 hard-coded hex in components (concentrated — `#153D7A`/`#1B4F9B` blue button ×~13) get
replaced with `var(--blue)` so they follow the theme.

## Color mapping (light theme) — current → Anthropic
| Token | Now | Anthropic | Meaning |
|---|---|---|---|
| `--bg` | #FFFFFF | **#FAF9F5** | warm ivory page |
| `--bg2` | #FFFFFF | **#FFFFFF** | white cards (float on ivory) |
| `--bg3` | #F5F5F5 | **#F0EEE6** | ivory-medium (hover/muted) |
| `--sand` | #F2EDDF | **#EAE4D6** | kraft (progress tracks) |
| `--border` | #EAEAEA | **#E7E1D5** | warm hairline |
| `--border-hover` | #C8C4BA | **#D8D0BF** | |
| `--t1` | #111111 | **#20201D** | warm ink (not pure black) |
| `--t2` | #555555 | **#46443E** | |
| `--t3` | #999999 | **#78736B** | muted warm gray |
| `--t4` | #BBBBBB | **#A8A299** | |
| `--blue` (primary/accent) | #1B4F9B | **#C15F3C** | Anthropic clay — primary buttons, links, ring |
| `--blue-bg` | #E3EDF8 | **#F4E7DF** | light clay tint |
| `--red` (Poor) | #D42B2B | **#A23A2C** | deeper brick-crimson, distinct from clay |
| `--red-bg` | #FDE8E8 | **#F3E1DC** | |
| `--yellow` (Warning) | #D4960A | **#B8862F** | warm ochre |
| `--yellow-bg` | #FDF3D7 | **#F3E9D4** | |
| `--green` (Excellent) | #16A34A | **#5E7A4F** | muted sage |
| `--green-bg` | #DCFCE7 | **#E8EDE0** | |

Dark theme: re-map analogously (ivory→deep warm charcoal, clay stays clay). Detailed in implementation.

## Fonts (in `app/layout.tsx`)
| Role | Now | Anthropic |
|---|---|---|
| Heading | Cormorant Garamond | **Fraunces** (warm editorial serif) |
| Body | Noto Sans SC | **Inter** (+ Noto SC fallback for any CJK) |
| Label | DM Sans | Inter / DM Sans (keep) |

## Bauhaus stripe
The 4-colour red/blue/yellow/black stripe is the least "Anthropic" element. Proposal: re-tone to a
warm earth set (clay / ink / ochre / kraft). Alternative the user may prefer: a single thin clay line.

## Semantic-colour rule (keeps functionality)
Poor/Warning/Excellent **keep their meaning** — only warmed. Decorative Bauhaus multicolour →
Anthropic ivory+clay. Watch: clay accent vs Poor-red must stay visually distinct (verify in preview).

## Implementation scope (after approval)
1. `app/globals.css` — re-map the `:root` and `.dark` token values above; re-tone `.bauhaus-stripe`.
2. `app/layout.tsx` — swap the 3 next/font imports.
3. Replace ~50 hard-coded hex in components with the matching `var(--…)` (mostly the blue button).
4. Verify: `npx tsc --noEmit`, `npx vitest run`, `npx next build`, run app + before/after screenshots.

Preview specimen: `anthropic-preview.html` (open in a browser to compare before/after).
