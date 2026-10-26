import type { RevenueStatus } from './database'

export const CAT_COLORS = {
  to_do: '#E8DBC0',
  soft_unconfirmed: '#006C35',
  soft_at_risk: '#C9654F',
  hard: '#B65540',
} as const

export const CAT_LABELS = {
  to_do: 'To Do',
  soft_unconfirmed: 'Soft (Unconfirmed)',
  soft_at_risk: 'Soft (At Risk)',
  hard: 'Hard Scheduled',
} as const

export type CatKey = keyof typeof CAT_COLORS
export type RevenueViewMode = 'monthly' | 'quarterly'

export interface RevenueMonthBucket {
  key: string
  label: string
  to_do: number
  soft_unconfirmed: number
  soft_at_risk: number
  hard: number
  total: number
}

export interface RevenueProjectContribution {
  project_id: string
  client_name: string
  project_name: string
  practice_manager: string | null
  status: RevenueStatus
  amount: number
  // Optional: populated for legacy historical_revenue rows so the per-project
  // export can still emit a SOW # when the project pre-dates Altair and isn't
  // present in the projects table.
  sow_number?: string
}

export interface RevenueDrilldown {
  label: string
  category: CatKey | 'total'
  contributions: RevenueProjectContribution[]
}
