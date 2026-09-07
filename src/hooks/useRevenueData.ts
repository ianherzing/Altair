import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { distributeHoursToMonth } from '../lib/dateUtils'
import { monthsBetween, formatMonth, quarterKey } from '../lib/financeUtils'
import { statusCategory, contribKey } from '../lib/revenueUtils'
import { LEGACY_MONTHS, HIST_MONTH_NAME_BY_KEY } from '../lib/legacyMonths'
import type { Project, Assignment, HistoricalRevenue, MonthlySnapshot } from '../types/database'
import type {
  CatKey,
  RevenueViewMode,
  RevenueMonthBucket,
  RevenueProjectContribution,
  RevenueDrilldown,
} from '../types/revenue'
import { CAT_LABELS } from '../types/revenue'

export type RevenueExportRow = Record<string, string | number>
export const REVENUE_EXPORT_COLUMNS = [
  'Month', 'Client', 'Project', 'SOW #', 'Status', 'Practice Manager',
  'Total Hours', 'Bill Rate', 'Bill Rate Locked', 'Revenue',
  'Engagement Start', 'Engagement End',
] as const

// LEGACY_MONTHS and the month-name <-> key maps live in src/lib/legacyMonths.ts
// so the weekly finance script can import the same set. When a new month is
// added there, both surfaces pick it up automatically.
// HIST_MONTH_TO_KEY is the reverse direction (long English month name -> key);
// derive it from HIST_MONTH_NAME_BY_KEY so the file stays a single source of truth.
const HIST_MONTH_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(HIST_MONTH_NAME_BY_KEY).map(([key, name]) => [name, key])
)

export function useRevenueData() {
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [legacyRevenue, setLegacyRevenue] = useState<HistoricalRevenue[]>([])
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([])
  const [viewMode, setViewMode] = useState<RevenueViewMode>('monthly')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)
  const [selectedYear, setSelectedYear] = useState<string>('2026')
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const yearPickerRef = useRef<HTMLDivElement>(null)

  // Practice Manager filter
  const [filterPracticeManagers, setFilterPracticeManagers] = useState<Set<string>>(new Set())
  const [showPMFilter, setShowPMFilter] = useState(false)
  const pmFilterRef = useRef<HTMLDivElement>(null)

  // Drill-down dialog state
  const [drilldown, setDrilldown] = useState<RevenueDrilldown | null>(null)

  const { loading, error, retry } = useLoadData(async () => {
    // Rolling 24-month snapshot window — covers backward reporting (e.g., AR
    // tracking prior-year actuals) without pulling everything.
    const snapCutoff = new Date()
    snapCutoff.setMonth(snapCutoff.getMonth() - 24)
    const snapCutoffStr = `${snapCutoff.getFullYear()}-${String(snapCutoff.getMonth() + 1).padStart(2, '0')}-01`
    // Build legacy filter from the shared LEGACY_MONTHS set. Group keys by year
    // so we can pull all configured legacy months in a single request, no matter
    // how many years they span.
    const legacyYears = [...new Set([...LEGACY_MONTHS].map(k => k.split('-')[0]))]
    const legacyMonthNames = [...LEGACY_MONTHS]
      .map(k => HIST_MONTH_NAME_BY_KEY[k])
      .filter((n): n is string => !!n)
    const legacyFilter = legacyYears.length === 1
      ? { year: `eq.${legacyYears[0]}`, month: `in.(${legacyMonthNames.join(',')})` }
      : { year: `in.(${legacyYears.join(',')})`, month: `in.(${legacyMonthNames.join(',')})` }
    const [projectData, assignmentData, legacyData, snapshotData] = await Promise.all([
      api.getProjects({ project_type: 'eq.billable' }),
      api.getAssignments(),
      api.getHistoricalRevenue(legacyFilter, undefined, 1000),
      api.getMonthlySnapshots({ month: `gte.${snapCutoffStr}` }),
    ])
    setProjects(projectData)
    setAssignments(assignmentData)
    setLegacyRevenue(legacyData)
    setSnapshots(snapshotData)
  }, [], 8000)

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`revenue-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => { if (mounted) retry() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => { if (mounted) retry() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false)
      }
      if (yearPickerRef.current && !yearPickerRef.current.contains(e.target as Node)) {
        setYearPickerOpen(false)
      }
      if (pmFilterRef.current && !pmFilterRef.current.contains(e.target as Node)) {
        setShowPMFilter(false)
      }
    }
    if (monthPickerOpen || yearPickerOpen || showPMFilter) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [monthPickerOpen, yearPickerOpen, showPMFilter])

  // Available practice managers for the filter dropdown
  const availablePMs = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) {
      if (p.project_manager) set.add(p.project_manager)
    }
    return Array.from(set).sort()
  }, [projects])

  // Filter projects by practice manager before building buckets
  const pmFilteredProjects = useMemo(() => {
    if (filterPracticeManagers.size === 0) return projects
    return projects.filter(p => p.project_manager && filterPracticeManagers.has(p.project_manager))
  }, [projects, filterPracticeManagers])

  // Build a set of project IDs that pass the PM filter for quick lookup
  const pmFilteredProjectIds = useMemo(() => {
    return new Set(pmFilteredProjects.map(p => p.id))
  }, [pmFilteredProjects])

  // Lookup: SOW number → Altair project. Used to attribute legacy revenue rows
  // to a practice manager so the PM filter still applies to Jan-Mar 2026.
  const projectsBySow = useMemo(() => {
    const map = new Map<string, Project>()
    for (const p of projects) {
      if (p.sow_number) map.set(p.sow_number, p)
    }
    return map
  }, [projects])

  // Legacy rows that survive the current PM filter. Historical rows without a
  // matching Altair project have no PM, so they pass only when no PM filter
  // is active (default view) — matching the intent of "locked legacy totals".
  const filteredLegacyRevenue = useMemo(() => {
    if (filterPracticeManagers.size === 0) return legacyRevenue
    return legacyRevenue.filter(r => {
      const proj = projectsBySow.get(r.sow_number)
      return proj?.project_manager
        ? filterPracticeManagers.has(proj.project_manager)
        : false
    })
  }, [legacyRevenue, filterPracticeManagers, projectsBySow])

  const allMonthKeys = useMemo(() => {
    const monthSet = new Set<string>()
    for (const p of pmFilteredProjects) {
      if (!p.sow_amount || !p.engagement_start) continue
      const end = p.engagement_end || p.engagement_start
      for (const m of monthsBetween(p.engagement_start, end)) {
        monthSet.add(m)
      }
    }
    // Also include months from assignments whose projects are in the filtered set
    for (const a of assignments) {
      if (!pmFilteredProjectIds.has(a.project_id)) continue
      for (const m of monthsBetween(a.start_date, a.end_date)) {
        monthSet.add(m)
      }
    }
    // Legacy months always surface in the picker when historical rows exist,
    // so Jan-Mar 2026 remain selectable even if no Altair project spans them.
    for (const r of filteredLegacyRevenue) {
      const k = HIST_MONTH_TO_KEY[r.month]
      if (k) monthSet.add(k)
    }
    return Array.from(monthSet).sort()
  }, [pmFilteredProjects, assignments, pmFilteredProjectIds, filteredLegacyRevenue])

  // Derive available years from allMonthKeys
  const availableYears = useMemo(() => {
    const yearSet = new Set<string>()
    for (const m of allMonthKeys) {
      yearSet.add(m.slice(0, 4))
    }
    return Array.from(yearSet).sort()
  }, [allMonthKeys])

  // Filter allMonthKeys by selected year
  const filteredMonthKeys = useMemo(() => {
    if (selectedYear === 'all') return allMonthKeys
    return allMonthKeys.filter(m => m.startsWith(selectedYear))
  }, [allMonthKeys, selectedYear])

  // When year changes, clear selected months that are no longer in the filtered set
  useEffect(() => {
    if (selectedMonths.length > 0) {
      const valid = selectedMonths.filter(m => filteredMonthKeys.includes(m))
      if (valid.length !== selectedMonths.length) {
        setSelectedMonths(valid)
      }
    }
  }, [filteredMonthKeys, selectedMonths])

  // Build monthBuckets AND per-project contribution map together
  const { monthBuckets, contributionMap, projectMonthDetailMap } = useMemo(() => {
    const bucketMap = new Map<string, RevenueMonthBucket>()
    const cMap = new Map<string, RevenueProjectContribution[]>()
    // Per (project_id|YYYY-MM) details for the CSV export. Hours and bill rate
    // are forecast-derived; the snapshot table overrides these when present.
    const detailMap = new Map<string, { hours: number; billRate: number }>()

    // Quick-lookup map: project_id -> project
    const projectMap = new Map<string, Project>()
    for (const p of pmFilteredProjects) {
      projectMap.set(p.id, p)
    }

    // Group billable assignments by project_id (only for filtered projects)
    const assignmentsByProject = new Map<string, Assignment[]>()
    for (const a of assignments) {
      if (!a.is_billable) continue
      if (!pmFilteredProjectIds.has(a.project_id)) continue
      if (!assignmentsByProject.has(a.project_id)) assignmentsByProject.set(a.project_id, [])
      assignmentsByProject.get(a.project_id)!.push(a)
    }

    // Helper to add revenue to a bucket + contribution map.
    // Legacy months (Jan-Mar 2026) are overlaid from historical_revenue below,
    // so skip the assignment-based contribution here to avoid double-counting.
    function addRevenue(monthKey: string, cat: CatKey, amount: number, contrib: Omit<RevenueProjectContribution, 'amount'>) {
      if (LEGACY_MONTHS.has(monthKey)) return
      if (!bucketMap.has(monthKey)) {
        bucketMap.set(monthKey, { key: monthKey, label: formatMonth(monthKey), to_do: 0, soft_unconfirmed: 0, soft_at_risk: 0, hard: 0, total: 0 })
      }
      const bucket = bucketMap.get(monthKey)!
      bucket[cat] += amount
      bucket.total += amount

      const catCK = contribKey(monthKey, cat)
      if (!cMap.has(catCK)) cMap.set(catCK, [])
      cMap.get(catCK)!.push({ ...contrib, amount })

      const totalCK = contribKey(monthKey, 'total')
      if (!cMap.has(totalCK)) cMap.set(totalCK, [])
      cMap.get(totalCK)!.push({ ...contrib, amount })
    }

    // Track which projects were handled via assignments
    const projectsWithAssignmentRevenue = new Set<string>()

    // --- Assignment-based revenue: hours_in_month * bill_rate ---
    // Bill-rate denominator is max(planned_hours, assignedHours): planned_hours is
    // the floor (so under-assigned projects still under-report correctly), but if
    // assignments exceed planned (including bad SF data like planned_hours=1) we
    // use assigned so total project revenue can never exceed sow_amount.
    for (const [projectId, projAssignments] of assignmentsByProject) {
      const project = projectMap.get(projectId)
      if (!project) continue
      if (!project.sow_amount) continue

      const plannedHours = Number(project.planned_hours) || 0
      const totalAssignedHours = projAssignments.reduce((sum, a) => sum + Number(a.total_hours || 0), 0)
      const denominator = Math.max(plannedHours, totalAssignedHours)
      if (denominator <= 0) continue

      const billRate = Number(project.sow_amount) / denominator
      if (!isFinite(billRate) || billRate <= 0) continue

      const cat = statusCategory(project.status)
      const contrib: Omit<RevenueProjectContribution, 'amount'> = {
        project_id: project.id,
        client_name: project.client_name,
        project_name: project.project_name,
        practice_manager: project.project_manager,
        status: project.status,
      }

      let hasAnyHours = false
      for (const a of projAssignments) {
        // Determine which months this assignment spans
        const months = monthsBetween(a.start_date, a.end_date)
        for (const m of months) {
          const [y, mo] = m.split('-').map(Number)
          const hours = distributeHoursToMonth(a, y, mo - 1) // month is 0-indexed
          if (hours <= 0) continue
          hasAnyHours = true
          if (LEGACY_MONTHS.has(m)) continue // legacy months are overlaid from historical_revenue
          addRevenue(m, cat, hours * billRate, contrib)
          const dk = `${project.id}|${m}`
          const prev = detailMap.get(dk)
          detailMap.set(dk, { hours: (prev?.hours ?? 0) + hours, billRate })
        }
      }

      if (hasAnyHours) {
        projectsWithAssignmentRevenue.add(projectId)
      }
    }

    // No fallback — projects without assignments show $0 revenue
    // Suppress unused variable warning — kept for documentation parity with original code
    void projectsWithAssignmentRevenue

    // --- Legacy overlay: Jan-Mar 2026 come from historical_revenue ---
    // These are hard, billed legacy numbers (pre-Altair).
    // All booked as 'hard' category since they represent recognized revenue.
    for (const r of filteredLegacyRevenue) {
      const monthKey = HIST_MONTH_TO_KEY[r.month]
      if (!monthKey) continue
      if (!bucketMap.has(monthKey)) {
        bucketMap.set(monthKey, { key: monthKey, label: formatMonth(monthKey), to_do: 0, soft_unconfirmed: 0, soft_at_risk: 0, hard: 0, total: 0 })
      }
      const bucket = bucketMap.get(monthKey)!
      const amount = Number(r.revenue)
      bucket.hard += amount
      bucket.total += amount

      const proj = projectsBySow.get(r.sow_number)
      const contrib: RevenueProjectContribution = {
        project_id: proj?.id ?? `legacy:${r.id}`,
        client_name: r.client_name,
        project_name: r.project_name,
        practice_manager: proj?.project_manager ?? null,
        status: 'done',
        amount,
        sow_number: r.sow_number,
      }
      const hardCK = contribKey(monthKey, 'hard')
      if (!cMap.has(hardCK)) cMap.set(hardCK, [])
      cMap.get(hardCK)!.push(contrib)
      const totalCK = contribKey(monthKey, 'total')
      if (!cMap.has(totalCK)) cMap.set(totalCK, [])
      cMap.get(totalCK)!.push(contrib)
    }

    return {
      monthBuckets: Array.from(bucketMap.values()).sort((a, b) => a.key.localeCompare(b.key)),
      contributionMap: cMap,
      projectMonthDetailMap: detailMap,
    }
  }, [pmFilteredProjects, assignments, pmFilteredProjectIds, filteredLegacyRevenue, projectsBySow])

  const filteredBuckets = useMemo(() => {
    let base = monthBuckets
    // Apply year filter first
    if (selectedYear !== 'all') {
      base = base.filter(b => b.key.startsWith(selectedYear))
    }
    // Then apply month filter
    if (selectedMonths.length === 0) return base
    return base.filter(b => selectedMonths.includes(b.key))
  }, [monthBuckets, selectedMonths, selectedYear])

  const displayBuckets = useMemo(() => {
    if (viewMode === 'monthly') return filteredBuckets

    const qMap = new Map<string, RevenueMonthBucket>()
    for (const b of filteredBuckets) {
      const qk = quarterKey(b.key)
      if (!qMap.has(qk)) {
        qMap.set(qk, { key: qk, label: qk, to_do: 0, soft_unconfirmed: 0, soft_at_risk: 0, hard: 0, total: 0 })
      }
      const q = qMap.get(qk)!
      q.to_do += b.to_do
      q.soft_unconfirmed += b.soft_unconfirmed
      q.soft_at_risk += b.soft_at_risk
      q.hard += b.hard
      q.total += b.total
    }
    return Array.from(qMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [filteredBuckets, viewMode])

  // Build a display-level contribution map that handles quarterly aggregation
  const displayContributionMap = useMemo(() => {
    if (viewMode === 'monthly') return contributionMap

    // For quarterly view, aggregate contributions across the quarter's months
    const qMap = new Map<string, RevenueProjectContribution[]>()
    for (const b of filteredBuckets) {
      const qk = quarterKey(b.key)
      for (const cat of ['soft_unconfirmed', 'soft_at_risk', 'hard', 'total'] as (CatKey | 'total')[]) {
        const srcKey = contribKey(b.key, cat)
        const dstKey = contribKey(qk, cat)
        const entries = contributionMap.get(srcKey) || []
        if (!qMap.has(dstKey)) qMap.set(dstKey, [])
        qMap.get(dstKey)!.push(...entries)
      }
    }
    return qMap
  }, [contributionMap, filteredBuckets, viewMode])

  // Snapshot lookup: `${project_id}|YYYY-MM` -> MonthlySnapshot
  // Locked snapshots are the system of record for hours / bill rate / revenue.
  const snapshotByKey = useMemo(() => {
    const m = new Map<string, MonthlySnapshot>()
    for (const s of snapshots) {
      const monthKey = s.month.slice(0, 7) // 'YYYY-MM-DD' -> 'YYYY-MM'
      m.set(`${s.project_id}|${monthKey}`, s)
    }
    return m
  }, [snapshots])

  /**
   * Build per-project CSV rows for the currently displayed window.
   * One row per (project, month) at month grain regardless of viewMode (per-project
   * quarter rollups don't add value; finance pivots in Excel if needed).
   * Sources, in order: monthly_snapshots (locked actuals), assignment-derived
   * forecast hours x bill rate, historical_revenue (legacy-month overlay).
   */
  const buildExportRows = useCallback((): RevenueExportRow[] => {
    const rows: RevenueExportRow[] = []
    const projectById = new Map<string, Project>()
    for (const p of projects) projectById.set(p.id, p)

    // Index snapshots by month for O(1) orphan lookup below.
    const snapshotsByMonth = new Map<string, MonthlySnapshot[]>()
    for (const s of snapshots) {
      const mk = s.month.slice(0, 7)
      if (!snapshotsByMonth.has(mk)) snapshotsByMonth.set(mk, [])
      snapshotsByMonth.get(mk)!.push(s)
    }

    for (const b of filteredBuckets) {
      const contributions = contributionMap.get(contribKey(b.key, 'total')) ?? []
      // Aggregate revenue per project for this month (multiple assignment slices
      // produce multiple contribution entries for the same project).
      const perProject = new Map<string, { revenue: number; sample: RevenueProjectContribution }>()
      for (const c of contributions) {
        const cur = perProject.get(c.project_id)
        if (cur) cur.revenue += c.amount
        else perProject.set(c.project_id, { revenue: c.amount, sample: c })
      }

      for (const [projectId, agg] of perProject) {
        const project = projectById.get(projectId)
        const snap = snapshotByKey.get(`${projectId}|${b.key}`)
        const detail = projectMonthDetailMap.get(`${projectId}|${b.key}`)
        const isLegacy = projectId.startsWith('legacy:')

        const hours = snap?.total_hours ?? detail?.hours
        const billRate = snap?.bill_rate ?? detail?.billRate
        const revenue = snap ? Number(snap.revenue) : agg.revenue
        const locked = isLegacy ? 'Yes' : snap?.is_locked ? 'Yes' : 'No'

        rows.push({
          Month: b.key,
          Client: agg.sample.client_name,
          Project: agg.sample.project_name,
          'SOW #': project?.sow_number ?? agg.sample.sow_number ?? '',
          Status: agg.sample.status,
          'Practice Manager': agg.sample.practice_manager ?? '',
          'Total Hours': hours !== undefined ? hours.toFixed(2) : '',
          'Bill Rate': billRate !== undefined && billRate > 0 ? billRate.toFixed(2) : '',
          'Bill Rate Locked': locked,
          Revenue: Math.round(revenue * 100) / 100,
          'Engagement Start': project?.engagement_start ?? '',
          'Engagement End': project?.engagement_end ?? '',
        })
      }

      // Orphaned-snapshot rows: a locked monthly_snapshot whose assignment was
      // edited or deleted post-lock has no contribution but still represents
      // recognized revenue. Emit it so the dashboard CSV matches the weekly
      // email (which iterates snapshots directly). Respect the PM filter via
      // pmFilteredProjectIds. Legacy months are intentionally skipped — they're
      // sourced from historical_revenue, not snapshots.
      if (!LEGACY_MONTHS.has(b.key)) {
        for (const s of snapshotsByMonth.get(b.key) ?? []) {
          if (perProject.has(s.project_id)) continue
          if (!pmFilteredProjectIds.has(s.project_id)) continue
          const project = projectById.get(s.project_id)
          if (!project) continue
          rows.push({
            Month: b.key,
            Client: project.client_name,
            Project: project.project_name,
            'SOW #': project.sow_number ?? '',
            Status: project.status,
            'Practice Manager': project.project_manager ?? '',
            'Total Hours': Number(s.total_hours).toFixed(2),
            'Bill Rate': Number(s.bill_rate).toFixed(2),
            'Bill Rate Locked': s.is_locked ? 'Yes' : 'No',
            Revenue: Math.round(Number(s.revenue) * 100) / 100,
            'Engagement Start': project.engagement_start ?? '',
            'Engagement End': project.engagement_end ?? '',
          })
        }
      }
    }
    return rows
  }, [filteredBuckets, contributionMap, projectMonthDetailMap, snapshotByKey, projects, snapshots, pmFilteredProjectIds])

  /** Open the drill-down dialog for a given bucket key and category */
  const openDrilldown = useCallback((bucketKey: string, bucketLabel: string, category: CatKey | 'total') => {
    const key = contribKey(bucketKey, category)
    const entries = displayContributionMap.get(key) || []
    const catLabel = category === 'total' ? 'All Categories' : CAT_LABELS[category]
    setDrilldown({
      label: `${bucketLabel} \u2014 ${catLabel}`,
      category,
      contributions: entries,
    })
  }, [displayContributionMap])

  // Max total for y-axis scaling (stacked, so max of totals)
  const maxVal = useMemo(() => {
    let max = 0
    for (const b of displayBuckets) {
      max = Math.max(max, b.total)
    }
    return max || 1
  }, [displayBuckets])

  const totals = useMemo(() => {
    const t = { soft_unconfirmed: 0, soft_at_risk: 0, hard: 0, total: 0 }
    for (const b of displayBuckets) {
      t.soft_unconfirmed += b.soft_unconfirmed
      t.soft_at_risk += b.soft_at_risk
      t.hard += b.hard
      t.total += b.total
    }
    return t
  }, [displayBuckets])

  const hasActiveFilters = filterPracticeManagers.size > 0 || selectedMonths.length > 0

  const getFilters = useCallback(() => ({
    viewMode,
    selectedYear,
    selectedMonths,
    filterPracticeManagers: [...filterPracticeManagers],
  }), [viewMode, selectedYear, selectedMonths, filterPracticeManagers])

  const applyFilters = useCallback((filters: Record<string, unknown>) => {
    if (filters.viewMode !== undefined) setViewMode(filters.viewMode as RevenueViewMode)
    if (filters.selectedYear !== undefined) setSelectedYear(filters.selectedYear as string)
    if (filters.selectedMonths !== undefined) setSelectedMonths(filters.selectedMonths as string[])
    if (filters.filterPracticeManagers !== undefined) setFilterPracticeManagers(new Set(filters.filterPracticeManagers as string[]))
  }, [])

  return {
    loading,
    error,
    retry,
    viewMode,
    setViewMode,
    selectedMonths,
    setSelectedMonths,
    monthPickerOpen,
    setMonthPickerOpen,
    monthPickerRef,
    selectedYear,
    setSelectedYear,
    yearPickerOpen,
    setYearPickerOpen,
    yearPickerRef,
    filterPracticeManagers,
    setFilterPracticeManagers,
    showPMFilter,
    setShowPMFilter,
    pmFilterRef,
    drilldown,
    setDrilldown,
    availablePMs,
    filteredMonthKeys,
    availableYears,
    displayBuckets,
    openDrilldown,
    maxVal,
    totals,
    hasActiveFilters,
    getFilters,
    applyFilters,
    buildExportRows,
  }
}
