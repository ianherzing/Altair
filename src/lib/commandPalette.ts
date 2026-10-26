import type { UserRole } from '../types/database'
import { canAccess } from './permissions'
import { NAV_STRUCTURE } from './navStructure'

export interface Command {
  id: string
  label: string
  group: string | null
  path: string
  secondary?: boolean
  shortcut?: string
}

export function buildNavCommands(role: UserRole): Command[] {
  const out: Command[] = []
  for (const node of NAV_STRUCTURE) {
    if (node.kind === 'link') {
      if (canAccess(role, node.path)) {
        out.push({ id: node.path, label: node.label, group: node.paletteSection ?? null, path: node.path, shortcut: node.shortcut })
      }
      continue
    }
    for (const child of node.children) {
      if (canAccess(role, child.path)) {
        out.push({
          id: child.path,
          label: child.label,
          group: node.label,
          path: child.path,
          secondary: !!child.secondary,
          shortcut: child.shortcut,
        })
      }
    }
  }
  return out
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim().toLowerCase()
  if (!q) return commands
  const scored = commands
    .map((c, i) => ({ c, i, idx: c.label.toLowerCase().indexOf(q) }))
    .filter(s => s.idx >= 0)
    .map(s => {
      const prev = s.idx === 0 ? '' : s.c.label[s.idx - 1]
      const wordStart = s.idx === 0 || /[\s/-]/.test(prev)
      const rank = s.idx === 0 ? 0 : wordStart ? 1 : 2
      return { ...s, rank }
    })
  scored.sort((a, b) => a.rank - b.rank || a.i - b.i)
  return scored.map(s => s.c)
}

export function matchShortcut(commands: Command[], key: string): Command | undefined {
  const k = key.toUpperCase()
  return commands.find(c => c.shortcut === k)
}
