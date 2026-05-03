// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildTreeIndex } from './mentorTree'
import type { Consultant } from '../types/database'

function c(over: Partial<Consultant>): Consultant {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    full_name: over.full_name ?? 'Unnamed',
    email: over.email ?? `${over.full_name ?? 'x'}@x.test`,
    title: over.title ?? null,
    manager: over.manager ?? null,
    mentor: over.mentor ?? null,
    is_mentor: over.is_mentor ?? false,
    country: over.country ?? null,
    skills: over.skills ?? [],
    passion_area: over.passion_area ?? null,
    passion_area_id: over.passion_area_id ?? null,
    is_active: over.is_active ?? true,
    hourly_cost_rate: over.hourly_cost_rate ?? null,
    utilization_target: over.utilization_target ?? 80,
    hire_date: over.hire_date ?? null,
    offboarded_at: over.offboarded_at ?? null,
    created_at: over.created_at ?? '2025-01-01',
    updated_at: over.updated_at ?? '2025-01-01',
  }
}

describe('buildTreeIndex', () => {
  it('returns empty index for empty input', () => {
    const idx = buildTreeIndex([])
    expect(idx.roots).toEqual([])
    expect(idx.unassigned).toEqual([])
    expect(idx.byName.size).toBe(0)
    expect(idx.childrenOf.size).toBe(0)
  })

  it('places mentee under mentor', () => {
    const alice = c({ full_name: 'Alice', is_mentor: true })
    const bob = c({ full_name: 'Bob', mentor: 'Alice' })
    const idx = buildTreeIndex([alice, bob])
    expect(idx.roots.map(r => r.full_name)).toEqual(['Alice'])
    expect(idx.childrenOf.get('Alice')?.map(k => k.full_name)).toEqual(['Bob'])
    expect(idx.unassigned).toEqual([])
  })

  it('puts active orphan with missing mentor in unassigned', () => {
    const ghost = c({ full_name: 'Ghost', mentor: 'Nobody' })
    const idx = buildTreeIndex([ghost])
    expect(idx.unassigned.map(e => e.full_name)).toEqual(['Ghost'])
    expect(idx.roots).toEqual([])
  })

  it('keeps inactive mentor with active children visible as root', () => {
    const retired = c({ full_name: 'Retired', is_active: false, is_mentor: true })
    const active = c({ full_name: 'Active', mentor: 'Retired' })
    const idx = buildTreeIndex([retired, active])
    expect(idx.roots.map(r => r.full_name)).toEqual(['Retired'])
    expect(idx.childrenOf.get('Retired')?.map(k => k.full_name)).toEqual(['Active'])
  })

  it('drops self-referential mentor (Alice→Alice) into unassigned', () => {
    // Self-loop: not a child of anyone (excluded), no children, not is_mentor -> unassigned
    const loop = c({ full_name: 'Alice', mentor: 'Alice', is_active: true })
    const idx = buildTreeIndex([loop])
    expect(idx.unassigned.map(e => e.full_name)).toEqual(['Alice'])
    expect(idx.roots).toEqual([])
  })

  it('sorts children alphabetically (no TITLE_RANK in OSS)', () => {
    const lead = c({ full_name: 'Lead', is_mentor: true })
    const charlie = c({ full_name: 'Charlie', mentor: 'Lead' })
    const alice = c({ full_name: 'Alice', mentor: 'Lead' })
    const bob = c({ full_name: 'Bob', mentor: 'Lead' })
    const idx = buildTreeIndex([lead, charlie, alice, bob])
    expect(idx.childrenOf.get('Lead')?.map(k => k.full_name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('inactive non-mentor with no children does not appear anywhere', () => {
    // An offboarded engineer who is not a mentor and has no children
    // should be dropped entirely from the tree view.
    const ghost = c({ full_name: 'Ghost', is_active: false, is_mentor: false })
    const idx = buildTreeIndex([ghost])
    expect(idx.roots).toEqual([])
    expect(idx.unassigned).toEqual([])
  })
})
