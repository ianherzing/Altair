import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { useIsPmoAdmin } from '../lib/permissions'
import { useAuth } from '../lib/auth'
import { monthsBetween, formatMonth, quarterKey } from '../lib/financeUtils'
import { getCostRateForMonth } from '../lib/marginUtils'
import type { Project, ConsultantCostRate, HistoricalRevenue } from '../types/database'
import type {
  AssignmentBasic,
  MarginViewMode,
  MarginMonthBucket,
  MarginProjectContribution,
  MarginDrilldown,
} from '../types/margin'

// Legacy months — revenue comes from historical_revenue table.
// Cost stays computed from Altair assignments + cost rates. See
// migration_v71_jan_mar_2026_revenue.sql and useRevenueData.ts.
const LEGACY_MONTHS = new Set(['2026-01', '2026-02', '2026-03'])
const HIST_MONTH_TO_KEY: Record<string, string> = {
  January: '2026-01',
  February: '2026-02',
  March: '2026-03',
}

function distributeHoursToMonth(a: AssignmentBasic, year: number, month: number): number {
  const aStart = new Date(a.start_date + 'T00:00:00')
  const aEnd = new Date(a.end_date + 'T00:00:00')
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const overlapStart = aStart > monthStart ? aStart : monthStart
  const overlapEnd = aEnd < monthEnd ? aEnd : monthEnd
  if (overlapStart > overlapEnd) return 0
  const totalDays = Math.max((aEnd.getTime() - aStart.getTime()) / 86400000 + 1, 1)
  const overlapDays = (overlapEnd.getTime() - overlapStart.getTime()) / 86400000 + 1
  return Math.round((a.total_hours * overlapDays / totalDays) * 100) / 100
}

export function useMarginData() {
  const isPmoAdmin = useIsPmoAdmin()
  const { role } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<AssignmentBasic[]>([])
  const [costRateHistory, setCostRateHistory] = useState<ConsultantCostRate[]>([])
  const [legacyRevenue, setLegacyRevenue] = useState<HistoricalRevenue[]>([])
  const [viewMode, setViewMode] = useState<MarginViewMode>('monthly')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)
  const [selectedYear, setSelectedYear] = useState<string>('2026')
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const yearPickerRef = useRef<HTMLDivElement>(null)

  // Client / project filters
  const [filterClients, setFilterClients] = useState<Set<string>>(new Set())
  const [showClientFilter, setShowClientFilter] = useState(false)
  const clientFilterRef = useRef<HTMLDivElement>(null)
  const [filterProjects, setFilterProjects] = useState<Set<string>>(new Set())
  const [showProjectFilter, setShowProjectFilter] = useState(false)
  const projectFilterRef = useRef<HTMLDivElement>(null)
  const [filterPracticeManagers, setFilterPracticeManagers] = useState<Set<string>>(new Set())
  const [showPMFilter, setShowPMFilter] = useState(false)
  const pmFilterRef = useRef<HTMLDivElement>(null)

  // Drill-down dialog state
  const [drilldown, setDrilldown] = useState<MarginDrilldown | null>(null)

  /* ---------- Data loading ---------- */

  const { loading, error, retry } = useLoadData(async () => {
    const [projData, assignData, crData, legacyData] = await Promise.all([
      api.getProjects({ project_type: 'eq.billable', is_active: 'eq.true' }),
      api.getAssignments(),
      (isPmoAdmin || role === 'finance_viewer') ? api.getCostRates() : Promise.resolve([]),
      api.getHistoricalRevenue({ year: 'eq.2026', month: 'in.(January,February,March)' }, undefined, 1000),
    ])

    setProjects(projData)
    setAssignments(assignData as AssignmentBasic[])
    setCostRateHistory(crData)
    setLegacyRevenue(legacyData)
  }, [], 8000)

  useEffect(() => {
    let mounted = true
    const ts = Date.now()
    const ch1 = supabase
      .channel(`margin-projects-${ts}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => { if (mounted) retry() })
      .subscribe()
    const ch2 = supabase
      .channel(`margin-assignments-${ts}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => { if (mounted) retry() })
      .subscribe()
    const ch3 = supabase
      .channel(`margin-cost-rates-${ts}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultant_cost_rates' }, () => { if (mounted) retry() })
      .subscribe()
    return () => {
      mounted = false
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
      supabase.removeChannel(ch3)
    }
  }, [retry])

  /* ---------- Outside-click for pickers ---------- */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) setMonthPickerOpen(false)
      if (yearPickerRef.current && !yearPickerRef.current.contains(e.target as Node)) setYearPickerOpen(false)
      if (clientFilterRef.current && !clientFilterRef.current.contains(e.target as Node)) setShowClientFilter(false)
      if (projectFilterRef.current && !projectFilterRef.current.contains(e.target as Node)) setShowProjectFilter(false)
      if (pmFilterRef.current && !pmFilterRef.current.contains(e.target as Node)) setShowPMFilter(false)
    }
    if (monthPickerOpen || yearPickerOpen || showClientFilter || showProjectFilter || showPMFilter) {
      document.addEventListener('mousedown', handleClick)
    }
    return () => document.removeEventListener('mousedown', handleClick)
  }, [monthPickerOpen, yearPickerOpen, showClientFilter, showProjectFilter, showPMFilter])

  /* ---------- Available clients & project names ---------- */

  const availableClients = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) set.add(p.client_name)
    return Array.from(set).sort()
  }, [projects])

  const availableProjectNames = useMemo(() => {
    // If clients are filtered, only show projects for those clients
    const filtered = filterClients.size > 0
      ? projects.filter(p => filterClients.has(p.client_name))
      : projects
    return filtered.map(p => ({ id: p.id, label: `${p.client_name} — ${p.project_name}` }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [projects, filterClients])

  const availablePMs = useMemo(() => {
    const set = new Set<string>()
    for (const p of projects) {
      if (p.project_manager) set.add(p.project_manager)
    }
    return Array.from(set).sort()
  }, [projects])

  /* ---------- Filter projects ---------- */

  const filteredProjects = useMemo(() => {
    let result = projects
    if (filterClients.size > 0) {
      result = result.filter(p => filterClients.has(p.client_name))
    }
    if (filterProjects.size > 0) {
      result = result.filter(p => filterProjects.has(p.id))
    }
    if (filterPracticeManagers.size > 0) {
      result = result.filter(p => p.project_manager && filterPracticeManagers.has(p.project_manager))
    }
    return result
  }, [projects, filterClients, filterProjects, filterPracticeManagers])

  // Lookup: SOW → project (used to map legacy revenue rows to Altair projects
  // so filters + drill-down attribution still work for Jan-Mar 2026).
  const projectsBySow = useMemo(() => {
    const map = new Map<string, Project>()
    for (const p of projects) {
      if (p.sow_number) map.set(p.sow_number, p)
    }
    return map
  }, [projects])

  // Apply the same client/project/PM filters to legacy revenue rows.
  // Historical rows whose SOW doesn't map to a Altair project survive only
  // when no filter is active — there's no way to attribute them otherwise.
  const filteredLegacyRevenue = useMemo(() => {
    const hasFilter = filterClients.size > 0 || filterProjects.size > 0 || filterPracticeManagers.size > 0
    if (!hasFilter) return legacyRevenue
    return legacyRevenue.filter(r => {
      const proj = projectsBySow.get(r.sow_number)
      if (!proj) return false
      if (filterClients.size > 0 && !filterClients.has(proj.client_name)) return false
      if (filterProjects.size > 0 && !filterProjects.has(proj.id)) return false
      if (filterPracticeManagers.size > 0) {
        if (!proj.project_manager) return false
        if (!filterPracticeManagers.has(proj.project_manager)) return false
      }
      return true
    })
  }, [legacyRevenue, filterClients, filterProjects, filterPracticeManagers, projectsBySow])

  /* ---------- Consultant cost rate lookup (date-aware) ---------- */

  // Build a map of consultant_id -> sorted rate entries (desc by effective_date)
  const costRatesByConsultant = useMemo(() => {
    const map = new Map<string, Array<{ hourly_rate: number; effective_date: string }>>()
    for (const cr of costRateHistory) {
      if (!map.has(cr.consultant_id)) map.set(cr.consultant_id, [])
      map.get(cr.consultant_id)!.push({ hourly_rate: cr.hourly_rate, effective_date: cr.effective_date })
    }
    // Ensure each array is sorted descending by effective_date
    for (const entries of map.values()) {
      entries.sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    }
    return map
  }, [costRateHistory])

  /* ---------- Build all month keys ---------- */

  const allMonthKeys = useMemo(() => {
    const monthSet = new Set<string>()
    for (const p of filteredProjects) {
      if (!p.sow_amount || !p.engagement_start) continue
      const end = p.engagement_end || p.engagement_start
      for (const m of monthsBetween(p.engagement_start, end)) {
        monthSet.add(m)
      }
    }
    for (const r of filteredLegacyRevenue) {
      const k = HIST_MONTH_TO_KEY[r.month]
      if (k) monthSet.add(k)
    }
    return Array.from(monthSet).sort()
  }, [filteredProjects, filteredLegacyRevenue])

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>()
    for (const m of allMonthKeys) yearSet.add(m.slice(0, 4))
    return Array.from(yearSet).sort()
  }, [allMonthKeys])

  const filteredMonthKeys = useMemo(() => {
    if (selectedYear === 'all') return allMonthKeys
    return allMonthKeys.filter(m => m.startsWith(selectedYear))
  }, [allMonthKeys, selectedYear])

  useEffect(() => {
    if (selectedMonths.length > 0) {
      const valid = selectedMonths.filter(m => filteredMonthKeys.includes(m))
      if (valid.length !== selectedMonths.length) setSelectedMonths(valid)
    }
  }, [filteredMonthKeys, selectedMonths])

  /* ---------- Build month buckets and contribution map ---------- */

  const { monthBuckets, contributionMap } = useMemo(() => {
    const bucketMap = new Map<string, MarginMonthBucket>()
    const cMap = new Map<string, Map<string, MarginProjectContribution>>()

    for (const p of filteredProjects) {
      if (!p.sow_amount || !p.engagement_start) continue
      const end = p.engagement_end || p.engagement_start
      const months = monthsBetween(p.engagement_start, end)
      if (months.length === 0) continue

      const perMonthRevenue = Number(p.sow_amount) / months.length
      const projAssignments = assignments.filter(a => a.project_id === p.id)

      for (const m of months) {
        if (!bucketMap.has(m)) {
          bucketMap.set(m, { key: m, label: formatMonth(m), revenue: 0, cost: 0, margin: 0 })
        }
        const bucket = bucketMap.get(m)!
        const isLegacy = LEGACY_MONTHS.has(m)
        // Legacy months get revenue from historical_revenue below; skip
        // the per-month SOW slice here to avoid double-counting.
        if (!isLegacy) bucket.revenue += perMonthRevenue

        const [y, mo] = m.split('-').map(Number)
        let monthCost = 0
        for (const a of projAssignments) {
          const hours = distributeHoursToMonth(a, y, mo - 1)
          monthCost += hours * getCostRateForMonth(costRatesByConsultant, a.consultant_id, m)
        }
        bucket.cost += monthCost
        bucket.margin = bucket.revenue - bucket.cost

        if (!cMap.has(m)) cMap.set(m, new Map())
        const projMap = cMap.get(m)!
        if (!projMap.has(p.id)) {
          projMap.set(p.id, {
            project_id: p.id,
            client_name: p.client_name,
            project_name: p.project_name,
            sow_amount: isLegacy ? 0 : perMonthRevenue,
            cost: 0,
            margin: 0,
          })
        }
        const contrib = projMap.get(p.id)!
        contrib.cost += monthCost
        contrib.margin = contrib.sow_amount - contrib.cost
      }
    }

    // Overlay legacy revenue from the historical_revenue table.
    for (const r of filteredLegacyRevenue) {
      const m = HIST_MONTH_TO_KEY[r.month]
      if (!m) continue
      if (!bucketMap.has(m)) {
        bucketMap.set(m, { key: m, label: formatMonth(m), revenue: 0, cost: 0, margin: 0 })
      }
      const bucket = bucketMap.get(m)!
      const amount = Number(r.revenue)
      bucket.revenue += amount
      bucket.margin = bucket.revenue - bucket.cost

      if (!cMap.has(m)) cMap.set(m, new Map())
      const projMap = cMap.get(m)!
      const proj = projectsBySow.get(r.sow_number)
      const key = proj?.id ?? `legacy:${r.id}`
      if (!projMap.has(key)) {
        projMap.set(key, {
          project_id: key,
          client_name: proj?.client_name ?? r.client_name,
          project_name: proj?.project_name ?? r.project_name,
          sow_amount: 0,
          cost: 0,
          margin: 0,
        })
      }
      const contrib = projMap.get(key)!
      contrib.sow_amount += amount
      contrib.margin = contrib.sow_amount - contrib.cost
    }

    const flatCMap = new Map<string, MarginProjectContribution[]>()
    for (const [k, projMap] of cMap) flatCMap.set(k, Array.from(projMap.values()))
    return { monthBuckets: Array.from(bucketMap.values()).sort((a, b) => a.key.localeCompare(b.key)), contributionMap: flatCMap }
  }, [filteredProjects, assignments, costRatesByConsultant, filteredLegacyRevenue, projectsBySow])

  /* ---------- Filter & display buckets ---------- */

  const filteredBuckets = useMemo(() => {
    let base = monthBuckets
    if (selectedYear !== 'all') base = base.filter(b => b.key.startsWith(selectedYear))
    if (selectedMonths.length > 0) base = base.filter(b => selectedMonths.includes(b.key))
    return base
  }, [monthBuckets, selectedMonths, selectedYear])

  const displayBuckets = useMemo(() => {
    if (viewMode === 'monthly') return filteredBuckets
    const qMap = new Map<string, MarginMonthBucket>()
    for (const b of filteredBuckets) {
      const qk = quarterKey(b.key)
      if (!qMap.has(qk)) qMap.set(qk, { key: qk, label: qk, revenue: 0, cost: 0, margin: 0 })
      const q = qMap.get(qk)!
      q.revenue += b.revenue
      q.cost += b.cost
      q.margin += b.margin
    }
    return Array.from(qMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [filteredBuckets, viewMode])

  const displayContributionMap = useMemo(() => {
    if (viewMode === 'monthly') return contributionMap
    const qMap = new Map<string, MarginProjectContribution[]>()
    for (const b of filteredBuckets) {
      const qk = quarterKey(b.key)
      const entries = contributionMap.get(b.key) || []
      if (!qMap.has(qk)) qMap.set(qk, [])
      qMap.get(qk)!.push(...entries)
    }
    const merged = new Map<string, MarginProjectContribution[]>()
    for (const [qk, contribs] of qMap) {
      const projMap = new Map<string, MarginProjectContribution>()
      for (const c of contribs) {
        if (!projMap.has(c.project_id)) { projMap.set(c.project_id, { ...c }) }
        else {
          const ex = projMap.get(c.project_id)!
          ex.sow_amount += c.sow_amount; ex.cost += c.cost; ex.margin = ex.sow_amount - ex.cost
        }
      }
      merged.set(qk, Array.from(projMap.values()))
    }
    return merged
  }, [contributionMap, filteredBuckets, viewMode])

  /* ---------- Totals ---------- */

  const totals = useMemo(() => {
    const t = { revenue: 0, cost: 0, margin: 0 }
    for (const b of displayBuckets) { t.revenue += b.revenue; t.cost += b.cost; t.margin += b.margin }
    return t
  }, [displayBuckets])

  const totalMarginPct = totals.revenue > 0 ? (totals.margin / totals.revenue) * 100 : null

  const openDrilldown = useCallback((bucketKey: string, bucketLabel: string) => {
    const entries = displayContributionMap.get(bucketKey) || []
    setDrilldown({ label: bucketLabel, contributions: entries })
  }, [displayContributionMap])

  const hasActiveFilters = filterClients.size > 0 || filterProjects.size > 0 || filterPracticeManagers.size > 0

  const getFilters = useCallback(() => ({
    viewMode,
    selectedYear,
    selectedMonths,
    filterClients: [...filterClients],
    filterProjects: [...filterProjects],
    filterPracticeManagers: [...filterPracticeManagers],
  }), [viewMode, selectedYear, selectedMonths, filterClients, filterProjects, filterPracticeManagers])

  const applyFilters = useCallback((filters: Record<string, unknown>) => {
    if (filters.viewMode !== undefined) setViewMode(filters.viewMode as MarginViewMode)
    if (filters.selectedYear !== undefined) setSelectedYear(filters.selectedYear as string)
    if (filters.selectedMonths !== undefined) setSelectedMonths(filters.selectedMonths as string[])
    if (filters.filterClients !== undefined) setFilterClients(new Set(filters.filterClients as string[]))
    if (filters.filterProjects !== undefined) setFilterProjects(new Set(filters.filterProjects as string[]))
    if (filters.filterPracticeManagers !== undefined) setFilterPracticeManagers(new Set(filters.filterPracticeManagers as string[]))
  }, [])

  return {
    isPmoAdmin,
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
    filterClients,
    setFilterClients,
    showClientFilter,
    setShowClientFilter,
    clientFilterRef,
    filterProjects,
    setFilterProjects,
    showProjectFilter,
    setShowProjectFilter,
    projectFilterRef,
    filterPracticeManagers,
    setFilterPracticeManagers,
    showPMFilter,
    setShowPMFilter,
    pmFilterRef,
    drilldown,
    setDrilldown,
    availableClients,
    availableProjectNames,
    availablePMs,
    filteredMonthKeys,
    availableYears,
    displayBuckets,
    displayContributionMap,
    openDrilldown,
    totals,
    totalMarginPct,
    hasActiveFilters,
    getFilters,
    applyFilters,
  }
}
