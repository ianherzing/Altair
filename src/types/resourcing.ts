import type { Assignment, Consultant, Project } from './database'

export interface AssignmentWithDetails extends Assignment {
  projects: Pick<Project, 'client_name' | 'project_name' | 'status' | 'project_type'> | null
}

export interface ConsultantWithAssignments extends Consultant {
  assignments: AssignmentWithDetails[]
}

export interface SkillFilterItem {
  skillId: string
  name: string
  enabled: boolean
  min: number
  max: number
}

export interface EditingAssignment {
  id: string
  project_id: string
  consultant_id: string
  start_date: string
  end_date: string
  total_hours: string
  notes: string
  project_label: string
}

export interface ProjectWithConsultants {
  project: Project
  consultantAssignments: {
    consultant: ConsultantWithAssignments
    assignments: AssignmentWithDetails[]
  }[]
  totalHours: number
}
