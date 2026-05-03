import type { Holiday } from '../types/database'

export const HOURS_PER_DAY = 8

export function getWorkingDaysInMonth(year: number, month: number): number {
  let count = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

export function getHolidaysInMonth(holidays: Holiday[], country: string | null, year: number, month: number): number {
  if (!country) return 0
  return holidays.filter(h => {
    if (h.country !== country) return false
    const d = new Date(h.date + 'T00:00:00')
    if (d.getFullYear() !== year || d.getMonth() !== month) return false
    const day = d.getDay()
    return day !== 0 && day !== 6
  }).length
}

export interface AssignmentForDistribution {
  start_date: string
  end_date: string
  total_hours: number
}

function countWeekdays(start: Date, end: Date): number {
  let count = 0
  const cursor = new Date(start)
  while (cursor <= end) {
    const day = cursor.getDay()
    if (day !== 0 && day !== 6) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function distributeHoursToMonth(a: AssignmentForDistribution, year: number, month: number): number {
  const aStart = new Date(a.start_date + 'T00:00:00')
  const aEnd = new Date(a.end_date + 'T00:00:00')
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)

  const overlapStart = aStart > monthStart ? aStart : monthStart
  const overlapEnd = aEnd < monthEnd ? aEnd : monthEnd

  if (overlapStart > overlapEnd) return 0

  const totalWorkingDays = Math.max(countWeekdays(aStart, aEnd), 1)
  const overlapWorkingDays = countWeekdays(overlapStart, overlapEnd)

  return Math.round((a.total_hours * overlapWorkingDays / totalWorkingDays) * 100) / 100
}

export function formatMonth(key: string): string {
  const d = new Date(key + '-01T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function formatMonthShort(key: string): string {
  const d = new Date(key + '-01T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short' })
}
