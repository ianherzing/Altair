import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import {
  getWeeks,
  getMonthHeaders,
  bizDaysBetween,
  advanceByBizDays,
  dateToStr,
  calcBusinessDays,
  getBarBackground,
  getBarTextColor,
  assignmentBarLabel,
  buildHolidayMap,
} from '../lib/resourcingUtils'
import { countHolidaysInRangeArray } from '../lib/projectDetailUtils'
import { NAME_COL, VISIBLE_WEEKS } from '../lib/projectDetailStyles'
import { EMPTY_ASSIGNMENT } from '../types/projectDetail'
import type { RevenueStatus, ProjectType, Consultant, Holiday } from '../types/database'
import type { AssignmentWithConsultant, EditingAssignment, DragState, CreateDragState } from '../types/projectDetail'

const TOTAL_BIZ_DAYS = VISIBLE_WEEKS * 5

interface UseProjectDetailAssignmentsArgs {
  id: string | undefined
  readOnly: boolean
  assignments: AssignmentWithConsultant[]
  setAssignments: React.Dispatch<React.SetStateAction<AssignmentWithConsultant[]>>
  consultants: Consultant[]
  holidays: Holiday[]
  mutatingRef: React.MutableRefObject<boolean>
  loadAssignments: () => Promise<void>
  loadProject: () => Promise<void>
}

export function useProjectDetailAssignments({
  id,
  readOnly,
  assignments,
  setAssignments,
  consultants,
  holidays,
  mutatingRef,
  loadAssignments,
  loadProject,
}: UseProjectDetailAssignmentsArgs) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_ASSIGNMENT)
  const [saving, setSaving] = useState(false)

  // Gantt edit modal state
  const [editingAssignment, setEditingAssignment] = useState<EditingAssignment | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Gantt timeline navigation
  const [weekOffset, setWeekOffset] = useState(0)

  // Gantt drag state
  const [dragging, setDragging] = useState<DragState | null>(null)
  const ganttRef = useRef<HTMLDivElement>(null)

  // Gantt drag-to-create state
  const [creating, setCreating] = useState<CreateDragState | null>(null)

  /* ---------- Timeline computation ---------- */

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const timelineStart = useMemo(() => {
    // Start 2 weeks before today, shifted by weekOffset, snapped to Monday
    const d = new Date(today)
    d.setDate(d.getDate() - 14 + weekOffset * 7)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  }, [today, weekOffset])

  const weeks = useMemo(() => getWeeks(timelineStart, VISIBLE_WEEKS), [timelineStart])
  const monthHeaders = useMemo(() => getMonthHeaders(weeks), [weeks])
  const todayPct = (bizDaysBetween(timelineStart, today) / TOTAL_BIZ_DAYS) * 100

  function dateToPct(d: Date): number {
    return (bizDaysBetween(timelineStart, d) / TOTAL_BIZ_DAYS) * 100
  }

  function pxToDate(x: number, tlLeft: number, tlWidth: number): Date {
    const pct = Math.max(0, Math.min(1, (x - tlLeft) / tlWidth))
    const bizDayOffset = Math.round(pct * TOTAL_BIZ_DAYS)
    return advanceByBizDays(timelineStart, bizDayOffset)
  }

  // Holiday lookup map for assignmentBarLabel — avoids O(days) scans per bar.
  const holidayMap = useMemo(() => buildHolidayMap(holidays), [holidays])

  // Group assignments by consultant
  const assignmentsByConsultant = useMemo(() => {
    const map = new Map<string, { name: string; assignments: AssignmentWithConsultant[] }>()
    for (const a of assignments) {
      const engId = a.consultant_id
      const engName = a.consultants?.full_name || 'Unknown'
      if (!map.has(engId)) {
        map.set(engId, { name: engName, assignments: [] })
      }
      map.get(engId)!.assignments.push(a)
    }
    return Array.from(map.entries())
  }, [assignments])

  /* ---------- CRUD handlers ---------- */

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    setSaving(true)
    mutatingRef.current = true
    try {
      await api.createAssignment({
        project_id: id!,
        consultant_id: form.consultant_id,
        start_date: form.start_date,
        end_date: form.end_date,
        total_hours: parseFloat(form.total_hours),
      })

      setShowForm(false)
      setForm(EMPTY_ASSIGNMENT)
    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error creating assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      await Promise.all([loadAssignments(), loadProject()])
      mutatingRef.current = false
      setSaving(false)
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (readOnly) return
    mutatingRef.current = true
    // Optimistic delete — remove from UI immediately
    setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    try {
      await api.deleteAssignment(assignmentId)

    } catch (err) {
      console.error('Error removing assignment:', err)
      alert('Error removing assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      await Promise.all([loadAssignments(), loadProject()])
      mutatingRef.current = false
    }
  }

  async function updateStatus(newStatus: RevenueStatus) {
    if (readOnly) return
    try {
      await api.updateProjectStatus(id!, newStatus)
      await loadProject()
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  /* ---------- Gantt edit modal handlers ---------- */

  function openEditModal(a: AssignmentWithConsultant) {
    setEditingAssignment({
      id: a.id,
      consultant_name: a.consultants?.full_name || 'Unknown',
      start_date: a.start_date,
      end_date: a.end_date,
      total_hours: String(a.total_hours),
      notes: a.notes || '',
    })
  }

  function updateEditDates(field: 'start_date' | 'end_date', value: string) {
    if (!editingAssignment) return
    const updated = { ...editingAssignment, [field]: value }
    if (updated.start_date && updated.end_date) {
      const bdays = calcBusinessDays(updated.start_date, updated.end_date)
      const asg = assignments.find(a => a.id === editingAssignment.id)
      const eng = asg ? consultants.find(e => e.id === asg.consultant_id) : null
      const hols = countHolidaysInRangeArray(holidays, eng?.country || null, updated.start_date, updated.end_date)
      updated.total_hours = String((bdays - hols) * 8)
    }
    setEditingAssignment(updated)
  }

  async function handleSaveEdit() {
    if (readOnly || !editingAssignment) return
    setSavingEdit(true)
    mutatingRef.current = true
    try {
      // Optimistic update — reflect change in UI immediately
      setAssignments(prev => prev.map(a =>
        a.id === editingAssignment.id
          ? { ...a, start_date: editingAssignment.start_date, end_date: editingAssignment.end_date, total_hours: parseFloat(editingAssignment.total_hours), notes: editingAssignment.notes || null }
          : a
      ))

      await api.updateAssignment({
        id: editingAssignment.id,
        start_date: editingAssignment.start_date,
        end_date: editingAssignment.end_date,
        total_hours: parseFloat(editingAssignment.total_hours),
        notes: editingAssignment.notes || undefined,
      })

    } catch (err) {
      console.error('Error updating assignment:', err)
      alert('Error updating assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      await Promise.all([loadAssignments(), loadProject()])
      mutatingRef.current = false
      setSavingEdit(false)
      setEditingAssignment(null)
    }
  }

  async function handleDeleteAssignment() {
    if (readOnly || !editingAssignment) return
    setSavingEdit(true)
    mutatingRef.current = true
    const deletedId = editingAssignment.id
    setEditingAssignment(null)
    try {
      // Optimistic delete — remove from UI immediately
      setAssignments(prev => prev.filter(a => a.id !== deletedId))

      await api.deleteAssignment(deletedId)

    } catch (err) {
      console.error('Error deleting assignment:', err)
      alert('Error deleting assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      await Promise.all([loadAssignments(), loadProject()])
      mutatingRef.current = false
      setSavingEdit(false)
    }
  }

  /* ---------- Gantt drag handlers ---------- */

  const pxToBizDays = useCallback((px: number) => {
    if (!ganttRef.current) return 0
    const timelineWidth = ganttRef.current.clientWidth - NAME_COL
    return (px / timelineWidth) * TOTAL_BIZ_DAYS
  }, [])

  function startDrag(e: React.MouseEvent, assignmentId: string, mode: 'move' | 'resize-start' | 'resize-end', startDate: string, endDate: string) {
    if (readOnly) return
    e.stopPropagation()
    e.preventDefault()
    const asg = assignments.find(a => a.id === assignmentId)
    const eng = asg ? consultants.find(en => en.id === asg.consultant_id) : null
    setDragging({ assignmentId, consultantCountry: eng?.country || null, mode, startX: e.clientX, origStart: startDate, origEnd: endDate })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragging.startX
    const bizDelta = Math.round(pxToBizDays(dx))
    if (bizDelta === 0) return

    const origStart = new Date(dragging.origStart + 'T00:00:00')
    const origEnd = new Date(dragging.origEnd + 'T00:00:00')

    let newStart: string, newEnd: string

    if (dragging.mode === 'move') {
      newStart = dateToStr(advanceByBizDays(origStart, bizDelta))
      newEnd = dateToStr(advanceByBizDays(origEnd, bizDelta))
    } else if (dragging.mode === 'resize-start') {
      const s = advanceByBizDays(origStart, bizDelta)
      if (s >= origEnd) return
      newStart = dateToStr(s)
      newEnd = dragging.origEnd
    } else {
      const e2 = advanceByBizDays(origEnd, bizDelta)
      if (e2 <= origStart) return
      newStart = dragging.origStart
      newEnd = dateToStr(e2)
    }

    const bdays = calcBusinessDays(newStart, newEnd)
    const hols = countHolidaysInRangeArray(holidays, dragging.consultantCountry, newStart, newEnd)
    const newHours = (bdays - hols) * 8

    setAssignments(prev => prev.map(a =>
      a.id === dragging.assignmentId
        ? { ...a, start_date: newStart, end_date: newEnd, total_hours: newHours }
        : a
    ))
  }, [dragging, pxToBizDays, holidays, setAssignments])

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!dragging) return

    const dx = e.clientX - dragging.startX
    const bizDelta = Math.round(pxToBizDays(dx))

    const origStart = new Date(dragging.origStart + 'T00:00:00')
    const origEnd = new Date(dragging.origEnd + 'T00:00:00')

    let newStart: string, newEnd: string

    if (dragging.mode === 'move') {
      newStart = dateToStr(advanceByBizDays(origStart, bizDelta))
      newEnd = dateToStr(advanceByBizDays(origEnd, bizDelta))
    } else if (dragging.mode === 'resize-start') {
      const s = advanceByBizDays(origStart, bizDelta)
      if (s >= origEnd) { setDragging(null); return }
      newStart = dateToStr(s)
      newEnd = dragging.origEnd
    } else {
      const e2 = advanceByBizDays(origEnd, bizDelta)
      if (e2 <= origStart) { setDragging(null); return }
      newStart = dragging.origStart
      newEnd = dateToStr(e2)
    }

    setDragging(null)
    mutatingRef.current = true
    try {
      if (newStart !== dragging.origStart || newEnd !== dragging.origEnd) {
        const bdays = calcBusinessDays(newStart, newEnd)
        const hols = countHolidaysInRangeArray(holidays, dragging.consultantCountry, newStart, newEnd)
        const totalHours = (bdays - hols) * 8
        // Get current notes from local state instead of re-fetching
        const currentAsg = assignments.find(a => a.id === dragging.assignmentId)
        await api.updateAssignment({
          id: dragging.assignmentId,
          start_date: newStart,
          end_date: newEnd,
          total_hours: totalHours,
          notes: currentAsg?.notes || undefined,
        })
      }
    } catch (err) {
      console.error('Error in drag update:', err)
    } finally {
      await loadAssignments()
      await loadProject()
      mutatingRef.current = false
    }
  }, [dragging, pxToBizDays, holidays, assignments, mutatingRef, loadAssignments, loadProject])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  /* ---------- Drag-to-create (blank space) ---------- */

  function handleCreateMouseDown(e: React.MouseEvent, consultantId: string) {
    if (readOnly) return
    if (e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    setCreating({
      consultantId,
      rowKey: `eng-${consultantId}`,
      startX: e.clientX,
      currentX: e.clientX,
      timelineLeft: rect.left,
      timelineWidth: rect.width,
    })
  }

  async function autoCreateAssignment(consultantId: string, startDate: string, endDate: string, totalHours: number) {
    if (readOnly || !id) return
    mutatingRef.current = true
    try {
      await api.createAssignment({
        project_id: id,
        consultant_id: consultantId,
        start_date: startDate,
        end_date: endDate,
        total_hours: totalHours,
      })

    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      await Promise.all([loadAssignments(), loadProject()])
      mutatingRef.current = false
    }
  }

  useEffect(() => {
    if (!creating) return
    function onMove(e: MouseEvent) {
      setCreating(prev => prev ? { ...prev, currentX: e.clientX } : null)
    }
    function onUp(e: MouseEvent) {
      setCreating(prev => {
        if (!prev || !id) return null
        const d1 = pxToDate(prev.startX, prev.timelineLeft, prev.timelineWidth)
        const d2 = pxToDate(e.clientX, prev.timelineLeft, prev.timelineWidth)
        const startDate = d1 < d2 ? d1 : d2
        const endDate = d1 < d2 ? d2 : d1
        const startStr = dateToStr(startDate)
        const endStr = dateToStr(endDate)
        const bdays = calcBusinessDays(startStr, endStr)
        if (bdays >= 1) {
          const eng = consultants.find(en => en.id === prev.consultantId)
          const hols = countHolidaysInRangeArray(holidays, eng?.country || null, startStr, endStr)
          const totalHrs = (bdays - hols) * 8
          autoCreateAssignment(prev.consultantId, startStr, endStr, totalHrs)
        }
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [creating, timelineStart])

  /* ---------- Render helpers ---------- */

  function renderDragCreateZone(consultantId: string) {
    return (
      <div
        onMouseDown={e => handleCreateMouseDown(e, consultantId)}
        style={{ position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 1 }}
      />
    )
  }

  function renderCreatePreview(rowKey: string) {
    if (!creating || creating.rowKey !== rowKey) return null
    const d1 = pxToDate(creating.startX, creating.timelineLeft, creating.timelineWidth)
    const d2 = pxToDate(creating.currentX, creating.timelineLeft, creating.timelineWidth)
    const startDate = d1 < d2 ? d1 : d2
    const endDate = d1 < d2 ? d2 : d1
    const leftPct = dateToPct(startDate)
    const rightPct = dateToPct(advanceByBizDays(endDate, 1))
    const widthPct = rightPct - leftPct
    if (widthPct < 0.3) return null
    const startLabel = startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const endLabel = endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const bdays = calcBusinessDays(dateToStr(startDate), dateToStr(endDate))
    return (
      <div style={{
        position: 'absolute',
        left: `${Math.max(0, leftPct)}%`,
        width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`,
        top: 6, bottom: 6,
        background: 'rgba(17, 195, 219, 0.25)',
        border: '2px dashed var(--brand-green)',
        borderRadius: 4, zIndex: 6,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.55rem', color: 'var(--brand-green)', fontWeight: 600,
        overflow: 'hidden', whiteSpace: 'nowrap',
      }}>
        {widthPct > 4 ? `${startLabel} → ${endLabel} (${bdays}d)` : ''}
      </div>
    )
  }

  /* ---------- Gantt bar rendering ---------- */

  function renderBar(a: AssignmentWithConsultant, topOffset: number, project: { project_type: ProjectType | null; status: RevenueStatus }) {
    const aStart = new Date(a.start_date + 'T00:00:00')
    const aEnd = new Date(a.end_date + 'T00:00:00')
    const startPct = dateToPct(aStart)
    const endPct = dateToPct(advanceByBizDays(aEnd, 1))
    const widthPct = endPct - startPct

    if (startPct > 100 || endPct < 0) return null

    const pType = project.project_type || 'billable'
    const status = project.status
    const barBg = getBarBackground(pType, status)
    const textColor = getBarTextColor(pType, status)
    const isDraggingThis = dragging?.assignmentId === a.id

    return (
      <div
        key={a.id}
        title={`${a.consultants?.full_name || 'Unknown'}\n${a.start_date} → ${a.end_date}\n${a.total_hours} hrs${a.notes ? '\n' + a.notes : ''}`}
        style={{
          position: 'absolute',
          left: `${Math.max(startPct, 0)}%`,
          width: `${Math.min(widthPct, 100 - Math.max(startPct, 0))}%`,
          top: topOffset, height: 26,
          background: barBg, borderRadius: 4,
          border: '1px solid rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center',
          overflow: 'hidden', whiteSpace: 'nowrap',
          fontSize: '0.7rem', fontWeight: 600, color: textColor,
          opacity: isDraggingThis ? 0.7 : 0.9,
          zIndex: isDraggingThis ? 10 : 2,
          cursor: dragging ? 'grabbing' : 'grab',
          transition: isDraggingThis ? 'none' : 'opacity 150ms',
        }}
        onMouseEnter={e => { if (!dragging) e.currentTarget.style.opacity = '1' }}
        onMouseLeave={e => { if (!dragging) e.currentTarget.style.opacity = '0.9' }}
        onClick={e => {
          if (!dragging) { e.stopPropagation(); openEditModal(a) }
        }}
      >
        <div
          onMouseDown={e => startDrag(e, a.id, 'resize-start', a.start_date, a.end_date)}
          style={{ width: 6, minWidth: 6, height: '100%', cursor: 'ew-resize', flexShrink: 0 }}
        />
        <div
          onMouseDown={e => startDrag(e, a.id, 'move', a.start_date, a.end_date)}
          style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden', cursor: 'inherit' }}
        >
          {widthPct > 6 ? assignmentBarLabel(a.total_hours, a.start_date, a.end_date, holidayMap, consultants.find(e => e.id === a.consultant_id)?.country || null) : ''}
        </div>
        <div
          onMouseDown={e => startDrag(e, a.id, 'resize-end', a.start_date, a.end_date)}
          style={{ width: 6, minWidth: 6, height: '100%', cursor: 'ew-resize', flexShrink: 0 }}
        />
      </div>
    )
  }

  return {
    showForm,
    setShowForm,
    form,
    setForm,
    saving,
    editingAssignment,
    setEditingAssignment,
    savingEdit,
    weekOffset,
    setWeekOffset,
    dragging,
    creating,
    ganttRef,
    today,
    timelineStart,
    weeks,
    monthHeaders,
    todayPct,
    dateToPct,
    assignmentsByConsultant,
    handleAssign,
    removeAssignment,
    updateStatus,
    openEditModal,
    updateEditDates,
    handleSaveEdit,
    handleDeleteAssignment,
    startDrag,
    handleCreateMouseDown,
    renderDragCreateZone,
    renderCreatePreview,
    renderBar,
    VISIBLE_WEEKS,
    TOTAL_BIZ_DAYS,
  }
}
