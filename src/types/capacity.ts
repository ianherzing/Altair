export interface AssignmentBasic {
  consultant_id: string
  project_id: string
  start_date: string
  end_date: string
  total_hours: number
  project_type: string | null
  project_name: string | null
  client_name: string | null
}

export type ViewMode = 'monthly' | 'quarterly'
export type ValueMode = 'hours' | 'revenue'

/** Per-consultant capacity detail for drilldown */
export interface CapacityDetail {
  consultantId: string
  consultantName: string
  hours: number
}

/** Per-assignment detail for drilldown */
export interface AssignedDetail {
  consultantId: string
  consultantName: string
  projectName: string
  clientName: string
  hours: number
  revenue: number
}

export interface MonthBucket {
  key: string             // YYYY-MM
  label: string           // "Jan 2026"
  capacity: number        // hours
  assigned: number        // hours
  assignedRevenue: number // dollars, summed from per-project implied rates (matches Revenue dashboard)
  capacityDetail: CapacityDetail[]
  assignedDetail: AssignedDetail[]
}
