export type RevenueStatus = 'to_do' | 'soft_unconfirmed' | 'soft_at_risk' | 'hard_scheduled' | 'active' | 'done'
export type ProjectType = 'billable' | 'non_billable' | 'pto'

/** Titles excluded from resourcing/capacity/utilization views — managers, directors, coordinators */
export const NON_RESOURCEABLE_TITLES = new Set([
  'Project Manager',
  'Practice Director',
  'Practice Manager',
  'Senior Practice Manager',
  'Program Manager',
  'Resource Manager',
  'Program Coordinator',
])

export interface Consultant {
  id: string
  full_name: string
  email: string
  title: string | null
  manager: string | null
  mentor: string | null
  is_mentor: boolean
  country: string | null
  skills: string[]
  passion_area: string | null
  passion_area_id: string | null
  is_active: boolean
  hourly_cost_rate: number | null
  utilization_target: number
  hire_date: string | null
  offboarded_at: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  client_name: string
  project_name: string
  project_type: ProjectType
  sow_number: string | null
  sow_amount: number | null
  planned_hours: number | null
  status: RevenueStatus
  engagement_start: string | null
  engagement_end: string | null
  manager_id: string | null
  program_manager_id: string | null
  managing_director_id: string | null
  practice_manager: string | null
  project_manager: string | null
  notes: string | null
  is_active: boolean
  done_at: string | null
  archived_at: string | null
  // Contact + scheduling
  client_contact_email: string | null
  sla: string | null
  onsite_required: boolean
  special_skills: string[]
  client_constraints: string[]
  pm_email: string | null
  po_required: boolean
  po_received: boolean
  // Engagement lifecycle dates
  kickoff_internal: string | null
  kickoff_external: string | null
  readout_meeting: string | null
  // Operational links
  box_folder_link: string | null
  internal_slack_link: string | null
  external_slack_link: string | null
  // Altair UID
  altair_uid: string
  // External reference (adapter-supplied via EngagementSource)
  external_id: string | null
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  project_id: string
  consultant_id: string
  start_date: string
  end_date: string
  total_hours: number
  is_billable: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MonthlySnapshot {
  id: string
  project_id: string
  month: string
  total_hours: number
  bill_rate: number
  revenue: number
  is_locked: boolean
  locked_at: string | null
  created_at: string
  updated_at: string
}

export interface Skill {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface ConsultantSkill {
  consultant_id: string
  skill_id: string
  rating: number
}

export interface PassionArea {
  id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface ConsultantCostRate {
  id: string
  consultant_id: string
  hourly_rate: number
  effective_date: string
  created_at: string
  created_by: string | null
}

export interface Holiday {
  id: string
  country: string
  name: string
  date: string
  recurring: boolean
  created_at: string
}

export interface SavedView {
  id: string
  user_email: string
  page: string
  name: string
  filters: Record<string, unknown>
  is_default: boolean
  created_at: string
  updated_at: string
}

// Sync jobs can be of any adapter-defined type — free-form string.
// Common values: 'engagement_sync', 'timeoff_sync', 'month_lock', etc.
export type SyncType = string
export type SyncStatus = 'success' | 'partial' | 'error'

export interface SyncLog {
  id: string
  sync_type: SyncType
  status: SyncStatus
  records_processed: number
  records_created: number
  records_updated: number
  error_message: string | null
  started_at: string
  completed_at: string
}

export type UserRole = 'pmo_admin' | 'consultant_readonly' | 'finance_viewer' | 'leadership'

export interface UserRoleRow {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface ProjectComment {
  id: string
  project_id: string
  author_email: string
  author_name: string
  content: string
  created_at: string
  updated_at: string
}

export interface HistoricalRevenue {
  id: string
  year: number
  month: string
  client_name: string
  project_name: string
  sow_number: string
  revenue: number
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      consultants: { Row: Consultant; Insert: Partial<Consultant>; Update: Partial<Consultant>; Relationships: [] }
      projects: { Row: Project; Insert: Partial<Project>; Update: Partial<Project>; Relationships: [] }
      assignments: { Row: Assignment; Insert: Partial<Assignment>; Update: Partial<Assignment>; Relationships: [] }
      monthly_snapshots: { Row: MonthlySnapshot; Insert: Partial<MonthlySnapshot>; Update: Partial<MonthlySnapshot>; Relationships: [] }
      skills: { Row: Skill; Insert: Partial<Skill>; Update: Partial<Skill>; Relationships: [] }
      consultant_skills: { Row: ConsultantSkill; Insert: Partial<ConsultantSkill>; Update: Partial<ConsultantSkill>; Relationships: [] }
      consultant_cost_rates: { Row: ConsultantCostRate; Insert: Partial<ConsultantCostRate>; Update: Partial<ConsultantCostRate>; Relationships: [] }
      passion_areas: { Row: PassionArea; Insert: Partial<PassionArea>; Update: Partial<PassionArea>; Relationships: [] }
      holidays: { Row: Holiday; Insert: Partial<Holiday>; Update: Partial<Holiday>; Relationships: [] }
      sync_log: { Row: SyncLog; Insert: Partial<SyncLog>; Update: Partial<SyncLog>; Relationships: [] }
      user_roles: { Row: UserRoleRow; Insert: Partial<UserRoleRow>; Update: Partial<UserRoleRow>; Relationships: [] }
      project_comments: { Row: ProjectComment; Insert: Partial<ProjectComment>; Update: Partial<ProjectComment>; Relationships: [] }
      historical_revenue: { Row: HistoricalRevenue; Insert: Partial<HistoricalRevenue>; Update: Partial<HistoricalRevenue>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      revenue_status: RevenueStatus
      project_type: ProjectType
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}
