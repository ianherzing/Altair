import type { Consultant } from '../types/database'

export interface TreeIndex {
  byName: Map<string, Consultant>
  childrenOf: Map<string, Consultant[]>
  roots: Consultant[]
  unassigned: Consultant[]
}

export function buildTreeIndex(consultants: Consultant[]): TreeIndex {
  const byName = new Map<string, Consultant>()
  for (const c of consultants) byName.set(c.full_name, c)

  const childrenOf = new Map<string, Consultant[]>()
  const childIds = new Set<string>()
  const orphanedActive: Consultant[] = []
  for (const c of consultants) {
    if (c.mentor && byName.has(c.mentor) && c.mentor !== c.full_name) {
      const list = childrenOf.get(c.mentor) ?? []
      list.push(c)
      childrenOf.set(c.mentor, list)
      childIds.add(c.id)
    } else if (c.is_active) {
      orphanedActive.push(c)
    }
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.full_name.localeCompare(b.full_name))
  }

  const roots = consultants
    .filter(c => !childIds.has(c.id))
    .filter(c => childrenOf.has(c.full_name) || c.is_mentor)
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  const rootIds = new Set(roots.map(r => r.id))
  const unassigned = orphanedActive
    .filter(c => !rootIds.has(c.id))
    .filter(c => !c.is_mentor && !childrenOf.has(c.full_name))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  return { byName, childrenOf, roots, unassigned }
}
