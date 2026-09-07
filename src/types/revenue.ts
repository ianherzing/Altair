import type { RevenueStatus } from './database'

export const CAT_COLORS = {
  to_do: '#8B8FA3',              // gray — pre-scheduling
  soft_unconfirmed: '#28A36A',   // green — matches StatusBadge
  soft_at_risk: '#F0642B',       // orange — matches StatusBadge
  hard: '#E63948',               // red — matches StatusBadge hard_scheduled
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
