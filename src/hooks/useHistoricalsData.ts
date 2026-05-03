import { useEffect, useState, useMemo } from 'react'
import { api } from '../lib/api'
import { useIsReadOnly } from '../lib/permissions'

export interface HistoricalRow {
  id: string
  year: number
  month: string
  client_name: string
  project_name: string
  sow_number: string
  revenue: number
}

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export type SortField = 'year' | 'month' | 'client_name' | 'project_name' | 'sow_number' | 'revenue'
type SortDir = 'asc' | 'desc'

export function useHistoricalsData() {
  const canWrite = !useIsReadOnly()
  const [rows, setRows] = useState<HistoricalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Multi-select filters
  const [selectedYears, setSelectedYears] = useState<Set<string>>(new Set())
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set())
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [sowFilter, setSowFilter] = useState('')
  const [search, setSearch] = useState('')

  // Sorting
  const [sortField, setSortField] = useState<SortField>('year')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // View toggle
  const [view, setView] = useState<'table' | 'chart'>('chart')

  // Fetch ALL rows (paginate past the 1000-row default)
  useEffect(() => {
    if (!canWrite) return
    async function loadAll() {
      const PAGE = 1000
      let allRows: HistoricalRow[] = []
      let offset = 0
      let done = false
      while (!done) {
        const page = await api.getHistoricalRevenue(
          undefined,
          'year.asc',
          PAGE,
          offset,
        ) as unknown as HistoricalRow[]
        allRows = allRows.concat(page)
        if (page.length < PAGE) done = true
        else offset += PAGE
      }
      setRows(allRows)
      setLoading(false)
    }
    loadAll().catch(err => {
      setError(err.message || 'Failed to load historical data')
      setLoading(false)
    })
  }, [canWrite])

  // Derived filter options
  const years = useMemo(() => [...new Set(rows.map(r => String(r.year)))].sort(), [rows])
  const months = useMemo(() => {
    const present = new Set(rows.map(r => r.month))
    return MONTH_ORDER.filter(m => present.has(m))
  }, [rows])
  const clients = useMemo(() => [...new Set(rows.map(r => r.client_name))].sort(), [rows])

  // Filtered rows
  const filtered = useMemo(() => {
    let result = rows
    if (selectedYears.size > 0) result = result.filter(r => selectedYears.has(String(r.year)))
    if (selectedMonths.size > 0) result = result.filter(r => selectedMonths.has(r.month))
    if (selectedClients.size > 0) result = result.filter(r => selectedClients.has(r.client_name))
    if (sowFilter) result = result.filter(r => r.sow_number.toLowerCase().includes(sowFilter.toLowerCase()))
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.client_name.toLowerCase().includes(q) ||
        r.project_name.toLowerCase().includes(q) ||
        r.sow_number.toLowerCase().includes(q)
      )
    }
    return result
  }, [rows, selectedYears, selectedMonths, selectedClients, sowFilter, search])

  // Sorted rows (for table)
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortField === 'month') {
        cmp = MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month)
      } else if (sortField === 'revenue' || sortField === 'year') {
        cmp = (a[sortField] as number) - (b[sortField] as number)
      } else {
        cmp = String(a[sortField]).localeCompare(String(b[sortField]))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortField, sortDir])

  // Yearly aggregation for chart
  const yearlyData = useMemo(() => {
    const map: Record<number, number> = {}
    for (const r of filtered) {
      map[r.year] = (map[r.year] || 0) + r.revenue
    }
    return Object.entries(map)
      .map(([y, rev]) => ({ year: Number(y), revenue: rev }))
      .sort((a, b) => a.year - b.year)
  }, [filtered])

  const maxRevenue = useMemo(() => Math.max(...yearlyData.map(d => d.revenue), 1), [yearlyData])

  // Summary stats
  const totalRevenue = useMemo(() => filtered.reduce((s, r) => s + r.revenue, 0), [filtered])
  const uniqueClients = useMemo(() => new Set(filtered.map(r => r.client_name)).size, [filtered])
  const uniqueSOWs = useMemo(() => new Set(filtered.map(r => r.sow_number)).size, [filtered])

  const hasFilters = selectedYears.size > 0 || selectedMonths.size > 0 || selectedClients.size > 0 || sowFilter || search

  function clearAll() {
    setSelectedYears(new Set())
    setSelectedMonths(new Set())
    setSelectedClients(new Set())
    setSowFilter('')
    setSearch('')
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'revenue' || field === 'year' ? 'desc' : 'asc')
    }
  }

  function sortIcon(field: SortField) {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  return {
    canWrite,
    loading, error,
    // Filter state
    selectedYears, setSelectedYears,
    selectedMonths, setSelectedMonths,
    selectedClients, setSelectedClients,
    sowFilter, setSowFilter,
    search, setSearch,
    // View
    view, setView,
    // Derived
    years, months, clients,
    filtered, sorted,
    yearlyData, maxRevenue,
    totalRevenue, uniqueClients, uniqueSOWs,
    hasFilters,
    // Actions
    clearAll, toggleSort, sortIcon,
  }
}
