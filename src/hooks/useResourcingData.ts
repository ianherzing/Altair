import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { RESOURCING_TIMEOUT_MS } from '../lib/constants'
import { NON_RESOURCEABLE_TITLES } from '../types/database'
import { buildHolidayMap } from '../lib/resourcingUtils'
import type { Project, Skill, ConsultantSkill, PassionArea, Holiday } from '../types/database'
import type { AssignmentWithDetails, ConsultantWithAssignments, SkillFilterItem } from '../types/resourcing'

export function useResourcingData() {
  const [consultants, setConsultants] = useState<ConsultantWithAssignments[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [, setAllSkills] = useState<Skill[]>([])
  const [consultantSkillsMap, setConsultantSkillsMap] = useState<Map<string, ConsultantSkill[]>>(new Map())
  const [passionAreas, setPassionAreas] = useState<PassionArea[]>([])
  const [skillFilters, setSkillFilters] = useState<SkillFilterItem[]>([])
  // Guards against stale data from concurrent loads / realtime race conditions
  const loadVersionRef = useRef(0)
  const mutatingRef = useRef(false)

  // Pre-compute holiday lookup map for O(1) checks instead of O(n) scans
  const holidayMap = useMemo(() => buildHolidayMap(holidays), [holidays])

  async function loadData() {
    const thisVersion = ++loadVersionRef.current

    // Include active consultants + terminated consultants still in 2-week grace period
    const graceCutoff = new Date()
    graceCutoff.setDate(graceCutoff.getDate() - 14)
    const cutoffStr = graceCutoff.toISOString().slice(0, 10)

    const [engData, assignData, projData, skillData, engSkillData, paData, holData] = await Promise.all([
      api.getConsultants({ or: `(is_active.eq.true,offboarded_at.gte.${cutoffStr})`, order: 'full_name' }),
      api.getAssignments({ order: 'start_date' }),
      api.getProjects({ is_active: 'eq.true', order: 'client_name' }),
      api.getSkills(),
      api.getConsultantSkills(),
      api.getPassionAreas(),
      api.getHolidays(),
    ])

    // Discard stale responses — a newer loadData() was triggered while this one was in-flight
    if (thisVersion !== loadVersionRef.current) return

    // Build a project lookup map for client-side joining (replaces PostgREST join)
    const projLookup = new Map(projData.map(p => [p.id, p]))

    const assignsByConsultant = new Map<string, AssignmentWithDetails[]>()
    for (const a of assignData) {
      const proj = projLookup.get(a.project_id)
      const enriched: AssignmentWithDetails = {
        ...a,
        projects: proj
          ? { client_name: proj.client_name, project_name: proj.project_name, status: proj.status, project_type: proj.project_type }
          : null,
      }
      const list = assignsByConsultant.get(a.consultant_id) || []
      list.push(enriched)
      assignsByConsultant.set(a.consultant_id, list)
    }

    setConsultants((engData || []).filter(e => !NON_RESOURCEABLE_TITLES.has(e.title || '')).map(e => ({
      ...e,
      assignments: assignsByConsultant.get(e.id) || [],
    })))
    setProjects(projData)
    setHolidays(holData as Holiday[])

    const skills = skillData || []
    setAllSkills(skills)
    setSkillFilters(prev => {
      if (prev.length > 0) return prev
      return skills.map(s => ({ skillId: s.id, name: s.name, enabled: false, min: 1, max: 3 }))
    })

    const esMap = new Map<string, ConsultantSkill[]>()
    for (const es of (engSkillData || [])) {
      const list = esMap.get(es.consultant_id) || []
      list.push(es)
      esMap.set(es.consultant_id, list)
    }
    setConsultantSkillsMap(esMap)
    setPassionAreas((paData || []).filter(p => p.is_active))
  }

  /** Lightweight refresh — only re-fetch assignments after a mutation */
  async function refreshAssignments() {
    try {
      const [assignData, projData] = await Promise.all([
        api.getAssignments({ order: 'start_date' }),
        api.getProjects({ is_active: 'eq.true' }),
      ])
      const projLookup = new Map(projData.map(p => [p.id, p]))
      const assignsByConsultant = new Map<string, AssignmentWithDetails[]>()
      for (const a of assignData) {
        const proj = projLookup.get(a.project_id)
        const enriched: AssignmentWithDetails = {
          ...a,
          projects: proj
            ? { client_name: proj.client_name, project_name: proj.project_name, status: proj.status, project_type: proj.project_type }
            : null,
        }
        const list = assignsByConsultant.get(a.consultant_id) || []
        list.push(enriched)
        assignsByConsultant.set(a.consultant_id, list)
      }
      setConsultants(prev => prev.map(e => ({
        ...e,
        assignments: assignsByConsultant.get(e.id) || [],
      })))
    } catch (err) {
      console.error('Error refreshing assignments:', err)
    }
  }

  const { loading, error, retry } = useLoadData(async () => {
    await loadData()
  }, [], RESOURCING_TIMEOUT_MS)

  useEffect(() => {
    let mounted = true
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (mounted && !mutatingRef.current) refreshAssignments()
      }, 500)
    }
    const channel = supabase
      .channel(`resourcing-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        if (mounted && !mutatingRef.current) debouncedRefresh()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultants' }, () => {
        if (mounted && !mutatingRef.current) debouncedRefresh()
      })
      .subscribe()
    return () => { mounted = false; if (debounceTimer) clearTimeout(debounceTimer); supabase.removeChannel(channel) }
  }, [refreshAssignments])

  return {
    consultants,
    setConsultants,
    projects,
    holidays,
    consultantSkillsMap,
    passionAreas,
    skillFilters,
    setSkillFilters,
    loading,
    error,
    retry,
    mutatingRef,
    refreshAssignments,
    holidayMap,
  }
}
