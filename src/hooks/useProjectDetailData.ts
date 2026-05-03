import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import type { Project, Consultant, Holiday, ProjectComment } from '../types/database'
import type { AssignmentWithConsultant } from '../types/projectDetail'

function enrichAssignments(
  assignments: Awaited<ReturnType<typeof api.getAssignments>>,
  engList: Consultant[],
): AssignmentWithConsultant[] {
  return assignments.map(a => {
    const eng = engList.find(e => e.id === a.consultant_id)
    return {
      ...a,
      consultants: eng ? { full_name: eng.full_name, email: eng.email, hourly_cost_rate: eng.hourly_cost_rate } : null,
    } as AssignmentWithConsultant
  })
}

export function useProjectDetailData(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [assignments, setAssignments] = useState<AssignmentWithConsultant[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [comments, setComments] = useState<ProjectComment[]>([])

  // Guards against stale data from concurrent loads / realtime race conditions
  const loadVersionRef = useRef(0)
  const mutatingRef = useRef(false)
  // Keep a ref to consultants so loadAssignments always has the latest list
  const consultantsRef = useRef<Consultant[]>([])

  async function loadProject() {
    if (!id) return
    try {
      const data = await api.getProjectById(id)
      setProject(data)
    } catch (err) {
      console.error('Error loading project:', err)
    }
  }

  async function loadComments() {
    if (!id) return
    try {
      const data = await api.getProjectComments(id)
      setComments(data)
    } catch (err) {
      console.error('Error loading comments:', err)
    }
  }

  async function loadAssignments() {
    if (!id) return
    const thisVersion = ++loadVersionRef.current
    try {
      const data = await api.getAssignments({ project_id: `eq.${id}`, order: 'start_date' })
      // Discard stale responses — a newer load was triggered while this one was in-flight
      if (thisVersion !== loadVersionRef.current) return
      // Enrich with consultant data from ref (always current, unlike state closure)
      const enriched = enrichAssignments(data, consultantsRef.current)
      setAssignments(enriched)
    } catch (err) {
      // Discard stale responses
      if (thisVersion !== loadVersionRef.current) return
      console.error('Error loading assignments:', err)
    }
  }

  const { loading, error, retry } = useLoadData(async () => {
    if (!id) return
    const [engData, holData] = await Promise.all([
      api.getConsultants({ is_active: 'eq.true' }),
      api.getHolidays(),
    ])
    setConsultants(engData)
    consultantsRef.current = engData
    setHolidays(holData)
    // Load project first, then assignments (which need consultants for enrichment)
    await loadProject()
    // Assignments enrichment uses consultants state, but state won't be available yet.
    // Fetch assignments directly and enrich using engData from this closure.
    const thisVersion = ++loadVersionRef.current
    const asgData = await api.getAssignments({ project_id: `eq.${id}`, order: 'start_date' })
    if (thisVersion === loadVersionRef.current) {
      const enriched = enrichAssignments(asgData, engData)
      setAssignments(enriched)
    }
    // Load comments (independent — don't let failure break the page)
    try {
      const commentsData = await api.getProjectComments(id)
      setComments(commentsData)
    } catch (err) {
      console.error('Error loading comments:', err)
    }
  }, [id], 8000)

  // Realtime subscription for assignment changes
  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`assignments-${id}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => {
        if (mounted && !mutatingRef.current) { loadAssignments(); loadProject() }
      })
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [id])

  return {
    project,
    setProject,
    assignments,
    setAssignments,
    consultants,
    holidays,
    comments,
    setComments,
    loading,
    error,
    retry,
    loadProject,
    loadAssignments,
    loadComments,
    mutatingRef,
  }
}
