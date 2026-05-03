export interface AssignmentBasic {
  consultant_id: string
  project_id: string
  start_date: string
  end_date: string
  total_hours: number
}

export type MarginViewMode = 'monthly' | 'quarterly'

export interface MarginMonthBucket {
  key: string
  label: string
  revenue: number
  cost: number
  margin: number
}

export interface MarginProjectContribution {
  project_id: string
  client_name: string
  project_name: string
  sow_amount: number
  cost: number
  margin: number
}

export interface MarginDrilldown {
  label: string
  contributions: MarginProjectContribution[]
}
