import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { HOURS_PER_DAY, getWorkingDaysInMonth, getHolidaysInMonth, distributeHoursToMonth, formatMonth } from '../lib/dateUtils'
import { buildQuarterlyBuckets, computeTotals } from '../lib/capacityUtils'
import type { Consultant, Holiday, PassionArea, Project } from '../types/database'
import { NON_RESOURCEABLE_TITLES, NON_CAPACITY_TITLES } from '../types/database'
import type { AssignmentBasic, MonthBucket, ViewMode, ValueMode } from '../types/capacity'

export function useCapacityData() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [assignments, setAssignments] = useState<AssignmentBasic[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [passionAreas, setPassionAreas] = useState<PassionArea[]>([])
  // Filters
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [valueMode, setValueMode] = useState<ValueMode>('hours')
  const [selectedYear, setSelectedYear] = useState<string>('2026')
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const yearPickerRef = useRef<HTMLDivElement>(null)
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)
  const [selectedPassionAreas, setSelectedPassionAreas] = useState<string[]>([])
  const [passionAreaPickerOpen, setPassionAreaPickerOpen] = useState(false)
  const passionAreaPickerRef = useRef<HTMLDivElement>(null)
  const [showInfo, setShowInfo] = useState(false)

  /* ---------- Data loading ---------- */

  const { loading, error, retry } = useLoadData(async () => {
    const [engData, assignData, projectData, holData, paData] = await Promise.all([
      api.getConsultants({ is_active: 'eq.true' }),
      api.getAssignments(),
      api.getProjects(),
      api.getHolidays(),
      api.getPassionAreas(),
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
        project_id: a.project_id,
        start_date: a.start_date,
        end_date: a.end_date,
        total_hours: a.total_hours,
        project_type: proj?.project_type ?? null,
        project_name: proj?.project_name ?? null,
        client_name: proj?.client_name ?? null,
      }
    }))
    setProjects(projectData)
    setHolidays(holData)
    setPassionAreas(paData.filter(p => p.is_active))
  }, [], 8000)

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`capacity-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => { if (mounted) retry() })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  /* ---------- Outside-click for pickers ---------- */

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target as Node)) {
        setMonthPickerOpen(false)
      }
      if (yearPickerRef.current && !yearPickerRef.current.contains(e.target as Node)) {
        setYearPickerOpen(false)
      }
      if (passionAreaPickerRef.current && !passionAreaPickerRef.current.contains(e.target as Node)) {
        setPassionAreaPickerOpen(false)
      }
    }
    if (monthPickerOpen || yearPickerOpen || passionAreaPickerOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [monthPickerOpen, yearPickerOpen, passionAreaPickerOpen])

  /* ---------- Filtered consultants by passion area ---------- */

  const filteredConsultants = useMemo(() => {
    if (selectedPassionAreas.length === 0) return consultants
    return consultants.filter(e => e.passion_area && selectedPassionAreas.includes(e.passion_area))
  }, [consultants, selectedPassionAreas])

  const filteredConsultantIds = useMemo(() => new Set(filteredConsultants.map(e => e.id)), [filteredConsultants])

  const filteredAssignments = useMemo(() => {
    if (selectedPassionAreas.length === 0) return assignments
    return assignments.filter(a => filteredConsultantIds.has(a.consultant_id))
  }, [assignments, selectedPassionAreas, filteredConsultantIds])

  /* ---------- Build all month keys from assignments + current year ---------- */

  const allMonthKeys = useMemo(() => {
    const monthSet = new Set<string>()
    const now = new Date()
    for (let m = 0; m < 12; m++) {
      const key = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`
      monthSet.add(key)
    }
    for (const a of assignments) {
      const start = new Date(a.start_date + 'T00:00:00')
      const end = new Date(a.end_date + 'T00:00:00')
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
        monthSet.add(key)
        cursor.setMonth(cursor.getMonth() + 1)
      }
    }
    return Array.from(monthSet).sort()
  }, [assignments])

  const availableYears = useMemo(() => {
    const yearSet = new Set<string>()
    for (const m of allMonthKeys) {
      yearSet.add(m.slice(0, 4))
    }
    return Array.from(yearSet).sort()
  }, [allMonthKeys])

  const filteredMonthKeys = useMemo(() => {
    if (selectedYear === 'all') return allMonthKeys
    return allMonthKeys.filter(m => m.startsWith(selectedYear))
  }, [allMonthKeys, selectedYear])

  // Clear selected months when year changes and they fall outside the filtered set
  useEffect(() => {
    if (selectedMonths.length > 0) {
      const valid = selectedMonths.filter(m => filteredMonthKeys.includes(m))
      if (valid.length !== selectedMonths.length) {
        setSelectedMonths(valid)
      }
    }
  }, [filteredMonthKeys, selectedMonths])

  /* ---------- Compute month buckets ---------- */

  // Consultant name lookup
  const consultantNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of consultants) m.set(e.id, e.full_name)
    return m
  }, [consultants])

  // Per-project bill rate: sow_amount / max(planned_hours, total_assigned_hours)
  // Matches Revenue dashboard's implied-rate formula so both views agree in $.
  const projectBillRateMap = useMemo(() => {
    const totalAssignedByProject = new Map<string, number>()
    for (const a of assignments) {
      if (a.project_type !== 'billable') continue
      totalAssignedByProject.set(a.project_id, (totalAssignedByProject.get(a.project_id) || 0) + Number(a.total_hours || 0))
    }
    const rates = new Map<string, number>()
    for (const p of projects) {
      if (!p.sow_amount) continue
      const planned = Number(p.planned_hours) || 0
      const assigned = totalAssignedByProject.get(p.id) || 0
      const denom = Math.max(planned, assigned)
      if (denom <= 0) continue
      const rate = Number(p.sow_amount) / denom
      if (isFinite(rate) && rate > 0) rates.set(p.id, rate)
    }
    return rates
  }, [projects, assignments])

  const monthBuckets = useMemo((): MonthBucket[] => {
    const buckets: MonthBucket[] = []

    for (const mk of allMonthKeys) {
      const [y, m] = mk.split('-').map(Number)
      const year = y
      const month = m - 1 // zero-based

      // Pre-compute PTO hours per consultant for this month
      const ptoByConsultant = new Map<string, number>()
      for (const a of filteredAssignments) {
        if (a.project_type !== 'pto') continue
        const ptoHours = distributeHoursToMonth(a, year, month)
        if (ptoHours > 0) {
          ptoByConsultant.set(a.consultant_id, (ptoByConsultant.get(a.consultant_id) || 0) + ptoHours)
        }
      }

      let totalCapacity = 0
      const capacityDetail: MonthBucket['capacityDetail'] = []
      for (const eng of filteredConsultants) {
        if (eng.hire_date) {
          const monthEnd = new Date(year, month + 1, 0)
          const hireDt = new Date(eng.hire_date + 'T00:00:00')
          if (monthEnd < hireDt) continue
        }
        const workingDays = getWorkingDaysInMonth(year, month)
        const holidayDays = getHolidaysInMonth(holidays, eng.country, year, month)
        const utilTarget = (eng.utilization_target ?? 80) / 100
        const rawHours = (workingDays - holidayDays) * HOURS_PER_DAY * utilTarget
        const ptoHours = ptoByConsultant.get(eng.id) || 0
        const hours = Math.max(rawHours - ptoHours, 0)
        totalCapacity += hours
        if (hours > 0 || ptoHours > 0) capacityDetail.push({ consultantId: eng.id, consultantName: eng.full_name, hours })
      }

      let totalAssigned = 0
      let totalAssignedRevenue = 0
      const assignedDetail: MonthBucket['assignedDetail'] = []
      for (const a of filteredAssignments) {
        if (a.project_type !== 'billable') continue
        const hours = distributeHoursToMonth(a, year, month)
        if (hours > 0) {
          totalAssigned += hours
          const rate = projectBillRateMap.get(a.project_id) || 0
          const revenue = hours * rate
          totalAssignedRevenue += revenue
          assignedDetail.push({
            consultantId: a.consultant_id,
            consultantName: consultantNameMap.get(a.consultant_id) || 'Unknown',
            projectName: a.project_name || 'Unknown',
            clientName: a.client_name || '',
            hours,
            revenue,
          })
        }
      }

      buckets.push({
        key: mk,
        label: formatMonth(mk),
        capacity: Math.round(totalCapacity * 10) / 10,
        assigned: Math.round(totalAssigned * 10) / 10,
        assignedRevenue: Math.round(totalAssignedRevenue * 100) / 100,
        capacityDetail: capacityDetail.sort((a, b) => a.consultantName.localeCompare(b.consultantName)),
        assignedDetail: assignedDetail.sort((a, b) => a.consultantName.localeCompare(b.consultantName)),
      })
    }

    return buckets
  }, [allMonthKeys, filteredConsultants, filteredAssignments, holidays, consultantNameMap, projectBillRateMap])

  /* ---------- Filter buckets ---------- */

  const filteredBuckets = useMemo(() => {
    let base = monthBuckets
    if (selectedYear !== 'all') {
      base = base.filter(b => b.key.startsWith(selectedYear))
    }
    if (selectedMonths.length > 0) {
      base = base.filter(b => selectedMonths.includes(b.key))
    }
    return base
  }, [monthBuckets, selectedYear, selectedMonths])

  /* ---------- Display buckets (monthly / quarterly) ---------- */

  const displayBuckets = useMemo(() => {
    if (viewMode === 'monthly') return filteredBuckets
    return buildQuarterlyBuckets(filteredBuckets)
  }, [filteredBuckets, viewMode])

  /* ---------- Totals for summary cards ---------- */

  const totals = useMemo(() => computeTotals(displayBuckets), [displayBuckets])

  /* ---------- Chart max ---------- */

  const maxVal = useMemo(() => {
    let max = 0
    for (const b of displayBuckets) {
      max = Math.max(max, b.capacity, b.assigned)
    }
    return max || 1
  }, [displayBuckets])

  const hasActiveFilters = selectedMonths.length > 0 || selectedPassionAreas.length > 0

  const getFilters = useCallback(() => ({
    viewMode,
    valueMode,
    selectedYear,
    selectedMonths,
    selectedPassionAreas,
  }), [viewMode, valueMode, selectedYear, selectedMonths, selectedPassionAreas])

  const applyFilters = useCallback((filters: Record<string, unknown>) => {
    if (filters.viewMode !== undefined) setViewMode(filters.viewMode as ViewMode)
    if (filters.valueMode !== undefined) setValueMode(filters.valueMode as ValueMode)
    if (filters.selectedYear !== undefined) setSelectedYear(filters.selectedYear as string)
    if (filters.selectedMonths !== undefined) setSelectedMonths(filters.selectedMonths as string[])
    if (filters.selectedPassionAreas !== undefined) setSelectedPassionAreas(filters.selectedPassionAreas as string[])
  }, [])

  return {
    // State
    viewMode, setViewMode,
    valueMode, setValueMode,
    selectedYear, setSelectedYear,
    yearPickerOpen, setYearPickerOpen,
    yearPickerRef,
    selectedMonths, setSelectedMonths,
    monthPickerOpen, setMonthPickerOpen,
    monthPickerRef,
    selectedPassionAreas, setSelectedPassionAreas,
    passionAreaPickerOpen, setPassionAreaPickerOpen,
    passionAreaPickerRef,
    passionAreas,
    showInfo, setShowInfo,
    // Computed
    availableYears,
    filteredMonthKeys,
    displayBuckets,
    totals,
    maxVal,
    hasActiveFilters,
    // Callbacks
    getFilters,
    applyFilters,
    // Loading
    loading, error, retry,
  }
}
