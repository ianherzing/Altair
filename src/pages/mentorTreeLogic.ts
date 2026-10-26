import type { Consultant, ConsultantSkill, Skill } from '../types/database'

/** A skill with its proficiency rating, as shown in the Skills column / CSV. */
export interface RatedSkill {
  name: string
  rating: number
}

/**
 * One flattened subtree row carrying everything the row needs to draw
 * always-connected file-tree guides:
 *  - `depth`: 1-based depth below the root.
 *  - `ancestors`: length `depth - 1`. For each ancestor level, whether that
 *    ancestor has a following sibling (continuous vertical rail).
 *  - `isLastChild`: last child of its parent → elbow stops at row center.
 */
export interface GuidedRow {
  consultant: Consultant
  depth: number
  ancestors: boolean[]
  isLastChild: boolean
}

/**
 * Depth-first flatten of a root's subtree into ordered guide-annotated rows.
 * The root itself is not emitted (it renders as the section header row).
 * Mentor links have no server-side cycle check, so names already on the path
 * are skipped.
 */
export function flattenSubtreeWithGuides(
  rootName: string,
  childrenOf: Map<string, Consultant[]>,
): GuidedRow[] {
  const out: GuidedRow[] = []
  const visited = new Set<string>([rootName])
  const walk = (name: string, depth: number, ancestors: boolean[]) => {
    const kids = childrenOf.get(name) ?? []
    kids.forEach((child, j) => {
      if (visited.has(child.full_name)) return
      visited.add(child.full_name)
      const hasNext = j < kids.length - 1
      out.push({ consultant: child, depth, ancestors, isLastChild: !hasNext })
      walk(child.full_name, depth + 1, ancestors.concat(hasNext))
    })
  }
  walk(rootName, 1, [])
  return out
}

/**
 * Join consultant_skills against skills into a per-consultant list of
 * {name, rating}, sorted by rating descending. Unknown skill ids are dropped.
 */
export function joinConsultantSkills(
  consultantSkills: ConsultantSkill[],
  skills: Skill[],
): Map<string, RatedSkill[]> {
  const nameById = new Map(skills.map(s => [s.id, s.name]))
  const byConsultant = new Map<string, RatedSkill[]>()
  for (const cs of consultantSkills) {
    const name = nameById.get(cs.skill_id)
    if (name === undefined) continue
    const list = byConsultant.get(cs.consultant_id) ?? []
    list.push({ name, rating: cs.rating })
    byConsultant.set(cs.consultant_id, list)
  }
  for (const list of byConsultant.values()) {
    list.sort((a, b) => b.rating - a.rating)
  }
  return byConsultant
}

/** One CSV export row. The index signature keeps it assignable to downloadCsv. */
export interface MentorTreeCsvRow {
  Consultant: string
  Title: string
  Mentor: string
  'Passion area': string
  Skills: string
  Mentees: number
  [column: string]: string | number
}

export function buildCsvRows(
  consultants: Consultant[],
  skillsByConsultant: Map<string, RatedSkill[]>,
  menteeCountByName: Map<string, number>,
): MentorTreeCsvRow[] {
  return consultants.map(c => ({
    Consultant: c.full_name,
    Title: c.title ?? '',
    Mentor: c.mentor ?? '',
    'Passion area': c.passion_area ?? '',
    Skills: (skillsByConsultant.get(c.id) ?? []).map(s => `${s.name} (${s.rating})`).join('; '),
    Mentees: menteeCountByName.get(c.full_name) ?? 0,
  }))
}
