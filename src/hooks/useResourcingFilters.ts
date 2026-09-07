import { useState, useMemo, useCallback } from 'react'
import type { Project, ConsultantSkill, PassionArea } from '../types/database'
import type { ConsultantWithAssignments, SkillFilterItem, ProjectWithConsultants } from '../types/resourcing'

interface UseResourcingFiltersArgs {
  consultants: ConsultantWithAssignments[]
  projects: Project[]
  consultantSkillsMap: Map<string, ConsultantSkill[]>
  passionAreas: PassionArea[]
  skillFilters: SkillFilterItem[]
  setSkillFilters: React.Dispatch<React.SetStateAction<SkillFilterItem[]>>
}

export function useResourcingFilters({
  consultants,
  projects,
  consultantSkillsMap,
  skillFilters,
  setSkillFilters,
}: UseResourcingFiltersArgs) {
  const [viewMode, setViewMode] = useState<'consultant' | 'project'>(() => {
    const saved = localStorage.getItem('altair-resourcing-view-mode')
    return saved === 'project' ? 'project' : 'consultant'
  })
  const [searchText, setSearchText] = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterTitle, setFilterTitle] = useState<Set<string>>(new Set())
  const [showTitleFilter, setShowTitleFilter] = useState(false)
  const [titleSearchText, setTitleSearchText] = useState('')
  const [filterConsultants, setFilterConsultants] = useState<Set<string>>(new Set())
  const [showConsultantFilter, setShowConsultantFilter] = useState(false)
  const [consultantSearchText, setConsultantSearchText] = useState('')
  const [filterPassion, setFilterPassion] = useState('')
  const [filterPracticeManager, setFilterPracticeManager] = useState('')
  const [filterSow, setFilterSow] = useState<Set<string>>(new Set())
  const [showSowFilter, setShowSowFilter] = useState(false)
  const [sowSearchText, setSowSearchText] = useState('')
  const [filterStatus, setFilterStatus] = useState<Set<string>>(new Set())
  const [showStatusFilter, setShowStatusFilter] = useState(false)
  const [showSkillFilters, setShowSkillFilters] = useState(false)

  const managers = useMemo(() => {
    const set = new Set(consultants.map(e => e.manager).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [consultants])

  const practiceManagers = useMemo(() => {
    const set = new Set(projects.map(p => p.project_manager).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [projects])

  const titles = useMemo(() => {
    const set = new Set(consultants.map(e => e.title).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [consultants])

  const activeSkillFilters = useMemo(() => skillFilters.filter(sf => sf.enabled), [skillFilters])

  const sowNumbers = useMemo(() => {
    const set = new Set(projects.map(p => p.sow_number).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [projects])

  const sowFilteredProjectIds = useMemo(() => {
    if (filterSow.size === 0) return null
    return new Set(projects.filter(p => p.sow_number && filterSow.has(p.sow_number)).map(p => p.id))
  }, [filterSow, projects])

  const statusFilteredProjectIds = useMemo(() => {
    if (filterStatus.size === 0) return null
    return new Set(projects.filter(p => filterStatus.has(p.status)).map(p => p.id))
  }, [filterStatus, projects])

  const practiceManagerProjectIds = useMemo(() => {
    if (!filterPracticeManager) return null
    return new Set(projects.filter(p => p.project_manager === filterPracticeManager).map(p => p.id))
  }, [filterPracticeManager, projects])

  // Projects that have at least one assigned consultant reporting to filterManager.
  // Used as a project-level filter in By Project view so all consultants on the
  // matching project remain visible (not just those reporting to the manager).
  const managerProjectIds = useMemo(() => {
    if (!filterManager) return null
    const ids = new Set<string>()
    for (const eng of consultants) {
      if (eng.manager !== filterManager) continue
      for (const a of eng.assignments) ids.add(a.project_id)
    }
    return ids
  }, [filterManager, consultants])

  // Memoize project options for SearchableSelect — avoids new array every render
  const projectOptions = useMemo(() =>
    projects.map(p => ({
      value: p.id,
      label: `${p.client_name} — ${p.project_name}${p.sow_number ? ` (${p.sow_number})` : ''}`,
    })),
    [projects]
  )

  // Memoize sorted consultants for dropdowns
  const sortedConsultants = useMemo(() =>
    consultants.slice().sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [consultants]
  )

  const filteredConsultants = useMemo(() => {
    const q = searchText ? searchText.toLowerCase() : ''
    const uidMatchProjectIds = q
      ? new Set(projects.filter(p => p.altair_uid.toLowerCase().includes(q)).map(p => p.id))
      : null

    return consultants.filter(eng => {
      if (searchText) {
        const nameMatch = eng.full_name.toLowerCase().includes(q)
        const skillMatch = eng.skills?.some(s => s.toLowerCase().includes(q))
        const paMatch = eng.passion_area?.toLowerCase().includes(q)
        const uidMatch = !!uidMatchProjectIds && eng.assignments.some(a => uidMatchProjectIds.has(a.project_id))
        if (!nameMatch && !skillMatch && !paMatch && !uidMatch) return false
      }
      // Manager filter: consultant-level in By Consultant view only. In By Project view
      // it's applied at the project level (managerProjectIds) so other consultants on
      // the same project remain visible.
      if (viewMode === 'consultant' && filterManager && eng.manager !== filterManager) return false
      if (filterTitle.size > 0 && !filterTitle.has(eng.title || '')) return false
      if (filterConsultants.size > 0 && !filterConsultants.has(eng.id)) return false
      if (filterPassion) {
        if (eng.passion_area_id !== filterPassion && eng.passion_area !== filterPassion) return false
      }
      if (activeSkillFilters.length > 0) {
        const engSkills = consultantSkillsMap.get(eng.id) || []
        for (const sf of activeSkillFilters) {
          const match = engSkills.find(es => es.skill_id === sf.skillId && es.rating >= sf.min && es.rating <= sf.max)
          if (!match) return false
        }
      }
      if (sowFilteredProjectIds && !eng.assignments.some(a => sowFilteredProjectIds.has(a.project_id))) return false
      // PM filter: consultant-level in By Consultant view only. In By Project view
      // it's applied at the project level so projects are filtered by
      // project.project_manager (not by whichever projects those
      // consultants happen to be on).
      if (viewMode === 'consultant' && practiceManagerProjectIds && !eng.assignments.some(a => practiceManagerProjectIds.has(a.project_id))) return false
      if (statusFilteredProjectIds && !eng.assignments.some(a => statusFilteredProjectIds.has(a.project_id))) return false
      return true
    })
  }, [consultants, projects, viewMode, searchText, filterManager, filterTitle, filterConsultants, filterPassion, activeSkillFilters, consultantSkillsMap, sowFilteredProjectIds, practiceManagerProjectIds, statusFilteredProjectIds])

  const { activeProjectGroups, doneProjectGroups } = useMemo(() => {
    if (viewMode !== 'project') return { activeProjectGroups: [] as ProjectWithConsultants[], doneProjectGroups: [] as ProjectWithConsultants[] }

    const projectMap = new Map<string, ProjectWithConsultants>()

    for (const eng of filteredConsultants) {
      for (const a of eng.assignments) {
        if (sowFilteredProjectIds && !sowFilteredProjectIds.has(a.project_id)) continue
        if (statusFilteredProjectIds && !statusFilteredProjectIds.has(a.project_id)) continue
        if (managerProjectIds && !managerProjectIds.has(a.project_id)) continue
        if (practiceManagerProjectIds && !practiceManagerProjectIds.has(a.project_id)) continue
        let entry = projectMap.get(a.project_id)
        if (!entry) {
          const proj = projects.find(p => p.id === a.project_id)
          const fallback = {
            id: a.project_id,
            client_name: a.projects?.client_name || 'Unknown',
            project_name: a.projects?.project_name || 'Unknown',
            status: a.projects?.status || 'soft_unconfirmed',
            project_type: a.projects?.project_type || 'billable',
          } as Project
          entry = { project: proj || fallback, consultantAssignments: [], totalHours: 0 }
          projectMap.set(a.project_id, entry)
        }

        let consultantEntry = entry.consultantAssignments.find(ea => ea.consultant.id === eng.id)
        if (!consultantEntry) {
          consultantEntry = { consultant: eng, assignments: [] }
          entry.consultantAssignments.push(consultantEntry)
        }
        consultantEntry.assignments.push(a)
        entry.totalHours += Number(a.total_hours)
      }
    }

    const all = Array.from(projectMap.values()).sort((a, b) => {
      const cmp = (a.project.client_name || '').localeCompare(b.project.client_name || '')
      if (cmp !== 0) return cmp
      return (a.project.project_name || '').localeCompare(b.project.project_name || '')
    })

    const active: ProjectWithConsultants[] = []
    const done: ProjectWithConsultants[] = []
    for (const p of all) {
      if (p.project.status === 'done') done.push(p)
      else active.push(p)
    }
    return { activeProjectGroups: active, doneProjectGroups: done }
  }, [viewMode, filteredConsultants, projects, sowFilteredProjectIds, statusFilteredProjectIds, managerProjectIds, practiceManagerProjectIds])

  const hasActiveFilters = useMemo(() =>
    !!(searchText || filterManager || filterPracticeManager || filterTitle.size > 0 || filterConsultants.size > 0 || filterPassion || activeSkillFilters.length > 0 || filterSow.size > 0 || filterStatus.size > 0),
    [searchText, filterManager, filterPracticeManager, filterTitle, filterConsultants, filterPassion, activeSkillFilters, filterSow, filterStatus]
  )

  function toggleSkillFilter(skillId: string) {
    setSkillFilters(prev => prev.map(sf =>
      sf.skillId === skillId ? { ...sf, enabled: !sf.enabled } : sf
    ))
  }

  function updateSkillFilterRange(skillId: string, field: 'min' | 'max', value: number) {
    setSkillFilters(prev => prev.map(sf =>
      sf.skillId === skillId ? { ...sf, [field]: Math.max(1, Math.min(3, value)) } : sf
    ))
  }

  function clearAllFilters() {
    setSearchText('')
    setFilterManager('')
    setFilterPracticeManager('')
    setFilterTitle(new Set())
    setFilterConsultants(new Set())
    setFilterPassion('')
    setFilterSow(new Set())
    setFilterStatus(new Set())
    setSkillFilters(prev => prev.map(sf => ({ ...sf, enabled: false, min: 1, max: 3 })))
  }

  const getFilters = useCallback(() => ({
    viewMode,
    searchText,
    filterManager,
    filterPracticeManager,
    filterTitle: [...filterTitle],
    filterConsultants: [...filterConsultants],
    filterPassion,
    filterSow: [...filterSow],
    filterStatus: [...filterStatus],
    skillFilters,
  }), [viewMode, searchText, filterManager, filterPracticeManager, filterTitle, filterConsultants, filterPassion, filterSow, filterStatus, skillFilters])

  const applyFilters = useCallback((filters: Record<string, unknown>) => {
    if (filters.viewMode !== undefined) {
      const vm = filters.viewMode as 'consultant' | 'project'
      setViewMode(vm)
      localStorage.setItem('altair-resourcing-view-mode', vm)
    }
    if (filters.searchText !== undefined) setSearchText(filters.searchText as string)
    if (filters.filterManager !== undefined) setFilterManager(filters.filterManager as string)
    if (filters.filterPracticeManager !== undefined) setFilterPracticeManager(filters.filterPracticeManager as string)
    if (filters.filterTitle !== undefined) setFilterTitle(new Set(filters.filterTitle as string[]))
    if (filters.filterConsultants !== undefined) setFilterConsultants(new Set(filters.filterConsultants as string[]))
    if (filters.filterPassion !== undefined) setFilterPassion(filters.filterPassion as string)
    if (filters.filterSow !== undefined) setFilterSow(new Set(filters.filterSow as string[]))
    if (filters.filterStatus !== undefined) setFilterStatus(new Set(filters.filterStatus as string[]))
    if (filters.skillFilters !== undefined) setSkillFilters(filters.skillFilters as SkillFilterItem[])
  }, [])

  return {
    viewMode,
    setViewMode,
    searchText,
    setSearchText,
    filterManager,
    setFilterManager,
    filterTitle,
    setFilterTitle,
    showTitleFilter,
    setShowTitleFilter,
    titleSearchText,
    setTitleSearchText,
    filterConsultants,
    setFilterConsultants,
    showConsultantFilter,
    setShowConsultantFilter,
    consultantSearchText,
    setConsultantSearchText,
    filterPassion,
    setFilterPassion,
    filterPracticeManager,
    setFilterPracticeManager,
    filterSow,
    setFilterSow,
    showSowFilter,
    setShowSowFilter,
    sowSearchText,
    setSowSearchText,
    filterStatus,
    setFilterStatus,
    showStatusFilter,
    setShowStatusFilter,
    showSkillFilters,
    setShowSkillFilters,
    managers,
    practiceManagers,
    titles,
    activeSkillFilters,
    sowNumbers,
    sowFilteredProjectIds,
    statusFilteredProjectIds,
    projectOptions,
    sortedConsultants,
    filteredConsultants,
    activeProjectGroups,
    doneProjectGroups,
    hasActiveFilters,
    toggleSkillFilter,
    updateSkillFilterRange,
    clearAllFilters,
    getFilters,
    applyFilters,
  }
}
