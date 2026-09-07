import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/csv'
import { useLoadData } from '../lib/useLoadData'
import {
  HOURS_PER_DAY,
  getWorkingDaysInMonth,
  getHolidaysInMonth,
  distributeHoursToMonth,
  formatMonth,
} from '../lib/dateUtils'
import { NON_RESOURCEABLE_TITLES, NON_CAPACITY_TITLES } from '../types/database'
import type { Consultant, Holiday } from '../types/database'
import type { AssignmentFlat, MonthCell, DrilldownData } from '../types/utilization'

/* ------------------------------------------------------------------ */
/*  Hook return type                                                   */
/* ------------------------------------------------------------------ */

export interface UseUtilizationDataReturn {
  /* raw data */
  consultants: Consultant[]
  holidays: Holiday[]
  assignments: AssignmentFlat[]

  /* loading */
  loading: boolean
  error: string | null
  retry: () => void

  /* filter state */
  selectedYear: string
  setSelectedYear: React.Dispatch<React.SetStateAction<string>>
  filterManagers: string[]
  setFilterManagers: React.Dispatch<React.SetStateAction<string[]>>
  filterConsultants: string[]
  setFilterConsultants: React.Dispatch<React.SetStateAction<string[]>>

  /* picker open state */
  yearPickerOpen: boolean
  setYearPickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  yearPickerRef: React.RefObject<HTMLDivElement>
  managerPickerOpen: boolean
  setManagerPickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  managerPickerRef: React.RefObject<HTMLDivElement>
  consultantPickerOpen: boolean
  setConsultantPickerOpen: React.Dispatch<React.SetStateAction<boolean>>
  consultantPickerRef: React.RefObject<HTMLDivElement>

  /* drilldown & info modals */
  drilldown: DrilldownData | null
  setDrilldown: React.Dispatch<React.SetStateAction<DrilldownData | null>>
  showInfo: boolean
  setShowInfo: React.Dispatch<React.SetStateAction<boolean>>

  /* sort */
  sortCol: string
  sortAsc: boolean
  handleSort: (col: string) => void

  /* derived data */
  availableYears: string[]
  monthKeys: string[]
  managers: string[]
  filteredConsultants: Consultant[]
  currentMonthKey: string
  gridData: Map<string, Map<string, MonthCell>>
  ytdData: Map<string, { billable: number; available: number; utilization: number }>
  orgAverages: Map<string, number>
  orgYtd: number
  sortedConsultants: Consultant[]
  hasActiveFilters: boolean

  /* actions */
  openDrilldown: (eng: Consultant, mk: string) => void
  exportCsv: () => void
  getFilters: () => Record<string, unknown>
  applyFilters: (filters: Record<string, unknown>) => void
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useUtilizationData(): UseUtilizationDataReturn {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [assignments, setAssignments] = useState<AssignmentFlat[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])

  // Filters
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()))
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const yearPickerRef = useRef<HTMLDivElement>(null!)
  const [filterManagers, setFilterManagers] = useState<string[]>([])
  const [managerPickerOpen, setManagerPickerOpen] = useState(false)
  const managerPickerRef = useRef<HTMLDivElement>(null!)
  const [filterConsultants, setFilterConsultants] = useState<string[]>([])
  const [consultantPickerOpen, setConsultantPickerOpen] = useState(false)
  const consultantPickerRef = useRef<HTMLDivElement>(null!)

  // Drilldown & info
  const [drilldown, setDrilldown] = useState<DrilldownData | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  // Sort
  const [sortCol, setSortCol] = useState<string>('name')
  const [sortAsc, setSortAsc] = useState(true)

  /* ---------- Data loading ---------- */

  const { loading, error, retry } = useLoadData(async () => {
    const [engData, assignData, projectData, holData] = await Promise.all([
      api.getConsultants({ is_active: 'eq.true' }),
      api.getAssignments(),
      api.getProjects(),
      api.getHolidays(),
    ])

    const projectMap = new Map(projectData.map(p => [p.id, p]))

    setConsultants(engData.filter(e => {
      const title = e.title || ''
      return !NON_RESOURCEABLE_TITLES.has(title) && !NON_CAPACITY_TITLES.has(title)
    }))
    setAssignments(assignData.map(a => {
      const proj = projectMap.get(a.project_id)
      return {
        consultant_id: a.consultant_id,
        start_date: a.start_date,
        end_date: a.end_date,
        total_hours: a.total_hours,
        project_type: proj?.project_type ?? null,
        client_name: proj?.client_name ?? '',
        project_name: proj?.project_name ?? '',
      }
    }))
    setHolidays(holData)
  }, [], 8000)

  /* ---------- Realtime ---------- */

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`utilization-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => { if (mounted) retry() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  /* ---------- Outside-click for pickers ---------- */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (yearPickerRef.current && !yearPickerRef.current.contains(e.target as Node)) setYearPickerOpen(false)
      if (managerPickerRef.current && !managerPickerRef.current.contains(e.target as Node)) setManagerPickerOpen(false)
      if (consultantPickerRef.current && !consultantPickerRef.current.contains(e.target as Node)) setConsultantPickerOpen(false)
    }
    if (yearPickerOpen || managerPickerOpen || consultantPickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [yearPickerOpen, managerPickerOpen, consultantPickerOpen])

  /* ---------- Derived data ---------- */

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>()
    yearSet.add(String(new Date().getFullYear()))
    for (const a of assignments) {
      yearSet.add(a.start_date.slice(0, 4))
      yearSet.add(a.end_date.slice(0, 4))
    }
    return Array.from(yearSet).sort()
  }, [assignments])

  const monthKeys = useMemo(() => {
    const year = parseInt(selectedYear)
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  }, [selectedYear])

  const managers = useMemo(() => {
    return Array.from(new Set(consultants.map(e => e.manager).filter(Boolean) as string[])).sort()
  }, [consultants])

  const filteredConsultants = useMemo(() => {
    return consultants.filter(e => {
      if (filterManagers.length > 0 && !filterManagers.includes(e.manager || '')) return false
      if (filterConsultants.length > 0 && !filterConsultants.includes(e.id)) return false
      return true
    })
  }, [consultants, filterManagers, filterConsultants])

  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  /* ---------- Compute utilization grid ---------- */

  const gridData = useMemo(() => {
    const data = new Map<string, Map<string, MonthCell>>()
    for (const eng of filteredConsultants) {
      const engData = new Map<string, MonthCell>()
      for (const mk of monthKeys) {
        const [y, m] = mk.split('-').map(Number)
        const workingDays = getWorkingDaysInMonth(y, m - 1)
        const holidayDays = getHolidaysInMonth(holidays, eng.country, y, m - 1)
        const availableHours = (workingDays - holidayDays) * HOURS_PER_DAY

        let billableHours = 0
        for (const a of assignments) {
          if (a.consultant_id !== eng.id) continue
          if (a.project_type !== 'billable') continue
          billableHours += distributeHoursToMonth(a, y, m - 1)
        }

        engData.set(mk, {
          billableHours: Math.round(billableHours * 10) / 10,
          availableHours: Math.round(availableHours * 10) / 10,
          utilization: availableHours > 0 ? Math.round((billableHours / availableHours) * 100) : 0,
          isFuture: mk > currentMonthKey,
        })
      }
      data.set(eng.id, engData)
    }
    return data
  }, [filteredConsultants, monthKeys, assignments, holidays, currentMonthKey])

  /* ---------- YTD per consultant ---------- */

  const ytdData = useMemo(() => {
    const result = new Map<string, { billable: number; available: number; utilization: number }>()
    const currentYear = new Date().getFullYear()
    const selectedYearNum = parseInt(selectedYear)

    for (const eng of filteredConsultants) {
      const engGrid = gridData.get(eng.id)
      if (!engGrid) continue
      let totalBillable = 0
      let totalAvailable = 0
      for (const [mk, cell] of engGrid) {
        // YTD: months up through current month, or all months if viewing a past year
        if (selectedYearNum < currentYear || mk <= currentMonthKey) {
          totalBillable += cell.billableHours
          totalAvailable += cell.availableHours
        }
      }
      result.set(eng.id, {
        billable: Math.round(totalBillable * 10) / 10,
        available: Math.round(totalAvailable * 10) / 10,
        utilization: totalAvailable > 0 ? Math.round((totalBillable / totalAvailable) * 100) : 0,
      })
    }
    return result
  }, [filteredConsultants, gridData, selectedYear, currentMonthKey])

  /* ---------- Org averages ---------- */

  const orgAverages = useMemo(() => {
    const result = new Map<string, number>()
    for (const mk of monthKeys) {
      let totalBillable = 0
      let totalAvailable = 0
      for (const eng of filteredConsultants) {
        const cell = gridData.get(eng.id)?.get(mk)
        if (cell) {
          totalBillable += cell.billableHours
          totalAvailable += cell.availableHours
        }
      }
      result.set(mk, totalAvailable > 0 ? Math.round((totalBillable / totalAvailable) * 100) : 0)
    }
    return result
  }, [monthKeys, filteredConsultants, gridData])

  const orgYtd = useMemo(() => {
    let totalBillable = 0
    let totalAvailable = 0
    for (const eng of filteredConsultants) {
      const ytd = ytdData.get(eng.id)
      if (ytd) {
        totalBillable += ytd.billable
        totalAvailable += ytd.available
      }
    }
    return totalAvailable > 0 ? Math.round((totalBillable / totalAvailable) * 100) : 0
  }, [filteredConsultants, ytdData])

  /* ---------- Sorting ---------- */

  const sortedConsultants = useMemo(() => {
    const sorted = [...filteredConsultants]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'name') {
        cmp = a.full_name.localeCompare(b.full_name)
      } else if (sortCol === 'ytd') {
        cmp = (ytdData.get(a.id)?.utilization ?? 0) - (ytdData.get(b.id)?.utilization ?? 0)
      } else {
        cmp = (gridData.get(a.id)?.get(sortCol)?.utilization ?? 0) - (gridData.get(b.id)?.get(sortCol)?.utilization ?? 0)
      }
      return sortAsc ? cmp : -cmp
    })
    return sorted
  }, [filteredConsultants, sortCol, sortAsc, ytdData, gridData])

  /* ---------- Handlers ---------- */

  function handleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(col === 'name') }
  }

  function openDrilldown(eng: Consultant, mk: string) {
    const cell = gridData.get(eng.id)?.get(mk)
    if (!cell) return
    const [y, m] = mk.split('-').map(Number)
    const workingDays = getWorkingDaysInMonth(y, m - 1)
    const holidayDays = getHolidaysInMonth(holidays, eng.country, y, m - 1)

    const engAssignments = assignments
      .filter(a => a.consultant_id === eng.id)
      .map(a => {
        const hours = distributeHoursToMonth(a, y, m - 1)
        if (hours === 0) return null
        return {
          client: a.client_name,
          project: a.project_name,
          hours: Math.round(hours * 10) / 10,
          type: a.project_type || 'billable',
        }
      })
      .filter(Boolean) as DrilldownData['assignments']

    setDrilldown({
      consultantName: eng.full_name,
      monthLabel: formatMonth(mk),
      billableHours: cell.billableHours,
      availableHours: cell.availableHours,
      utilization: cell.utilization,
      workingDays,
      holidayDays,
      assignments: engAssignments.sort((a, b) => b.hours - a.hours),
    })
  }

  const hasActiveFilters = filterManagers.length > 0 || filterConsultants.length > 0

  const getFilters = useCallback(() => ({
    selectedYear,
    filterManagers,
    filterConsultants,
    sortCol,
    sortAsc,
  }), [selectedYear, filterManagers, filterConsultants, sortCol, sortAsc])

  const applyFilters = useCallback((filters: Record<string, unknown>) => {
    if (filters.selectedYear !== undefined) setSelectedYear(filters.selectedYear as string)
    if (filters.filterManagers !== undefined) setFilterManagers(filters.filterManagers as string[])
    if (filters.filterConsultants !== undefined) setFilterConsultants(filters.filterConsultants as string[])
    if (filters.sortCol !== undefined) setSortCol(filters.sortCol as string)
    if (filters.sortAsc !== undefined) setSortAsc(filters.sortAsc as boolean)
  }, [])

  function exportCsv() {
    const rows: Record<string, string | number>[] = []
    for (const eng of sortedConsultants) {
      const row: Record<string, string | number> = { Consultant: eng.full_name, Manager: eng.manager || '' }
      for (const mk of monthKeys) {
        const cell = gridData.get(eng.id)?.get(mk)
        row[formatMonth(mk)] = cell ? `${cell.utilization}%` : '0%'
      }
      const ytd = ytdData.get(eng.id)
      row['YTD'] = ytd ? `${ytd.utilization}%` : '0%'
      rows.push(row)
    }
    downloadCsv(rows, `altair-utilization-${selectedYear}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return {
    consultants,
    holidays,
    assignments,
    loading,
    error,
    retry,
    selectedYear,
    setSelectedYear,
    filterManagers,
    setFilterManagers,
    filterConsultants,
    setFilterConsultants,
    yearPickerOpen,
    setYearPickerOpen,
    yearPickerRef,
    managerPickerOpen,
    setManagerPickerOpen,
    managerPickerRef,
    consultantPickerOpen,
    setConsultantPickerOpen,
    consultantPickerRef,
    drilldown,
    setDrilldown,
    showInfo,
    setShowInfo,
    sortCol,
    sortAsc,
    handleSort,
    availableYears,
    monthKeys,
    managers,
    filteredConsultants,
    currentMonthKey,
    gridData,
    ytdData,
    orgAverages,
    orgYtd,
    sortedConsultants,
    hasActiveFilters,
    openDrilldown,
    exportCsv,
    getFilters,
    applyFilters,
  }
}
