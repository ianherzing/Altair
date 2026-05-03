/* ------------------------------------------------------------------ */
/*  Utilization page types                                             */
/* ------------------------------------------------------------------ */

export interface AssignmentFlat {
  consultant_id: string
  start_date: string
  end_date: string
  total_hours: number
  project_type: string | null
  client_name: string
  project_name: string
}

export interface MonthCell {
  billableHours: number
  availableHours: number
  utilization: number
  isFuture: boolean
}

export interface DrilldownData {
  consultantName: string
  monthLabel: string
  billableHours: number
  availableHours: number
  utilization: number
  workingDays: number
  holidayDays: number
  assignments: { client: string; project: string; hours: number; type: string }[]
}
