# Altair Frontend Design System

**Status:** Foundations + primitives landed; page-by-page rollout in progress.

## Goal

Aesthetic upgrade of Altair's frontend — restraint, typographic discipline,
generous whitespace, spring-physics motion, and obsessive hover/focus/active
polish. Medium density. Pure presentation layer: no UX re-architecture, no
data-layer changes.

Inspiration:

- [impeccable.style](https://impeccable.style/) — restraint, typographic discipline, anti-slop
- [emilkowalski/skill](https://github.com/emilkowalski/skill) — spring motion, micro-interactions (Emil's libs: Sonner, Vaul)
- [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) — design dials for variance / motion / density

## Scope decisions

- **Scope:** full app redesign — every page — rolled out gradually
- **Problem framing:** aesthetic upgrade, not a UX overhaul or rearchitecture
- **Reference page:** `src/pages/Resourcing.tsx` — rebuilt end-to-end before others
- **Theme:** dark is the default; a light theme is scaffolded behind a dev-only toggle
- **Design-system level:** tokens + ~9 small primitives; no Tailwind / Radix / cva
- **Brand:** Altair's deep-forest palette is locked — `--brand-green` (#D6B25E accent),
  `--brand-green-dark` (#006C35), rust `--brand-red` (#B65540); severity ramp preserved.
  Every color is a CSS variable in `src/index.css`, so forks rebrand by overriding tokens.

---

## Section 1 — Foundations (`src/index.css`)

### Type stack

Body text stays on **Inter** until pages are redesigned. Primitives and redesigned
pages use **Geist Sans** (`@fontsource-variable/geist`, self-hosted — no CDN
dependency) and **Geist Mono** wherever numbers, dates, or hours appear.

```
--font-sans:    'Inter', 'Geist Variable', system-ui, -apple-system, sans-serif
--font-display: 'Geist Variable', 'Inter', system-ui, sans-serif
--font-mono:    'Geist Mono Variable', ui-monospace, 'SF Mono', Menlo, monospace
```

### Type scale

```
--text-xs: 11px   --text-sm: 12px   --text-base: 13px   --text-md: 14px
--text-lg: 16px   --text-xl: 20px   --text-2xl: 28px    --text-3xl: 40px
--text-display: 56px
```

Paired with `--leading-tight: 1.1`, `--leading-snug: 1.3`, `--leading-normal: 1.5`
and `--tracking-tight: -0.02em`, `--tracking-normal: 0`, `--tracking-wide: 0.08em`.

### Color additions

All existing tokens are kept. Added alongside (used opt-in by primitives and
redesigned pages):

```
--bg-elevated       one step above card, for hover
--border-soft       subtle default border for redesigned components
--border-strong     explicit alias for the heavy variant
--border-focus      focus ring color (= --brand-green)
--color-success / --fill-success
--accent-green-glow / --accent-red-glow   halos, focus rings, hover feedback
--brand-green-hover / --brand-red-hover   hover step for brand surfaces
--on-brand          text/icon color on a brand-colored surface
```

Light-theme equivalents live under `[data-theme="light"]`, visible only via the
dev toggle in `src/lib/theme.ts`:

```js
localStorage.setItem('altair-theme-toggle-enabled', '1'); location.reload()
window.__altairToggleTheme()
```

### Spacing, radius, motion

```
--space-1..8:  4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px
--radius-sm/md/lg/xl/pill: 4 / 6 / 8 / 12 / 9999 px
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
--duration-fast: 120ms   --duration-base: 200ms   --duration-slow: 360ms
```

Most motion is pure CSS using these tokens. The `motion` package is available
for the few cases CSS can't reach (drawers, list reorders, toast stacks).

### Focus system

```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  transition: outline-offset var(--duration-fast) var(--ease-out);
}
*:focus-visible:hover { outline-offset: 3px; }
```

The outline offset grows slightly on hover-while-focused.

---

## Section 2 — Primitives (`src/components/ui/`)

Plain React + CSS variables (`ui.css`). Import from `src/components/ui`.

| Component | Purpose | API sketch |
|---|---|---|
| `Card` | Replaces inline card-style blobs | `<Card variant="default\|elevated\|inset" padding="sm\|md\|lg" hoverable />` |
| `Section` | Page section with header + action slot | `<Section title description action />` |
| `Stat` | KPI tile — value in Geist Mono | `<Stat label value delta hint />` |
| `Button` | Replaces global `button` style | `<Button variant="primary\|secondary\|ghost\|danger" size="sm\|md" icon />` |
| `Field` + `Input` | Labeled inputs | `<Field label hint error><Input /></Field>` |
| `Badge` | Replaces ad-hoc colored pills | `<Badge tone="neutral\|info\|warning\|critical\|success" variant="solid\|soft" />` |
| `StatusDot` | Dot with spring-scaled hover halo | `<StatusDot color alwaysHalo ariaLabel />` |
| `DataTable` / `DataHeaderCell` | Replaces raw `<table>` | Sticky header, hover row, animated sort icon |

### Adopted libraries

| Lib | Why |
|---|---|
| `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` | Self-hosted Geist Sans + Mono |
| `motion` | Spring physics where CSS can't reach |
| `sonner` | Toasts |
| `vaul` | Side drawers |

### Explicitly NOT adopted

- Tailwind — violates the "no CSS frameworks" convention
- Radix UI — a11y polish but expands scope; revisit if a11y becomes a sharp requirement
- class-variance-authority — overkill for 9 primitives
- shadcn/ui — requires Tailwind

---

## Section 3 — Resourcing reference page

- **Heading:** "Resourcing" in Geist Sans 28px / 600 / tracking-tight, with a
  muted subtitle showing active filter count and consultant count.
- **Action row:** segmented view-mode toggle with a spring-physics sliding
  indicator, date range chip, primary `+ New Assignment` Button.
- **Toolbar:** the row of inline filters collapses into one calm bar where each
  active filter is a soft `Badge` with `×`; clicking the bar opens a `vaul`
  drawer with all filter controls grouped (Consultant / Project / Time / Skills / Other).
- **Timeline grid:** sticky header; month labels Geist Sans 11px uppercase
  tracked; week labels Geist Mono 12px; hovered week column gets a
  `--bg-elevated` wash (200ms); hovered row gets a brighter left-edge border.
- **Assignment bars:** keep current color semantics; `border-radius: 4px`;
  inner highlight `inset 0 1px 0 rgba(255,255,255,0.08)`; hover lifts 1px and
  fades in a plain tooltip.
- **StatusDots:** 8px dot, 16px halo at 18% opacity scaling 0 → 1 on row hover
  via `--ease-spring`.
- **Edit modal → drawer:** slides in from the right; form uses `Field` + `Input`;
  save shows an in-button spinner then a `sonner` toast.
- **Loading:** pulsing skeleton rows mirroring the grid. No spinner.
- **Unchanged:** RPC calls, optimistic updates, realtime subscriptions,
  drag-create flow, assignment math.

---

## Section 4 — Rollout

Feature branches off `main`, small PRs.

| Step | What changes |
|---|---|
| Foundations | Deps, tokens (additive, no renames), light-theme tokens, dev-only theme toggle. No visible page changes. |
| Primitives | `src/components/ui/*`. No existing files touched. |
| Resourcing (dark) | Refactor `Resourcing.tsx` to primitives + tokens. The big visual change. |
| Resourcing (light) | Same page in light theme; side-by-side compare; pick a default. |
| Roll-through | Remaining pages in batches of 3–4: Capacity → Projects → Consultants → Utilization → ProjectKanban → ProjectDetail → ConsultantDetail → Margin → Revenue → SkillsMatrix → Holidays → Permissions → Security → SyncLog → Historicals → Login → AccessDenied → archives. |

### Acceptance criteria per page

- Uses primitives where applicable
- No raw `style={{}}` for things primitives cover (Card, Button, Field, …)
- All hardcoded hex literals moved into tokens
- Every interactive element shows the focus ring
- No functional regression — smoke-test the page after redesign

### Risk & rollback

- Foundations are purely additive on tokens (renames nothing), so any later
  step can be reverted independently.
- The theme switcher stays behind the localStorage flag until rollout is
  complete, so users never see a half-redesigned app.
