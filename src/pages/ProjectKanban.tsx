import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useIsReadOnly } from '../lib/permissions'
import { PageTitle, StatusDot, Button, MultiSelect, DatePicker } from '../components/ui'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { ProjectDetail } from './ProjectDetail'
import { KanbanSkeleton } from './KanbanSkeleton'
import { COLUMNS, UNASSIGNED_KEY, formatDateRange } from '../lib/kanbanUtils'
import { STATUS_COLORS, STATUS_LABELS } from '../types/projects'
import { useKanbanData } from '../hooks/useKanbanData'
import { useKanbanFilters } from '../hooks/useKanbanFilters'
import { useKanbanDragDrop } from '../hooks/useKanbanDragDrop'
import type { KanbanCardProps, KanbanColumn } from '../types/kanban'

/** Thin vertical separator between toolbar control groups. */
const toolbarDividerStyle = {
  width: 1, height: 18, background: 'var(--border-soft)', margin: '0 var(--space-1)', flexShrink: 0,
} as const

/** Format ISO date string to compact "Mon D" (e.g. "Apr 30") */
function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Column accent from the Altair status palette (not the legacy kanbanUtils cyan). */
function columnAccent(col: KanbanColumn): string {
  return STATUS_COLORS[col.defaultStatus]
}

/**
 * Two-letter initials for a swimlane avatar. First+last initial for a multi-word
 * name, first two letters for a single word, em-dash for the Unassigned lane.
 */
function pmInitials(label: string): string {
  if (label === 'Unassigned') return '—'
  const parts = label.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function ProjectKanban() {
  const readOnly = useIsReadOnly()
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()

  const { projects, assignments, loading, error, retry, executeStatusChange } = useKanbanData()

  const {
    filterPMs, setFilterPMs,
    filterClients, setFilterClients,
    filterDateStart, setFilterDateStart,
    filterDateEnd, setFilterDateEnd,
    searchText, setSearchText,
    collapsedLanes, toggleLane,
    consultantCountByProject,
    allPMs, allClients,
    filteredProjects,
    pmGroups, sortedPMKeys,
    columnCounts,
    hasActiveFilters, getFilters, applyFilters,
  } = useKanbanFilters(projects, assignments)

  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!drawerProjectId) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerProjectId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [drawerProjectId])

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

  if (error) return <LoadingState loading={false} error={error} retry={retry} message="Loading Kanban board..." />
  if (loading) return <KanbanSkeleton />

  const pendingProject = pendingDrop ? projects.find(p => p.id === pendingDrop.projectId) : null

  return (
    <div style={{ display: 'flex', gap: 0, margin: '-2rem', height: 'calc(100vh - 0px)' }}>
    <div style={{
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      padding: '2rem',
      background: 'var(--bg-content)',
      transition: 'flex 0.2s ease',
    }}>
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <PageTitle title="Project Kanban" meta={`(${filteredProjects.length}${filteredProjects.length !== projects.length ? ` of ${projects.length}` : ''})`} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <MultiSelect
          label="PMs"
          options={allPMs.map(pm => ({ value: pm, label: pm }))}
          value={filterPMs}
          onChange={setFilterPMs}
        />
        <MultiSelect
          label="Clients"
          options={allClients.map(c => ({ value: c, label: c }))}
          value={filterClients}
          onChange={setFilterClients}
        />

        <span style={toolbarDividerStyle} aria-hidden="true" />

        <DatePicker
          value={filterDateStart}
          onChange={setFilterDateStart}
          placeholder="Start date"
          ariaLabel="Filter: engagement start from"
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{'\u2013'}</span>
        <DatePicker
          value={filterDateEnd}
          onChange={setFilterDateEnd}
          placeholder="End date"
          ariaLabel="Filter: engagement end to"
        />

        <span style={toolbarDividerStyle} aria-hidden="true" />

        <input
          className="kanban-ghost"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Search client / project / ALT-ID..."
          aria-label="Search projects"
          style={{ width: 280, padding: '0.4rem 0.7rem', fontSize: '0.8rem', fontWeight: 500, fontFamily: 'var(--font-display)', borderRadius: 'var(--radius-md)' }}
        />

        <span style={{ marginLeft: 'auto' }} />
        <SavedViewBar page="kanban" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} />
      </div>

      <div style={{ overflowX: 'auto', minHeight: 400 }}>

        <div style={{ position: 'sticky', top: 0, zIndex: 10, paddingBottom: '0.5rem', background: 'var(--bg-content)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
            gap: 8,
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
                  background: columnAccent(col),
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
            gap: 8,
          }}>
            {COLUMNS.map((col, i) => {
              const center = (COLUMNS.length - 1) / 2
              const dist = Math.abs(i - center)
              return (
                <motion.div
                  key={col.key}
                  aria-hidden="true"
                  initial={reduceMotion ? false : { scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : {
                    delay: dist * 0.12,
                    duration: 0.75,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={{
                    height: 6,
                    borderRadius: 'var(--radius-pill)',
                    background: columnAccent(col),
                    transformOrigin: 'center',
                  }}
                />
              )
            })}
          </div>
        </div>

        {sortedPMKeys.map(pmKey => {
          const pmAllProjects = pmGroups.get(pmKey) || []
          const isCollapsed = collapsedLanes.has(pmKey)
          const pmLabel = pmKey === UNASSIGNED_KEY ? 'Unassigned' : pmKey

          return (
            <div key={pmKey}>
              <div
                onClick={() => toggleLane(pmKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  cursor: 'pointer',
                  padding: '0.55rem 0.25rem',
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                  userSelect: 'none',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border-soft)',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <span style={{ fontSize: '0.6rem', width: 12, textAlign: 'center' }}>
                  {isCollapsed ? '\u25B6' : '\u25BC'}
                </span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-soft)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: pmKey === UNASSIGNED_KEY ? 'var(--text-muted)' : 'var(--brand-cyan)',
                }}>
                  {pmInitials(pmLabel)}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: pmKey === UNASSIGNED_KEY ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontStyle: pmKey === UNASSIGNED_KEY ? 'italic' : 'normal',
                  letterSpacing: '0.04em',
                }}>
                  {pmLabel}
                </span>
                {pmAllProjects.length > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                    marginLeft: 'auto',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '1px 8px',
                    fontWeight: 500,
                  }}>
                    {pmAllProjects.length}
                  </span>
                )}
              </div>

              {!isCollapsed && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
                }}>
                  {COLUMNS.map((col, ci) => {
                    const cellProjects = pmAllProjects.filter(p => col.statuses.includes(p.status))
                    const cellKey = `${pmKey}__${col.key}`
                    const isOver = dragOverColumn === cellKey
                    const accent = columnAccent(col)

                    return (
                      <div
                        key={col.key}
                        onDragOver={e => handleDragOver(e, cellKey)}
                        onDragLeave={e => handleDragLeave(e, cellKey)}
                        onDrop={e => handleDrop(e, col)}
                        style={{
                          background: isOver ? 'rgba(255,255,255,0.04)' : 'transparent',
                          borderLeft: ci === 0 ? 'none' : '1px solid var(--border-soft)',
                          padding: '0.5rem',
                          minHeight: 54,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          transition: 'background 0.15s',
                          outline: isOver ? `2px dashed ${accent}` : '2px dashed transparent',
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
                </div>
              )}
            </div>
          )
        })}
      </div>

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
              <Button variant="secondary" onClick={cancelDrop}>Cancel</Button>
              <Button variant="primary" onClick={confirmDrop}>Confirm</Button>
            </div>
          </div>
        </div>
      )}

    </div>
    </div>

    {drawerProjectId && (
      <div style={{
        width: 700,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-content)',
        overflow: 'auto',
        boxShadow: '-4px 0 16px rgba(0,0,0,0.2)',
      }}>
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
          <Button variant="ghost" size="sm" onClick={() => setDrawerProjectId(null)}>
            &times; Close
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigate(`/projects/${drawerProjectId}`)
              setDrawerProjectId(null)
            }}
          >
            Open full page &#x2197;
          </Button>
        </div>
        <div style={{ padding: '1rem' }}>
          <ProjectDetail key={drawerProjectId} projectId={drawerProjectId} />
        </div>
      </div>
    )}
    </div>
  )
}

function KanbanCard({ project, consultantCount, isDragging, onDragStart, onDragEnd, readOnly, onClickCard, dismissed, onDismissAlert, onRestoreAlert }: KanbanCardProps) {
  const statusColor = STATUS_COLORS[project.status]
  const dateRange = formatDateRange(project.engagement_start, project.engagement_end)
  const consultantLabel = consultantCount > 0 ? `${consultantCount} consultant${consultantCount !== 1 ? 's' : ''}` : '\u2014'
  const didDragRef = useRef(false)

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

  let cardBg = 'var(--card-tile)'
  let cardBorder = 'var(--border-soft)'
  let alertLabel = ''
  let alertType = ''
  if (needsKickoffAlert) {
    cardBg = 'var(--card-tile-kickoff)'
    cardBorder = 'var(--alert-kickoff-border)'
    alertLabel = 'Kickoff not scheduled'
    alertType = 'kickoff'
  } else if (needsReadoutAlert) {
    cardBg = 'var(--card-tile-readout)'
    cardBorder = 'var(--alert-readout-border)'
    alertLabel = 'Readout not scheduled'
    alertType = 'readout'
  }

  const restShadow = '0 1px 2px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.18)'
  const liftShadow = '0 2px 4px rgba(0,0,0,0.3), 0 12px 28px rgba(0,0,0,0.35)'

  const dateCells: Array<{ key: string; label: string; title: string; value: string | null }> = [
    { key: 'IK', label: 'IK', title: 'Internal Kickoff', value: project.kickoff_internal },
    { key: 'EK', label: 'EK', title: 'External Kickoff', value: project.kickoff_external },
    { key: 'RO', label: 'RO', title: 'Readout Meeting', value: project.readout_meeting },
  ]

  return (
    <div
      draggable={!readOnly}
      onDragStart={e => {
        didDragRef.current = true
        onDragStart(e, project.id)
      }}
      onDragEnd={() => {
        onDragEnd()
        setTimeout(() => { didDragRef.current = false }, 0)
      }}
      onClick={() => {
        if (!didDragRef.current) onClickCard(project.id)
      }}
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-4)',
        cursor: 'pointer',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: restShadow,
        transform: 'translateY(0)',
        transition: 'transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)',
      }}
      onMouseEnter={e => {
        if (!isDragging) {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = liftShadow
        }
        const popout = e.currentTarget.querySelector('.kanban-popout-btn') as HTMLElement | null
        if (popout) { popout.style.opacity = '0.6'; popout.style.pointerEvents = 'auto' }
        const uid = e.currentTarget.querySelector('.kanban-uid') as HTMLElement | null
        if (uid) uid.style.opacity = '0'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = restShadow
        const popout = e.currentTarget.querySelector('.kanban-popout-btn') as HTMLElement | null
        if (popout) { popout.style.opacity = '0'; popout.style.pointerEvents = 'none' }
        const uid = e.currentTarget.querySelector('.kanban-uid') as HTMLElement | null
        if (uid) uid.style.opacity = '1'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        <StatusDot color={statusColor} ariaLabel={STATUS_LABELS[project.status]} />
        <span style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-muted)',
          fontWeight: 500,
          flex: '1 1 auto',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {STATUS_LABELS[project.status]}
        </span>
        <span style={{ position: 'relative', flexShrink: 0, display: 'inline-flex', alignItems: 'center' }}>
          <span className="kanban-uid" style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            transition: 'opacity var(--duration-fast) var(--ease-out)',
          }}>
            {project.altair_uid}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title="Open in new window"
            aria-label={`Open ${project.project_name} in new window`}
            className="kanban-popout-btn"
            icon={<span style={{ fontSize: 'var(--text-sm)', lineHeight: 1 }}>&#x29C9;</span>}
            onClick={e => {
              e.stopPropagation()
              window.open(`/projects/${project.id}`, '_blank', 'noopener')
            }}
            style={{ position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)', opacity: 0, pointerEvents: 'none', transition: 'opacity var(--duration-fast) var(--ease-out)' }}
          />
        </span>
      </div>

      <div style={{
        fontSize: 'var(--text-md)',
        fontWeight: 600,
        color: 'var(--text-primary)',
        lineHeight: 'var(--leading-tight)',
        marginBottom: 'var(--space-1)',
      }}>
        {project.project_name}
      </div>

      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
        {project.client_name}{project.sow_number ? ` \u00B7 ${project.sow_number}` : ''}
      </div>

      <div style={{
        background: 'var(--card-inset)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
      }}>
        {dateRange && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', whiteSpace: 'nowrap' }}>
            {dateRange}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {dateCells.map(cell => (
            <div key={cell.key} title={cell.title} style={{ flex: '1 1 auto', minWidth: '3.5rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'center' }}>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: 'var(--tracking-wide)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {cell.label}
              </span>
              {cell.value ? (
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'var(--date-chip-bg)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2px var(--space-1)',
                  whiteSpace: 'nowrap',
                }}>
                  {shortDate(cell.value)}
                </span>
              ) : (
                <span style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2px var(--space-2)',
                }}>
                  {'\u2014'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="kanban-card-footer" style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', gap: 'var(--space-2)', minHeight: 22 }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {consultantLabel}
        </span>

        {alertLabel ? (
          <span
            aria-label={alertLabel}
            style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              padding: '2px var(--space-2)',
              borderRadius: 'var(--radius-pill)',
              background: needsKickoffAlert ? 'var(--alert-kickoff-chip)' : 'var(--alert-readout-chip)',
              color: needsKickoffAlert ? 'var(--alert-kickoff-text)' : 'var(--alert-readout-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span className="kanban-alert-glyph" aria-hidden="true" title={alertLabel} style={{ fontSize: 'var(--text-sm)', lineHeight: 1 }}>
              {'⚠︎'}
            </span>
            <span className="kanban-alert-mid" aria-hidden="true">
              {alertType === 'kickoff' ? 'Kickoff' : 'Readout'}
            </span>
            <span className="kanban-alert-full" aria-hidden="true">
              {alertLabel}
            </span>
            <Button
              variant="ghost"
              size="sm"
              title="Dismiss alert"
              aria-label={`Dismiss ${alertLabel} alert`}
              className="kanban-alert-dismiss"
              onClick={e => {
                e.stopPropagation()
                onDismissAlert(project.id, alertType)
              }}
            >
              &times;
            </Button>
          </span>
        ) : hasDismissedAlert ? (
          <span
            role="button"
            title="Restore dismissed alert"
            onClick={e => {
              e.stopPropagation()
              if (dismissedAlertType) onRestoreAlert(project.id, dismissedAlertType)
            }}
            style={{
              marginLeft: 'auto',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              opacity: 0.5,
              textDecoration: 'underline',
              whiteSpace: 'nowrap',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
          >
            Restore alert
          </span>
        ) : null}
      </div>
    </div>
  )
}
