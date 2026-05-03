import type React from 'react'
import { createElement } from 'react'
import type { Holiday } from '../types/database'

/** Format an ISO timestamp as a relative time string (e.g., "5m ago", "3d ago") */
export function formatTimeAgo(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Render @[Name](id) mention markup as highlighted spans */
export function renderMentionContent(content: string): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      return createElement('span', {
        key: i,
        style: { color: 'var(--brand-green-dark)', fontWeight: 600 },
      }, `@${match[1]}`)
    }
    return part
  })
}

/**
 * Count holidays falling on weekdays in a date range (inclusive) for a country.
 * Uses the raw Holiday[] array (unlike the Map-based version in resourcingUtils).
 */
export function countHolidaysInRangeArray(holidays: Holiday[], country: string | null, startStr: string, endStr: string): number {
  if (!country || holidays.length === 0) return 0
  const start = new Date(startStr + 'T00:00:00')
  const end = new Date(endStr + 'T00:00:00')
  return holidays.filter(h => {
    if (h.country !== country) return false
    const d = new Date(h.date + 'T00:00:00')
    if (d < start || d > end) return false
    const day = d.getDay()
    return day !== 0 && day !== 6
  }).length
}
