import type { ProjectType, RevenueStatus, Holiday } from '../types/database'
import type { AssignmentWithDetails } from '../types/resourcing'

// Resourcing bar palette.
const BAR_BLUE = '#2aa7d8'
const BAR_GREEN = '#2fd27a'
const BAR_TEAL = '#0f9f8a'
const BAR_GOLD = '#d6b25e'
const BAR_CORAL = '#d98f45'
const BAR_MUTED = '#b9cdbf'

export function getBarColor(projectType: ProjectType, status: RevenueStatus): string {
  if (projectType === 'pto') return BAR_GOLD
  if (projectType === 'non_billable') return BAR_BLUE
  if (status === 'to_do' || status === 'soft_unconfirmed' || status === 'soft_at_risk') return BAR_GREEN
  return BAR_GREEN
}

export function getBarBackground(projectType: ProjectType, status: RevenueStatus): string {
  const base = getBarColor(projectType, status)
  if (projectType === 'billable' && (status === 'to_do' || status === 'soft_unconfirmed' || status === 'soft_at_risk')) {
    return `repeating-linear-gradient(-45deg, ${base} 0px, ${base} 4px, transparent 4px, transparent 8px), ${base}88`
  }
  return base
}

export function getBarTextColor(_projectType: ProjectType, _status: RevenueStatus): string {
  return '#fff'
}

export const SOFT_STRIPE_BG = `repeating-linear-gradient(-45deg, ${BAR_GREEN} 0px, ${BAR_GREEN} 4px, transparent 4px, transparent 8px), ${BAR_GREEN}88`

export const HOLIDAY_BG = 'repeating-linear-gradient(45deg, rgba(180,180,180,0.10) 0px, rgba(180,180,180,0.10) 4px, rgba(200,200,200,0.38) 4px, rgba(200,200,200,0.38) 8px)'

export const TYPE_LEGEND = [
  { label: 'Billable — Soft / At Risk', color: BAR_GREEN, background: SOFT_STRIPE_BG },
  { label: 'Billable — Hard / Active / Done', color: BAR_GREEN },
  { label: 'Non-Billable', color: BAR_BLUE },
  { label: 'PTO', color: BAR_GOLD },
  { label: 'Holiday', color: '#888', background: HOLIDAY_BG },
]

export const STATUS_DOT_COLORS: Record<string, string> = {
  to_do: BAR_MUTED,
  soft_unconfirmed: BAR_GREEN,
  soft_at_risk: BAR_CORAL,
  hard_scheduled: BAR_BLUE,
  active: BAR_TEAL,
  done: BAR_GOLD,
}

export const EMPTY_ASSIGN_FORM = { project_id: '', start_date: '', end_date: '', total_hours: '' }
export const EMPTY_CONSULTANT_ASSIGN_FORM = { consultant_id: '', start_date: '', end_date: '', total_hours: '' }

export function getWeeks(startDate: Date, count: number): Date[] {
  const weeks: Date[] = []
  const d = new Date(startDate)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  for (let i = 0; i < count; i++) {
    weeks.push(new Date(d))
    d.setDate(d.getDate() + 7)
  }
  return weeks
}

export function formatWeek(d: Date): string {
  const fri = new Date(d)
  fri.setDate(fri.getDate() + 4)
  const mon = d.getMonth() + 1
  const monDay = d.getDate()
  if (d.getMonth() === fri.getMonth()) {
    return `${mon}/${monDay}\u2009\u2013\u2009${fri.getDate()}`
  }
  return `${mon}/${monDay}\u2009\u2013\u2009${fri.getMonth() + 1}/${fri.getDate()}`
}

export function getMonthHeaders(weeks: Date[]): { label: string; span: number }[] {
  const headers: { label: string; span: number }[] = []
  let current = ''
  for (const w of weeks) {
    const label = w.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (label === current) {
      headers[headers.length - 1].span++
    } else {
      headers.push({ label, span: 1 })
      current = label
    }
  }
  return headers
}

/** Count business days (Mon-Fri) from start up to but NOT including end */
export function bizDaysBetween(start: Date, end: Date): number {
  if (end <= start) return 0
  let count = 0
  const d = new Date(start)
  while (d < end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** Advance a date by N business days (positive or negative) */
export function advanceByBizDays(date: Date, bizDays: number): Date {
  const d = new Date(date)
  const dir = bizDays >= 0 ? 1 : -1
  let remaining = Math.abs(bizDays)
  while (remaining > 0) {
    d.setDate(d.getDate() + dir)
    if (d.getDay() !== 0 && d.getDay() !== 6) remaining--
  }
  return d
}

export function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Format the inline label for an assignment bar: "NN% (Xh)".
 * Percentage = total_hours / ((bizdays - holidays) * 8). A 40h assignment over
 * one holiday-free week reads 100%; a 32h assignment over a week containing one
 * holiday also reads 100% (4 workable days × 8h). When holidayMap/country are
 * omitted, holidays are not deducted — callers outside the resourcing flow may
 * lack this context. */
export function assignmentBarLabel(
  totalHours: number,
  startDate: string,
  endDate: string,
  holidayMap?: Map<string, string>,
  country?: string | null,
): string {
  const hours = Number(totalHours) || 0
  const bdays = calcBusinessDays(startDate, endDate)
  const hols = holidayMap && country ? countHolidaysInRange(holidayMap, country, startDate, endDate) : 0
  const workableDays = Math.max(0, bdays - hols)
  if (workableDays === 0) return `${hours}h`
  const pct = Math.round((hours / (workableDays * 8)) * 100)
  return `${pct}% (${hours}h)`
}

export function calcBusinessDays(startStr: string, endStr: string): number {
  const s = new Date(startStr + 'T00:00:00')
  const e = new Date(endStr + 'T00:00:00')
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0
  let count = 0
  const d = new Date(s)
  while (d <= e) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** Build a lookup map: "country:YYYY-MM-DD" → holiday name for O(1) checks */
export function buildHolidayMap(holidays: Holiday[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const h of holidays) {
    map.set(`${h.country}:${h.date}`, h.name)
  }
  return map
}

// toISOString converts to UTC, which shifts dates for users east of UTC (SG, NZ).
// Use local-date components so holiday lookups match DB YYYY-MM-DD regardless of viewer TZ.
function toLocalYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Count holidays falling on weekdays in a given week (Mon-Fri) for a country */
export function countHolidaysInWeek(holidayMap: Map<string, string>, country: string | null, weekMon: Date): number {
  if (!country || holidayMap.size === 0) return 0
  let count = 0
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekMon)
    d.setDate(d.getDate() + i)
    const ds = toLocalYmd(d)
    if (holidayMap.has(`${country}:${ds}`)) count++
  }
  return count
}

/** Get individual holiday day positions within a week for a country */
export function getHolidayDaysInWeek(holidayMap: Map<string, string>, country: string | null, weekMon: Date): { dayIndex: number; name: string }[] {
  if (!country || holidayMap.size === 0) return []
  const result: { dayIndex: number; name: string }[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekMon)
    d.setDate(d.getDate() + i)
    const ds = toLocalYmd(d)
    const key = `${country}:${ds}`
    const name = holidayMap.get(key)
    if (name) result.push({ dayIndex: i, name })
  }
  return result
}

/** Count holidays falling on weekdays in a date range (inclusive) for a country */
export function countHolidaysInRange(holidayMap: Map<string, string>, country: string | null, startStr: string, endStr: string): number {
  if (!country || holidayMap.size === 0) return 0
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  let count = 0
  const d = new Date(start)
  while (d <= end) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      const ds = d.toISOString().slice(0, 10)
      if (holidayMap.has(`${country}:${ds}`)) count++
    }
    d.setDate(d.getDate() + 1)
  }
  return count
}

/** Calculate hours per week for an consultant's assignments across visible weeks.
 *  Weeks before hireDate return -1 (pre-hire, not available). */
export function calcWeeklyHours(
  assignments: AssignmentWithDetails[],
  weeks: Date[],
  holidayMap: Map<string, string>,
  consultantCountry: string | null,
  hireDate?: string | null,
): number[] {
  const hoursPerWeek = new Array(weeks.length).fill(0)
  const hireDt = hireDate ? new Date(hireDate + 'T00:00:00') : null

  // Mark pre-hire weeks as -1
  if (hireDt) {
    for (let wi = 0; wi < weeks.length; wi++) {
      const weekFri = new Date(weeks[wi])
      weekFri.setDate(weekFri.getDate() + 4)
      if (weekFri < hireDt) hoursPerWeek[wi] = -1
    }
  }

  for (const a of assignments) {
    const aStart = new Date(a.start_date + 'T00:00:00')
    const aEnd = new Date(a.end_date + 'T00:00:00')
    const totalBizDays = calcBusinessDays(a.start_date, a.end_date)
    const totalHolidays = countHolidaysInRange(holidayMap, consultantCountry, a.start_date, a.end_date)
    const netWorkDays = totalBizDays - totalHolidays
    if (netWorkDays === 0) continue
    const hoursPerDay = Number(a.total_hours) / netWorkDays

    for (let wi = 0; wi < weeks.length; wi++) {
      if (hoursPerWeek[wi] === -1) continue // pre-hire week
      const weekMon = weeks[wi]
      const weekFri = new Date(weekMon)
      weekFri.setDate(weekFri.getDate() + 4)

      // Count overlap business days between assignment and this week
      const overlapStart = aStart > weekMon ? aStart : weekMon
      const overlapEnd = aEnd < weekFri ? aEnd : weekFri
      if (overlapStart > overlapEnd) continue

      const overlapStr = dateToStr(overlapStart)
      const overlapEndStr = dateToStr(overlapEnd)
      const overlapDays = calcBusinessDays(overlapStr, overlapEndStr)
      const overlapHolidays = countHolidaysInRange(holidayMap, consultantCountry, overlapStr, overlapEndStr)
      hoursPerWeek[wi] += hoursPerDay * (overlapDays - overlapHolidays)
    }
  }
  return hoursPerWeek
}
