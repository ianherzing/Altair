// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isDoneAndStale, matchesDateRange } from './kanbanUtils'
import type { Project } from '../types/database'

// Minimal builder — isDoneAndStale only reads `status` and `done_at`.
function p(fields: { status?: Project['status']; done_at?: string | null }): Project {
  return {
    status: fields.status ?? 'active',
    done_at: fields.done_at ?? null,
  } as unknown as Project
}

describe('isDoneAndStale', () => {
  // Fix "now" to 2026-04-13T12:00:00Z for deterministic tests.
  const NOW = new Date('2026-04-13T12:00:00Z').getTime()
  const HIDE_DAYS = 7

  it('returns false for projects that are not Done', () => {
    expect(isDoneAndStale(p({ status: 'active', done_at: '2026-01-01' }), HIDE_DAYS, NOW)).toBe(false)
    expect(isDoneAndStale(p({ status: 'to_do', done_at: '2026-01-01' }), HIDE_DAYS, NOW)).toBe(false)
  })

  it('returns false for Done projects with null done_at (legacy rows stay visible)', () => {
    expect(isDoneAndStale(p({ status: 'done', done_at: null }), HIDE_DAYS, NOW)).toBe(false)
  })

  it('returns false for Done projects younger than the cutoff', () => {
    // done 1 day ago → visible
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-04-12' }), HIDE_DAYS, NOW)).toBe(false)
    // done today → visible
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-04-13' }), HIDE_DAYS, NOW)).toBe(false)
    // done exactly 6 days ago → visible (not yet 7)
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-04-07' }), HIDE_DAYS, NOW)).toBe(false)
  })

  it('returns true for Done projects older than the cutoff', () => {
    // done 8 days ago → hide
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-04-05' }), HIDE_DAYS, NOW)).toBe(true)
    // done 90 days ago → hide
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-01-13' }), HIDE_DAYS, NOW)).toBe(true)
  })

  it('hides at the 7-day boundary (done_at parsed as UTC midnight)', () => {
    // done_at = 2026-04-06 parses as 2026-04-06T00:00Z; NOW = 2026-04-13T12:00Z.
    // Cutoff = 2026-04-06T12:00Z. 2026-04-06T00:00 < 2026-04-06T12:00 → true (hide).
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-04-06' }), HIDE_DAYS, NOW)).toBe(true)
  })

  it('respects a configurable hideAfterDays value', () => {
    // With a 14-day threshold, a project done 10 days ago should stay visible.
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-04-03' }), 14, NOW)).toBe(false)
    // And one done 20 days ago should hide.
    expect(isDoneAndStale(p({ status: 'done', done_at: '2026-03-24' }), 14, NOW)).toBe(true)
  })

  it('defaults to Date.now() when nowMs is omitted', () => {
    // Can't pin the result without a fixed clock, but the call should not throw
    // and should agree with an explicit Date.now() within the same instant.
    const nowSnapshot = Date.now()
    const proj = p({ status: 'done', done_at: '1970-01-01' })
    expect(isDoneAndStale(proj, 7)).toBe(isDoneAndStale(proj, 7, nowSnapshot))
  })
})

describe('matchesDateRange', () => {
  const proj = {
    engagement_start: '2026-04-01',
    engagement_end: '2026-04-15',
  } as unknown as Project

  it('returns true when both filters are empty', () => {
    expect(matchesDateRange(proj, '', '')).toBe(true)
  })

  it('returns false when project ended before the start filter', () => {
    expect(matchesDateRange(proj, '2026-04-16', '')).toBe(false)
  })

  it('returns false when project started after the end filter', () => {
    expect(matchesDateRange(proj, '', '2026-03-31')).toBe(false)
  })

  it('returns true when project overlaps the range', () => {
    expect(matchesDateRange(proj, '2026-04-10', '2026-04-20')).toBe(true)
  })
})

