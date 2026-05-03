import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import {
  calcBusinessDays,
  countHolidaysInRange,
  advanceByBizDays,
  dateToStr,
  EMPTY_ASSIGN_FORM,
  EMPTY_CONSULTANT_ASSIGN_FORM,
} from '../lib/resourcingUtils'
import type { AssignmentWithDetails, ConsultantWithAssignments, EditingAssignment } from '../types/resourcing'

interface UseAssignmentsArgs {
  readOnly: boolean
  consultants: ConsultantWithAssignments[]
  setConsultants: React.Dispatch<React.SetStateAction<ConsultantWithAssignments[]>>
  holidayMap: Map<string, string>
  mutatingRef: React.MutableRefObject<boolean>
  refreshAssignments: () => Promise<void>
  timelineStart: Date
  TOTAL_BIZ_DAYS: number
  NAME_COL: number
}

export function useAssignments({
  readOnly,
  consultants,
  setConsultants,
  holidayMap,
  mutatingRef,
  refreshAssignments,
  timelineStart,
  TOTAL_BIZ_DAYS,
  NAME_COL,
}: UseAssignmentsArgs) {
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM)
  const [savingAssign, setSavingAssign] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<EditingAssignment | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [dragging, setDragging] = useState<{
    assignmentId: string
    consultantCountry: string | null
    mode: 'move' | 'resize-start' | 'resize-end'
    startX: number
    origStart: string
    origEnd: string
  } | null>(null)
  const [creating, setCreating] = useState<{
    consultantId: string
    projectId?: string
    rowKey: string
    startX: number
    currentX: number
    timelineLeft: number
    timelineWidth: number
  } | null>(null)
  const [pendingCreate, setPendingCreate] = useState<{
    consultantId: string
    startDate: string
    endDate: string
    totalHours: number
    x: number
    y: number
  } | null>(null)
  const [pendingCreateProject, setPendingCreateProject] = useState<{
    projectId: string
    startDate: string
    endDate: string
    totalHours: number
    x: number
    y: number
  } | null>(null)
  const [addingForProject, setAddingForProject] = useState<string | null>(null)
  const [assignConsultantForm, setAssignConsultantForm] = useState(EMPTY_CONSULTANT_ASSIGN_FORM)

  // Auto-update hours when dates change (subtract holidays for consultant's country)
  function updateAssignDates(field: 'start_date' | 'end_date', value: string) {
    const updated = { ...assignForm, [field]: value }
    if (updated.start_date && updated.end_date) {
      const bdays = calcBusinessDays(updated.start_date, updated.end_date)
      const eng = addingFor ? consultants.find(e => e.id === addingFor) : null
      const hols = countHolidaysInRange(holidayMap, eng?.country || null, updated.start_date, updated.end_date)
      updated.total_hours = String((bdays - hols) * 8)
    }
    setAssignForm(updated)
  }

  // Inline assign handler — uses RPC to bypass PostgREST restrictions
  async function handleInlineAssign(consultantId: string) {
    if (readOnly) return
    if (!assignForm.project_id || !assignForm.start_date || !assignForm.end_date || !assignForm.total_hours) return
    setSavingAssign(true)
    mutatingRef.current = true
    try {
      await api.createAssignment({
        project_id: assignForm.project_id,
        consultant_id: consultantId,
        start_date: assignForm.start_date,
        end_date: assignForm.end_date,
        total_hours: parseFloat(assignForm.total_hours),
      })
      setAddingFor(null)
      setAssignForm(EMPTY_ASSIGN_FORM)
    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error creating assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      mutatingRef.current = false
      setSavingAssign(false)
    }
    refreshAssignments()
  }

  // Inline assign handler for project view — picks an consultant instead of a project
  async function handleInlineAssignForProject(projectId: string) {
    if (readOnly) return
    if (!assignConsultantForm.consultant_id || !assignConsultantForm.start_date || !assignConsultantForm.end_date || !assignConsultantForm.total_hours) return
    setSavingAssign(true)
    mutatingRef.current = true
    try {
      await api.createAssignment({
        project_id: projectId,
        consultant_id: assignConsultantForm.consultant_id,
        start_date: assignConsultantForm.start_date,
        end_date: assignConsultantForm.end_date,
        total_hours: parseFloat(assignConsultantForm.total_hours),
      })
      setAddingForProject(null)
      setAssignConsultantForm(EMPTY_CONSULTANT_ASSIGN_FORM)
    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error creating assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      mutatingRef.current = false
      setSavingAssign(false)
    }
    refreshAssignments()
  }

  function updateAssignConsultantDates(field: 'start_date' | 'end_date', value: string) {
    const updated = { ...assignConsultantForm, [field]: value }
    if (updated.start_date && updated.end_date) {
      const bdays = calcBusinessDays(updated.start_date, updated.end_date)
      const eng = updated.consultant_id ? consultants.find(e => e.id === updated.consultant_id) : null
      const hols = countHolidaysInRange(holidayMap, eng?.country || null, updated.start_date, updated.end_date)
      updated.total_hours = String((bdays - hols) * 8)
    }
    setAssignConsultantForm(updated)
  }

  // Auto-create assignment (no UI) — used when project is known from sub-row drag
  async function autoCreateAssignment(consultantId: string, projectId: string, startDate: string, endDate: string, totalHours: number) {
    if (readOnly) return
    mutatingRef.current = true
    try {
      await api.createAssignment({
        project_id: projectId,
        consultant_id: consultantId,
        start_date: startDate,
        end_date: endDate,
        total_hours: totalHours,
      })
    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      mutatingRef.current = false
    }
    refreshAssignments()
  }

  // Quick-create after drag — auto-creates assignment when project is picked
  async function handleQuickCreate(projectId: string) {
    if (readOnly) return
    if (!pendingCreate || !projectId) return
    mutatingRef.current = true
    setPendingCreate(null)
    try {
      await api.createAssignment({
        project_id: projectId,
        consultant_id: pendingCreate.consultantId,
        start_date: pendingCreate.startDate,
        end_date: pendingCreate.endDate,
        total_hours: pendingCreate.totalHours,
      })
    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      mutatingRef.current = false
    }
    refreshAssignments()
  }

  // Quick-create after drag in project view — auto-creates when consultant is picked
  async function handleQuickCreateForProject(consultantId: string) {
    if (readOnly) return
    if (!pendingCreateProject || !consultantId) return
    mutatingRef.current = true
    setPendingCreateProject(null)
    try {
      await api.createAssignment({
        project_id: pendingCreateProject.projectId,
        consultant_id: consultantId,
        start_date: pendingCreateProject.startDate,
        end_date: pendingCreateProject.endDate,
        total_hours: pendingCreateProject.totalHours,
      })
    } catch (err) {
      console.error('Error creating assignment:', err)
      alert('Error: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      mutatingRef.current = false
    }
    refreshAssignments()
  }

  // Edit assignment modal handlers — use RPC to bypass PostgREST restrictions
  async function handleSaveEdit() {
    if (readOnly) return
    if (!editingAssignment) return
    setSavingEdit(true)
    mutatingRef.current = true

    // Optimistic update — reflect change in UI immediately
    setConsultants(prev => prev.map(eng => ({
      ...eng,
      assignments: eng.assignments.map(a =>
        a.id === editingAssignment.id
          ? { ...a, start_date: editingAssignment.start_date, end_date: editingAssignment.end_date, total_hours: parseFloat(editingAssignment.total_hours), notes: editingAssignment.notes || null }
          : a
      ),
    })))

    // Close modal immediately — don't block UI on the RPC + trigger chain
    setSavingEdit(false)
    setEditingAssignment(null)

    try {
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
      // Revert optimistic update on error
      refreshAssignments()
      return
    } finally {
      mutatingRef.current = false
    }
    // Background refresh to pick up trigger side-effects (snapshot recalc, project dates)
    refreshAssignments()
  }

  async function handleDeleteAssignment() {
    if (readOnly) return
    if (!editingAssignment) return

    mutatingRef.current = true
    const deletedId = editingAssignment.id

    // Optimistic delete — close modal and remove from UI immediately
    setEditingAssignment(null)
    setSavingEdit(false)
    setConsultants(prev => prev.map(eng => ({
      ...eng,
      assignments: eng.assignments.filter(a => a.id !== deletedId),
    })))

    try {
      await api.deleteAssignment(deletedId)
    } catch (err) {
      console.error('Error deleting assignment:', err)
      alert('Error deleting assignment: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      mutatingRef.current = false
    }
    refreshAssignments()
  }

  function openEditModal(a: AssignmentWithDetails) {
    const projectLabel = a.projects
      ? `${a.projects.client_name} — ${a.projects.project_name}`
      : 'Unknown Project'
    setEditingAssignment({
      id: a.id,
      project_id: a.project_id,
      consultant_id: a.consultant_id,
      start_date: a.start_date,
      end_date: a.end_date,
      total_hours: String(a.total_hours),
      notes: a.notes || '',
      project_label: projectLabel,
    })
  }

  function updateEditDates(field: 'start_date' | 'end_date', value: string) {
    if (!editingAssignment) return
    const updated = { ...editingAssignment, [field]: value }
    if (updated.start_date && updated.end_date) {
      const bdays = calcBusinessDays(updated.start_date, updated.end_date)
      const eng = consultants.find(e => e.id === editingAssignment.consultant_id)
      const hols = countHolidaysInRange(holidayMap, eng?.country || null, updated.start_date, updated.end_date)
      updated.total_hours = String((bdays - hols) * 8)
    }
    setEditingAssignment(updated)
  }

  // Drag-to-create: convert pixel X position to a date (business-day math)
  function pxToDate(x: number, tlLeft: number, tlWidth: number): Date {
    const pct = Math.max(0, Math.min(1, (x - tlLeft) / tlWidth))
    const bizDayOffset = Math.round(pct * TOTAL_BIZ_DAYS)
    return advanceByBizDays(timelineStart, bizDayOffset)
  }

  // Start drag-to-create on mousedown in blank timeline
  function handleCreateMouseDown(e: React.MouseEvent, consultantId: string, projectId?: string) {
    if (readOnly) return
    if (e.button !== 0) return // left click only
    const rect = e.currentTarget.getBoundingClientRect()
    setCreating({
      consultantId,
      projectId,
      rowKey: !consultantId ? `pv-header-${projectId}` : (projectId ? `project-${consultantId}-${projectId}` : `header-${consultantId}`),
      startX: e.clientX,
      currentX: e.clientX,
      timelineLeft: rect.left,
      timelineWidth: rect.width,
    })
  }

  // Track mouse position during drag-to-create
  useEffect(() => {
    if (!creating) return
    function onMove(e: MouseEvent) {
      setCreating(prev => prev ? { ...prev, currentX: e.clientX } : null)
    }
    function onUp(e: MouseEvent) {
      setCreating(prev => {
        if (!prev) return null
        const d1 = pxToDate(prev.startX, prev.timelineLeft, prev.timelineWidth)
        const d2 = pxToDate(e.clientX, prev.timelineLeft, prev.timelineWidth)
        const startDate = d1 < d2 ? d1 : d2
        const endDate = d1 < d2 ? d2 : d1
        const startStr = dateToStr(startDate)
        const endStr = dateToStr(endDate)
        const bdays = calcBusinessDays(startStr, endStr)
        if (bdays >= 1) {
          const eng = prev.consultantId ? consultants.find(en => en.id === prev.consultantId) : null
          const hols = countHolidaysInRange(holidayMap, eng?.country || null, startStr, endStr)
          const totalHrs = (bdays - hols) * 8
          if (prev.projectId && prev.consultantId) {
            // Both known — auto-create immediately
            autoCreateAssignment(prev.consultantId, prev.projectId, startStr, endStr, totalHrs)
          } else if (prev.projectId && !prev.consultantId) {
            // Project view header row — show consultant picker
            setPendingCreateProject({
              projectId: prev.projectId,
              startDate: startStr,
              endDate: endStr,
              totalHours: totalHrs,
              x: e.clientX,
              y: e.clientY,
            })
          } else {
            // Consultant view header row — show project picker
            setPendingCreate({
              consultantId: prev.consultantId,
              startDate: startStr,
              endDate: endStr,
              totalHours: totalHrs,
              x: e.clientX,
              y: e.clientY,
            })
          }
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    if (!timelineWidthRef.current) return
    const timelineWidth = timelineWidthRef.current - NAME_COL
    const dx = e.clientX - dragging.startX
    const bizDelta = Math.round((dx / timelineWidth) * TOTAL_BIZ_DAYS)
    if (bizDelta === 0) return

    const origStart = new Date(dragging.origStart + 'T00:00:00')
    const origEnd = new Date(dragging.origEnd + 'T00:00:00')

    let newStart: string, newEnd: string

    if (dragging.mode === 'move') {
      const s = advanceByBizDays(origStart, bizDelta)
      const e2 = advanceByBizDays(origEnd, bizDelta)
      newStart = dateToStr(s)
      newEnd = dateToStr(e2)
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
    const hols = countHolidaysInRange(holidayMap, dragging.consultantCountry, newStart, newEnd)
    const newHours = (bdays - hols) * 8

    setConsultants(prev => prev.map(eng => ({
      ...eng,
      assignments: eng.assignments.map(a =>
        a.id === dragging.assignmentId
          ? { ...a, start_date: newStart, end_date: newEnd, total_hours: newHours }
          : a
      ),
    })))
  }, [dragging, NAME_COL, TOTAL_BIZ_DAYS, holidayMap, setConsultants])

  const timelineWidthRef = { current: 0 }

  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!dragging) return
    if (!timelineWidthRef.current) { setDragging(null); return }

    const timelineWidth = timelineWidthRef.current - NAME_COL
    const dx = e.clientX - dragging.startX
    const bizDelta = Math.round((dx / timelineWidth) * TOTAL_BIZ_DAYS)

    const origStart = new Date(dragging.origStart + 'T00:00:00')
    const origEnd = new Date(dragging.origEnd + 'T00:00:00')

    let newStart: string
    let newEnd: string

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
    if (newStart === dragging.origStart && newEnd === dragging.origEnd) return

    mutatingRef.current = true
    const bdays = calcBusinessDays(newStart, newEnd)
    const hols = countHolidaysInRange(holidayMap, dragging.consultantCountry, newStart, newEnd)
    const totalHours = (bdays - hols) * 8

    // Get notes from local state to avoid an extra DB round trip
    let notes: string | null = null
    for (const eng of consultants) {
      const a = eng.assignments.find(a => a.id === dragging.assignmentId)
      if (a) { notes = a.notes; break }
    }

    try {
      await api.updateAssignment({
        id: dragging.assignmentId,
        start_date: newStart,
        end_date: newEnd,
        total_hours: totalHours,
        notes: notes || undefined,
      })
    } catch (err) {
      console.error('Error in drag update:', err)
    } finally {
      mutatingRef.current = false
    }
    refreshAssignments()
  }, [dragging, NAME_COL, TOTAL_BIZ_DAYS, holidayMap, consultants, mutatingRef, refreshAssignments, setConsultants])

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

  function startDrag(e: React.MouseEvent, assignmentId: string, mode: 'move' | 'resize-start' | 'resize-end', startDate: string, endDate: string) {
    if (readOnly) return
    e.stopPropagation()
    e.preventDefault()
    const eng = consultants.find(en => en.assignments.some(a => a.id === assignmentId))
    setDragging({ assignmentId, consultantCountry: eng?.country || null, mode, startX: e.clientX, origStart: startDate, origEnd: endDate })
  }

  return {
    addingFor,
    setAddingFor,
    assignForm,
    setAssignForm,
    savingAssign,
    editingAssignment,
    setEditingAssignment,
    savingEdit,
    dragging,
    creating,
    pendingCreate,
    setPendingCreate,
    pendingCreateProject,
    setPendingCreateProject,
    addingForProject,
    setAddingForProject,
    assignConsultantForm,
    setAssignConsultantForm,
    updateAssignDates,
    handleInlineAssign,
    handleInlineAssignForProject,
    updateAssignConsultantDates,
    handleQuickCreate,
    handleQuickCreateForProject,
    handleSaveEdit,
    handleDeleteAssignment,
    openEditModal,
    updateEditDates,
    handleCreateMouseDown,
    startDrag,
    timelineWidthRef,
  }
}
