/**
 * Months whose revenue is sourced from a legacy system of record (the
 * `historical_revenue` table) instead of being computed from assignments.
 * Single source of truth for every surface that overlays legacy revenue
 * (Revenue page, CSV export) — add or roll off months here only.
 *
 * The demo seed ships locked historical revenue for Jan–Mar 2026.
 */
export const LEGACY_MONTHS: ReadonlySet<string> = new Set([
  '2026-01',
  '2026-02',
  '2026-03',
])

/** Long English month name -> 1-based month number. */
export const MONTH_NAME_TO_NUM: Readonly<Record<string, number>> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
}

/**
 * Map each legacy month key (`YYYY-MM`) to the long-form English month name as
 * stored in `historical_revenue.month`. Used by the hook for the overlay path.
 */
export const HIST_MONTH_NAME_BY_KEY: Readonly<Record<string, string>> = Object.fromEntries(
  [...LEGACY_MONTHS].map(k => {
    const monthNum = Number(k.split('-')[1])
    const name = Object.entries(MONTH_NAME_TO_NUM).find(([, n]) => n === monthNum)?.[0]
    if (!name) throw new Error(`Invalid legacy month key: ${k}`)
    return [k, name]
  })
)
