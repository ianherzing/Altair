import { useState, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useIsReadOnly } from '../lib/permissions'
import { LoadingState } from '../components/LoadingState'
import { SearchableSelect } from '../components/SearchableSelect'
import { SavedViewBar } from '../components/SavedViewBar'
import { TimelineGrid } from '../lib/TimelineGrid'
import { useResourcingData } from '../hooks/useResourcingData'
import { useResourcingFilters } from '../hooks/useResourcingFilters'
import { useAssignments } from '../hooks/useAssignments'
import {
  getBarBackground, getBarTextColor,
  HOLIDAY_BG, TYPE_LEGEND, STATUS_DOT_COLORS,
  EMPTY_ASSIGN_FORM, EMPTY_CONSULTANT_ASSIGN_FORM,
  getWeeks, formatWeek, getMonthHeaders,
  bizDaysBetween, advanceByBizDays, dateToStr,
  calcBusinessDays, calcWeeklyHours,
  countHolidaysInWeek, getHolidayDaysInWeek,
  assignmentBarLabel,
} from '../lib/resourcingUtils'
import {
  modalLabelStyle, modalInputStyle, navBtnStyle,
  filterInputStyle, inlineInputStyle, skillRangeInputStyle,
} from '../lib/resourcingStyles'
import type { AssignmentWithDetails, ProjectWithConsultants } from '../types/resourcing'

export function Resourcing() {
  const readOnly = useIsReadOnly()

  const {
    consultants, setConsultants, projects,
    consultantSkillsMap, passionAreas,
    skillFilters, setSkillFilters,
    loading, error, retry,
    mutatingRef, refreshAssignments, holidayMap,
  } = useResourcingData()

  const {
    viewMode, setViewMode,
    searchText, setSearchText,
    filterManager, setFilterManager,
    filterTitle, setFilterTitle,
    showTitleFilter, setShowTitleFilter,
    titleSearchText, setTitleSearchText,
    filterConsultants, setFilterConsultants,
    showConsultantFilter, setShowConsultantFilter,
    consultantSearchText, setConsultantSearchText,
    filterPassion, setFilterPassion,
    filterPracticeManager, setFilterPracticeManager,
    filterSow, setFilterSow,
    showSowFilter, setShowSowFilter,
    sowSearchText, setSowSearchText,
    filterStatus, setFilterStatus,
    showStatusFilter, setShowStatusFilter,
    showSkillFilters, setShowSkillFilters,
    managers, practiceManagers, titles,
    activeSkillFilters, sowNumbers,
    projectOptions, sortedConsultants,
    filteredConsultants,
    activeProjectGroups, doneProjectGroups,
    hasActiveFilters,
    toggleSkillFilter, updateSkillFilterRange, clearAllFilters,
    getFilters, applyFilters,
  } = useResourcingFilters({
    consultants, projects, consultantSkillsMap, passionAreas,
    skillFilters, setSkillFilters,
  })

  // Option lists for searchable filter dropdowns — lead with empty ("All ...") sentinel
  const managerOptions = useMemo(
    () => [{ value: '', label: 'All Managers' }, ...managers.map(m => ({ value: m, label: m }))],
    [managers]
  )
  const practiceManagerOptions = useMemo(
    () => [{ value: '', label: 'All Project Managers' }, ...practiceManagers.map(pm => ({ value: pm, label: pm }))],
    [practiceManagers]
  )
  const passionOptions = useMemo(
    () => [{ value: '', label: 'All Passion Areas' }, ...passionAreas.map(pa => ({ value: pa.id, label: pa.name }))],
    [passionAreas]
  )

  const [weekOffset, setWeekOffset] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const timelineRef = useRef<HTMLDivElement>(null)
  const [hiddenExpanded, setHiddenExpanded] = useState<Set<string>>(new Set())
  const [hiddenProjectsOpen, setHiddenProjectsOpen] = useState(false)

  const VISIBLE_WEEKS = 20

  const [nameColWidth, setNameColWidth] = useState(() => {
    const saved = localStorage.getItem('altair-name-col-width')
    return saved ? parseInt(saved) : 280
  })
  const NAME_COL = nameColWidth
  const [resizingCol, setResizingCol] = useState(false)

  function toggleHidden(engId: string) {
    setHiddenExpanded(prev => {
      const next = new Set(prev)
      if (next.has(engId)) next.delete(engId)
      else next.add(engId)
      return next
    })
  }

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, []) // Only compute once per mount — date doesn't change during session

  const timelineStart = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + weekOffset * 7)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // snap to Monday
    return d
  }, [weekOffset])

  const weeks = useMemo(() => getWeeks(timelineStart, VISIBLE_WEEKS), [timelineStart])
  const monthHeaders = useMemo(() => getMonthHeaders(weeks), [weeks])

  const TOTAL_BIZ_DAYS = VISIBLE_WEEKS * 5
  const todayPct = (bizDaysBetween(timelineStart, today) / TOTAL_BIZ_DAYS) * 100

  /** Convert a date to a timeline percentage using business-day math */
  function dateToPct(d: Date): number {
    return (bizDaysBetween(timelineStart, d) / TOTAL_BIZ_DAYS) * 100
  }

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const {
    addingFor, setAddingFor,
    assignForm, setAssignForm,
    savingAssign,
    editingAssignment, setEditingAssignment,
    savingEdit,
    dragging,
    creating,
    pendingCreate, setPendingCreate,
    pendingCreateProject, setPendingCreateProject,
    addingForProject, setAddingForProject,
    assignConsultantForm, setAssignConsultantForm,
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
  } = useAssignments({
    readOnly, consultants, setConsultants,
    holidayMap, mutatingRef, refreshAssignments,
    timelineStart, TOTAL_BIZ_DAYS, NAME_COL,
  })

  // Keep timelineWidthRef in sync with actual timeline width
  if (timelineRef.current) {
    timelineWidthRef.current = timelineRef.current.clientWidth
  }

  // Column resize handler
  function handleColResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = NAME_COL
    setResizingCol(true)

    function onMove(ev: MouseEvent) {
      setNameColWidth(Math.max(180, Math.min(600, startWidth + (ev.clientX - startX))))
    }
    function onUp(ev: MouseEvent) {
      const finalWidth = Math.max(180, Math.min(600, startWidth + (ev.clientX - startX)))
      setResizingCol(false)
      setNameColWidth(finalWidth)
      localStorage.setItem('altair-name-col-width', String(finalWidth))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function renderBar(a: AssignmentWithDetails, topOffset: number, country: string | null = null) {
    const aStart = new Date(a.start_date + 'T00:00:00')
    const aEnd = new Date(a.end_date + 'T00:00:00')
    const startPct = dateToPct(aStart)
    // End date is inclusive, so add 1 biz day for visual width
    const endPct = dateToPct(advanceByBizDays(aEnd, 1))
    const widthPct = endPct - startPct

    if (startPct > 100 || endPct < 0) return null

    const pType = a.projects?.project_type || 'billable'
    const status = a.projects?.status || 'soft_unconfirmed'
    const barBg = getBarBackground(pType, status)
    const textColor = getBarTextColor(pType, status)
    const projectLabel = a.projects
      ? `${a.projects.client_name} — ${a.projects.project_name}`
      : 'Unknown Project'
    const isDraggingThis = dragging?.assignmentId === a.id

    return (
      <div
        key={a.id}
        title={`${projectLabel}\n${a.start_date} → ${a.end_date}\n${a.total_hours} hrs`}
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
      >
        <div
          onMouseDown={e => startDrag(e, a.id, 'resize-start', a.start_date, a.end_date)}
          style={{ width: 6, minWidth: 6, height: '100%', cursor: 'ew-resize', flexShrink: 0 }}
        />
        <div
          onMouseDown={e => startDrag(e, a.id, 'move', a.start_date, a.end_date)}
          onClick={e => { if (!dragging) { e.stopPropagation(); openEditModal(a) } }}
          style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', padding: '0 4px', overflow: 'hidden' }}
        >
          {widthPct > 6 ? assignmentBarLabel(a.total_hours, a.start_date, a.end_date, holidayMap, country) : ''}
        </div>
        <div
          onMouseDown={e => startDrag(e, a.id, 'resize-end', a.start_date, a.end_date)}
          style={{ width: 6, minWidth: 6, height: '100%', cursor: 'ew-resize', flexShrink: 0 }}
        />
      </div>
    )
  }

  /** Render a drag-to-create zone over the timeline for an consultant row */
  function renderDragCreateZone(consultantId: string, projectId?: string) {
    return (
      <div
        onMouseDown={e => handleCreateMouseDown(e, consultantId, projectId)}
        style={{
          position: 'absolute', inset: 0, cursor: 'crosshair', zIndex: 1,
        }}
      />
    )
  }

  /** Render the drag-to-create preview bar — snapped to day boundaries, shows day labels */
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

  // Local pxToDate for renderCreatePreview (uses component-level timelineStart)
  function pxToDate(x: number, tlLeft: number, tlWidth: number): Date {
    const pct = Math.max(0, Math.min(1, (x - tlLeft) / tlWidth))
    const bizDayOffset = Math.round(pct * TOTAL_BIZ_DAYS)
    return advanceByBizDays(timelineStart, bizDayOffset)
  }

  /** Render utilization % labels per week — red if over-allocated, adjusted for holidays */
  function renderUtilization(weeklyHours: number[], engCountry: string | null) {
    return weeklyHours.map((hrs, i) => {
      if (hrs === -1) return null // pre-hire
      if (hrs === 0) return null
      const holidaysInWeek = countHolidaysInWeek(holidayMap, engCountry, weeks[i])
      const availableHours = (5 - holidaysInWeek) * 8
      if (availableHours === 0) return null
      const pct = Math.round((hrs / availableHours) * 100)
      const isOver = pct > 100
      return (
        <div
          key={`util-${i}`}
          style={{
            position: 'absolute',
            left: `${(i / VISIBLE_WEEKS) * 100}%`,
            width: `${(1 / VISIBLE_WEEKS) * 100}%`,
            top: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.6rem', fontWeight: 700,
            color: isOver ? '#d98f45' : 'rgba(255,255,255,0.95)',
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
            zIndex: 3,
            pointerEvents: 'none',
          }}
          title={`${Math.round(hrs)}h / ${availableHours}h${holidaysInWeek > 0 ? ` (${holidaysInWeek} holiday${holidaysInWeek > 1 ? 's' : ''})` : ''} (${pct}%)`}
        >
          {pct}%
        </div>
      )
    })
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading resourcing view..." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0 }}>Resourcing</h2>
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <button
              onClick={() => { setViewMode('consultant'); localStorage.setItem('altair-resourcing-view-mode', 'consultant') }}
              style={{
                ...navBtnStyle, border: 'none', borderRadius: 0, fontSize: '0.7rem', padding: '0.25rem 0.6rem',
                background: viewMode === 'consultant' ? 'var(--brand-green-dark)' : 'var(--bg-card)',
                color: viewMode === 'consultant' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              By Consultant
            </button>
            <button
              onClick={() => { setViewMode('project'); localStorage.setItem('altair-resourcing-view-mode', 'project') }}
              style={{
                ...navBtnStyle, border: 'none', borderRadius: 0, fontSize: '0.7rem', padding: '0.25rem 0.6rem',
                background: viewMode === 'project' ? 'var(--brand-green-dark)' : 'var(--bg-card)',
                color: viewMode === 'project' ? '#fff' : 'var(--text-secondary)',
              }}
            >
              By Project
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', flexShrink: 0 }}>
        <input
          type="text" placeholder="Search name, skill, passion area, ALT-ID..."
          value={searchText} onChange={e => setSearchText(e.target.value)}
          style={{ ...filterInputStyle, width: 220 }}
        />
        <SearchableSelect
          value={filterManager}
          onChange={setFilterManager}
          options={managerOptions}
          placeholder="All Managers"
          style={{ minWidth: 170 }}
        />
        <SearchableSelect
          value={filterPracticeManager}
          onChange={setFilterPracticeManager}
          options={practiceManagerOptions}
          placeholder="All Project Managers"
          style={{ minWidth: 220 }}
        />
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTitleFilter(!showTitleFilter)}
            style={{
              ...filterInputStyle,
              cursor: 'pointer',
              background: filterTitle.size > 0 ? 'var(--brand-green-dark)' : 'var(--bg-card)',
              color: filterTitle.size > 0 ? '#fff' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{filterTitle.size > 0 ? `Titles (${filterTitle.size})` : 'All Titles'}</span>
            <span style={{ fontSize: '0.5rem', marginLeft: 'auto' }}>{showTitleFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showTitleFilter && (
            <>
            <div onClick={() => { setShowTitleFilter(false); setTitleSearchText('') }} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, width: 240, maxHeight: 320, display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search title..."
                  value={titleSearchText}
                  onChange={e => setTitleSearchText(e.target.value)}
                  style={{ ...filterInputStyle, width: '100%', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filterTitle.size > 0 && (
                  <div
                    onClick={() => setFilterTitle(new Set())}
                    style={{
                      padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    Clear selection
                  </div>
                )}
                {titles
                  .filter(t => !titleSearchText || t.toLowerCase().includes(titleSearchText.toLowerCase()))
                  .map(t => (
                  <label key={t} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                    color: filterTitle.has(t) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <input
                      type="checkbox"
                      checked={filterTitle.has(t)}
                      onChange={() => setFilterTitle(prev => {
                        const next = new Set(prev)
                        if (next.has(t)) next.delete(t)
                        else next.add(t)
                        return next
                      })}
                      style={{ accentColor: 'var(--brand-green)', flexShrink: 0 }}
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            </>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowConsultantFilter(!showConsultantFilter)}
            style={{
              ...filterInputStyle,
              cursor: 'pointer',
              background: filterConsultants.size > 0 ? 'var(--brand-green-dark)' : 'var(--bg-card)',
              color: filterConsultants.size > 0 ? '#fff' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{filterConsultants.size > 0 ? `Consultants (${filterConsultants.size})` : 'All Consultants'}</span>
            <span style={{ fontSize: '0.5rem', marginLeft: '0.25rem' }}>{showConsultantFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showConsultantFilter && (
            <>
            <div onClick={() => { setShowConsultantFilter(false); setConsultantSearchText('') }} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, width: 240, maxHeight: 320, display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search consultant..."
                  value={consultantSearchText}
                  onChange={e => setConsultantSearchText(e.target.value)}
                  style={{ ...filterInputStyle, width: '100%', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filterConsultants.size > 0 && (
                  <div
                    onClick={() => setFilterConsultants(new Set())}
                    style={{
                      padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    Clear selection
                  </div>
                )}
                {sortedConsultants
                  .filter(eng => !consultantSearchText || eng.full_name.toLowerCase().includes(consultantSearchText.toLowerCase()))
                  .map(eng => (
                  <label key={eng.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                    color: filterConsultants.has(eng.id) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <input
                      type="checkbox"
                      checked={filterConsultants.has(eng.id)}
                      onChange={() => setFilterConsultants(prev => {
                        const next = new Set(prev)
                        if (next.has(eng.id)) next.delete(eng.id)
                        else next.add(eng.id)
                        return next
                      })}
                      style={{ accentColor: 'var(--brand-green)', flexShrink: 0 }}
                    />
                    {eng.full_name}
                  </label>
                ))}
              </div>
            </div>
            </>
          )}
        </div>
        <SearchableSelect
          value={filterPassion}
          onChange={setFilterPassion}
          options={passionOptions}
          placeholder="All Passion Areas"
          style={{ minWidth: 170 }}
        />
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSowFilter(!showSowFilter)}
            style={{
              ...filterInputStyle,
              cursor: 'pointer',
              background: filterSow.size > 0 ? 'var(--brand-green-dark)' : 'var(--bg-card)',
              color: filterSow.size > 0 ? '#fff' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{filterSow.size > 0 ? `SOW # (${filterSow.size})` : 'All SOWs'}</span>
            <span style={{ fontSize: '0.5rem', marginLeft: 'auto' }}>{showSowFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showSowFilter && (
            <>
            <div onClick={() => { setShowSowFilter(false); setSowSearchText('') }} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, width: 240, maxHeight: 320, display: 'flex', flexDirection: 'column',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search SOW #..."
                  value={sowSearchText}
                  onChange={e => setSowSearchText(e.target.value)}
                  style={{ ...filterInputStyle, width: '100%', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                />
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filterSow.size > 0 && (
                  <div
                    onClick={() => setFilterSow(new Set())}
                    style={{
                      padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    Clear selection
                  </div>
                )}
                {sowNumbers
                  .filter(sow => !sowSearchText || sow.toLowerCase().includes(sowSearchText.toLowerCase()))
                  .map(sow => (
                  <label key={sow} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                    color: filterSow.has(sow) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <input
                      type="checkbox"
                      checked={filterSow.has(sow)}
                      onChange={() => setFilterSow(prev => {
                        const next = new Set(prev)
                        if (next.has(sow)) next.delete(sow)
                        else next.add(sow)
                        return next
                      })}
                      style={{ accentColor: 'var(--brand-green)', flexShrink: 0 }}
                    />
                    {sow}
                  </label>
                ))}
              </div>
            </div>
            </>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowStatusFilter(!showStatusFilter)}
            style={{
              ...filterInputStyle,
              cursor: 'pointer',
              background: filterStatus.size > 0 ? 'var(--brand-green-dark)' : 'var(--bg-card)',
              color: filterStatus.size > 0 ? '#fff' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{filterStatus.size > 0 ? `Status (${filterStatus.size})` : 'All Statuses'}</span>
            <span style={{ fontSize: '0.5rem', marginLeft: 'auto' }}>{showStatusFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showStatusFilter && (
            <>
            <div onClick={() => setShowStatusFilter(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 6, width: 220,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ overflowY: 'auto' }}>
                {filterStatus.size > 0 && (
                  <div
                    onClick={() => setFilterStatus(new Set())}
                    style={{
                      padding: '0.4rem 0.75rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    Clear selection
                  </div>
                )}
                {([
                  ['to_do', 'To Do'],
                  ['soft_unconfirmed', 'Soft — Unconfirmed'],
                  ['soft_at_risk', 'Soft — At Risk'],
                  ['hard_scheduled', 'Hard Scheduled'],
                  ['active', 'Active'],
                  ['done', 'Done'],
                ] as [string, string][]).map(([value, label]) => (
                  <label key={value} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                    color: filterStatus.has(value) ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    <input
                      type="checkbox"
                      checked={filterStatus.has(value)}
                      onChange={() => setFilterStatus(prev => {
                        const next = new Set(prev)
                        if (next.has(value)) next.delete(value)
                        else next.add(value)
                        return next
                      })}
                      style={{ accentColor: 'var(--brand-green)', flexShrink: 0 }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            </>
          )}
        </div>
        <button
          onClick={() => setShowSkillFilters(!showSkillFilters)}
          style={{
            ...navBtnStyle, fontSize: '0.75rem', padding: '0.3rem 0.6rem',
            background: activeSkillFilters.length > 0 ? 'var(--brand-green-dark)' : 'var(--bg-card)',
            color: activeSkillFilters.length > 0 ? '#fff' : 'var(--text-secondary)',
          }}
        >
          Skills {activeSkillFilters.length > 0 ? `(${activeSkillFilters.length})` : ''}
        </button>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} style={{ ...navBtnStyle, fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
            Clear Filters
          </button>
        )}
        <SavedViewBar page="resourcing" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {viewMode === 'consultant'
            ? `${filteredConsultants.length} of ${consultants.length} consultants`
            : `${activeProjectGroups.length + doneProjectGroups.length} projects (${filteredConsultants.length} consultants)`
          }
        </span>
      </div>

      {/* Skill filter panel */}
      {showSkillFilters && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6,
          padding: '0.75rem 1rem', marginBottom: '0.75rem',
          display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1.5rem', flexShrink: 0,
        }}>
          {skillFilters.map(sf => (
            <label key={sf.skillId} style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer',
            }}>
              <input type="checkbox" checked={sf.enabled} onChange={() => toggleSkillFilter(sf.skillId)}
                style={{ accentColor: 'var(--brand-green)' }} />
              <span>{sf.name}</span>
              {sf.enabled && (
                <>
                  <input type="number" min={1} max={3} value={sf.min}
                    onChange={e => updateSkillFilterRange(sf.skillId, 'min', parseInt(e.target.value) || 1)}
                    style={skillRangeInputStyle} onClick={e => e.stopPropagation()} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>to</span>
                  <input type="number" min={1} max={3} value={sf.max}
                    onChange={e => updateSkillFilterRange(sf.skillId, 'max', parseInt(e.target.value) || 3)}
                    style={skillRangeInputStyle} onClick={e => e.stopPropagation()} />
                </>
              )}
            </label>
          ))}
        </div>
      )}


      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.75rem', flexShrink: 0 }}>
        {TYPE_LEGEND.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: item.background || item.color }} />
            <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
          </div>
        ))}
      </div>

      <div ref={timelineRef} style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, userSelect: (dragging || resizingCol) ? 'none' : 'auto', minHeight: 0 }}>
        <div style={{ minWidth: NAME_COL + VISIBLE_WEEKS * 50 }}>

          {/* Sticky header group: nav + month + week headers */}
          <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
            {/* Month headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-card)', padding: '0.25rem 0.5rem', position: 'sticky', left: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <button onClick={() => setWeekOffset(w => w - 4)} style={{ ...navBtnStyle, fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>&larr;</button>
                <button onClick={() => setWeekOffset(0)} style={{ ...navBtnStyle, fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>Today</button>
                <button onClick={() => setWeekOffset(w => w + 4)} style={{ ...navBtnStyle, fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>&rarr;</button>
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                {monthHeaders.map((mh, i) => (
                  <div key={i} style={{
                    flex: `0 0 ${(mh.span / VISIBLE_WEEKS) * 100}%`,
                    textAlign: 'center', padding: '0.5rem 0', fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--text-primary)', background: 'var(--bg-card)',
                    borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>
                    {mh.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Week headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-card)', padding: '0.4rem 1rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, position: 'sticky', left: 0, zIndex: 5, display: 'flex', alignItems: 'center' }}>
                {viewMode === 'consultant' ? 'CONSULTANT' : 'PROJECT'}
                <button
                  onClick={() => {
                    if (viewMode === 'consultant') {
                      const allIds = filteredConsultants.map(e => e.id)
                      const allCollapsed = allIds.every(id => collapsed.has(id))
                      setCollapsed(allCollapsed ? new Set() : new Set(allIds))
                    } else {
                      const allIds = [...activeProjectGroups, ...doneProjectGroups].map(pg => pg.project.id)
                      const allCollapsed = allIds.every(id => collapsed.has(id))
                      setCollapsed(allCollapsed ? new Set() : new Set(allIds))
                    }
                  }}
                  title={(() => {
                    const allIds = viewMode === 'consultant'
                      ? filteredConsultants.map(e => e.id)
                      : [...activeProjectGroups, ...doneProjectGroups].map(pg => pg.project.id)
                    return allIds.every(id => collapsed.has(id)) ? 'Expand all' : 'Collapse all'
                  })()}
                  style={{
                    marginLeft: '0.5rem', background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 3, color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.6rem',
                    padding: '0.1rem 0.35rem', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '0.2rem',
                  }}
                >
                  {(() => {
                    const allIds = viewMode === 'consultant'
                      ? filteredConsultants.map(e => e.id)
                      : [...activeProjectGroups, ...doneProjectGroups].map(pg => pg.project.id)
                    return allIds.every(id => collapsed.has(id))
                      ? <><span style={{ fontSize: '0.5rem' }}>{'\u25BC'}</span> Expand</>
                      : <><span style={{ fontSize: '0.5rem' }}>{'\u25B6'}</span> Collapse</>
                  })()}
                </button>
                <div
                  onMouseDown={handleColResizeStart}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
                    cursor: 'col-resize', zIndex: 10,
                    background: resizingCol ? 'var(--brand-green)' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!resizingCol) e.currentTarget.style.background = 'var(--border)' }}
                  onMouseLeave={e => { if (!resizingCol) e.currentTarget.style.background = 'transparent' }}
                />
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                {weeks.map((w, i) => {
                  const isThisWeek = w <= today && new Date(w.getTime() + 7 * 86400000) > today
                  return (
                    <div key={i} style={{
                      flex: `0 0 ${100 / VISIBLE_WEEKS}%`, textAlign: 'center', padding: '0.4rem 0',
                      fontSize: '0.6rem', color: isThisWeek ? 'var(--brand-green)' : 'var(--text-muted)',
                      fontWeight: isThisWeek ? 700 : 400, background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                      {formatWeek(w)}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Consultant rows */}
          {viewMode === 'consultant' && filteredConsultants.map((eng, engIdx) => {
            const isCollapsed = collapsed.has(eng.id)
            const isAddingHere = addingFor === eng.id
            const subRowHeight = 36
            const weeklyHours = calcWeeklyHours(eng.assignments, weeks, holidayMap, eng.country, eng.hire_date)
            const isTerminated = eng.offboarded_at != null
            const isEvenRow = engIdx % 2 === 0

            return (
              <div key={eng.id} style={{ borderBottom: '1px solid var(--border)', opacity: isTerminated ? 0.55 : 1, background: isEvenRow ? 'transparent' : 'rgba(255,255,255,0.02)', position: 'relative' }}>
                {/* Holiday background — spans header row + expanded sub-rows */}
                <div style={{
                  position: 'absolute', left: NAME_COL, right: 0, top: 0, bottom: 0,
                  pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
                }}>
                  {weeks.map((w, i) => {
                    const holDays = getHolidayDaysInWeek(holidayMap, eng.country, w)
                    if (holDays.length === 0) return null
                    const weekLeft = (i / VISIBLE_WEEKS) * 100
                    const dayWidth = (1 / VISIBLE_WEEKS) * 100 / 5
                    return holDays.map((hd) => (
                      <div key={`hol-${i}-${hd.dayIndex}`} title={hd.name} style={{
                        position: 'absolute',
                        left: `${weekLeft + hd.dayIndex * dayWidth}%`,
                        width: `${dayWidth}%`,
                        top: 0, bottom: 0,
                        background: HOLIDAY_BG,
                      }} />
                    ))
                  })}
                </div>

                {/* Consultant header row */}
                <div style={{ display: 'flex', minHeight: 44 }}>
                  <div style={{
                    width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                    padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    borderRight: '1px solid var(--border)',
                    background: isEvenRow ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-card) 94%, var(--text-primary) 6%)',
                    position: 'sticky', left: 0, zIndex: 4,
                  }}>
                    <span onClick={() => toggleCollapse(eng.id)}
                      style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: 14, flexShrink: 0, cursor: 'pointer' }}>
                      {isCollapsed ? '\u25B6' : '\u25BC'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isTerminated ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {eng.full_name}
                        {isTerminated && (
                          <span style={{
                            fontSize: '0.55rem',
                            fontWeight: 600,
                            color: '#d98f45',
                            background: '#d98f4530',
                            border: '1px solid #d98f4550',
                            borderRadius: 3,
                            padding: '0.1rem 0.35rem',
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.04em',
                          }}>
                            Terminated
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>{eng.title || ''}</span>
                      </div>
                    </div>
                    {!isCollapsed && !readOnly && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (isAddingHere) { setAddingFor(null); setAssignForm(EMPTY_ASSIGN_FORM) }
                          else { setAddingFor(eng.id); setAssignForm(EMPTY_ASSIGN_FORM) }
                        }}
                        style={{ ...navBtnStyle, fontSize: '0.65rem', padding: '0.2rem 0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                        title="Assign to project"
                      >
                        {isAddingHere ? 'Cancel' : '+ Assign'}
                      </button>
                    )}
                  </div>

                  {/* Timeline area */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={todayPct} />

                    {/* Pre-hire background (greyed out) */}
                    {weeklyHours.map((hrs, i) => {
                      if (hrs !== -1) return null
                      return (
                        <div key={`prehire-${i}`} style={{
                          position: 'absolute',
                          left: `${(i / VISIBLE_WEEKS) * 100}%`,
                          width: `${(1 / VISIBLE_WEEKS) * 100}%`,
                          top: 0, bottom: 0,
                          background: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(100,100,100,0.15) 3px, rgba(100,100,100,0.15) 6px)',
                          zIndex: 0,
                        }} />
                      )
                    })}

                    {/* Over-allocation background highlights */}
                    {weeklyHours.map((hrs, i) => {
                      if (hrs <= 40) return null
                      return (
                        <div key={`over-${i}`} style={{
                          position: 'absolute',
                          left: `${(i / VISIBLE_WEEKS) * 100}%`,
                          width: `${(1 / VISIBLE_WEEKS) * 100}%`,
                          top: 0, bottom: 0,
                          background: 'rgba(217, 143, 69, 0.14)',
                          zIndex: 0,
                        }} />
                      )
                    })}

                    {/* Utilization % per week */}
                    {renderUtilization(weeklyHours, eng.country)}

                    {/* Collapsed: thin ticks */}
                    {isCollapsed && eng.assignments.map((a) => {
                      const aStart = new Date(a.start_date + 'T00:00:00')
                      const aEnd = new Date(a.end_date + 'T00:00:00')
                      const startPct = dateToPct(aStart)
                      const endPct = dateToPct(advanceByBizDays(aEnd, 1))
                      const widthPct = endPct - startPct
                      if (startPct > 100 || endPct < 0) return null
                      const pType = a.projects?.project_type || 'billable'
                      const status = a.projects?.status || 'soft_unconfirmed'
                      return (
                        <div key={a.id} style={{
                          position: 'absolute',
                          left: `${Math.max(startPct, 0)}%`,
                          width: `${Math.min(widthPct, 100 - Math.max(startPct, 0))}%`,
                          top: '12%', height: '76%', borderRadius: 4,
                          background: getBarBackground(pType, status), opacity: 0.95, zIndex: 2,
                          border: '1px solid rgba(255,255,255,0.15)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                      )
                    })}

                    {/* Collapsed empty */}
                    {isCollapsed && eng.assignments.length === 0 && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5,
                      }}>
                        Available
                      </div>
                    )}

                    {/* Drag-to-create zone — works on all rows */}
                    {renderDragCreateZone(eng.id)}
                    {renderCreatePreview(`header-${eng.id}`)}
                  </div>
                </div>

                {/* Expanded sub-rows — grouped by project */}
                {!isCollapsed && (() => {
                  const projectGroups = new Map<string, AssignmentWithDetails[]>()
                  for (const a of eng.assignments) {
                    const list = projectGroups.get(a.project_id) || []
                    list.push(a)
                    projectGroups.set(a.project_id, list)
                  }

                  const activeProjects: [string, AssignmentWithDetails[]][] = []
                  const doneProjects: [string, AssignmentWithDetails[]][] = []

                  for (const [projectId, assignments] of projectGroups.entries()) {
                    const first = assignments[0]
                    if (first.projects?.status === 'done') {
                      doneProjects.push([projectId, assignments])
                    } else {
                      activeProjects.push([projectId, assignments])
                    }
                  }

                  const isHiddenOpen = hiddenExpanded.has(eng.id)

                  // Helper to render a project sub-row (reused for both active and done)
                  function renderProjectRow(projectId: string, assignments: AssignmentWithDetails[]) {
                    const first = assignments[0]
                    const projectLabel = first.projects
                      ? `${first.projects.client_name} — ${first.projects.project_name}`
                      : 'Unknown Project'
                    const totalHours = assignments.reduce((sum, a) => sum + Number(a.total_hours), 0)

                    return (
                      <div key={projectId} style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{
                          width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                          padding: '0.25rem 0.75rem 0.25rem 2rem',
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          borderRight: '1px solid var(--border)',
                          background: 'var(--bg-card-alt)', fontSize: '0.75rem',
                          position: 'sticky', left: 0, zIndex: 4,
                        }}>
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            overflow: 'hidden', flex: 1,
                          }} title={projectLabel}>
                            <span style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: STATUS_DOT_COLORS[first.projects?.status || 'soft_unconfirmed'] || '#E63948',
                            }} />
                            <Link to={`/projects/${projectId}`} style={{
                              color: 'var(--text-secondary)', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              textDecoration: 'none',
                            }}>
                              {projectLabel}
                            </Link>
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>
                            {totalHours}h
                          </span>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={todayPct} opacity={0.2} />
                          {renderDragCreateZone(eng.id, projectId)}
                          {assignments.map(a => renderBar(a, 5, eng.country))}
                          {renderCreatePreview(`project-${eng.id}-${projectId}`)}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <>
                      {activeProjects.map(([pid, assigns]) => renderProjectRow(pid, assigns))}
                      {doneProjects.length > 0 && (
                        <>
                          <div
                            style={{
                              display: 'flex', minHeight: 28, borderTop: '1px solid var(--border-subtle)',
                              cursor: 'pointer', userSelect: 'none',
                            }}
                            onClick={() => toggleHidden(eng.id)}
                          >
                            <div style={{
                              width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                              padding: '0.2rem 0.75rem 0.2rem 2rem',
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              borderRight: '1px solid var(--border)',
                              background: 'var(--bg-card)', fontSize: '0.7rem',
                              color: 'var(--text-muted)', fontStyle: 'italic',
                              position: 'sticky', left: 0, zIndex: 4,
                            }}>
                              <span style={{ fontSize: '0.55rem', width: 10 }}>
                                {isHiddenOpen ? '\u25BC' : '\u25B6'}
                              </span>
                              Hidden ({doneProjects.length})
                            </div>
                            <div style={{
                              flex: 1, background: 'var(--bg-card)', opacity: 0.5,
                            }} />
                          </div>
                          {isHiddenOpen && doneProjects.map(([pid, assigns]) => renderProjectRow(pid, assigns))}
                        </>
                      )}
                    </>
                  )
                })()}

                {/* Inline add assignment form */}
                {!isCollapsed && isAddingHere && (
                  // zIndex 50 keeps the SearchableSelect dropdown above other
                  // rows' bars (zIndex 2, or 10 when dragging) when it expands
                  // down into the next consultant row.
                  <div style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)', position: 'relative', zIndex: 50 }}>
                    <div style={{
                      width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem',
                      display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem',
                    }}>
                      <SearchableSelect
                        value={assignForm.project_id}
                        onChange={val => setAssignForm({ ...assignForm, project_id: val })}
                        placeholder="Select Project..."
                        style={{ flex: 2 }}
                        options={projectOptions}
                      />
                      <input type="date" value={assignForm.start_date}
                        onChange={e => updateAssignDates('start_date', e.target.value)}
                        style={{ ...inlineInputStyle, flex: 1 }} />
                      <input type="date" value={assignForm.end_date}
                        onChange={e => updateAssignDates('end_date', e.target.value)}
                        style={{ ...inlineInputStyle, flex: 1 }} />
                      <input type="number" placeholder="Hours" step="0.5" min="0.5"
                        value={assignForm.total_hours}
                        onChange={e => setAssignForm({ ...assignForm, total_hours: e.target.value })}
                        style={{ ...inlineInputStyle, width: 70, flex: 0 }} />
                      <button
                        onClick={() => handleInlineAssign(eng.id)}
                        disabled={savingAssign || !assignForm.project_id || !assignForm.start_date || !assignForm.end_date || !assignForm.total_hours}
                        style={{
                          ...navBtnStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem',
                          background: 'var(--brand-green-dark)', color: '#fff', border: 'none',
                          opacity: (savingAssign || !assignForm.project_id) ? 0.6 : 1,
                        }}
                      >
                        {savingAssign ? '...' : 'Add'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!isCollapsed && eng.assignments.length === 0 && !isAddingHere && (
                  <div style={{
                    padding: '0.5rem 2rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card-alt)',
                    position: 'relative', zIndex: 1,
                  }}>
                    No assignments — click "+ Assign" or click a week on the timeline
                  </div>
                )}
              </div>
            )
          })}

          {/* Project rows */}
          {viewMode === 'project' && (() => {
            const subRowHeight = 36

            function renderProjectGroupRow(pg: ProjectWithConsultants, pgIdx: number) {
              const isCollapsed = collapsed.has(pg.project.id)
              const isAddingHere = addingForProject === pg.project.id
              const projectLabel = `${pg.project.client_name} — ${pg.project.project_name}`
              const isEvenRow = pgIdx % 2 === 0

              return (
                <div key={pg.project.id} style={{ borderBottom: '1px solid var(--border)', background: isEvenRow ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  {/* Project header row */}
                  <div style={{ display: 'flex', minHeight: 44 }}>
                    <div style={{
                      width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                      padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      borderRight: '1px solid var(--border)',
                      background: isEvenRow ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-card) 94%, var(--text-primary) 6%)',
                      position: 'sticky', left: 0, zIndex: 4,
                    }}>
                      <span onClick={() => toggleCollapse(pg.project.id)}
                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: 14, flexShrink: 0, cursor: 'pointer' }}>
                        {isCollapsed ? '\u25B6' : '\u25BC'}
                      </span>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: STATUS_DOT_COLORS[pg.project.status] || '#E63948',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link to={`/projects/${pg.project.id}`} style={{
                          fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)',
                          textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                        }}>
                          {projectLabel}
                        </Link>
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>
                        {pg.totalHours}h
                      </span>
                      {!isCollapsed && !readOnly && (
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (isAddingHere) { setAddingForProject(null); setAssignConsultantForm(EMPTY_CONSULTANT_ASSIGN_FORM) }
                            else { setAddingForProject(pg.project.id); setAssignConsultantForm(EMPTY_CONSULTANT_ASSIGN_FORM) }
                          }}
                          style={{ ...navBtnStyle, fontSize: '0.65rem', padding: '0.2rem 0.4rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                          title="Assign consultant"
                        >
                          {isAddingHere ? 'Cancel' : '+ Assign'}
                        </button>
                      )}
                    </div>

                    {/* Timeline area */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={todayPct} />

                      {/* Collapsed: thin ticks for all assignments on this project */}
                      {isCollapsed && pg.consultantAssignments.flatMap(ea => ea.assignments).map((a) => {
                        const aStart = new Date(a.start_date + 'T00:00:00')
                        const aEnd = new Date(a.end_date + 'T00:00:00')
                        const startPct = dateToPct(aStart)
                        const endPct = dateToPct(advanceByBizDays(aEnd, 1))
                        const widthPct = endPct - startPct
                        if (startPct > 100 || endPct < 0) return null
                        const pType = a.projects?.project_type || 'billable'
                        const status = a.projects?.status || 'soft_unconfirmed'
                        return (
                          <div key={a.id} style={{
                            position: 'absolute',
                            left: `${Math.max(startPct, 0)}%`,
                            width: `${Math.min(widthPct, 100 - Math.max(startPct, 0))}%`,
                            top: '12%', height: '76%', borderRadius: 4,
                            background: getBarBackground(pType, status), opacity: 0.95, zIndex: 2,
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }} />
                        )
                      })}

                      {/* Collapsed empty */}
                      {isCollapsed && pg.consultantAssignments.length === 0 && (
                        <div style={{
                          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5,
                        }}>
                          No consultants assigned
                        </div>
                      )}

                      {/* Drag-to-create zone on project header — no consultant known */}
                      {renderDragCreateZone('', pg.project.id)}
                      {renderCreatePreview(`pv-header-${pg.project.id}`)}
                    </div>
                  </div>

                  {/* Expanded: consultant sub-rows */}
                  {!isCollapsed && pg.consultantAssignments.map(({ consultant: eng, assignments }) => {
                    const engTotalHours = assignments.reduce((sum, a) => sum + Number(a.total_hours), 0)

                    return (
                      <div key={eng.id} style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-subtle)' }}>
                        <div style={{
                          width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                          padding: '0.25rem 0.75rem 0.25rem 2rem',
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          borderRight: '1px solid var(--border)',
                          background: 'var(--bg-card-alt)', fontSize: '0.75rem',
                          position: 'sticky', left: 0, zIndex: 4,
                        }}>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {eng.full_name}
                            </div>
                            {eng.title && (
                              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {eng.title}
                              </div>
                            )}
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>
                            {engTotalHours}h
                          </span>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={todayPct} opacity={0.2} />
                          {renderDragCreateZone(eng.id, pg.project.id)}
                          {assignments.map(a => renderBar(a, 5, eng.country))}
                          {renderCreatePreview(`project-${eng.id}-${pg.project.id}`)}
                        </div>
                      </div>
                    )
                  })}

                  {/* Inline assign consultant form */}
                  {!isCollapsed && isAddingHere && (
                    <div style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                      <div style={{
                        width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem',
                        display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem',
                      }}>
                        <select
                          value={assignConsultantForm.consultant_id}
                          onChange={e => setAssignConsultantForm({ ...assignConsultantForm, consultant_id: e.target.value })}
                          style={{ ...inlineInputStyle, flex: 2 }}
                        >
                          <option value="">Select Consultant...</option>
                          {sortedConsultants.map(eng => (
                            <option key={eng.id} value={eng.id}>{eng.full_name}</option>
                          ))}
                        </select>
                        <input type="date" value={assignConsultantForm.start_date}
                          onChange={e => updateAssignConsultantDates('start_date', e.target.value)}
                          style={{ ...inlineInputStyle, flex: 1 }} />
                        <input type="date" value={assignConsultantForm.end_date}
                          onChange={e => updateAssignConsultantDates('end_date', e.target.value)}
                          style={{ ...inlineInputStyle, flex: 1 }} />
                        <input type="number" placeholder="Hours" step="0.5" min="0.5"
                          value={assignConsultantForm.total_hours}
                          onChange={e => setAssignConsultantForm({ ...assignConsultantForm, total_hours: e.target.value })}
                          style={{ ...inlineInputStyle, width: 70, flex: 0 }} />
                        <button
                          onClick={() => handleInlineAssignForProject(pg.project.id)}
                          disabled={savingAssign || !assignConsultantForm.consultant_id || !assignConsultantForm.start_date || !assignConsultantForm.end_date || !assignConsultantForm.total_hours}
                          style={{
                            ...navBtnStyle, fontSize: '0.7rem', padding: '0.25rem 0.5rem',
                            background: 'var(--brand-green-dark)', color: '#fff', border: 'none',
                            opacity: (savingAssign || !assignConsultantForm.consultant_id) ? 0.6 : 1,
                          }}
                        >
                          {savingAssign ? '...' : 'Add'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!isCollapsed && pg.consultantAssignments.length === 0 && !isAddingHere && (
                    <div style={{
                      padding: '0.5rem 2rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card-alt)',
                    }}>
                      No consultants assigned — click "+ Assign" or drag on the timeline
                    </div>
                  )}
                </div>
              )
            }

            return (
              <>
                {activeProjectGroups.map((pg, i) => renderProjectGroupRow(pg, i))}
                {doneProjectGroups.length > 0 && (
                  <>
                    <div
                      style={{
                        display: 'flex', minHeight: 28, borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', userSelect: 'none',
                      }}
                      onClick={() => setHiddenProjectsOpen(p => !p)}
                    >
                      <div style={{
                        width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                        padding: '0.2rem 0.75rem 0.2rem 1rem',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        borderRight: '1px solid var(--border)',
                        background: 'var(--bg-card)', fontSize: '0.7rem',
                        color: 'var(--text-muted)', fontStyle: 'italic',
                        position: 'sticky', left: 0, zIndex: 4,
                      }}>
                        <span style={{ fontSize: '0.55rem', width: 10 }}>
                          {hiddenProjectsOpen ? '\u25BC' : '\u25B6'}
                        </span>
                        Hidden ({doneProjectGroups.length})
                      </div>
                      <div style={{
                        flex: 1, background: 'var(--bg-card)', opacity: 0.5,
                      }} />
                    </div>
                    {hiddenProjectsOpen && doneProjectGroups.map((pg, i) => renderProjectGroupRow(pg, activeProjectGroups.length + i))}
                  </>
                )}
              </>
            )
          })()}

        </div>
      </div>

      {/* Edit / Delete Assignment Modal */}
      {editingAssignment && (
        <div
          onClick={() => setEditingAssignment(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '1.5rem', width: 420, maxWidth: '90vw',
            }}
          >
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
              Edit Allocation
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              {editingAssignment.project_label}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={modalLabelStyle}>Start Date</label>
                <input
                  type="date" value={editingAssignment.start_date}
                  onChange={e => updateEditDates('start_date', e.target.value)}
                  style={modalInputStyle}
                />
              </div>
              <div>
                <label style={modalLabelStyle}>End Date</label>
                <input
                  type="date" value={editingAssignment.end_date}
                  onChange={e => updateEditDates('end_date', e.target.value)}
                  style={modalInputStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={modalLabelStyle}>Total Hours</label>
              <input
                type="number" step="0.5" min="0.5"
                value={editingAssignment.total_hours}
                onChange={e => setEditingAssignment({ ...editingAssignment, total_hours: e.target.value })}
                style={{ ...modalInputStyle, width: 120 }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={modalLabelStyle}>Notes</label>
              <textarea
                value={editingAssignment.notes}
                onChange={e => setEditingAssignment({ ...editingAssignment, notes: e.target.value })}
                placeholder="Optional notes"
                rows={2}
                style={{ ...modalInputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <Link
                to={`/projects/${editingAssignment.project_id}`}
                style={{ color: 'var(--brand-green)', textDecoration: 'none' }}
                onClick={() => setEditingAssignment(null)}
              >
                View Project Details
              </Link>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!readOnly && (
                <button
                  onClick={handleDeleteAssignment}
                  disabled={savingEdit}
                  style={{
                    background: 'transparent', border: '1px solid var(--fill-critical)',
                    color: 'var(--color-critical)', padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: readOnly ? 'auto' : undefined }}>
                <button
                  onClick={() => setEditingAssignment(null)}
                  style={{ ...navBtnStyle, padding: '0.4rem 0.75rem' }}
                >
                  {readOnly ? 'Close' : 'Cancel'}
                </button>
                {!readOnly && (
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    style={{
                      background: 'var(--brand-green-dark)', color: '#fff',
                      border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                      borderRadius: 4, cursor: 'pointer', opacity: savingEdit ? 0.6 : 1,
                    }}
                  >
                    {savingEdit ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick-create popup after drag-to-create */}
      {pendingCreate && (
        <>
          <div onClick={() => setPendingCreate(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'fixed',
            left: Math.min(pendingCreate.x, window.innerWidth - 310),
            top: Math.min(pendingCreate.y + 10, window.innerHeight - 120),
            zIndex: 100,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            width: 290,
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {new Date(pendingCreate.startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' → '}
              {new Date(pendingCreate.endDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}{pendingCreate.totalHours}h
            </div>
            <SearchableSelect
              autoFocus
              value=""
              onChange={val => handleQuickCreate(val)}
              placeholder="Select project to assign..."
              style={{ width: '100%' }}
              options={projectOptions}
            />
          </div>
        </>
      )}

      {/* Quick-create popup after drag-to-create in project view — pick consultant */}
      {pendingCreateProject && (
        <>
          <div onClick={() => setPendingCreateProject(null)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'fixed',
            left: Math.min(pendingCreateProject.x, window.innerWidth - 310),
            top: Math.min(pendingCreateProject.y + 10, window.innerHeight - 120),
            zIndex: 100,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '0.75rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            width: 290,
          }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {new Date(pendingCreateProject.startDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' → '}
              {new Date(pendingCreateProject.endDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {' · '}{pendingCreateProject.totalHours}h
            </div>
            <select
              autoFocus
              defaultValue=""
              onChange={e => handleQuickCreateForProject(e.target.value)}
              style={{ ...inlineInputStyle, width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
            >
              <option value="">Select consultant to assign...</option>
              {sortedConsultants.map(eng => (
                <option key={eng.id} value={eng.id}>{eng.full_name}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
