import type { Project, RevenueStatus } from './database'

export interface KanbanColumn {
  key: string
  label: string
  statuses: RevenueStatus[]
  /** When a card is dropped on this column, which status to assign */
  defaultStatus: RevenueStatus
  color: string
  /** Whether dropping here requires a confirmation modal */
  confirmOnDrop: boolean
}

export interface PendingDrop {
  projectId: string
  newStatus: RevenueStatus
  columnLabel: string
}

export interface KanbanFilters {
  filterPMs: string[]
  filterClients: string[]
  filterDateStart: string
  filterDateEnd: string
  searchText: string
}

export interface KanbanCardProps {
  project: Project
  consultantCount: number
  isDragging: boolean
  isSoftColumn: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  readOnly: boolean
  onClickCard: (projectId: string) => void
  dismissed: Record<string, boolean>
  onDismissAlert: (projectId: string, alertType: string) => void
  onRestoreAlert: (projectId: string, alertType: string) => void
}
