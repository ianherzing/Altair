import type { UserRole } from '../types/database'
import { useAuth } from './auth'

/** Routes each role can access. Undefined = all routes. */
const ROLE_ROUTES: Record<UserRole, string[] | null> = {
  pmo_admin: null, // all routes
  consultant_readonly: ['/', '/projects', '/resourcing', '/consultants', '/skills', '/holidays', '/mentor-tree'],
  finance_viewer: ['/', '/projects', '/resourcing', '/consultants', '/skills', '/mentor-tree'],
  leadership: ['/', '/projects', '/resourcing', '/consultants', '/skills', '/revenue', '/historicals', '/capacity', '/margin', '/utilization', '/permissions', '/sync-log', '/security', '/mentor-tree'],
}

// Explicit deny list for routes that would otherwise match a broader allow prefix
// (e.g. /consultants grants /consultants/:id; we still want /consultants/archive blocked).
const ROLE_DENIED_ROUTES: Partial<Record<UserRole, string[]>> = {
  consultant_readonly: ['/consultants/archive'],
  finance_viewer: ['/consultants/archive'],
}

/** Roles that can write (create/update/delete) data */
const WRITE_ROLES: Set<UserRole> = new Set(['pmo_admin', 'leadership'])

/** Check if a role can access a given path */
export function canAccess(role: UserRole, path: string): boolean {
  const denied = ROLE_DENIED_ROUTES[role]
  if (denied && denied.some(r => path === r || path.startsWith(r + '/'))) return false

  const allowed = ROLE_ROUTES[role]
  if (allowed === null) return true // null = all routes

  // Exact match or prefix match (e.g. /projects matches /projects/:id)
  return allowed.some(route => {
    if (path === route) return true
    if (route !== '/' && path.startsWith(route + '/')) return true
    return false
  })
}

/** Check if a role can write data */
export function canWrite(role: UserRole | null): boolean {
  if (!role) return false
  return WRITE_ROLES.has(role)
}

/** Hook: returns true if the current user is read-only */
export function useIsReadOnly(): boolean {
  const { role } = useAuth()
  return !canWrite(role)
}

/** Hook: returns true if the current user is a PMO admin */
export function useIsPmoAdmin(): boolean {
  const { role } = useAuth()
  return role === 'pmo_admin'
}
