/**
 * Lightweight RBAC policy check — replaces the casbin npm package.
 *
 * The policy is a simple exact-match (subject, object, action) lookup.
 * No wildcard, inheritance, or effect logic needed — just a Set of
 * allowed "role|resource|action" triples.
 */

const POLICIES = new Set([
  // pmo_admin — full access
  'pmo_admin|projects|read',
  'pmo_admin|assignments|read',
  'pmo_admin|consultants|read',
  'pmo_admin|consultant_cost_rates|read',
  'pmo_admin|monthly_snapshots|read',
  'pmo_admin|historical_revenue|read',
  'pmo_admin|skills|read',
  'pmo_admin|consultant_skills|read',
  'pmo_admin|passion_areas|read',
  'pmo_admin|holidays|read',
  'pmo_admin|sync_log|read',
  'pmo_admin|projects|create',
  'pmo_admin|projects|update',
  'pmo_admin|projects|delete',
  'pmo_admin|assignments|create',
  'pmo_admin|assignments|update',
  'pmo_admin|assignments|delete',
  'pmo_admin|consultants|create',
  'pmo_admin|consultants|update',
  'pmo_admin|consultant_cost_rates|create',
  'pmo_admin|consultant_cost_rates|delete',
  'pmo_admin|skills|create',
  'pmo_admin|consultant_skills|create',
  'pmo_admin|consultant_skills|delete',
  'pmo_admin|passion_areas|create',
  'pmo_admin|holidays|create',
  'pmo_admin|holidays|delete',
  'pmo_admin|user_roles|read',
  'pmo_admin|user_roles|create',
  'pmo_admin|user_roles|update',
  'pmo_admin|user_roles|delete',
  'pmo_admin|project_comments|read',
  'pmo_admin|project_comments|create',
  'pmo_admin|project_comments|delete',
  'pmo_admin|sync|trigger',
  'pmo_admin|saved_views|read',
  'pmo_admin|saved_views|create',
  'pmo_admin|saved_views|update',
  'pmo_admin|saved_views|delete',

  // finance_viewer — read financials
  'finance_viewer|project_comments|read',
  'finance_viewer|projects|read',
  'finance_viewer|assignments|read',
  'finance_viewer|consultants|read',
  'finance_viewer|consultant_cost_rates|read',
  'finance_viewer|monthly_snapshots|read',
  'finance_viewer|historical_revenue|read',
  'finance_viewer|holidays|read',
  'finance_viewer|saved_views|read',
  'finance_viewer|saved_views|create',
  'finance_viewer|saved_views|update',
  'finance_viewer|saved_views|delete',
  'finance_viewer|project_comments|read',
  'finance_viewer|project_comments|create',

  // leadership — full read/write EXCEPT cost rates; holidays read-only
  'leadership|projects|read',
  'leadership|projects|create',
  'leadership|projects|update',
  'leadership|projects|delete',
  'leadership|assignments|read',
  'leadership|assignments|create',
  'leadership|assignments|update',
  'leadership|assignments|delete',
  'leadership|consultants|read',
  'leadership|consultants|create',
  'leadership|consultants|update',
  'leadership|skills|read',
  'leadership|skills|create',
  'leadership|consultant_skills|read',
  'leadership|consultant_skills|create',
  'leadership|consultant_skills|delete',
  'leadership|passion_areas|read',
  'leadership|passion_areas|create',
  'leadership|holidays|read',
  'leadership|monthly_snapshots|read',
  'leadership|historical_revenue|read',
  'leadership|sync_log|read',
  'leadership|user_roles|read',
  'leadership|project_comments|read',
  'leadership|project_comments|create',
  'leadership|project_comments|delete',
  'leadership|sync|trigger',
  'leadership|saved_views|read',
  'leadership|saved_views|create',
  'leadership|saved_views|update',
  'leadership|saved_views|delete',

  // consultant_readonly — read basics
  'consultant_readonly|project_comments|read',
  'consultant_readonly|projects|read',
  'consultant_readonly|assignments|read',
  'consultant_readonly|consultants|read',
  'consultant_readonly|skills|read',
  'consultant_readonly|consultant_skills|read',
  'consultant_readonly|passion_areas|read',
  'consultant_readonly|holidays|read',
  'consultant_readonly|saved_views|read',
  'consultant_readonly|saved_views|create',
  'consultant_readonly|saved_views|update',
  'consultant_readonly|saved_views|delete',
  'consultant_readonly|project_comments|read',
  'consultant_readonly|project_comments|create',

  // Self-service: any authenticated role can change their OWN mentor.
  // Identity is re-derived server-side in the update_own_mentor RPC via
  // auth.jwt()->>'email', so granting this action cannot be used to mutate
  // another user's row.
  'pmo_admin|consultants|update_own_mentor',
  'leadership|consultants|update_own_mentor',
  'finance_viewer|consultants|update_own_mentor',
  'consultant_readonly|consultants|update_own_mentor',
])

/**
 * Check if a role is allowed to perform an action on a resource.
 */
export async function checkPermission(
  role: string,
  resource: string,
  action: string
): Promise<boolean> {
  return POLICIES.has(`${role}|${resource}|${action}`)
}
