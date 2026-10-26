import { useState, useMemo, useCallback, useRef } from 'react'
import type React from 'react'
import { Link } from 'react-router-dom'
import { useIsReadOnly } from '../lib/permissions'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button, MultiSelect, DatePicker } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { SavedViewBar } from '../components/SavedViewBar'
import { AssignmentBarItem } from '../components/AssignmentBarItem'
import { HolidayOverlay } from '../components/HolidayOverlay'
import { TimelineGrid } from '../lib/TimelineGrid'
import { useResourcingData } from '../hooks/useResourcingData'
import { useResourcingFilters } from '../hooks/useResourcingFilters'
import { useAssignments } from '../hooks/useAssignments'
import { STATUS_COLORS } from '../lib/kanbanUtils'
import {
  EMPTY_ASSIGN_FORM, EMPTY_CONSULTANT_ASSIGN_FORM,
  getWeeks, formatWeek, getMonthHeaders,
  bizDaysBetween, advanceByBizDays, dateToStr,
  calcBusinessDays, calcWeeklyHours,
  countHolidaysInWeek,
} from '../lib/resourcingUtils'
import {
  modalLabelStyle, modalInputStyle, inlineInputStyle,
} from '../lib/resourcingStyles'
import type { AssignmentWithDetails, ProjectWithConsultants } from '../types/resourcing'
import './Resourcing.css'

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const ChevronDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
)
const ChevronRightIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
)
const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

const countPillStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-xs)',
  color: 'var(--text-muted)',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-soft)',
  borderRadius: 'var(--radius-pill)',
  padding: '1px 8px',
  fontWeight: 500,
}

const ghostFieldStyle: React.CSSProperties = {
  padding: '0.4rem 0.7rem',
  fontSize: '0.8rem',
  fontWeight: 500,
  fontFamily: 'var(--font-display)',
  borderRadius: 'var(--radius-md)',
}

const toolbarDividerStyle: React.CSSProperties = {
  width: 1, height: 18, background: 'var(--border-soft)', margin: '0 var(--space-1)', flexShrink: 0,
}

function barClass(projectType: string, status: string): string {
  if (projectType === 'pto') return 'res-bar--pto'
  if (projectType === 'non_billable') return 'res-bar--nonbill'
  if (status === 'to_do' || status === 'soft_unconfirmed' || status === 'soft_at_risk') return 'res-bar--soft'
  return 'res-bar--hard'
}

const LEGEND = [
  { label: 'Billable — Soft / At Risk', className: 'res-bar--soft' },
  { label: 'Billable — Hard / Active / Done', className: 'res-bar--hard' },
  { label: 'Non-Billable', className: 'res-bar--nonbill' },
  { label: 'PTO', className: 'res-bar--pto' },
  { label: 'Holiday', className: 'res-bar--holiday' },
]

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  ['to_do', 'To Do'],
  ['soft_unconfirmed', 'Soft — Unconfirmed'],
  ['soft_at_risk', 'Soft — At Risk'],
  ['hard_scheduled', 'Hard Scheduled'],
  ['active', 'Active'],
  ['done', 'Done'],
].map(([value, label]) => ({ value, label }))

function SkillRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  function pick(n: number) {
    if (n < min) onChange(n, max)
    else if (n > max) onChange(min, n)
    else onChange(n, n)
  }
  return (
    <span className="skill-range" title={`proficiency ${min}–${max}`}>
      {[1, 2, 3].map(n => {
        const on = n >= min && n <= max
        return (
          <div
            key={n}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`Set proficiency bound ${n}`}
            className={`skill-range__cell${on ? ' skill-range__cell--on' : ''}`}
            onClick={() => pick(n)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(n) } }}
          >
            {n}
          </div>
        )
      })}
    </span>
  )
}

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
    filterConsultants, setFilterConsultants,
    filterPassion, setFilterPassion,
    filterPracticeManager, setFilterPracticeManager,
    filterSow, setFilterSow,
    filterStatus, setFilterStatus,
    managers, practiceManagers, titles,
    sowNumbers,
    projectOptions, sortedConsultants,
    filteredConsultants,
    activeProjectGroups, doneProjectGroups,
    hasActiveFilters,
    clearAllFilters,
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
    return (
      <AssignmentBarItem
        key={a.id}
        a={a}
        topOffset={topOffset}
        country={country}
        dateToPct={dateToPct}
        dragging={dragging}
        holidayMap={holidayMap}
        onStartDrag={startDrag}
        onOpenEdit={openEditModal}
      />
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
        background: 'var(--accent-cyan-glow)',
        border: '1px dashed var(--brand-cyan)',
        borderRadius: 2, zIndex: 6,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.55rem', color: 'var(--brand-cyan)', fontWeight: 600,
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
            zIndex: 4,
            pointerEvents: 'none',
          }}
          title={`${Math.round(hrs)}h / ${availableHours}h${holidaysInWeek > 0 ? ` (${holidaysInWeek} holiday${holidaysInWeek > 1 ? 's' : ''})` : ''} (${pct}%)`}
        >
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.65rem', fontWeight: 600,
            color: isOver ? 'var(--util-chip-text-over)' : 'var(--util-chip-text)',
            background: 'var(--util-chip-bg)',
            borderRadius: 2, padding: '1px 6px',
          }}>
            {pct}%
          </span>
        </div>
      )
    })
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading resourcing view..." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
        <PageTitle
          title="Resourcing"
          meta={viewMode === 'consultant'
            ? `(${filteredConsultants.length}${filteredConsultants.length !== consultants.length ? ` of ${consultants.length}` : ''})`
            : `(${activeProjectGroups.length + doneProjectGroups.length})`}
          style={{ margin: 0 }}
        />
        <div style={{
          display: 'inline-flex', gap: 'var(--space-5)',
          borderBottom: '1px solid var(--border-soft)',
        }}>
          {([
            ['consultant', 'By Consultant'],
            ['project', 'By Project'],
          ] as const).map(([mode, label]) => {
            const active = viewMode === mode
            return (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={`view-tab${active ? ' view-tab--active' : ''}`}
                aria-pressed={active}
                onClick={() => {
                  setViewMode(mode)
                  localStorage.setItem('altair-resourcing-view-mode', mode)
                }}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)', flexWrap: 'wrap', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search consultant, SOW #, or project..."
          className="kanban-ghost"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ ...ghostFieldStyle, width: 220 }}
        />

        <span style={toolbarDividerStyle} aria-hidden="true" />

        <SearchableSelect
          variant="ghost"
          value={filterManager}
          onChange={setFilterManager}
          options={managerOptions}
          placeholder="All Managers"
          style={{ minWidth: 120 }}
        />
        <SearchableSelect
          variant="ghost"
          value={filterPracticeManager}
          onChange={setFilterPracticeManager}
          options={practiceManagerOptions}
          placeholder="All Project Managers"
          style={{ minWidth: 120 }}
        />
        <MultiSelect
          label="Titles"
          options={titles.map(t => ({ value: t, label: t }))}
          value={[...filterTitle]}
          onChange={next => setFilterTitle(new Set(next))}
        />
        <MultiSelect
          label="Consultants"
          options={sortedConsultants.map(eng => ({ value: eng.id, label: eng.full_name }))}
          value={[...filterConsultants]}
          onChange={next => setFilterConsultants(new Set(next))}
        />
        <SearchableSelect
          variant="ghost"
          value={filterPassion}
          onChange={setFilterPassion}
          options={passionOptions}
          placeholder="All Passion Areas"
          style={{ minWidth: 120 }}
        />
        <MultiSelect
          label="SOW #"
          options={sowNumbers.map(sow => ({ value: sow, label: sow }))}
          value={[...filterSow]}
          onChange={next => setFilterSow(new Set(next))}
        />
        <MultiSelect
          label="Status"
          options={STATUS_FILTER_OPTIONS.map(opt => ({
            value: opt.value,
            label: opt.label,
            color: STATUS_COLORS[opt.value as keyof typeof STATUS_COLORS],
          }))}
          value={[...filterStatus]}
          onChange={next => setFilterStatus(new Set(next))}
        />

        <span style={toolbarDividerStyle} aria-hidden="true" />

        <MultiSelect
          label="Skills"
          options={skillFilters.map(sf => ({ value: sf.skillId, label: sf.name }))}
          value={skillFilters.filter(sf => sf.enabled).map(sf => sf.skillId)}
          onChange={next => {
            setSkillFilters(prev => prev.map(sf => {
              const enabled = next.includes(sf.skillId)
              if (enabled && !sf.enabled) return { ...sf, enabled: true, min: 1, max: 3 }
              if (!enabled && sf.enabled) return { ...sf, enabled: false, min: 1, max: 3 }
              return { ...sf, enabled }
            }))
          }}
          renderAccessory={(opt, selected) => {
            if (!selected) return null
            const sf = skillFilters.find(s => s.skillId === opt.value)
            if (!sf) return null
            return (
              <SkillRange
                min={sf.min}
                max={sf.max}
                onChange={(min, max) => {
                  setSkillFilters(prev => prev.map(s => s.skillId === sf.skillId ? { ...s, min, max } : s))
                }}
              />
            )
          }}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} style={{ ...ghostFieldStyle, fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
            Clear Filters
          </Button>
        )}
        <span style={{ marginLeft: 'auto' }} aria-hidden="true" />
        <SavedViewBar page="resourcing" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={clearAllFilters} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: '1rem', flexShrink: 0, paddingLeft: 'var(--space-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        {LEGEND.map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div className={item.className} style={{ width: 10, height: 10, borderRadius: 3, border: '1px solid var(--bar-hairline)', flexShrink: 0 }} />
            <span>{item.label}</span>
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>
          {viewMode === 'consultant'
            ? `${filteredConsultants.length} of ${consultants.length} consultants`
            : `${activeProjectGroups.length + doneProjectGroups.length} projects (${filteredConsultants.length} consultants)`
          }
        </span>
      </div>

      <div ref={timelineRef} style={{ flex: 1, overflow: 'auto', overscrollBehaviorX: 'contain', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-lg)', userSelect: (dragging || resizingCol) ? 'none' : 'auto', minHeight: 0, contain: 'paint' }}>
        <div style={{ minWidth: NAME_COL + VISIBLE_WEEKS * 50, position: 'relative' }}>

          {/* One continuous today line. TimelineGrid still accepts todayPct but
              we pass -1 so it does not paint a second marker on every row. */}
          {todayPct >= 0 && todayPct <= 100 && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: 2,
              left: `calc(${NAME_COL}px + (100% - ${NAME_COL}px) * ${todayPct / 100})`,
              background: 'var(--brand-cyan)', opacity: 0.6, zIndex: 3,
              pointerEvents: 'none',
            }} />
          )}

          {/* Sticky header sits above the per-row holiday overlay (z5). */}
          <div style={{ position: 'sticky', top: 0, zIndex: 6, background: 'var(--bg-content)' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-content)', padding: '0.25rem 1rem', position: 'sticky', left: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.25rem' }}>
                <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} aria-label="Previous weeks" onClick={() => setWeekOffset(w => w - 4)} />
                <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
                <Button variant="ghost" size="sm" icon={<ArrowRightIcon />} aria-label="Next weeks" onClick={() => setWeekOffset(w => w + 4)} />
              </div>
              <div style={{ flex: 1, display: 'flex' }}>
                {monthHeaders.map((mh, i) => (
                  <div key={i} style={{
                    flex: `0 0 ${(mh.span / VISIBLE_WEEKS) * 100}%`,
                    textAlign: 'center', padding: '0.5rem 0', fontSize: '0.75rem', fontWeight: 600,
                    color: 'var(--text-primary)', background: 'var(--bg-content)',
                    borderLeft: i > 0 ? '1px solid var(--border-soft)' : 'none',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                  }}>
                    {mh.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)' }}>
              <div style={{ width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-content)', padding: '0.4rem 1rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, position: 'sticky', left: 0, zIndex: 5, display: 'flex', alignItems: 'center' }}>
                {viewMode === 'consultant' ? 'CONSULTANT' : 'PROJECT'}
                {(() => {
                  const allIds = viewMode === 'consultant'
                    ? filteredConsultants.map(e => e.id)
                    : [...activeProjectGroups, ...doneProjectGroups].map(pg => pg.project.id)
                  const allCollapsed = allIds.every(id => collapsed.has(id))
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={allCollapsed ? <ChevronDownIcon /> : <ChevronRightIcon />}
                      onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allIds))}
                      title={allCollapsed ? 'Expand all' : 'Collapse all'}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {allCollapsed ? 'Expand All' : 'Collapse All'}
                    </Button>
                  )
                })()}
                <div
                  onMouseDown={handleColResizeStart}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
                    cursor: 'col-resize', zIndex: 10,
                    background: resizingCol ? 'var(--brand-cyan)' : 'transparent',
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
                      fontSize: '0.6rem', color: isThisWeek ? 'var(--brand-cyan)' : 'var(--text-muted)',
                      fontWeight: isThisWeek ? 700 : 400, background: 'var(--bg-content)', borderLeft: '1px solid var(--border-soft)',
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
          {viewMode === 'consultant' && filteredConsultants.map((eng) => {
            const isCollapsed = collapsed.has(eng.id)
            const isAddingHere = addingFor === eng.id
            const subRowHeight = 36
            const weeklyHours = calcWeeklyHours(eng.assignments, weeks, holidayMap, eng.country, eng.hire_date)
            const isTerminated = eng.offboarded_at != null

            return (
              <div key={eng.id} style={{ borderBottom: '1px solid var(--border-soft)', opacity: isTerminated ? 0.55 : 1, background: 'transparent', position: 'relative' }}>
                <div style={{ position: 'absolute', left: NAME_COL, right: 0, top: 0, bottom: 0, zIndex: 5, pointerEvents: 'none' }}>
                  <HolidayOverlay weeks={weeks} visibleWeeks={VISIBLE_WEEKS} holidayMap={holidayMap} country={eng.country} />
                </div>

                {/* Consultant header row */}
                <div style={{ display: 'flex', minHeight: 44 }}>
                  <div style={{
                    width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                    padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                    borderRight: '1px solid var(--border-soft)',
                    background: 'var(--bg-content)',
                    position: 'sticky', left: 0, zIndex: 5,
                  }}>
                    <span onClick={() => toggleCollapse(eng.id)}
                      style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: 14, flexShrink: 0, cursor: 'pointer' }}>
                      {isCollapsed ? '\u25B6' : '\u25BC'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, color: isTerminated ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Link to={`/consultants/${eng.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {eng.full_name}
                        </Link>
                        {isTerminated && (
                          <span style={{
                            fontSize: '0.55rem',
                            fontWeight: 600,
                            color: 'var(--color-critical)',
                            background: 'var(--fill-critical)',
                            border: '1px solid var(--color-critical)',
                            borderRadius: 3,
                            padding: '0.1rem 0.35rem',
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.04em',
                          }}>
                            Terminated
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span>{eng.title || ''}</span>
                      </div>
                    </div>
                    {!isCollapsed && !readOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={isAddingHere ? undefined : <PlusIcon />}
                        onClick={e => {
                          e.stopPropagation()
                          if (isAddingHere) { setAddingFor(null); setAssignForm(EMPTY_ASSIGN_FORM) }
                          else { setAddingFor(eng.id); setAssignForm(EMPTY_ASSIGN_FORM) }
                        }}
                        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        title="Assign to project"
                      >
                        {isAddingHere ? 'Cancel' : 'Assign'}
                      </Button>
                    )}
                  </div>

                  {/* Timeline area */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={-1} />

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
                          background: 'var(--resourcing-overalloc)',
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
                        <div key={a.id} className={barClass(pType, status)} style={{
                          position: 'absolute',
                          left: `${Math.max(startPct, 0)}%`,
                          width: `${Math.min(widthPct, 100 - Math.max(startPct, 0))}%`,
                          top: '12%', height: '76%', borderRadius: 2,
                          zIndex: 2,
                          border: '1px solid var(--bar-hairline)',
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
                    const clientName = first.projects?.client_name ?? 'Unknown Project'
                    const projectName = first.projects?.project_name ?? ''
                    const projectLabel = first.projects
                      ? `${clientName} — ${projectName}`
                      : 'Unknown Project'
                    const totalHours = assignments.reduce((sum, a) => sum + Number(a.total_hours), 0)

                    return (
                      <div key={projectId} style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-soft)' }}>
                        <div style={{
                          width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                          padding: '0.25rem 0.75rem 0.25rem 2rem',
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          borderRight: '1px solid var(--border-soft)',
                          background: 'var(--bg-card)', fontSize: '0.75rem',
                          position: 'sticky', left: 0, zIndex: 5,
                        }}>
                          <Link to={`/projects/${projectId}`} style={{
                            flex: 1, minWidth: 0, overflow: 'hidden',
                            textDecoration: 'none',
                          }} title={projectLabel}>
                            <div style={{
                              fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {clientName}
                            </div>
                            <div style={{
                              fontSize: '11.5px', color: 'var(--text-muted)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {projectName}
                            </div>
                          </Link>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>
                            {totalHours}h
                          </span>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={-1} opacity={0.2} />
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
                              display: 'flex', minHeight: 28, borderTop: '1px solid var(--border-soft)',
                              cursor: 'pointer', userSelect: 'none',
                            }}
                            onClick={() => toggleHidden(eng.id)}
                          >
                            <div style={{
                              width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                              padding: '0.2rem 0.75rem 0.2rem 2rem',
                              display: 'flex', alignItems: 'center', gap: '0.4rem',
                              borderRight: '1px solid var(--border-soft)',
                              background: 'var(--bg-content)', fontSize: '0.7rem',
                              color: 'var(--text-muted)', fontStyle: 'italic',
                              position: 'sticky', left: 0, zIndex: 5,
                            }}>
                              <span style={{ fontSize: '0.55rem', width: 10 }}>
                                {isHiddenOpen ? '\u25BC' : '\u25B6'}
                              </span>
                              Hidden
                              <span style={countPillStyle}>{doneProjects.length}</span>
                            </div>
                            <div style={{
                              flex: 1, background: 'var(--bg-content)', opacity: 0.5,
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
                  <div style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-soft)', background: 'var(--bg-card)', position: 'relative', zIndex: 50 }}>
                    <div style={{
                      width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem',
                      display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.75rem',
                    }}>
                      <SearchableSelect
                        variant="ghost"
                        value={assignForm.project_id}
                        onChange={val => setAssignForm({ ...assignForm, project_id: val })}
                        placeholder="Select Project..."
                        style={{ width: 260 }}
                        options={projectOptions}
                      />
                      <div style={{ width: 150 }}>
                        <DatePicker value={assignForm.start_date}
                          onChange={v => updateAssignDates('start_date', v)}
                          placeholder="Start date" ariaLabel="Start date" />
                      </div>
                      <div style={{ width: 150 }}>
                        <DatePicker value={assignForm.end_date}
                          onChange={v => updateAssignDates('end_date', v)}
                          placeholder="End date" ariaLabel="End date" />
                      </div>
                      <input className="no-spinner" type="number" placeholder="Hours" step="0.5" min="0.5"
                        value={assignForm.total_hours}
                        onChange={e => setAssignForm({ ...assignForm, total_hours: e.target.value })}
                        style={{ ...inlineInputStyle, width: 70, flex: 0 }} />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleInlineAssign(eng.id)}
                        disabled={savingAssign || !assignForm.project_id || !assignForm.start_date || !assignForm.end_date || !assignForm.total_hours}
                      >
                        {savingAssign ? '...' : 'Add'}
                      </Button>
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
                    No assignments — click "Assign" or click a week on the timeline
                  </div>
                )}
              </div>
            )
          })}

          {/* Project rows */}
          {viewMode === 'project' && (() => {
            const subRowHeight = 36

            function renderProjectGroupRow(pg: ProjectWithConsultants) {
              const isCollapsed = collapsed.has(pg.project.id)
              const isAddingHere = addingForProject === pg.project.id
              const projectLabel = `${pg.project.client_name} — ${pg.project.project_name}`

              return (
                <div key={pg.project.id} style={{ borderBottom: '1px solid var(--border-soft)', background: 'transparent' }}>
                  {/* Project header row */}
                  <div style={{ display: 'flex', minHeight: 44 }}>
                    <div style={{
                      width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                      padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                      borderRight: '1px solid var(--border-soft)',
                      background: 'var(--bg-content)',
                      position: 'sticky', left: 0, zIndex: 5,
                    }}>
                      <span onClick={() => toggleCollapse(pg.project.id)}
                        style={{ fontSize: '0.7rem', color: 'var(--text-muted)', width: 14, flexShrink: 0, cursor: 'pointer' }}>
                        {isCollapsed ? '\u25B6' : '\u25BC'}
                      </span>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={isAddingHere ? undefined : <PlusIcon />}
                          onClick={e => {
                            e.stopPropagation()
                            if (isAddingHere) { setAddingForProject(null); setAssignConsultantForm(EMPTY_CONSULTANT_ASSIGN_FORM) }
                            else { setAddingForProject(pg.project.id); setAssignConsultantForm(EMPTY_CONSULTANT_ASSIGN_FORM) }
                          }}
                          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                          title="Assign consultant"
                        >
                          {isAddingHere ? 'Cancel' : 'Assign'}
                        </Button>
                      )}
                    </div>

                    {/* Timeline area */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={-1} />

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
                          <div key={a.id} className={barClass(pType, status)} style={{
                            position: 'absolute',
                            left: `${Math.max(startPct, 0)}%`,
                            width: `${Math.min(widthPct, 100 - Math.max(startPct, 0))}%`,
                            top: '12%', height: '76%', borderRadius: 2,
                            zIndex: 2,
                            border: '1px solid var(--bar-hairline)',
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
                      <div key={eng.id} style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-soft)' }}>
                        <div style={{
                          width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                          padding: '0.25rem 0.75rem 0.25rem 2rem',
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          borderRight: '1px solid var(--border-soft)',
                          background: 'var(--bg-card)', fontSize: '0.75rem',
                          position: 'sticky', left: 0, zIndex: 5,
                        }}>
                          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                            <Link to={`/consultants/${eng.id}`} style={{
                              fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--text-primary)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              textDecoration: 'none', display: 'block',
                            }}>
                              {eng.full_name}
                            </Link>
                            {eng.title && (
                              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {eng.title}
                              </div>
                            )}
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', flexShrink: 0 }}>
                            {engTotalHours}h
                          </span>
                        </div>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <TimelineGrid weeks={weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={-1} opacity={0.2} />
                          {renderDragCreateZone(eng.id, pg.project.id)}
                          {assignments.map(a => renderBar(a, 5, eng.country))}
                          {renderCreatePreview(`project-${eng.id}-${pg.project.id}`)}
                        </div>
                      </div>
                    )
                  })}

                  {/* Inline assign consultant form */}
                  {!isCollapsed && isAddingHere && (
                    <div style={{ display: 'flex', minHeight: subRowHeight, borderTop: '1px solid var(--border-soft)', background: 'var(--bg-card)' }}>
                      <div style={{
                        width: '100%', padding: '0.4rem 0.75rem 0.4rem 2rem',
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.75rem',
                      }}>
                        <select
                          value={assignConsultantForm.consultant_id}
                          onChange={e => setAssignConsultantForm({ ...assignConsultantForm, consultant_id: e.target.value })}
                          style={{ ...inlineInputStyle, width: 260 }}
                        >
                          <option value="">Select Consultant...</option>
                          {sortedConsultants.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name}</option>
                          ))}
                        </select>
                        <div style={{ width: 150 }}>
                          <DatePicker value={assignConsultantForm.start_date}
                            onChange={v => updateAssignConsultantDates('start_date', v)}
                            placeholder="Start date" ariaLabel="Start date" />
                        </div>
                        <div style={{ width: 150 }}>
                          <DatePicker value={assignConsultantForm.end_date}
                            onChange={v => updateAssignConsultantDates('end_date', v)}
                            placeholder="End date" ariaLabel="End date" />
                        </div>
                        <input className="no-spinner" type="number" placeholder="Hours" step="0.5" min="0.5"
                          value={assignConsultantForm.total_hours}
                          onChange={e => setAssignConsultantForm({ ...assignConsultantForm, total_hours: e.target.value })}
                          style={{ ...inlineInputStyle, width: 70, flex: 0 }} />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleInlineAssignForProject(pg.project.id)}
                          disabled={savingAssign || !assignConsultantForm.consultant_id || !assignConsultantForm.start_date || !assignConsultantForm.end_date || !assignConsultantForm.total_hours}
                        >
                          {savingAssign ? '...' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!isCollapsed && pg.consultantAssignments.length === 0 && !isAddingHere && (
                    <div style={{
                      padding: '0.5rem 2rem', fontSize: '0.7rem', color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card-alt)',
                    }}>
                      No consultants assigned — click "Assign" or drag on the timeline
                    </div>
                  )}
                </div>
              )
            }

            return (
              <>
                {activeProjectGroups.map((pg) => renderProjectGroupRow(pg))}
                {doneProjectGroups.length > 0 && (
                  <>
                    <div
                      style={{
                        display: 'flex', minHeight: 28, borderBottom: '1px solid var(--border-soft)',
                        cursor: 'pointer', userSelect: 'none',
                      }}
                      onClick={() => setHiddenProjectsOpen(p => !p)}
                    >
                      <div style={{
                        width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                        padding: '0.2rem 0.75rem 0.2rem 1rem',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        borderRight: '1px solid var(--border-soft)',
                        background: 'var(--bg-content)', fontSize: '0.7rem',
                        color: 'var(--text-muted)', fontStyle: 'italic',
                        position: 'sticky', left: 0, zIndex: 5,
                      }}>
                        <span style={{ fontSize: '0.55rem', width: 10 }}>
                          {hiddenProjectsOpen ? '\u25BC' : '\u25B6'}
                        </span>
                        Hidden
                        <span style={countPillStyle}>{doneProjectGroups.length}</span>
                      </div>
                      <div style={{
                        flex: 1, background: 'var(--bg-content)', opacity: 0.5,
                      }} />
                    </div>
                    {hiddenProjectsOpen && doneProjectGroups.map((pg) => renderProjectGroupRow(pg))}
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
                <Button variant="danger" size="sm" onClick={handleDeleteAssignment} disabled={savingEdit}>
                  Delete
                </Button>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: readOnly ? 'auto' : undefined }}>
                <Button variant="ghost" size="sm" onClick={() => setEditingAssignment(null)}>
                  {readOnly ? 'Close' : 'Cancel'}
                </Button>
                {!readOnly && (
                  <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={savingEdit}>
                    {savingEdit ? 'Saving...' : 'Save'}
                  </Button>
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
