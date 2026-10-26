// Pure, framework-free date logic for the DatePicker primitive. Extracted so the
// behavior (timezone-safe local YMD round-trip, month-grid construction) can be
// unit-tested in a node environment — jsdom is broken on this baseline, so the
// sibling ui tests never mount. See DatePicker.test.ts.
//
// CRITICAL — timezone safety. This codebase deliberately uses LOCAL date
// components for YYYY-MM-DD (see dateToStr in src/lib/resourcingUtils.ts):
// toISOString() converts to UTC, which shifts the date a day earlier for
// viewers east of UTC (SG, NZ). Every function here parses with a 'T00:00:00'
// local anchor and emits via getFullYear()/getMonth()/getDate() — NEVER
// toISOString().

/** Parse 'YYYY-MM-DD' as a LOCAL-midnight Date. The 'T00:00:00' suffix forces
 * local interpretation (a bare 'YYYY-MM-DD' would be parsed as UTC midnight).
 * Returns null for empty/blank/invalid input. */
export function parseLocalYMD(str: string): Date | null {
  if (!str || !str.trim()) return null
  const d = new Date(str + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

/** Serialize a LOCAL-time Date to 'YYYY-MM-DD' using local components — the
 * exact inverse of parseLocalYMD. Mirrors dateToStr in resourcingUtils.ts.
 * NEVER toISOString() (UTC shift). */
export function toLocalYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** One cell of a month grid. `inMonth` is false for the leading days carried in
 * from the previous month and the trailing days from the next month. */
export interface DayCell {
  /** Full local Date at midnight for this cell. */
  date: Date
  /** Day-of-month number (1–31). */
  day: number
  /** True when this cell belongs to the displayed month. */
  inMonth: boolean
}

/** Build the 6-row × 7-col (42-cell) calendar grid for the given displayed
 * month. `month` is 0-based (0 = January). The grid starts on Sunday: leading
 * cells come from the previous month, trailing cells from the next, both
 * flagged inMonth=false. Always returns exactly 42 cells so the popover height
 * is stable across months. */
export function buildMonthGrid(year: number, month: number): DayCell[] {
  const cells: DayCell[] = []
  const first = new Date(year, month, 1)
  // getDay(): 0 = Sunday. Number of leading cells from the previous month.
  const lead = first.getDay()
  // Start at the Sunday on/before the 1st, then walk 42 days forward. Using a
  // Date that increments by day handles month/year rollover correctly.
  const start = new Date(year, month, 1 - lead)
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({ date: d, day: d.getDate(), inMonth: d.getMonth() === month })
  }
  return cells
}

/** Format a Date as a compact label, e.g. "Jun 15, 2026". Used for the field
 * trigger text. */
export function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Whether two Dates fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export interface PopoverSide {
  flipUp: boolean
  /** Height cap when neither side fully fits (popover scrolls internally), else null. */
  maxHeight: number | null
}

/**
 * Which side of the trigger the calendar popover opens toward. Fits below →
 * below; fits only above → above; fits NEITHER → the larger side, capped to
 * that side's space so the popover scrolls internally — in a fixed dialog no
 * side is scroll-reachable, so clipping either edge would lose controls (the
 * month nav is at the top, the last weeks at the bottom). Ties go below.
 */
export function pickPopoverSide(spaceAbove: number, spaceBelow: number, popHeight: number): PopoverSide {
  if (spaceBelow >= popHeight) return { flipUp: false, maxHeight: null }
  if (spaceAbove >= popHeight) return { flipUp: true, maxHeight: null }
  const flipUp = spaceAbove > spaceBelow
  return { flipUp, maxHeight: Math.max(spaceAbove, spaceBelow) }
}

/**
 * Horizontal twin of pickPopoverSide: which edge of the trigger the calendar
 * popover aligns to. Preferred side fits → preferred; only the other fits →
 * the other; fits NEITHER → the side with more room, so the majority of the day
 * grid stays on-screen (a viewport narrower than the calendar clips one edge
 * either way). Ties, when neither side fits, go to `preferred`.
 *
 * An exact fit counts as fitting (>= not >): a popover whose last pixel column
 * lands on the viewport edge is still fully clickable, so flipping it would be
 * gratuitous motion.
 *
 * CAUTION — the two space arguments are named for the ALIGNMENT they serve, NOT
 * for a compass direction. A LEFT-aligned popover grows rightward, so its room
 * is `spaceRight` (viewportWidth - rect.left); a RIGHT-aligned popover grows
 * leftward, so its room is `spaceLeft` (rect.right).
 */
export function pickPopoverAlign(
  preferred: 'left' | 'right',
  spaceRight: number,
  spaceLeft: number,
  popWidth: number,
): 'left' | 'right' {
  const other = preferred === 'left' ? 'right' : 'left'
  const preferredSpace = preferred === 'left' ? spaceRight : spaceLeft
  const otherSpace = preferred === 'left' ? spaceLeft : spaceRight
  if (preferredSpace >= popWidth) return preferred
  if (otherSpace >= popWidth) return other
  return otherSpace > preferredSpace ? other : preferred
}
