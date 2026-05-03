import type { Assignment, Consultant } from './database'

export interface AssignmentWithConsultant extends Assignment {
  consultants: Pick<Consultant, 'full_name' | 'email' | 'hourly_cost_rate'> | null
}

export interface EditingAssignment {
  id: string
  consultant_name: string
  start_date: string
  end_date: string
  total_hours: string
  notes: string
}

export interface DragState {
  assignmentId: string
  consultantCountry: string | null
  mode: 'move' | 'resize-start' | 'resize-end'
  startX: number
  origStart: string
  origEnd: string
}

export interface CreateDragState {
  consultantId: string
  rowKey: string
  startX: number
  currentX: number
  timelineLeft: number
  timelineWidth: number
}

export const EMPTY_ASSIGNMENT = {
  consultant_id: '',
  start_date: '',
  end_date: '',
  total_hours: '',
  notes: '',
}
