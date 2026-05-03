import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsReadOnly } from '../lib/permissions'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { ProjectDetail } from './ProjectDetail'
import { COLUMNS, UNASSIGNED_KEY, STATUS_COLORS, formatDateRange } from '../lib/kanbanUtils'
import { filterBtnStyle, dropdownStyle, clearStyle, checkLabelStyle } from '../lib/kanbanStyles'
import { useKanbanData } from '../hooks/useKanbanData'
import { useKanbanFilters } from '../hooks/useKanbanFilters'
import { useKanbanDragDrop } from '../hooks/useKanbanDragDrop'
import type { Project } from '../types/database'
import type { KanbanCardProps } from '../types/kanban'

/** Format ISO date string to compact "Mon D" (e.g. "Apr 30") */
function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Component ───────────────────────────────────────────────────────

export function ProjectKanban() {
  const readOnly = useIsReadOnly()
  const navigate = useNavigate()

  // Data
  const { projects, assignments, loading, error, retry, executeStatusChange } = useKanbanData()

  // Filters
  const {
    filterPMs, setFilterPMs,
    showPMFilter, setShowPMFilter,
    pmFilterRef,
    filterClients, setFilterClients,
    showClientFilter, setShowClientFilter,
    clientFilterRef,
    filterDateStart, setFilterDateStart,
    filterDateEnd, setFilterDateEnd,
    searchText, setSearchText,
    collapsedLanes, toggleLane,
    collapsedSubRows, toggleSubRow,
    consultantCountByProject,
    allPMs, allClients,
    filteredProjects,
    pmGroups, sortedPMKeys,
    columnCounts,
    hasActiveFilters, getFilters, applyFilters,
  } = useKanbanFilters(projects, assignments)

  // Side panel (Jira-style split view — no overlay)
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null)

  // Close panel on Escape
  useEffect(() => {
    if (!drawerProjectId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerProjectId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerProjectId])

  // Drag and drop
  const {
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
  } = useKanbanDragDrop({ readOnly, projects, executeStatusChange })

  // Dismissed alerts (lifted to parent so all cards share one state)
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('altair-kanban-dismissed-alerts')
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  const handleDismissAlert = useCallback((projectId: string, alertType: string) => {
    const key = `${projectId}:${alertType}`
    setDismissedAlerts(prev => {
      const next = { ...prev, [key]: true }
      localStorage.setItem('altair-kanban-dismissed-alerts', JSON.stringify(next))
      return next
    })
  }, [])

  const handleRestoreAlert = useCallback((projectId: string, alertType: string) => {
    const key = `${projectId}:${alertType}`
    setDismissedAlerts(prev => {
      const next = { ...prev }
      delete next[key]
      localStorage.setItem('altair-kanban-dismissed-alerts', JSON.stringify(next))
      return next
    })
  }, [])

  // ─── Render ──────────────────────────────────────────────────────

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading Kanban board..." />

  const pendingProject = pendingDrop ? projects.find(p => p.id === pendingDrop.projectId) : null

  return (
    <div style={{ display: 'flex', gap: 0, margin: '-2rem', height: 'calc(100vh - 0px)' }}>
    {/* ─── Left: Kanban Board ─── */}
    <div style={{
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      padding: '2rem',
      transition: 'flex 0.2s ease',
    }}>
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Project Kanban ({filteredProjects.length}{filteredProjects.length !== projects.length ? ` of ${projects.length}` : ''})</h2>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* PM multi-select */}
        <div ref={pmFilterRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowPMFilter(o => !o)} style={{ ...filterBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{filterPMs.length === 0 ? 'All PMs' : `${filterPMs.length} PM${filterPMs.length > 1 ? 's' : ''}`}</span>
            <span style={{ fontSize: '0.5rem' }}>{showPMFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showPMFilter && (
            <div style={dropdownStyle}>
              {filterPMs.length > 0 && (
                <div onClick={() => setFilterPMs([])} style={clearStyle}>Clear all</div>
              )}
              {allPMs.map(pm => {
                const checked = filterPMs.includes(pm)
                return (
                  <label key={pm} style={checkLabelStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilterPMs(prev => checked ? prev.filter(v => v !== pm) : [...prev, pm])}
                      style={{ accentColor: 'var(--brand-green)' }} />
                    {pm}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Client multi-select */}
        <div ref={clientFilterRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setShowClientFilter(o => !o)} style={{ ...filterBtnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{filterClients.length === 0 ? 'All Clients' : `${filterClients.length} client${filterClients.length > 1 ? 's' : ''}`}</span>
            <span style={{ fontSize: '0.5rem' }}>{showClientFilter ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showClientFilter && (
            <div style={dropdownStyle}>
              {filterClients.length > 0 && (
                <div onClick={() => setFilterClients([])} style={clearStyle}>Clear all</div>
              )}
              {allClients.map(c => {
                const checked = filterClients.includes(c)
                return (
                  <label key={c} style={checkLabelStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input type="checkbox" checked={checked}
                      onChange={() => setFilterClients(prev => checked ? prev.filter(v => v !== c) : [...prev, c])}
                      style={{ accentColor: 'var(--brand-green)' }} />
                    {c}
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* Date range */}
        <input
          type="date"
          value={filterDateStart}
          onChange={e => setFilterDateStart(e.target.value)}
          placeholder="Start date"
          title="Filter: engagement start from"
          style={{ ...filterBtnStyle, width: 145 }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{'\u2013'}</span>
        <input
          type="date"
          value={filterDateEnd}
          onChange={e => setFilterDateEnd(e.target.value)}
          placeholder="End date"
          title="Filter: engagement end to"
          style={{ ...filterBtnStyle, width: 145 }}
        />

        {/* Text search */}
        <input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search client / project..."
          style={{ ...filterBtnStyle, width: 200 }}
        />

        <SavedViewBar page="kanban" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} />
      </div>

      {/* Kanban Board — horizontal swimlanes spanning all columns */}
      <div style={{ overflowX: 'auto', minHeight: 400 }}>

        {/* Sticky column headers */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, paddingBottom: '0.5rem', background: 'var(--bg-page)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
            background: 'var(--bg-card-alt)',
          }}>
            {COLUMNS.map(col => (
              <div key={col.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
              }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: col.color,
                  flexShrink: 0,
                }} />
                <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{col.label}</span>
                <span style={{
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  padding: '0.1rem 0.5rem',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                  {columnCounts[col.key]}
                </span>
              </div>
            ))}
          </div>
          {/* Continuous color bar — no gaps */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
          }}>
            {COLUMNS.map(col => (
              <div key={col.key} style={{ height: 3, background: col.color }} />
            ))}
          </div>
        </div>

        {/* Swimlanes */}
        {sortedPMKeys.map(pmKey => {
          const pmAllProjects = pmGroups.get(pmKey) || []
          const isCollapsed = collapsedLanes.has(pmKey)
          const pmLabel = pmKey === UNASSIGNED_KEY ? 'Unassigned' : pmKey

          return (
            <div key={pmKey}>
              {/* Swimlane header — full-width bar */}
              <div
                onClick={() => toggleLane(pmKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  padding: '0.6rem 0.6rem',
                  borderRadius: 4,
                  marginTop: '0.25rem',
                  marginBottom: '0',
                  userSelect: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  borderLeft: '4px solid #11C3DB',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: 14, textAlign: 'center' }}>
                  {isCollapsed ? '\u25B6' : '\u25BC'}
                </span>
                <span style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: pmKey === UNASSIGNED_KEY ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontStyle: pmKey === UNASSIGNED_KEY ? 'italic' : 'normal',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}>
                  {pmLabel}
                </span>
                {pmAllProjects.length > 0 && (
                  <span style={{
                    fontSize: '0.65rem',
                    color: 'var(--text-primary)',
                    marginLeft: 'auto',
                    background: 'rgba(17,195,219,0.18)',
                    border: '1px solid rgba(17,195,219,0.3)',
                    borderRadius: 999,
                    padding: '0.1rem 0.5rem',
                    fontWeight: 600,
                  }}>
                    {pmAllProjects.length}
                  </span>
                )}
              </div>

              {/* Swimlane body — two sub-rows: Ready to Boot / Booted */}
              {!isCollapsed && (() => {
                const notBooted = pmAllProjects
                const booted: typeof pmAllProjects = []

                const renderSubRow = (label: string, subProjects: Project[], subKey: string, borderColor: string) => {
                  const collapseKey = `${pmKey}__${subKey}`
                  const isSubCollapsed = collapsedSubRows.has(collapseKey)

                  return (
                  <>
                    {/* Sub-row label — clickable to collapse */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
                    }}>
                      <div
                        onClick={() => toggleSubRow(collapseKey)}
                        style={{
                          gridColumn: `1 / -1`,
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          color: borderColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          background: 'rgba(255,255,255,0.02)',
                          borderLeft: `3px solid ${borderColor}`,
                          cursor: 'pointer',
                          userSelect: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                      >
                        <span style={{ fontSize: '0.5rem', width: 10, textAlign: 'center' }}>
                          {isSubCollapsed ? '\u25B6' : '\u25BC'}
                        </span>
                        {label}
                        <span style={{
                          fontSize: '0.6rem',
                          color: 'var(--text-muted)',
                          fontWeight: 400,
                        }}>
                          ({subProjects.length})
                        </span>
                      </div>
                    </div>
                    {/* Sub-row grid */}
                    {!isSubCollapsed && <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
                      gap: '1px',
                    }}>
                      {COLUMNS.map(col => {
                        const cellProjects = subProjects.filter(p => col.statuses.includes(p.status))
                        const cellKey = `${pmKey}__${subKey}__${col.key}`
                        const isOver = dragOverColumn === cellKey

                        return (
                          <div
                            key={col.key}
                            onDragOver={e => handleDragOver(e, cellKey)}
                            onDragLeave={e => handleDragLeave(e, cellKey)}
                            onDrop={e => handleDrop(e, col)}
                            style={{
                              background: isOver ? 'rgba(255,255,255,0.04)' : 'var(--bg-card-alt)',
                              borderTop: `1px solid ${borderColor}22`,
                              borderRight: '1px solid var(--border-subtle)',
                              padding: '0.5rem',
                              minHeight: 60,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              transition: 'background 0.15s',
                              outline: isOver ? `2px dashed ${col.color}` : '2px dashed transparent',
                              outlineOffset: '-2px',
                            }}
                          >
                            {cellProjects.length === 0 ? (
                              <div style={{ flex: 1 }} />
                            ) : (
                              cellProjects.map(project => (
                                <KanbanCard
                                  key={project.id}
                                  project={project}
                                  consultantCount={consultantCountByProject[project.id] || 0}
                                  isDragging={dragProjectId === project.id}
                                  isSoftColumn={col.key === 'soft_scheduled'}
                                  onDragStart={handleDragStart}
                                  onDragEnd={handleDragEnd}
                                  readOnly={readOnly}
                                  onClickCard={(id) => setDrawerProjectId(id)}
                                  dismissed={dismissedAlerts}
                                  onDismissAlert={handleDismissAlert}
                                  onRestoreAlert={handleRestoreAlert}
                                />
                              ))
                            )}
                          </div>
                        )
                      })}
                    </div>}
                  </>
                  )
                }

                void booted
                return (
                  <div>
                    {renderSubRow('Projects', notBooted, 'all', 'var(--border)')}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Confirmation Modal */}
      {pendingDrop && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={cancelDrop}>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '1.5rem 2rem',
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
              Confirm Status Change
            </h3>
            <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Move <strong style={{ color: 'var(--text-primary)' }}>{pendingProject?.client_name}</strong>
              {pendingProject?.sow_number ? ` (${pendingProject.sow_number})` : ''} to{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{pendingDrop.columnLabel}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelDrop}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  padding: '0.4rem 1rem',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDrop}
                style={{
                  background: 'var(--brand-green)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.4rem 1rem',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>

    {/* ─── Right: Side Panel (Jira-style, no overlay) ─── */}
    {drawerProjectId && (
      <div style={{
        width: 700,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-page)',
        overflow: 'auto',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.2)',
      }}>
        {/* Panel header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          background: 'var(--bg-card-alt)',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setDrawerProjectId(null)}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 4,
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
            }}
          >
            &times; Close
          </button>
          <button
            onClick={() => {
              navigate(`/projects/${drawerProjectId}`)
              setDrawerProjectId(null)
            }}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: 4,
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
            }}
          >
            Open full page &#x2197;
          </button>
        </div>
        {/* Embedded ProjectDetail */}
        <div style={{ padding: '1rem' }}>
          <ProjectDetail key={drawerProjectId} projectId={drawerProjectId} />
        </div>
      </div>
    )}
    </div>
  )
}

// ─── Card sub-component ──────────────────────────────────────────────

function KanbanCard({ project, consultantCount, isDragging, isSoftColumn, onDragStart, onDragEnd, readOnly, onClickCard, dismissed, onDismissAlert, onRestoreAlert }: KanbanCardProps) {
  const statusColor = STATUS_COLORS[project.status]
  const dateRange = formatDateRange(project.engagement_start, project.engagement_end)
  const consultantLabel = consultantCount > 0 ? `${consultantCount} consultant${consultantCount !== 1 ? 's' : ''}` : '\u2014'
  const didDragRef = useRef(false)

  // Alert overlays: red if start is within 14 days and no external kickoff, pink if end is within 10 days and no readout
  const now = Date.now()
  const msPerDay = 86_400_000
  const startMs = project.engagement_start ? new Date(project.engagement_start + 'T00:00:00').getTime() : null
  const endMs = project.engagement_end ? new Date(project.engagement_end + 'T00:00:00').getTime() : null
  const daysToStart = startMs != null ? (startMs - now) / msPerDay : null
  const daysToEnd = endMs != null ? (endMs - now) / msPerDay : null

  const kickoffDismissed = !!dismissed[`${project.id}:kickoff`]
  const readoutDismissed = !!dismissed[`${project.id}:readout`]

  const rawKickoffAlert = daysToStart != null && daysToStart <= 14 && !project.kickoff_external
  const rawReadoutAlert = daysToEnd != null && daysToEnd <= 10 && !project.readout_meeting
  const needsKickoffAlert = rawKickoffAlert && !kickoffDismissed
  const needsReadoutAlert = rawReadoutAlert && !readoutDismissed
  const hasDismissedAlert = (rawKickoffAlert && kickoffDismissed) || (rawReadoutAlert && readoutDismissed)
  const dismissedAlertType = rawKickoffAlert && kickoffDismissed ? 'kickoff' : rawReadoutAlert && readoutDismissed ? 'readout' : null

  let cardBg = 'var(--bg-card)'
  let alertLabel = ''
  let alertType = ''
  if (needsKickoffAlert) {
    cardBg = 'rgba(230, 57, 72, 0.18)'
    alertLabel = 'Kickoff not scheduled'
    alertType = 'kickoff'
  } else if (needsReadoutAlert) {
    cardBg = 'rgba(219, 112, 147, 0.18)'
    alertLabel = 'Readout not scheduled'
    alertType = 'readout'
  }

  return (
    <div
      draggable={!readOnly}
      onDragStart={e => {
        didDragRef.current = true
        onDragStart(e, project.id)
      }}
      onDragEnd={() => {
        onDragEnd()
        // Reset after a tick so onClick (which fires after dragEnd) can still read the flag
        setTimeout(() => { didDragRef.current = false }, 0)
      }}
      onClick={() => {
        if (!didDragRef.current) onClickCard(project.id)
      }}
      style={{
        background: cardBg,
        border: needsKickoffAlert ? '1px solid rgba(230, 57, 72, 0.5)' : needsReadoutAlert ? '1px solid rgba(219, 112, 147, 0.4)' : '1px solid var(--border)',
        borderLeft: `4px solid ${needsKickoffAlert ? '#E63948' : needsReadoutAlert ? '#DB7093' : statusColor}`,
        borderRadius: 6,
        padding: '0.6rem 0.7rem',
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        if (!isDragging) e.currentTarget.style.boxShadow = '0 3px 12px rgba(0,0,0,0.35)'
        const btn = e.currentTarget.querySelector('.kanban-popout-btn') as HTMLElement | null
        if (btn) btn.style.opacity = '0.5'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)'
        const btn = e.currentTarget.querySelector('.kanban-popout-btn') as HTMLElement | null
        if (btn) btn.style.opacity = '0'
      }}
    >
      {/* UID + Project name + pop-out */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.3rem', marginBottom: '0.2rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.3, flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.4rem' }}>{project.altair_uid}</span>
          {project.project_name}
        </div>
        <button
          type="button"
          title="Open in new window"
          aria-label={`Open ${project.project_name} in new window`}
          onClick={e => {
            e.stopPropagation()
            window.open(`/projects/${project.id}`, '_blank', 'noopener')
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.1rem',
            color: 'var(--text-muted)',
            fontSize: '0.7rem',
            lineHeight: 1,
            opacity: 0,
            transition: 'opacity 0.15s',
            flexShrink: 0,
          }}
          className="kanban-popout-btn"
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
        >
          &#x29C9;
        </button>
      </div>

      {/* Client · SOW */}
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
        {project.client_name}{project.sow_number ? ` \u00B7 ${project.sow_number}` : ''}
      </div>

      {/* Dates */}
      {dateRange && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
          {dateRange}
        </div>
      )}

      {/* Meeting dates: IK · EK · AW · RO */}
      <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
        <span title="Internal Kickoff">IK: {project.kickoff_internal ? shortDate(project.kickoff_internal) : '\u2014'}</span>
        <span title="External Kickoff">EK: {project.kickoff_external ? shortDate(project.kickoff_external) : '\u2014'}</span>
        <span title="Readout Meeting">RO: {project.readout_meeting ? shortDate(project.readout_meeting) : '\u2014'}</span>
      </div>

      {/* Bottom row: PM + consultants + soft badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
        {project.project_manager && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {project.project_manager}
          </span>
        )}
        <span style={{
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 4,
          padding: '0.1rem 0.35rem',
        }}>
          {consultantLabel}
        </span>

        {/* Soft status sub-badge */}
        {isSoftColumn && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.6rem',
            fontWeight: 600,
            padding: '0.1rem 0.4rem',
            borderRadius: 4,
            background: project.status === 'soft_at_risk' ? 'rgba(240,100,43,0.15)' : 'rgba(40,163,106,0.15)',
            color: project.status === 'soft_at_risk' ? '#F0642B' : '#28A36A',
          }}>
            {project.status === 'soft_at_risk' ? 'At Risk' : 'Unconfirmed'}
          </span>
        )}

        {/* Alert badge with dismiss button */}
        {alertLabel && (
          <span style={{
            marginLeft: isSoftColumn ? undefined : 'auto',
            fontSize: '0.6rem',
            fontWeight: 600,
            padding: '0.1rem 0.4rem',
            borderRadius: 4,
            background: needsKickoffAlert ? 'rgba(230, 57, 72, 0.25)' : 'rgba(219, 112, 147, 0.25)',
            color: needsKickoffAlert ? '#FF6B7A' : '#E8A0B8',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}>
            {alertLabel}
            <span
              role="button"
              title="Dismiss alert"
              onClick={e => {
                e.stopPropagation()
                onDismissAlert(project.id, alertType)
              }}
              style={{
                cursor: 'pointer',
                opacity: 0.6,
                fontSize: '0.7rem',
                lineHeight: 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
            >
              &times;
            </span>
          </span>
        )}

        {/* Restore dismissed alert */}
        {hasDismissedAlert && !alertLabel && (
          <span
            role="button"
            title="Restore dismissed alert"
            onClick={e => {
              e.stopPropagation()
              if (dismissedAlertType) onRestoreAlert(project.id, dismissedAlertType)
            }}
            style={{
              marginLeft: 'auto',
              fontSize: '0.55rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              opacity: 0.5,
              textDecoration: 'underline',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
          >
            Restore alert
          </span>
        )}
      </div>
    </div>
  )
}
