import type { ProjectType, RevenueStatus } from './database'

export const TYPE_LABELS: Record<ProjectType, string> = {
  billable: 'Billable',
  non_billable: 'Non-Billable',
  pto: 'PTO',
}

export const TYPE_COLORS: Record<ProjectType, string> = {
  billable: '#00A86B',
  non_billable: '#0F9F8A',
  pto: '#D6B25E',
}

export const STATUS_LABELS: Record<string, string> = {
  to_do: 'To Do',
  soft_unconfirmed: 'Soft (Unconfirmed)',
  soft_at_risk: 'Soft (At Risk)',
  hard_scheduled: 'Hard Scheduled',
  active: 'Active',
  done: 'Done',
}

export const STATUS_OPTIONS: RevenueStatus[] = ['to_do', 'soft_unconfirmed', 'soft_at_risk', 'hard_scheduled', 'active', 'done']

/** Status dots and kanban column accents. Altair palette only — no cyan. */
export const STATUS_COLORS: Record<RevenueStatus, string> = {
  to_do: '#E8DBC0',
  soft_unconfirmed: '#006C35',
  soft_at_risk: '#C9654F',
  hard_scheduled: '#B65540',
  active: '#D6B25E',
  done: '#3DDC84',
}

export const EMPTY_PROJECT_FORM = {
  client_name: '',
  project_name: '',
  project_type: 'billable' as ProjectType,
  sow_number: '',
  sow_amount: '',
  planned_hours: '',
  status: 'soft_unconfirmed' as RevenueStatus,
}

export type ProjectFormState = typeof EMPTY_PROJECT_FORM
