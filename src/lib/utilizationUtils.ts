/* ------------------------------------------------------------------ */
/*  Utilization — pure utility functions                               */
/* ------------------------------------------------------------------ */

/** Heat-map color by utilization percentage */
export function utilColor(pct: number): string {
  if (pct >= 85) return '#28A36A'
  if (pct >= 70) return '#7CB342'
  if (pct >= 50) return '#F0C42B'
  if (pct >= 30) return '#F0642B'
  return '#E63948'
}

/** Cell background with opacity for future vs. past months */
export function cellBg(pct: number, isFuture: boolean): string {
  if (pct === 0) return 'transparent'
  const color = utilColor(pct)
  const opacity = isFuture ? '20' : '35'
  return `${color}${opacity}`
}

/** Cell text color based on utilization */
export function cellTextColor(pct: number): string {
  if (pct === 0) return 'var(--text-muted)'
  return utilColor(pct)
}

/** Legend items for the heat-map color scale */
export const UTIL_LEGEND_RANGES = [
  { pct: 85, label: '85%+' },
  { pct: 70, label: '70-84%' },
  { pct: 50, label: '50-69%' },
  { pct: 30, label: '30-49%' },
  { pct: 15, label: '<30%' },
] as const

/** Color for assignment type in drilldown */
export function assignmentTypeColor(type: string): string {
  if (type === 'billable') return 'var(--brand-green)'
  if (type === 'pto') return '#FD7E14'
  return '#7CB342'
}

/** Display label for assignment type in drilldown */
export function assignmentTypeLabel(type: string): string {
  if (type === 'billable') return 'Billable'
  if (type === 'pto') return 'PTO'
  return 'Non-Billable'
}
