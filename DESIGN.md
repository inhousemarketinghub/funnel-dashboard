# Design System: Funnel Dashboard

## 1. Visual Theme & Atmosphere

A restrained, data-confident interface with clean asymmetric layouts and purposeful spring-physics motion. The atmosphere is precise yet approachable — like a well-organized analyst's desk in a minimalist studio. Content density balanced at 6/10 to accommodate dense funnel data without feeling cluttered. Variance at 7 for offset asymmetry. Motion at 5 — fluid but not distracting for a data tool.

- **Density:** 6 — Daily App Balanced (data-rich but breathable)
- **Variance:** 7 — Offset Asymmetric (no boring symmetric grids)
- **Motion:** 5 — Fluid CSS (spring transitions, staggered reveals, no cinema)

## 2. Color Palette & Roles

- **Canvas** (#FAFAF9) — Primary background, warm neutral stone-50
- **Surface** (#FFFFFF) — Card and container fills
- **Deep Ink** (#1C1917) — Primary text, stone-900 depth
- **Muted Stone** (#78716C) — Secondary text, descriptions, metadata
- **Whisper Border** (rgba(214, 211, 209, 0.5)) — Card borders, 1px structural lines, stone-300 base
- **Warm Amber** (#D97706) — Single accent for CTAs, active states, focus rings, amber-600
- **Signal Green** (#16A34A) — Positive metrics, KPI achieved, green-600
- **Signal Amber** (#CA8A04) — Warning metrics, close to target, yellow-600
- **Signal Red** (#DC2626) — Negative metrics, missed KPI, red-600

**Banned:** Purple/blue neon, oversaturated gradients, pure black (#000000).

### Dark Mode
- **Canvas Dark** (#0C0A09) — stone-950
- **Surface Dark** (#1C1917) — stone-900
- **Text Dark** (#E7E5E4) — stone-200
- **Muted Dark** (#A8A29E) — stone-400
- **Border Dark** (rgba(68, 64, 60, 0.5)) — stone-700 base

## 3. Typography Rules

- **Display:** `Geist` (variable) — Track-tight (-0.025em), controlled scale. Headlines through weight (600-700) and size, never screaming
- **Body:** `Geist` (variable) — Relaxed leading (1.6), max 65ch per line, stone-500 for secondary
- **Mono:** `Geist Mono` (variable) — All numbers, metrics, percentages, currency values. Tabular nums enabled
- **Scale:** Display 30/28/24/20, Body 15/14/13, Mono 13/12/11
- **Banned:** Inter, Open Sans, generic system fonts. Serif fonts banned (this is a dashboard)

## 4. Component Stylings

### Buttons
- Primary: Amber-600 fill, white text. 1px translate-y on active (tactile push). No outer glow
- Secondary: Ghost — transparent bg, stone-700 text, stone-200 border. Hover: stone-100 bg
- Destructive: Red-600 fill, white text. Same tactile push
- Border-radius: 8px (rounded-lg). Never pill-shaped for primary actions

### Cards (Metric Cards)
- Elevation only when communicating hierarchy. Tint shadows to stone hue
- Border: 1px stone-300/50. Hover: border-amber-500/30 + subtle shadow lift
- For dense metric grids: replace cards with border-top dividers + negative space
- No overlapping content within cards

### Data Tables
- Header: stone-100 bg, uppercase 10px tracking-wider mono labels
- Rows: Alternating subtle tint (stone-50/white). Hover: amber-50/30
- Conditional formatting: inline colored text (green/amber/red), not full cell backgrounds
- Sort indicators: subtle arrow icons, not colored headers

### Inputs
- Label above, stone-500 text. Input: stone-200 border, white bg. Focus: amber-500 ring (2px)
- Error: red-500 text below, red-500 border
- Select/Dropdown: Clean popover, no heavy shadows

### KPI Achievement Bars
- Track: stone-100 bg, 8px rounded. Fill: colored by status (green/amber/red)
- Hover: tooltip with Target / Actual / Achievement % in a clean card
- Target line: 2px red dashed vertical line at 100% mark

### Funnel Flow
- Horizontal step flow with icon per stage (emoji or Lucide icons)
- Chevron arrows between steps in stone-300
- Hover: step scales 1.02 + amber icon tint
- Mobile: wrap to 2-column grid

### Loading States
- Skeleton loaders matching layout dimensions. Stone-200 pulse animation
- No circular spinners

### Empty States
- Illustration-free. Clear text: "No clients yet. Add your first client to get started."
- Single CTA button

## 5. Layout Principles

- **Max width:** 1200px centered container for main content
- **Sidebar:** 240px fixed left nav on desktop. Collapse to mobile sheet on < 768px
- **Grid:** CSS Grid for dashboard modules. 2-column asymmetric default (60/40 or 55/45)
- **Spacing scale:** 4/8/12/16/24/32/48/64px. Section gaps: clamp(2rem, 6vw, 4rem)
- **No overlapping** — every element occupies its own clear spatial zone
- **No 3-column equal card rows** — use 2-column asymmetric or 4-column stat grid
- Full-height sections: `min-h-[100dvh]`

## 6. Responsive Rules

- **Mobile-First Collapse (< 768px):** All multi-column → single column
- **No horizontal scroll** on mobile (critical failure)
- **Typography:** Headlines scale via `clamp()`. Body min `14px`
- **Touch targets:** All interactive elements min `44px` tap target
- **Navigation:** Left sidebar → bottom sheet or hamburger on mobile
- **Metric cards:** 2-column on mobile (hero cards), 1-column for detail cards
- **Funnel flow:** Wraps to compact 2-column grid on mobile

## 7. Motion Philosophy

- **Spring physics default:** `cubic-bezier(0.32, 0.72, 0, 1)` — premium, weighty. No linear easing
- **Staggered orchestration:** Dashboard modules mount with 40ms cascade delay
- **Hover transitions:** 200ms for color/border, 300ms for transforms
- **Page transitions:** Fade + slide-up 350ms on page/tab switch
- **Number counters:** Ease-out cubic animation on hero card values (800ms)
- **Performance:** Animate only `transform` and `opacity`. Never `top/left/width/height`
- **Reduced motion:** Respect `prefers-reduced-motion` — collapse to instant transitions

## 8. Anti-Patterns (NEVER DO)

- No emojis in UI chrome (emojis OK in funnel step icons only as they're data labels)
- No `Inter` or `Open Sans` font
- No pure black (`#000000`) — use stone-900 (#1C1917)
- No neon/outer glow shadows
- No oversaturated accents beyond amber-600
- No gradient text on headers
- No custom mouse cursors
- No overlapping elements
- No 3-column equal card layouts
- No "Scroll to explore" or bouncing chevrons
- No fabricated metrics — all numbers come from real Google Sheet data
- No AI copywriting cliches ("Elevate", "Seamless", "Unleash")
- No generic serif fonts
- No circular loading spinners — use skeleton loaders
- No centered hero layouts for dashboard pages
