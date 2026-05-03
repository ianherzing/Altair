// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  HOURS_PER_DAY,
  getWorkingDaysInMonth,
  getHolidaysInMonth,
  distributeHoursToMonth,
  formatMonth,
  formatMonthShort,
  type AssignmentForDistribution,
} from './dateUtils'
import type { Holiday } from '../types/database'

describe('HOURS_PER_DAY', () => {
  it('equals 8', () => {
    expect(HOURS_PER_DAY).toBe(8)
  })
})

describe('getWorkingDaysInMonth', () => {
  it('returns 23 for January 2024 (starts Monday, 31 days)', () => {
    expect(getWorkingDaysInMonth(2024, 0)).toBe(23)
  })

  it('returns 21 for February 2024 (leap year, starts Thursday, 29 days)', () => {
    expect(getWorkingDaysInMonth(2024, 1)).toBe(21)
  })

  it('returns 22 for December 2024 (starts Sunday, 31 days)', () => {
    expect(getWorkingDaysInMonth(2024, 11)).toBe(22)
  })

  it('returns 23 for July 2024 (starts Monday, 31 days)', () => {
    expect(getWorkingDaysInMonth(2024, 6)).toBe(23)
  })

  it('returns 20 for February 2015 (starts Sunday, 28 days)', () => {
    // Feb 2015: 1=Sun, so Mon-Fri blocks: 2-6, 9-13, 16-20, 23-27 = 20
    expect(getWorkingDaysInMonth(2015, 1)).toBe(20)
  })

  it('never returns more than 23 working days for any month in 2024', () => {
    for (let m = 0; m < 12; m++) {
      expect(getWorkingDaysInMonth(2024, m)).toBeLessThanOrEqual(23)
    }
  })

  it('never returns fewer than 20 working days for any month in 2024', () => {
    for (let m = 0; m < 12; m++) {
      expect(getWorkingDaysInMonth(2024, m)).toBeGreaterThanOrEqual(20)
    }
  })
})

describe('getHolidaysInMonth', () => {
  const sampleHolidays: Holiday[] = [
    // Jan 1 2024 = Monday (weekday) — US
    { id: '1', country: 'US', name: 'New Year', date: '2024-01-01', recurring: true, created_at: '' },
    // Jan 15 2024 = Monday (weekday) — US
    { id: '2', country: 'US', name: 'MLK Day', date: '2024-01-15', recurring: true, created_at: '' },
    // Jan 1 2024 = Monday (weekday) — UK
    { id: '3', country: 'UK', name: 'Bank Holiday', date: '2024-01-01', recurring: false, created_at: '' },
    // Dec 25 2024 = Wednesday (weekday) — US
    { id: '4', country: 'US', name: 'Christmas', date: '2024-12-25', recurring: true, created_at: '' },
    // Jan 6 2024 = Saturday — should be excluded
    { id: '5', country: 'US', name: 'Weekend Holiday', date: '2024-01-06', recurring: false, created_at: '' },
  ]

  it('returns 0 when country is null', () => {
    expect(getHolidaysInMonth(sampleHolidays, null, 2024, 0)).toBe(0)
  })

  it('counts only weekday holidays for the matching country and month', () => {
    // US January 2024: Jan 1 (Mon) + Jan 15 (Mon) = 2; Jan 6 (Sat) excluded
    expect(getHolidaysInMonth(sampleHolidays, 'US', 2024, 0)).toBe(2)
  })

  it('excludes weekend holidays', () => {
    const weekendOnly: Holiday[] = [
      { id: '5', country: 'US', name: 'Saturday Holiday', date: '2024-01-06', recurring: false, created_at: '' },
    ]
    expect(getHolidaysInMonth(weekendOnly, 'US', 2024, 0)).toBe(0)
  })

  it('excludes Sunday holidays', () => {
    const sundayHoliday: Holiday[] = [
      // Jan 7 2024 = Sunday
      { id: '6', country: 'US', name: 'Sunday Holiday', date: '2024-01-07', recurring: false, created_at: '' },
    ]
    expect(getHolidaysInMonth(sundayHoliday, 'US', 2024, 0)).toBe(0)
  })

  it('excludes holidays from a different country', () => {
    // Only UK Jan 1 is a weekday UK holiday → 1
    expect(getHolidaysInMonth(sampleHolidays, 'UK', 2024, 0)).toBe(1)
  })

  it('excludes holidays from a different month', () => {
    expect(getHolidaysInMonth(sampleHolidays, 'US', 2024, 5)).toBe(0)
  })

  it('returns 0 for an empty holidays array', () => {
    expect(getHolidaysInMonth([], 'US', 2024, 0)).toBe(0)
  })

  it('counts a December weekday holiday correctly', () => {
    // Dec 25 2024 = Wednesday
    expect(getHolidaysInMonth(sampleHolidays, 'US', 2024, 11)).toBe(1)
  })
})

describe('distributeHoursToMonth', () => {
  it('returns all hours when assignment is entirely within the month', () => {
    // Jan 8–12 2024 (Mon–Fri): 5 weekdays out of 5 total
    const a: AssignmentForDistribution = {
      start_date: '2024-01-08',
      end_date: '2024-01-12',
      total_hours: 40,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(40)
  })

  it('returns 0 when assignment is entirely before the month', () => {
    const a: AssignmentForDistribution = {
      start_date: '2023-12-01',
      end_date: '2023-12-31',
      total_hours: 100,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(0)
  })

  it('returns 0 when assignment is entirely after the month', () => {
    const a: AssignmentForDistribution = {
      start_date: '2024-02-01',
      end_date: '2024-02-29',
      total_hours: 160,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(0)
  })

  it('distributes proportionally when assignment spans multiple months', () => {
    // Jan 15–Feb 15 2024
    // Overlap in Jan (Jan 15–31): 13 weekdays
    // Total (Jan 15–Feb 15): 24 weekdays
    // result = round(100 * 13/24 * 100) / 100 = 54.17
    const a: AssignmentForDistribution = {
      start_date: '2024-01-15',
      end_date: '2024-02-15',
      total_hours: 100,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(54.17)
  })

  it('handles a single weekday assignment within the month', () => {
    // Jan 15 2024 = Monday
    const a: AssignmentForDistribution = {
      start_date: '2024-01-15',
      end_date: '2024-01-15',
      total_hours: 8,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(8)
  })

  it('returns 0 for a weekend-only assignment (max guard prevents division by zero)', () => {
    // Jan 13–14 2024 = Sat–Sun: 0 weekdays, denominator clamped to 1, overlap = 0
    const a: AssignmentForDistribution = {
      start_date: '2024-01-13',
      end_date: '2024-01-14',
      total_hours: 16,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(0)
  })

  it('handles an assignment spanning the entire month', () => {
    // Jan 1–31 2024: overlap = full month = total working days → all hours
    const a: AssignmentForDistribution = {
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      total_hours: 184,
    }
    expect(distributeHoursToMonth(a, 2024, 0)).toBe(184)
  })

  it('rounds result to two decimal places', () => {
    const a: AssignmentForDistribution = {
      start_date: '2024-01-01',
      end_date: '2024-03-31',
      total_hours: 100,
    }
    const result = distributeHoursToMonth(a, 2024, 0)
    expect(result).toBe(Math.round(result * 100) / 100)
  })

  it('handles an assignment starting exactly on the first day of the month', () => {
    // Feb 1–Mar 31 2024, queried for February
    const a: AssignmentForDistribution = {
      start_date: '2024-02-01',
      end_date: '2024-03-31',
      total_hours: 100,
    }
    const result = distributeHoursToMonth(a, 2024, 1)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(100)
  })
})

describe('formatMonth', () => {
  it('formats YYYY-MM to short month and year', () => {
    expect(formatMonth('2024-01')).toBe('Jan 2024')
  })

  it('formats December correctly', () => {
    expect(formatMonth('2024-12')).toBe('Dec 2024')
  })

  it('formats July correctly', () => {
    expect(formatMonth('2025-07')).toBe('Jul 2025')
  })

  it('formats March correctly', () => {
    expect(formatMonth('2023-03')).toBe('Mar 2023')
  })
})

describe('formatMonthShort', () => {
  it('formats YYYY-MM to short month only', () => {
    expect(formatMonthShort('2024-01')).toBe('Jan')
  })

  it('formats December correctly', () => {
    expect(formatMonthShort('2024-12')).toBe('Dec')
  })

  it('formats July correctly', () => {
    expect(formatMonthShort('2025-07')).toBe('Jul')
  })

  it('formats March correctly', () => {
    expect(formatMonthShort('2023-03')).toBe('Mar')
  })
})
