import { useState, useCallback } from 'react'
import type { Project, RevenueStatus } from '../types/database'
import type { KanbanColumn, PendingDrop } from '../types/kanban'

interface UseKanbanDragDropArgs {
  readOnly: boolean
  projects: Project[]
  executeStatusChange: (projectId: string, newStatus: RevenueStatus) => Promise<void>
}

export function useKanbanDragDrop({ readOnly, projects, executeStatusChange }: UseKanbanDragDropArgs) {
  const [dragProjectId, setDragProjectId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null)

  const handleDragStart = useCallback((e: React.DragEvent, projectId: string) => {
    if (readOnly) { e.preventDefault(); return }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', projectId)
    setDragProjectId(projectId)
  }, [readOnly])

  const handleDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnKey)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent, columnKey: string) => {
    // Only clear if we're actually leaving the column, not entering a child
    const related = e.relatedTarget as Node | null
    const current = e.currentTarget as Node
    if (related && current.contains(related)) return
    setDragOverColumn(prev => prev === columnKey ? null : prev)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragProjectId(null)
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDragProjectId(null)

    if (readOnly) return

    const projectId = e.dataTransfer.getData('text/plain')
    if (!projectId) return

    const project = projects.find(p => p.id === projectId)
    if (!project) return

    if (column.statuses.includes(project.status)) return

    if (column.confirmOnDrop) {
      setPendingDrop({ projectId, newStatus: column.defaultStatus, columnLabel: column.label })
    } else {
      executeStatusChange(projectId, column.defaultStatus)
    }
  }, [readOnly, projects, executeStatusChange])

  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return
    executeStatusChange(pendingDrop.projectId, pendingDrop.newStatus)
    setPendingDrop(null)
  }, [pendingDrop, executeStatusChange])

  const cancelDrop = useCallback(() => {
    setPendingDrop(null)
  }, [])

  return {
    dragProjectId,
    dragOverColumn,
    pendingDrop,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDragEnd,
    handleDrop,
    confirmDrop,
    cancelDrop,
  }
}
