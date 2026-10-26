// Single source of truth for primary navigation ORDER and structure, shared by
// the sidebar and the command palette. Pure data — no React, no icons.

export interface NavLeaf {
  label: string
  path: string
  sidebarLabel?: string
  secondary?: boolean
  shortcut: string
}

export type NavNode =
  | { kind: 'link'; label: string; path: string; end?: boolean; shortcut: string; paletteSection?: string }
  | { kind: 'group'; label: string; children: NavLeaf[] }

/** Altair destinations. Praetorian-only surfaces (Finances, Guard, Shared Tools) are not in this product. */
export const NAV_STRUCTURE: readonly NavNode[] = [
  { kind: 'link', label: 'Resourcing', path: '/', end: true, shortcut: 'R', paletteSection: 'General' },
  {
    kind: 'group', label: 'Projects', children: [
      { label: 'Projects', path: '/projects', shortcut: 'P' },
      { label: 'Project Archive', sidebarLabel: 'Archive', path: '/projects/archive', secondary: true, shortcut: 'A' },
      { label: 'Project Kanban', sidebarLabel: 'Kanban', path: '/projects/kanban', secondary: true, shortcut: 'K' },
    ],
  },
  {
    kind: 'group', label: 'Consultants', children: [
      { label: 'Consultants', path: '/consultants', shortcut: 'E' },
      { label: 'Consultant Archive', sidebarLabel: 'Archive', path: '/consultants/archive', secondary: true, shortcut: 'D' },
    ],
  },
  {
    kind: 'group', label: 'Dashboards', children: [
      { label: 'Revenue', path: '/revenue', shortcut: 'V' },
      { label: 'Historicals', path: '/historicals', shortcut: 'H' },
      { label: 'Capacity', path: '/capacity', shortcut: 'C' },
      { label: 'Margin', path: '/margin', shortcut: 'M' },
      { label: 'Utilization', path: '/utilization', shortcut: 'U' },
    ],
  },
  {
    kind: 'group', label: 'Workspace', children: [
      { label: 'Skills', path: '/skills', shortcut: 'S' },
      { label: 'Mentor Tree', path: '/mentor-tree', shortcut: 'T' },
      { label: 'Holidays', path: '/holidays', shortcut: 'L' },
    ],
  },
  {
    kind: 'group', label: 'Admin', children: [
      { label: 'Permissions', path: '/permissions', shortcut: 'I' },
      { label: 'Sync Log', path: '/sync-log', shortcut: 'Y' },
      { label: 'Security', path: '/security', shortcut: 'X' },
    ],
  },
]
