import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import type { Project, Assignment, RevenueStatus } from '../types/database'

export function useKanbanData() {
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])

  // In-flight status change guard — suppresses Realtime refetches during API calls.
  // Kept high for 2s after mutation so the delayed Realtime event is also suppressed.
  const statusChangeInFlight = useRef(false)
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startSuppress = useCallback(() => {
    statusChangeInFlight.current = true
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
  }, [])

  const endSuppress = useCallback(() => {
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = setTimeout(() => {
      statusChangeInFlight.current = false
    }, 2000)
  }, [])

  // ─── Data loading ────────────────────────────────────────────────

  // Silent refetch — does not toggle the top-level `loading` flag, so realtime
  // updates don't tear down the kanban + side-panel subtree. The initial load
  // still goes through useLoadData below.
  const refetchSilently = useCallback(async () => {
    try {
      const [projData, assignData] = await Promise.all([
        api.getProjects({ is_active: 'eq.true' }),
        api.getAssignments(),
      ])
      projData.sort((a, b) => {
        if (!a.engagement_end && !b.engagement_end) return 0
        if (!a.engagement_end) return 1
        if (!b.engagement_end) return -1
        return a.engagement_end.localeCompare(b.engagement_end)
      })
      setProjects(projData)
      setAssignments(assignData)
    } catch (err) {
      console.error('Error refetching kanban data:', err)
    }
  }, [])

  const { loading, error, retry } = useLoadData(refetchSilently, [], 15000)

  // ─── Realtime ────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true
    const channel = supabase
      .channel(`kanban-projects-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        if (mounted && !statusChangeInFlight.current) refetchSilently()
      })
      .subscribe()

    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [refetchSilently])

  // ─── Status change ──────────────────────────────────────────────

  const executeStatusChange = useCallback(async (projectId: string, newStatus: RevenueStatus) => {
    // Optimistic update
    const prevProjects = projects
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))

    startSuppress()
    try {
      await api.updateProjectStatus(projectId, newStatus)
    } catch (err) {
      console.error('Error updating project status:', err)
      // Revert
      setProjects(prevProjects)
    } finally {
      endSuppress()
    }
  }, [projects, startSuppress, endSuppress])

  return {
    projects,
    assignments,
    loading,
    error,
    retry,
    executeStatusChange,
  }
}
