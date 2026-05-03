import type { UserRole } from './types.js'

/**
 * Per-table per-role column whitelists.
 * Enforced at query level — we never fetch columns the role shouldn't see.
 * '*' means all columns are allowed.
 */

type ColumnWhitelist = Record<string, Record<UserRole, string[] | '*' | null>>

const COLUMN_WHITELISTS: ColumnWhitelist = {
  consultants: {
    pmo_admin: '*',
    finance_viewer: [
      'id', 'full_name', 'email', 'title', 'manager', 'mentor', 'is_mentor',
      'skills', 'passion_area', 'passion_area_id', 'country',
      'is_active', 'department', 'utilization_target',
      'hire_date', 'offboarded_at', 'created_at', 'updated_at',
    ],
    leadership: [
      'id', 'full_name', 'email', 'title', 'manager', 'mentor', 'is_mentor',
      'skills', 'passion_area', 'passion_area_id', 'country',
      'is_active', 'department', 'utilization_target',
      'hire_date', 'offboarded_at', 'created_at', 'updated_at',
    ],
    consultant_readonly: [
      'id', 'full_name', 'email', 'title', 'manager', 'mentor', 'is_mentor',
      'skills', 'passion_area', 'passion_area_id', 'country',
      'is_active', 'department', 'utilization_target',
      'hire_date', 'offboarded_at', 'created_at', 'updated_at',
    ],
  },
  projects: {
    pmo_admin: '*',
    finance_viewer: [
      'id', 'client_name', 'project_name', 'project_type', 'sow_number',
      'sow_amount', 'planned_hours', 'status', 'engagement_start', 'engagement_end',
      'manager_id', 'program_manager_id', 'managing_director_id',
      'notes', 'is_active', 'done_at', 'archived_at',
      'practice_manager', 'project_manager',
      'altair_uid', 'external_id',
      'created_at', 'updated_at',
    ],
    leadership: [
      'id', 'client_name', 'project_name', 'project_type', 'sow_number',
      'planned_hours', 'status', 'engagement_start', 'engagement_end',
      'manager_id', 'program_manager_id', 'managing_director_id',
      'notes', 'is_active', 'done_at', 'archived_at',
      'practice_manager', 'project_manager',
      'altair_uid', 'external_id',
      'kickoff_internal', 'kickoff_external', 'readout_meeting',
      'created_at', 'updated_at',
    ],
    consultant_readonly: [
      'id', 'client_name', 'project_name', 'project_type', 'sow_number',
      'planned_hours', 'status', 'engagement_start', 'engagement_end',
      'manager_id', 'program_manager_id', 'managing_director_id',
      'notes', 'is_active', 'done_at', 'archived_at',
      'practice_manager', 'project_manager',
      'altair_uid', 'external_id',
      'created_at', 'updated_at',
    ],
  },
  assignments: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: '*',
    consultant_readonly: '*',
  },
  consultant_cost_rates: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: null,
    consultant_readonly: null,
  },
  monthly_snapshots: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: '*',
    consultant_readonly: null,
  },
  historical_revenue: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: '*',
    consultant_readonly: null,
  },
  skills: {
    pmo_admin: '*',
    finance_viewer: null,
    leadership: '*',
    consultant_readonly: '*',
  },
  consultant_skills: {
    pmo_admin: '*',
    finance_viewer: null,
    leadership: '*',
    consultant_readonly: '*',
  },
  passion_areas: {
    pmo_admin: '*',
    finance_viewer: null,
    leadership: '*',
    consultant_readonly: '*',
  },
  holidays: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: '*',
    consultant_readonly: '*',
  },
  sync_log: {
    pmo_admin: '*',
    finance_viewer: null,
    leadership: '*',
    consultant_readonly: null,
  },
  user_roles: {
    pmo_admin: '*',
    finance_viewer: null,
    leadership: '*',
    consultant_readonly: null,
  },
  project_comments: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: '*',
    consultant_readonly: '*',
  },
  saved_views: {
    pmo_admin: '*',
    finance_viewer: '*',
    leadership: '*',
    consultant_readonly: '*',
  },
}

/**
 * Get the allowed columns for a role on a table.
 * Returns null if the role has no access to the table at all.
 * Returns '*' if all columns are allowed.
 * Returns an array of column names otherwise.
 */
export function getAllowedColumns(table: string, role: UserRole): string[] | '*' | null {
  const tableConfig = COLUMN_WHITELISTS[table]
  if (!tableConfig) return null
  return tableConfig[role] ?? null
}

/**
 * Get the select string for a Supabase query.
 * Returns the comma-separated column list, or '*' for all.
 */
export function getSelectString(table: string, role: UserRole): string | null {
  const columns = getAllowedColumns(table, role)
  if (columns === null) return null
  if (columns === '*') return '*'
  return columns.join(', ')
}

/**
 * Check if a column is allowed for filtering/ordering.
 * Uses the same whitelist as read access — if you can't see it, you can't filter by it.
 */
export function isColumnAllowed(table: string, role: UserRole, column: string): boolean {
  const columns = getAllowedColumns(table, role)
  if (columns === null) return false
  if (columns === '*') return true
  return columns.includes(column)
}
