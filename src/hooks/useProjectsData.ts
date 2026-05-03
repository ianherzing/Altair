import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useIsReadOnly } from '../lib/permissions'
import { useLoadData } from '../lib/useLoadData'
import type { Project, ProjectType, RevenueStatus } from '../types/database'
import { EMPTY_PROJECT_FORM } from '../types/projects'
import type { ProjectFormState } from '../types/projects'

export function useProjectsData() {
  const readOnly = useIsReadOnly()
  const [projects, setProjects] = useState<Project[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProjectFormState>(EMPTY_PROJECT_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Filters
  const [filterClients, setFilterClients] = useState<string[]>([])
  const [showClientFilter, setShowClientFilter] = useState(false)
  const clientFilterRef = useRef<HTMLDivElement>(null)

  const [filterProject, setFilterProject] = useState('')

  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const typeFilterRef = useRef<HTMLDivElement>(null)

  const [filterSow, setFilterSow] = useState('')

  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  const [filterPMs, setFilterPMs] = useState<string[]>([])
  const [showPMFilter, setShowPMFilter] = useState(false)
  const pmFilterRef = useRef<HTMLDivElement>(null)

  // Sorting
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  // Auto-archive runs once on mount
  const archiveRan = useRef(false)
  useEffect(() => {
    if (archiveRan.current) return
    archiveRan.current = true
    api.archiveProjects()
      .catch((err) => console.error('Auto-archive error:', err))
  }, [])

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getProjects({ is_active: 'eq.true' })
    data.sort((a, b) => {
      if (!a.engagement_start && !b.engagement_start) return 0
      if (!a.engagement_start) return 1
      if (!b.engagement_start) return -1
      return a.engagement_start.localeCompare(b.engagement_start)
    })
    setProjects(data)
  }, [], 15000)

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`projects-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        if (mounted) retry()
      })
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [retry])

  // Outside-click for filter dropdowns
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientFilterRef.current && !clientFilterRef.current.contains(e.target as Node)) setShowClientFilter(false)
      if (typeFilterRef.current && !typeFilterRef.current.contains(e.target as Node)) setShowTypeFilter(false)
      if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setShowStatusFilter(false)
      if (pmFilterRef.current && !pmFilterRef.current.contains(e.target as Node)) setShowPMFilter(false)
    }
    if (showClientFilter || showTypeFilter || showStatusFilter || showPMFilter) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showClientFilter, showTypeFilter, showStatusFilter, showPMFilter])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    const isBillable = form.project_type === 'billable'
    const payload = {
      client_name: form.client_name,
      project_name: form.project_name,
      project_type: form.project_type,
      sow_number: form.sow_number || undefined,
      sow_amount: isBillable && form.sow_amount ? parseFloat(form.sow_amount) : undefined,
      planned_hours: form.planned_hours ? parseFloat(form.planned_hours) : undefined,
      status: form.status,
    }

    try {
      if (editingId) {
        await api.updateProject({ id: editingId, ...payload })
      } else {
        await api.createProject(payload)
      }
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_PROJECT_FORM)
    } catch (err) {
      console.error(editingId ? 'Error updating project:' : 'Error creating project:', err)
      setFormError(err instanceof Error ? err.message : 'Failed to save project')
    }

    setSaving(false)
  }

  function startEdit(p: Project) {
    setForm({
      client_name: p.client_name,
      project_name: p.project_name,
      project_type: p.project_type || 'billable',
      sow_number: p.sow_number || '',
      sow_amount: p.sow_amount ? String(p.sow_amount) : '',
      planned_hours: p.planned_hours ? String(p.planned_hours) : '',
      status: p.status,
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  async function updateStatus(projectId: string, newStatus: RevenueStatus) {
    try {
      await api.updateProjectStatus(projectId, newStatus)
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  async function handleDelete(projectId: string, clientName: string, projectName: string) {
    const confirmed = window.confirm(
      `Delete ${clientName} — ${projectName}? This will permanently delete the project and all its assignments. This cannot be undone.`
    )
    if (!confirmed) return

    setProjects(prev => prev.filter(p => p.id !== projectId))
    try {
      await api.deleteProject(projectId)
    } catch (err) {
      console.error('Error deleting project:', err)
      alert('Failed to delete project. See console for details.')
      retry()
    }
  }

  // Unique values for filter dropdowns
  const allClients = Array.from(new Set(projects.map(p => p.client_name))).sort()
  const allTypes: ProjectType[] = ['billable', 'non_billable', 'pto']
  const allPMs = Array.from(new Set(projects.map(p => p.project_manager).filter((v): v is string => !!v))).sort()

  // Filtered projects
  const filteredProjects = projects.filter(p => {
    if (filterClients.length > 0 && !filterClients.includes(p.client_name)) return false
    if (filterProject && !p.project_name.toLowerCase().includes(filterProject.toLowerCase())) return false
    if (filterTypes.length > 0 && !filterTypes.includes(p.project_type || 'billable')) return false
    if (filterSow && !(p.sow_number || '').toLowerCase().includes(filterSow.toLowerCase())) return false
    if (filterStatuses.length > 0 && !filterStatuses.includes(p.status)) return false
    if (filterPMs.length > 0 && !filterPMs.includes(p.project_manager || '')) return false
    return true
  })

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (!sortCol) return 0
    const dir = sortDir === 'asc' ? 1 : -1
    let av: string | number | null = null
    let bv: string | number | null = null
    switch (sortCol) {
      case 'uid': av = a.altair_uid ?? null; bv = b.altair_uid ?? null; break
      case 'client': av = a.client_name; bv = b.client_name; break
      case 'project': av = a.project_name; bv = b.project_name; break
      case 'type': av = a.project_type; bv = b.project_type; break
      case 'sow': av = a.sow_number; bv = b.sow_number; break
      case 'amount': av = a.sow_amount ?? null; bv = b.sow_amount ?? null; break
      case 'hours': av = a.planned_hours ?? null; bv = b.planned_hours ?? null; break
      case 'status': av = a.status; bv = b.status; break
      case 'pm': av = a.project_manager; bv = b.project_manager; break
      case 'start': av = a.engagement_start; bv = b.engagement_start; break
      case 'end': av = a.engagement_end; bv = b.engagement_end; break
    }
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv)) * dir
  })

  return {
    readOnly,
    projects,
    showForm, setShowForm,
    form, setForm,
    editingId, setEditingId,
    saving,
    formError, setFormError,
    // Filter state
    filterClients, setFilterClients,
    showClientFilter, setShowClientFilter,
    clientFilterRef,
    filterProject, setFilterProject,
    filterTypes, setFilterTypes,
    showTypeFilter, setShowTypeFilter,
    typeFilterRef,
    filterSow, setFilterSow,
    filterStatuses, setFilterStatuses,
    showStatusFilter, setShowStatusFilter,
    statusFilterRef,
    filterPMs, setFilterPMs,
    showPMFilter, setShowPMFilter,
    pmFilterRef,
    // Sort
    sortCol, sortDir, toggleSort,
    // Derived
    allClients, allTypes, allPMs,
    filteredProjects, sortedProjects,
    // Actions
    handleSubmit, startEdit, updateStatus, handleDelete,
    // Loading
    loading, error, retry,
  }
}
