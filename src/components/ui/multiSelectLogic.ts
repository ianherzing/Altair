// Pure, framework-free logic for the MultiSelect primitive. Extracted so the
// behavior (toggle → next array, search filtering, highlight movement) can be
// unit-tested in a node environment — jsdom is broken on this baseline, so the
// sibling ui tests never mount. See MultiSelect.test.ts.

export interface MultiSelectOption {
  value: string
  label: string
  color?: string
}

/**
 * Toggle a value in/out of the current selection, preserving the order of the
 * remaining selected values. Returns a NEW array (never mutates `value`).
 */
export function toggleValue(value: string[], next: string): string[] {
  return value.includes(next)
    ? value.filter(v => v !== next)
    : [...value, next]
}

/**
 * Case-insensitive substring filter over an option's label. An empty/blank
 * query matches everything.
 */
export function filterOptions(
  options: MultiSelectOption[],
  query: string,
): MultiSelectOption[] {
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

/**
 * Union of the current selection and every option value: existing `value`
 * entries first (in their order), then any option values not already present
 * (in option order). No duplicates. Returns a NEW array (never mutates
 * `value`). Pass a search-filtered option list to "select all" only the
 * currently visible rows.
 */
export function selectAllValues(
  value: string[],
  options: MultiSelectOption[],
): string[] {
  const present = new Set(value)
  const additions = options
    .map(o => o.value)
    .filter(v => !present.has(v))
  return [...value, ...additions]
}

/**
 * True iff `options` is non-empty AND every option value is already in `value`.
 * Extra entries in `value` beyond `options` don't affect the result.
 */
export function areAllSelected(
  value: string[],
  options: MultiSelectOption[],
): boolean {
  if (options.length === 0) return false
  const present = new Set(value)
  return options.every(o => present.has(o.value))
}
