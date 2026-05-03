import type { MonthBucket, ValueMode } from '../types/capacity'

export const DEFAULT_BILL_RATE = 325

export const COLOR_CAPACITY = '#8B95A5'
export const COLOR_ASSIGNED = '#11C3DB'

export function quarterKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const q = Math.ceil(m / 3)
  return `Q${q} ${y}`
}

export function fmtHours(n: number): string {
  return Math.round(n).toLocaleString() + 'h'
}

export function fmtDollars(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + Math.round(n / 1_000).toLocaleString() + 'K'
  return '$' + Math.round(n).toLocaleString()
}

export function fmtDollarsFull(n: number): string {
  return '$' + Math.round(n).toLocaleString()
}

export function fmtPct(n: number): string {
  return Math.round(n) + '%'
}

export function fmtVal(hours: number, valueMode: ValueMode): string {
  if (valueMode === 'revenue') return fmtDollars(hours * DEFAULT_BILL_RATE)
  return fmtHours(hours)
}

export function fmtValFull(hours: number, valueMode: ValueMode): string {
  if (valueMode === 'revenue') return fmtDollarsFull(hours * DEFAULT_BILL_RATE)
  return Math.round(hours).toLocaleString() + 'h'
}

/** Format assigned value — uses real per-project revenue (not flat rate) when in revenue mode. */
export function fmtAssignedVal(hours: number, revenue: number, valueMode: ValueMode): string {
  if (valueMode === 'revenue') return fmtDollars(revenue)
  return fmtHours(hours)
}

export function fmtAssignedValFull(hours: number, revenue: number, valueMode: ValueMode): string {
  if (valueMode === 'revenue') return fmtDollarsFull(revenue)
  return Math.round(hours).toLocaleString() + 'h'
}

/** Build quarterly buckets from monthly buckets */
export function buildQuarterlyBuckets(monthlyBuckets: MonthBucket[]): MonthBucket[] {
  const qMap = new Map<string, MonthBucket>()
  for (const b of monthlyBuckets) {
    const qk = quarterKey(b.key)
    if (!qMap.has(qk)) {
      qMap.set(qk, { key: qk, label: qk, capacity: 0, assigned: 0, assignedRevenue: 0, capacityDetail: [], assignedDetail: [] })
    }
    const q = qMap.get(qk)!
    q.capacity += b.capacity
    q.assigned += b.assigned
    q.assignedRevenue += b.assignedRevenue
    q.capacityDetail.push(...b.capacityDetail)
    q.assignedDetail.push(...b.assignedDetail)
  }
  return Array.from(qMap.values()).sort((a, b) => a.key.localeCompare(b.key))
}

/** Compute totals from display buckets */
export function computeTotals(buckets: MonthBucket[]) {
  let capacity = 0
  let assigned = 0
  let assignedRevenue = 0
  for (const b of buckets) {
    capacity += b.capacity
    assigned += b.assigned
    assignedRevenue += b.assignedRevenue
  }
  const available = Math.max(capacity - assigned, 0)
  const utilization = capacity > 0 ? (assigned / capacity) * 100 : 0
  return { capacity, assigned, assignedRevenue, available, utilization }
}
