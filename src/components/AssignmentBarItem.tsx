import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Tooltip } from './ui'
import { advanceByBizDays, assignmentBarLabel } from '../lib/resourcingUtils'
import type { AssignmentWithDetails } from '../types/resourcing'
import '../pages/Resourcing.css'

function barClass(projectType: string, status: string): string {
  if (projectType === 'pto') return 'res-bar--pto'
  if (projectType === 'non_billable') return 'res-bar--nonbill'
  if (status === 'to_do' || status === 'soft_unconfirmed' || status === 'soft_at_risk') return 'res-bar--soft'
  return 'res-bar--hard'
}

interface DragState {
  assignmentId: string
}

interface AssignmentBarItemProps {
  a: AssignmentWithDetails
  topOffset: number
  country: string | null
  dateToPct: (d: Date) => number
  dragging: DragState | null
  holidayMap: Map<string, string>
  onStartDrag: (e: MouseEvent, assignmentId: string, mode: 'move' | 'resize-start' | 'resize-end', startDate: string, endDate: string) => void
  onOpenEdit: (a: AssignmentWithDetails) => void
}

const TOOLTIP_ENTER_DELAY_MS = 500

export function AssignmentBarItem({
  a, topOffset, country, dateToPct, dragging, holidayMap,
  onStartDrag, onOpenEdit,
}: AssignmentBarItemProps) {
  const barRef = useRef<HTMLDivElement | null>(null)
  const tooltipTimerRef = useRef<number | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  useEffect(() => () => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
  }, [])

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current)
      tooltipTimerRef.current = null
    }
  }, [])

  const aStart = new Date(a.start_date + 'T00:00:00')
  const aEnd = new Date(a.end_date + 'T00:00:00')
  const startPct = dateToPct(aStart)
  const endPct = dateToPct(advanceByBizDays(aEnd, 1))
  const widthPct = endPct - startPct

  if (startPct > 100 || endPct < 0) return null

  const pType = a.projects?.project_type || 'billable'
  const status = a.projects?.status || 'soft_unconfirmed'
  const projectLabel = a.projects
    ? `${a.projects.client_name} — ${a.projects.project_name}`
    : 'Unknown Project'
  const isDraggingThis = dragging?.assignmentId === a.id

  return (
    <div
      ref={barRef}
      className={barClass(pType, status)}
      onMouseDown={() => {
        clearTooltipTimer()
        setTooltipVisible(false)
      }}
      style={{
        position: 'absolute',
        left: `${Math.max(startPct, 0)}%`,
        width: `${Math.min(widthPct, 100 - Math.max(startPct, 0))}%`,
        top: topOffset, bottom: topOffset,
        borderRadius: 2,
        border: '1px solid var(--bar-hairline)',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden', whiteSpace: 'nowrap',
        fontSize: '0.7rem', fontWeight: 600,
        opacity: isDraggingThis ? 0.7 : 0.9,
        zIndex: isDraggingThis ? 10 : 2,
        cursor: dragging ? 'grabbing' : 'grab',
        transform: 'translateY(0)',
        transition: isDraggingThis
          ? 'none'
          : 'opacity 150ms, transform var(--duration-fast) var(--ease-out)',
      }}
      onMouseEnter={(e) => {
        if (dragging) return
        e.currentTarget.style.opacity = '1'
        e.currentTarget.style.transform = 'translateY(-1px)'
        clearTooltipTimer()
        tooltipTimerRef.current = window.setTimeout(() => {
          setTooltipVisible(true)
        }, TOOLTIP_ENTER_DELAY_MS)
      }}
      onMouseLeave={(e) => {
        if (dragging) return
        e.currentTarget.style.opacity = '0.9'
        e.currentTarget.style.transform = 'translateY(0)'
        clearTooltipTimer()
        setTooltipVisible(false)
      }}
    >
      <div
        onMouseDown={(e) => onStartDrag(e, a.id, 'resize-start', a.start_date, a.end_date)}
        style={{ width: 6, minWidth: 6, height: '100%', cursor: 'ew-resize', flexShrink: 0 }}
      />
      <div
        onMouseDown={(e) => onStartDrag(e, a.id, 'move', a.start_date, a.end_date)}
        onClick={(e) => { if (!dragging) { e.stopPropagation(); onOpenEdit(a) } }}
        style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden' }}
      >
        {widthPct > 3 ? assignmentBarLabel(a.total_hours, a.start_date, a.end_date, holidayMap, country) : ''}
      </div>
      <div
        onMouseDown={(e) => onStartDrag(e, a.id, 'resize-end', a.start_date, a.end_date)}
        style={{ width: 6, minWidth: 6, height: '100%', cursor: 'ew-resize', flexShrink: 0 }}
      />
      <Tooltip
        visible={tooltipVisible && !dragging}
        anchorRef={barRef}
        content={`${projectLabel}\n${a.start_date} → ${a.end_date}\n${a.total_hours} hrs`}
      />
    </div>
  )
}
