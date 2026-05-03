// @vitest-environment node
// Pure logic tests — opt out of jsdom to dodge an undici module-resolution bug
// in the repo's jsdom setup that blocks the worker for this file.
import { describe, it, expect } from 'vitest'
import { assignmentBarLabel, buildHolidayMap, countHolidaysInWeek, getHolidayDaysInWeek } from './resourcingUtils'
import type { Holiday } from '../types/database'

const sgHolidays: Holiday[] = [
  { id: '1', country: 'SG', date: '2026-05-01', name: 'Labour Day' },
  { id: '2', country: 'SG', date: '2026-05-27', name: 'Hari Raya Haji' },
  { id: '3', country: 'SG', date: '2026-12-25', name: 'Christmas Day' },
] as Holiday[]

const holidayMap = buildHolidayMap(sgHolidays)

// Weeks constructed as local-time Monday dates, matching getWeeks() output.
const weekApr27 = new Date(2026, 3, 27)  // Mon 4/27 → contains Fri 5/1
const weekMay25 = new Date(2026, 4, 25)  // Mon 5/25 → contains Wed 5/27
const weekDec21 = new Date(2026, 11, 21) // Mon 12/21 → contains Fri 12/25

describe('countHolidaysInWeek', () => {
  it('finds May 1 Labour Day in the Apr 27 week (Friday holiday)', () => {
    expect(countHolidaysInWeek(holidayMap, 'SG', weekApr27)).toBe(1)
  })

  it('finds May 27 Hari Raya Haji in the May 25 week (Wednesday holiday)', () => {
    expect(countHolidaysInWeek(holidayMap, 'SG', weekMay25)).toBe(1)
  })

  it('finds Dec 25 Christmas Day in the Dec 21 week (Friday holiday)', () => {
    expect(countHolidaysInWeek(holidayMap, 'SG', weekDec21)).toBe(1)
  })

  it('returns 0 when country is null', () => {
    expect(countHolidaysInWeek(holidayMap, null, weekMay25)).toBe(0)
  })

  it('returns 0 for countries with no holidays in range', () => {
    expect(countHolidaysInWeek(holidayMap, 'US', weekMay25)).toBe(0)
  })
})

describe('getHolidayDaysInWeek', () => {
  it('places May 1 (Friday) at dayIndex 4', () => {
    const result = getHolidayDaysInWeek(holidayMap, 'SG', weekApr27)
    expect(result).toEqual([{ dayIndex: 4, name: 'Labour Day' }])
  })

  it('places May 27 (Wednesday) at dayIndex 2', () => {
    const result = getHolidayDaysInWeek(holidayMap, 'SG', weekMay25)
    expect(result).toEqual([{ dayIndex: 2, name: 'Hari Raya Haji' }])
  })

  it('places Dec 25 (Friday) at dayIndex 4', () => {
    const result = getHolidayDaysInWeek(holidayMap, 'SG', weekDec21)
    expect(result).toEqual([{ dayIndex: 4, name: 'Christmas Day' }])
  })

  it('returns empty when country is null', () => {
    expect(getHolidayDaysInWeek(holidayMap, null, weekMay25)).toEqual([])
  })
})

// Regression: a 184h US assignment from 2026-06-08 → 2026-07-10 was reading
// 92% because Juneteenth (Fri 6/19) and Independence Day observed (Fri 7/3)
// were counted as workable days. Deducting holidays puts it at the expected 100%.
const usHolidays: Holiday[] = [
  { id: '4', country: 'US', date: '2026-06-19', name: 'Juneteenth' },
  { id: '5', country: 'US', date: '2026-07-03', name: 'Independence Day (observed)' },
] as Holiday[]
const usHolidayMap = buildHolidayMap(usHolidays)

describe('assignmentBarLabel', () => {
  it('deducts country holidays from the denominator', () => {
    // 25 bizdays - 2 US holidays = 23 workable days; 184 / (23*8) = 100%
    expect(assignmentBarLabel(184, '2026-06-08', '2026-07-10', usHolidayMap, 'US'))
      .toBe('100% (184h)')
  })

  it('ignores holidays when country is null', () => {
    // Fallback path — 184 / (25*8) = 92%
    expect(assignmentBarLabel(184, '2026-06-08', '2026-07-10', usHolidayMap, null))
      .toBe('92% (184h)')
  })

  it('ignores holidays when map is omitted (existing callers unchanged)', () => {
    expect(assignmentBarLabel(184, '2026-06-08', '2026-07-10'))
      .toBe('92% (184h)')
  })

  it('does not deduct holidays from another country', () => {
    // Singapore consultant shouldn't lose days to US holidays
    expect(assignmentBarLabel(184, '2026-06-08', '2026-07-10', usHolidayMap, 'SG'))
      .toBe('92% (184h)')
  })

  it('falls back to hours-only when the range is entirely holidays', () => {
    // Single-day range falling on a holiday → 1 bizday - 1 holiday = 0 workable
    expect(assignmentBarLabel(8, '2026-06-19', '2026-06-19', usHolidayMap, 'US'))
      .toBe('8h')
  })
})
