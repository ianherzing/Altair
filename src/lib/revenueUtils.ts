import type { RevenueStatus } from '../types/database'
import type { CatKey } from '../types/revenue'

/** Map a project's RevenueStatus to a revenue category key. */
export function statusCategory(s: RevenueStatus): CatKey {
  if (s === 'to_do') return 'to_do'
  if (s === 'soft_unconfirmed') return 'soft_unconfirmed'
  if (s === 'soft_at_risk') return 'soft_at_risk'
  return 'hard' // hard_scheduled + active + done
}

/** Build a contribution-map key from a bucket key and category. */
export function contribKey(bucketKey: string, cat: CatKey | 'total'): string {
  return `${bucketKey}-${cat}`
}
