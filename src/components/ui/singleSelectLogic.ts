// Pure, framework-free logic for the SingleSelect primitive. Mirrors
// multiSelectLogic.ts so the behavior (search filtering, highlight movement)
// can be unit-tested in a node environment — jsdom is broken on this baseline,
// so the sibling ui tests never mount. See singleSelectLogic.test.ts.

export interface SingleSelectOption {
  value: string
  label: string
  meta?: string
}

/**
 * Case-insensitive substring filter over an option's label (NOT meta). An
 * empty/blank query matches everything.
 */
export function filterOptions(
  options: SingleSelectOption[],
  query: string,
): SingleSelectOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return options
  return options.filter(o => o.label.toLowerCase().includes(q))
}

/**
 * Clamp/advance the keyboard-highlight index over a list of `length` rows.
 * Wraps at both ends. Returns 0 for an empty list so callers can stay valid.
 */
export function moveHighlight(
  current: number,
  delta: 1 | -1,
  length: number,
): number {
  if (length <= 0) return 0
  return (current + delta + length) % length
}
