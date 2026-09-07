import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { COLUMNS, UNASSIGNED_KEY, matchesDateRange, isDoneAndStale } from '../lib/kanbanUtils'
import { KANBAN_DONE_HIDE_AFTER_DAYS } from '../lib/constants'
import type { Project, Assignment } from '../types/database'

export function useKanbanFilters(projects: Project[], assignments: Assignment[]) {
  // Filters
  const [filterPMs, setFilterPMs] = useState<string[]>([])
  const [showPMFilter, setShowPMFilter] = useState(false)
  const pmFilterRef = useRef<HTMLDivElement>(null)

  const [filterClients, setFilterClients] = useState<string[]>([])
  const [showClientFilter, setShowClientFilter] = useState(false)
  const clientFilterRef = useRef<HTMLDivElement>(null)

  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [searchText, setSearchText] = useState('')

  // Swimlane collapse state: key = pm name or "__unassigned__"
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set())

  // Sub-row collapse state: key = "pmKey__ready" or "pmKey__booted"
  const [collapsedSubRows, setCollapsedSubRows] = useState<Set<string>>(new Set())

  // ─── Outside-click for dropdowns ─────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pmFilterRef.current && !pmFilterRef.current.contains(e.target as Node)) setShowPMFilter(false)
      if (clientFilterRef.current && !clientFilterRef.current.contains(e.target as Node)) setShowClientFilter(false)
    }
    if (showPMFilter || showClientFilter) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showPMFilter, showClientFilter])

  // ─── Derived data ────────────────────────────────────────────────

  const consultantCountByProject = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of assignments) {
      const key = a.project_id
      if (!counts[key]) counts[key] = 0
      counts[key]++
    }
    return counts
  }, [assignments])

  const allPMs = useMemo(
    () => Array.from(new Set(projects.map(p => p.project_manager).filter((v): v is string => !!v))).sort(),
    [projects],
  )

  const allClients = useMemo(
    () => Array.from(new Set(projects.map(p => p.client_name))).sort(),
    [projects],
  )

  const filteredProjects = useMemo(() => {
    const now = Date.now()
    return projects.filter(p => {
      if (p.project_type === 'pto' || p.project_type === 'non_billable') return false
      // Hide Done projects N days after done_at. The archive RPC still fully archives at 90 days
      // and remains the source of truth for is_active; this is purely a Kanban display filter.
      if (isDoneAndStale(p, KANBAN_DONE_HIDE_AFTER_DAYS, now)) return false
      if (filterPMs.length > 0 && !filterPMs.includes(p.project_manager || '')) return false
      if (filterClients.length > 0 && !filterClients.includes(p.client_name)) return false
      if (!matchesDateRange(p, filterDateStart, filterDateEnd)) return false
      if (searchText) {
        const q = searchText.toLowerCase()
        const haystack = `${p.client_name} ${p.project_name} ${p.altair_uid}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [projects, filterPMs, filterClients, filterDateStart, filterDateEnd, searchText])

  // Group by PM then by column
  const pmGroups = useMemo(() => {
    const map = new Map<string, Project[]>()
    // "Unassigned" first
    map.set(UNASSIGNED_KEY, [])
    for (const p of filteredProjects) {
      const key = p.project_manager || UNASSIGNED_KEY
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [filteredProjects])

  // Sorted PM keys: Unassigned first (only if non-empty), then alphabetical
  const sortedPMKeys = useMemo(() => {
    const keys = Array.from(pmGroups.keys()).filter(
      k => k !== UNASSIGNED_KEY || (pmGroups.get(k)?.length ?? 0) > 0
    )
    return keys.sort((a, b) => {
      if (a === UNASSIGNED_KEY) return -1
      if (b === UNASSIGNED_KEY) return 1
      return a.localeCompare(b)
    })
  }, [pmGroups])

  // ─── Saved views ─────────────────────────────────────────────────

  const hasActiveFilters = useMemo(() =>
    filterPMs.length > 0 || filterClients.length > 0 || !!filterDateStart || !!filterDateEnd || searchText.length > 0,
    [filterPMs, filterClients, filterDateStart, filterDateEnd, searchText],
  )

  const getFilters = useCallback(() => ({
    filterPMs,
    filterClients,
    filterDateStart,
    filterDateEnd,
    searchText,
  }), [filterPMs, filterClients, filterDateStart, filterDateEnd, searchText])

  const applyFilters = useCallback((filters: Record<string, unknown>) => {
    if (filters.filterPMs !== undefined) setFilterPMs(filters.filterPMs as string[])
    if (filters.filterClients !== undefined) setFilterClients(filters.filterClients as string[])
    if (filters.filterDateStart !== undefined) setFilterDateStart(filters.filterDateStart as string)
    if (filters.filterDateEnd !== undefined) setFilterDateEnd(filters.filterDateEnd as string)
    if (filters.searchText !== undefined) setSearchText(filters.searchText as string)
  }, [])

  // Column card counts
  const columnCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const col of COLUMNS) {
      counts[col.key] = filteredProjects.filter(p => col.statuses.includes(p.status)).length
    }
    return counts
  }, [filteredProjects])

  // ─── Swimlane toggle ─────────────────────────────────────────────

  const toggleLane = useCallback((pmKey: string) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev)
      if (next.has(pmKey)) next.delete(pmKey)
      else next.add(pmKey)
      return next
    })
  }, [])

  const toggleSubRow = useCallback((key: string) => {
    setCollapsedSubRows(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  return {
    // Filter state + setters
    filterPMs, setFilterPMs,
    showPMFilter, setShowPMFilter,
    pmFilterRef,
    filterClients, setFilterClients,
    showClientFilter, setShowClientFilter,
    clientFilterRef,
    filterDateStart, setFilterDateStart,
    filterDateEnd, setFilterDateEnd,
    searchText, setSearchText,
    // Collapse state
    collapsedLanes, toggleLane,
    collapsedSubRows, toggleSubRow,
    // Derived
    consultantCountByProject,
    allPMs, allClients,
    filteredProjects,
    pmGroups, sortedPMKeys,
    columnCounts,
    // Saved views
    hasActiveFilters, getFilters, applyFilters,
  }
}
