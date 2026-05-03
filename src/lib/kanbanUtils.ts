import type { Project, RevenueStatus } from '../types/database'
import type { KanbanColumn } from '../types/kanban'

// ─── Status config ───────────────────────────────────────────────────

export const STATUS_COLORS: Record<RevenueStatus, string> = {
  to_do: '#8B8FA3',
  soft_unconfirmed: '#28A36A',
  soft_at_risk: '#F0642B',
  hard_scheduled: '#E63948',
  active: '#11C3DB',
  done: '#D4AF37',
}

export const COLUMNS: KanbanColumn[] = [
  { key: 'to_do', label: 'To Do', statuses: ['to_do'], defaultStatus: 'to_do', color: STATUS_COLORS.to_do, confirmOnDrop: false },
  { key: 'soft_scheduled', label: 'Soft Scheduled', statuses: ['soft_unconfirmed', 'soft_at_risk'], defaultStatus: 'soft_unconfirmed', color: STATUS_COLORS.soft_unconfirmed, confirmOnDrop: false },
  { key: 'hard_scheduled', label: 'Hard Scheduled', statuses: ['hard_scheduled'], defaultStatus: 'hard_scheduled', color: STATUS_COLORS.hard_scheduled, confirmOnDrop: true },
  { key: 'active', label: 'Active', statuses: ['active'], defaultStatus: 'active', color: STATUS_COLORS.active, confirmOnDrop: true },
  { key: 'done', label: 'Done', statuses: ['done'], defaultStatus: 'done', color: STATUS_COLORS.done, confirmOnDrop: true },
]

export const UNASSIGNED_KEY = '__unassigned__'

// ─── Helpers ─────────────────────────────────────────────────────────

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateRange(start: string | null, end: string | null): string {
  const s = formatDate(start)
  const e = formatDate(end)
  if (!s && !e) return ''
  if (s && !e) return s + ' -'
  if (!s && e) return '- ' + e
  return `${s} \u2013 ${e}`
}

export function matchesDateRange(project: Project, filterStart: string, filterEnd: string): boolean {
  if (!filterStart && !filterEnd) return true
  const pStart = project.engagement_start || ''
  const pEnd = project.engagement_end || ''
  if (filterStart && pEnd && pEnd < filterStart) return false
  if (filterEnd && pStart && pStart > filterEnd) return false
  return true
}

/**
 * True when a Done project has been done long enough that it should be hidden
 * from the Kanban. Pure of Date.now() so tests can inject a deterministic clock.
 *
 * Legacy rows with done_at = null remain visible — they'll get a done_at via
 * backfill (migration v59) or from the next transition into Done.
 */
export function isDoneAndStale(project: Project, hideAfterDays: number, nowMs: number = Date.now()): boolean {
  if (project.status !== 'done' || !project.done_at) return false
  const cutoff = nowMs - hideAfterDays * 24 * 60 * 60 * 1000
  return new Date(project.done_at).getTime() < cutoff
}
