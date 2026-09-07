// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeProjectForEmail } from './email'

describe('normalizeProjectForEmail', () => {
  it('strips ASCII-hyphen SOW prefix', () => {
    const r = normalizeProjectForEmail('2026-04-0801', '2026-04-0801 - NorthSky')
    expect(r.cleanProject).toBe('NorthSky')
    expect(r.subjectProject).toBe('NorthSky')
  })

  it('strips em-dash SOW prefix from CRM-synced names', () => {
    const r = normalizeProjectForEmail('2026-04-0801', '2026-04-0801 — NorthSky')
    expect(r.cleanProject).toBe('NorthSky')
    expect(r.subjectProject).toBe('NorthSky')
  })

  it('strips en-dash SOW prefix', () => {
    const r = normalizeProjectForEmail('2026-04-0801', '2026-04-0801 – NorthSky')
    expect(r.cleanProject).toBe('NorthSky')
    expect(r.subjectProject).toBe('NorthSky')
  })

  it('normalizes embedded em/en dashes to ASCII for Subject only', () => {
    const r = normalizeProjectForEmail('2026-04-0801', 'Acme — Phase 2 – Q1')
    expect(r.cleanProject).toBe('Acme — Phase 2 – Q1')
    expect(r.subjectProject).toBe('Acme - Phase 2 - Q1')
  })

  it('leaves project name unchanged when SOW prefix absent', () => {
    const r = normalizeProjectForEmail('2026-04-0801', 'NorthSky')
    expect(r.cleanProject).toBe('NorthSky')
    expect(r.subjectProject).toBe('NorthSky')
  })

  it('escapes regex metacharacters in SOW number', () => {
    const r = normalizeProjectForEmail('2026.04+0801', '2026.04+0801 - X')
    expect(r.cleanProject).toBe('X')
  })

  it('handles empty SOW number safely', () => {
    const r = normalizeProjectForEmail('', '2026-04-0801 - NorthSky')
    expect(r.cleanProject).toBe('2026-04-0801 - NorthSky')
    expect(r.subjectProject).toBe('2026-04-0801 - NorthSky')
  })
})
