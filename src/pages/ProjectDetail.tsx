import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { TimelineGrid } from '../lib/TimelineGrid'
import { useIsReadOnly, useIsPmoAdmin } from '../lib/permissions'
import { formatWeek } from '../lib/resourcingUtils'
import { calcBusinessDays } from '../lib/resourcingUtils'
import { countHolidaysInRangeArray } from '../lib/projectDetailUtils'
import { formatTimeAgo, renderMentionContent } from '../lib/projectDetailUtils'
import { EMPTY_ASSIGNMENT } from '../types/projectDetail'
import {
  ganttNavBtnStyle, formLabelStyle, formInputStyle,
  modalLabelStyle, modalInputStyle, panelCardStyle, panelInputStyle,
  NAME_COL, VISIBLE_WEEKS, ROW_H,
} from '../lib/projectDetailStyles'
import { useProjectDetailData } from '../hooks/useProjectDetailData'
import { useProjectDetailAssignments } from '../hooks/useProjectDetailAssignments'
import { useProjectDetailComments } from '../hooks/useProjectDetailComments'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ProjectDetail({ projectId: propId }: { projectId?: string } = {}) {
  const readOnly = useIsReadOnly()
  const isPmoAdmin = useIsPmoAdmin()
  const { id: paramId } = useParams<{ id: string }>()
  const id = propId || paramId

  // Data fetching
  const data = useProjectDetailData(id)
  const {
    project, assignments, consultants, holidays, comments,
    loading, error, retry, loadProject, loadAssignments, loadComments,
    setAssignments, mutatingRef,
  } = data

  // Assignment + Gantt logic
  const asg = useProjectDetailAssignments({
    id, readOnly, assignments, setAssignments, consultants, holidays,
    mutatingRef, loadAssignments, loadProject,
  })

  // Comments + mentions
  const cmt = useProjectDetailComments(id, loadComments, comments)

  // Scheduling email state
  const [sendingSchedulingEmail, setSendingSchedulingEmail] = useState(false)

  // Project Manager editing state
  const [editingOSM, setEditingOSM] = useState(false)
  const [allOSMs, setAllOSMs] = useState<string[]>([])

  useEffect(() => {
    api.getConsultants({ is_active: 'eq.true', title: 'eq.Project Manager' }).then(osms => {
      setAllOSMs(osms.map(e => e.full_name).sort())
    }).catch(() => {})
  }, [])

  // Key dates saving state
  const [savingDate, setSavingDate] = useState<string | null>(null)

  /* ---------- Render ---------- */

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading project..." />
  if (!project) return <p>Project not found.</p>

  const totalAssignedHours = assignments.reduce((sum, a) => sum + Number(a.total_hours), 0)
  const remainingHours = Number(project.planned_hours) - totalAssignedHours
  const impliedRate = totalAssignedHours > 0 ? Number(project.sow_amount) / totalAssignedHours : 0

  const totalCost = assignments.reduce((sum, a) => sum + Number(a.total_hours) * Number(a.consultants?.hourly_cost_rate || 0), 0)
  const sowAmount = Number(project.sow_amount || 0)
  const margin = sowAmount - totalCost
  const marginPct = (sowAmount && totalCost > 0) ? (margin / sowAmount) * 100 : null

  return (
    <div>
      <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none' }}>
        &larr; Back to Projects
      </Link>

      <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{project.client_name} — {project.project_name}</h2>
          <span
            style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.75rem',
              fontFamily: 'monospace', color: 'var(--text-secondary)', cursor: 'pointer',
              userSelect: 'all', letterSpacing: '0.03em',
            }}
            title="Click to copy Altair UID"
            onClick={() => navigator.clipboard.writeText(project.altair_uid)}
          >
            {project.altair_uid}
          </span>
          {readOnly ? (
            <StatusBadge status={project.status} />
          ) : (
            <StatusBadge status={project.status} onStatusChange={asg.updateStatus} />
          )}
        </div>
        {(project.engagement_start || project.engagement_end) && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {project.engagement_start || '?'} &rarr; {project.engagement_end || '?'}
          </div>
        )}
        {/* Card 1: Hours & Rate */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '1rem 1.25rem', marginTop: '0.75rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem 2rem' }}>
            <Stat label="SOW Amount" value={'$' + Number(project.sow_amount).toLocaleString()} />
            <Stat label="Planned Hours" value={String(project.planned_hours)} />
            <Stat label="Assigned Hours" value={String(totalAssignedHours)} />
            <Stat label="Remaining Hours" value={String(remainingHours)}
              color={remainingHours < 0 ? 'var(--color-critical)' : remainingHours === 0 ? 'var(--color-info)' : '#e0e0e0'} />
            <Stat label="Implied Rate" value={impliedRate > 0 ? '$' + impliedRate.toFixed(2) + '/hr' : '—'} />
          </div>
        </div>

        {/* Card 2: Margin & Details */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, padding: '1rem 1.25rem', marginTop: '0.75rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem 2rem' }}>
            {isPmoAdmin && (
              <>
                <Stat label="Total Cost" value={totalCost > 0 ? '$' + totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} />
                <Stat label="Margin" value={sowAmount > 0 ? '$' + margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                  color={margin > 0 ? '#28A36A' : margin < 0 ? '#E63948' : '#e0e0e0'} />
                <Stat label="Margin %" value={marginPct != null ? marginPct.toFixed(1) + '%' : '—'}
                  color={marginPct != null ? (marginPct > 0 ? '#28A36A' : '#E63948') : '#e0e0e0'} />
              </>
            )}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Project Manager
              </div>
              {editingOSM ? (
                <select
                  autoFocus
                  value={project.project_manager || ''}
                  onChange={async (e) => {
                    const newOSM = e.target.value || null
                    setEditingOSM(false)
                    if (newOSM !== (project.project_manager || null)) {
                      try {
                        await api.updateProject({ id: project.id, project_manager: newOSM })
                        await loadProject()
                      } catch (err) {
                        console.error('Error updating project_manager:', err)
                        alert('Error saving Project Manager: ' + (err instanceof Error ? err.message : String(err)))
                      }
                    }
                  }}
                  onBlur={() => setEditingOSM(false)}
                  style={{
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 4, color: '#e0e0e0', fontSize: '1rem', fontWeight: 600,
                    padding: '0.2rem 0.4rem', marginTop: '0.1rem', width: '100%', maxWidth: 200,
                  }}
                >
                  <option value="">— None —</option>
                  {allOSMs.map(osm => (
                    <option key={osm} value={osm}>{osm}</option>
                  ))}
                </select>
              ) : (
                <div
                  onClick={() => {
                    if (!readOnly) setEditingOSM(true)
                  }}
                  style={{
                    fontSize: '1.1rem', fontWeight: 600, color: '#e0e0e0', marginTop: '0.1rem',
                    cursor: readOnly ? 'default' : 'pointer',
                    borderBottom: readOnly ? 'none' : '1px dashed var(--border-subtle)',
                    display: 'inline-block',
                  }}
                  title={readOnly ? undefined : 'Click to edit'}
                >
                  {project.project_manager || '—'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============ GANTT CHART ============ */}
      {assignments.length > 0 && (
        <div ref={asg.ganttRef} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, overflow: 'auto', marginBottom: '1.5rem',
          userSelect: asg.dragging || asg.creating ? 'none' : 'auto',
        }}>
            <div style={{ minWidth: NAME_COL + VISIBLE_WEEKS * 50 }}>
              {/* Month headers */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{
                  width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-card)',
                  padding: '0.25rem 0.5rem', position: 'sticky', left: 0, zIndex: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                }}>
                  <button onClick={() => asg.setWeekOffset(w => w - 4)} style={{ ...ganttNavBtnStyle }}>&larr;</button>
                  <button onClick={() => asg.setWeekOffset(0)} style={{ ...ganttNavBtnStyle }}>Today</button>
                  <button onClick={() => asg.setWeekOffset(w => w + 4)} style={{ ...ganttNavBtnStyle }}>&rarr;</button>
                </div>
                <div style={{ flex: 1, display: 'flex' }}>
                  {asg.monthHeaders.map((mh, i) => (
                    <div key={i} style={{
                      flex: `0 0 ${(mh.span / VISIBLE_WEEKS) * 100}%`,
                      textAlign: 'center', padding: '0.5rem 0',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                      borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                    }}>
                      {mh.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Week headers */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{
                  width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                  background: 'var(--bg-card)', padding: '0.4rem 1rem',
                  fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600,
                  position: 'sticky', left: 0, zIndex: 4,
                }}>
                  Consultant
                </div>
                <div style={{ flex: 1, display: 'flex' }}>
                  {asg.weeks.map((w, i) => {
                    const isCurrentWeek = asg.today >= w && asg.today < new Date(w.getTime() + 7 * 86400000)
                    return (
                      <div key={i} style={{
                        flex: `0 0 ${100 / VISIBLE_WEEKS}%`, textAlign: 'center', padding: '0.4rem 0',
                        fontSize: '0.6rem', color: isCurrentWeek ? 'var(--brand-green)' : 'var(--text-muted)',
                        fontWeight: isCurrentWeek ? 700 : 400,
                      }}>
                        {formatWeek(w)}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Consultant rows */}
              {asg.assignmentsByConsultant.map(([engId, { name, assignments: engAssignments }]) => (
                  <div key={engId} style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }}>
                    {/* Name cell */}
                    <div style={{
                      width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                      padding: '0.5rem 1rem', display: 'flex', alignItems: 'center',
                      fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)',
                      background: 'var(--bg-card)', position: 'sticky', left: 0, zIndex: 4,
                    }}>
                      {name}
                    </div>
                    {/* Timeline cell — single row, all bars overlaid */}
                    <div style={{ flex: 1, position: 'relative', height: ROW_H }}>
                      <TimelineGrid weeks={asg.weeks} visibleWeeks={VISIBLE_WEEKS} todayPct={asg.todayPct} />
                      {asg.renderDragCreateZone(engId)}
                      {engAssignments.map((a) => asg.renderBar(a, 5, project))}
                      {asg.renderCreatePreview(`eng-${engId}`)}
                    </div>
                  </div>
              ))}
            </div>
        </div>
      )}

      {/* ============ ASSIGNMENTS TABLE ============ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Assignments ({assignments.length})</h3>
        {!readOnly && (
          <button onClick={() => { asg.setForm(EMPTY_ASSIGNMENT); asg.setShowForm(!asg.showForm) }}>
            {asg.showForm ? 'Cancel' : '+ Assign Consultant'}
          </button>
        )}
      </div>

      {asg.showForm && (
        <form onSubmit={asg.handleAssign} style={{
          background: 'var(--bg-card)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: '1rem',
        }}>
          <div>
            <label style={formLabelStyle}>Consultant *</label>
            <select style={formInputStyle} required value={asg.form.consultant_id}
              onChange={e => asg.setForm({ ...asg.form, consultant_id: e.target.value })}>
              <option value="">Select...</option>
              {[...consultants].sort((a, b) => a.full_name.localeCompare(b.full_name)).map(eng => (
                <option key={eng.id} value={eng.id}>{eng.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={formLabelStyle}>Start Date *</label>
            <input style={formInputStyle} required type="date" value={asg.form.start_date}
              onChange={e => {
                const updated = { ...asg.form, start_date: e.target.value }
                if (updated.start_date && updated.end_date) {
                  const bdays = calcBusinessDays(updated.start_date, updated.end_date)
                  const eng = updated.consultant_id ? consultants.find(en => en.id === updated.consultant_id) : null
                  const hols = countHolidaysInRangeArray(holidays, eng?.country || null, updated.start_date, updated.end_date)
                  updated.total_hours = String((bdays - hols) * 8)
                }
                asg.setForm(updated)
              }} />
          </div>
          <div>
            <label style={formLabelStyle}>End Date *</label>
            <input style={formInputStyle} required type="date" value={asg.form.end_date}
              onChange={e => {
                const updated = { ...asg.form, end_date: e.target.value }
                if (updated.start_date && updated.end_date) {
                  const bdays = calcBusinessDays(updated.start_date, updated.end_date)
                  const eng = updated.consultant_id ? consultants.find(en => en.id === updated.consultant_id) : null
                  const hols = countHolidaysInRangeArray(holidays, eng?.country || null, updated.start_date, updated.end_date)
                  updated.total_hours = String((bdays - hols) * 8)
                }
                asg.setForm(updated)
              }} />
          </div>
          <div>
            <label style={formLabelStyle}>Total Hours *</label>
            <input style={formInputStyle} required type="number" step="0.5" min="0.5" value={asg.form.total_hours}
              onChange={e => asg.setForm({ ...asg.form, total_hours: e.target.value })} />
          </div>
          <div style={{ gridColumn: '1 / 4' }}>
            <label style={formLabelStyle}>Notes</label>
            <input style={formInputStyle} value={asg.form.notes} placeholder="Optional notes"
              onChange={e => asg.setForm({ ...asg.form, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" disabled={asg.saving} style={{ width: '100%' }}>
              {asg.saving ? 'Saving...' : 'Assign'}
            </button>
          </div>
        </form>
      )}

      {assignments.length === 0 && !asg.showForm ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No consultants assigned yet. Click "+ Assign Consultant" to add one.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Consultant</th>
              <th>Start</th>
              <th>End</th>
              <th>Hours</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.consultants?.full_name || 'Unknown'}</td>
                <td>{a.start_date}</td>
                <td>{a.end_date}</td>
                <td>{a.total_hours}</td>
                <td style={{ color: 'var(--text-muted)' }}>{a.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => asg.openEditModal(a)} style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-muted)',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}>
                      Edit
                    </button>
                    {!readOnly && (
                      <button onClick={() => asg.removeAssignment(a.id)} style={{
                        background: 'transparent',
                        border: '1px solid var(--fill-critical)',
                        color: 'var(--color-critical)',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}>
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ============ EDIT ASSIGNMENT MODAL ============ */}
      {asg.editingAssignment && (
        <div
          onClick={() => asg.setEditingAssignment(null)}
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
              Edit Assignment
            </h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              {asg.editingAssignment.consultant_name}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={modalLabelStyle}>Start Date</label>
                <input
                  type="date" value={asg.editingAssignment.start_date}
                  onChange={e => asg.updateEditDates('start_date', e.target.value)}
                  style={modalInputStyle}
                  readOnly={readOnly}
                />
              </div>
              <div>
                <label style={modalLabelStyle}>End Date</label>
                <input
                  type="date" value={asg.editingAssignment.end_date}
                  onChange={e => asg.updateEditDates('end_date', e.target.value)}
                  style={modalInputStyle}
                  readOnly={readOnly}
                />
              </div>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={modalLabelStyle}>Total Hours</label>
              <input
                type="number" step="0.5" min="0.5"
                value={asg.editingAssignment.total_hours}
                onChange={e => asg.setEditingAssignment({ ...asg.editingAssignment!, total_hours: e.target.value })}
                style={{ ...modalInputStyle, width: 120 }}
                readOnly={readOnly}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={modalLabelStyle}>Notes</label>
              <textarea
                value={asg.editingAssignment.notes}
                onChange={e => asg.setEditingAssignment({ ...asg.editingAssignment!, notes: e.target.value })}
                placeholder="Optional notes"
                rows={2}
                style={{ ...modalInputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                readOnly={readOnly}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {!readOnly && (
                <button
                  onClick={asg.handleDeleteAssignment}
                  disabled={asg.savingEdit}
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
                  onClick={() => asg.setEditingAssignment(null)}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)', padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem', borderRadius: 4, cursor: 'pointer',
                  }}
                >
                  {readOnly ? 'Close' : 'Cancel'}
                </button>
                {!readOnly && (
                  <button
                    onClick={asg.handleSaveEdit}
                    disabled={asg.savingEdit}
                    style={{
                      background: 'var(--brand-green-dark)', color: '#fff',
                      border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                      borderRadius: 4, cursor: 'pointer', opacity: asg.savingEdit ? 0.6 : 1,
                    }}
                  >
                    {asg.savingEdit ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ DETAIL PANELS (Engagement, Dates, Links) ============ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
        marginTop: '2rem',
        marginBottom: '2rem',
      }}>

        {/* ---- Engagement Details Panel ---- */}
        {(project.external_id || project.client_contact_email || project.sla || project.po_required || project.po_received || project.onsite_required) && (
          <div style={panelCardStyle}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Engagement Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', fontSize: '0.8rem' }}>
              <DetailField label="External ID" value={project.external_id} />
              <DetailField label="Client Contact" value={project.client_contact_email} />
              <DetailField label="SLA" value={project.sla} />
              <DetailField label="SOW Amount" value={project.sow_amount != null ? '$' + Number(project.sow_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null} />
              <DetailField label="Planned Hours" value={project.planned_hours != null ? String(project.planned_hours) : null} />
              <DetailField label="Onsite Required" value={project.onsite_required ? 'Yes' : 'No'} />
              <DetailField label="PO Required" value={project.po_required ? 'Yes' : 'No'} />
              <DetailField label="PO Received" value={project.po_received ? 'Yes' : 'No'} />
            </div>
          </div>
        )}

        {/* ---- Key Dates Panel (left, bottom) ---- */}
        <div style={panelCardStyle}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Key Dates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {([
              ['kickoff_internal', 'Internal Kickoff'],
              ['kickoff_external', 'External Kickoff'],
              ['readout_meeting', 'Readout Meeting'],
            ] as const).map(([field, label]) => (
              <div key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                {readOnly ? (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {(project as unknown as Record<string, unknown>)[field] as string || '—'}
                  </span>
                ) : (
                  <input
                    type="date"
                    value={(project as unknown as Record<string, unknown>)[field] as string || ''}
                    disabled={savingDate === field}
                    onChange={async (e) => {
                      const newVal = e.target.value || null
                      setSavingDate(field)
                      try {
                        await api.updateProject({ id: project.id, [field]: newVal })
                        await loadProject()
                      } catch (err) {
                        console.error(`Error updating ${field}:`, err)
                        alert('Error saving date: ' + (err instanceof Error ? err.message : String(err)))
                      } finally {
                        setSavingDate(null)
                      }
                    }}
                    style={{
                      ...panelInputStyle,
                      width: 150,
                      opacity: savingDate === field ? 0.6 : 1,
                    }}
                  />
                )}
              </div>
            ))}

          </div>
        </div>

        {/* ---- Send Scheduling Email ---- */}
        <div style={{ ...panelCardStyle, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Scheduling Email</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {project.client_contact_email
                  ? `Send date confirmation to ${project.client_contact_email}`
                  : 'No client contact email set for this project'}
              </span>
            </div>
            <button
              disabled={sendingSchedulingEmail || !project.client_contact_email}
              onClick={async () => {
                if (!confirm(`Send scheduling email to ${project.client_contact_email}?`)) return
                setSendingSchedulingEmail(true)
                try {
                  await api.sendSchedulingEmail(project.id)
                  alert('Scheduling email sent successfully!')
                } catch (err) {
                  console.error('Error sending scheduling email:', err)
                  alert('Error: ' + (err instanceof Error ? err.message : String(err)))
                } finally {
                  setSendingSchedulingEmail(false)
                }
              }}
              style={{
                background: 'var(--brand-green-dark)', color: '#fff',
                border: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem',
                borderRadius: 4, cursor: 'pointer',
                opacity: (sendingSchedulingEmail || !project.client_contact_email) ? 0.6 : 1,
              }}
            >
              {sendingSchedulingEmail ? 'Sending...' : 'Send Scheduling Email'}
            </button>
          </div>
        </div>

      </div>

      {/* ============ NOTES / COMMENTS ============ */}
      <div style={{ ...panelCardStyle, marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>Notes</h3>

        {/* Add comment form — all authenticated users */}
        <div style={{ marginBottom: cmt.comments.length > 0 ? '1rem' : 0, position: 'relative' }}>
          <textarea
            ref={cmt.commentInputRef}
            value={cmt.newComment}
            onChange={cmt.handleCommentChange}
            onKeyDown={cmt.handleCommentKeyDown}
            placeholder="Add a note... Use @ to mention someone"
            rows={2}
            style={{
              ...panelInputStyle,
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
              marginBottom: '0.5rem',
            }}
          />
          {cmt.showMentions && (() => {
            const filtered = cmt.mentionUsers.filter(u => u.display.toLowerCase().includes(cmt.mentionQuery))
            if (filtered.length === 0) return null
            return (
              <div style={{
                position: 'absolute', zIndex: 10, left: 0, top: '100%',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 4, maxHeight: 200, overflow: 'auto', width: '100%',
                marginTop: -4,
              }}>
                {filtered.map((u, i) => (
                  <div
                    key={u.id}
                    onClick={() => cmt.insertMention(u)}
                    style={{
                      padding: '0.4rem 0.75rem', fontSize: '0.85rem',
                      color: 'var(--text-primary)', cursor: 'pointer',
                      background: i === cmt.mentionIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
                    }}
                  >
                    {u.display}
                  </div>
                ))}
              </div>
            )
          })()}
          <button
            disabled={cmt.savingComment || !cmt.newComment.trim()}
            onClick={() => cmt.handleAddComment(project)}
            style={{
              background: 'var(--brand-green-dark)', color: '#fff',
              border: 'none', padding: '0.4rem 0.75rem', fontSize: '0.8rem',
              borderRadius: 4, cursor: 'pointer',
              opacity: (cmt.savingComment || !cmt.newComment.trim()) ? 0.6 : 1,
            }}
          >
            {cmt.savingComment ? 'Saving...' : 'Add Note'}
          </button>
        </div>

        {/* Comments list */}
        {cmt.comments.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No notes yet.
          </div>
        )}
        {cmt.comments.map(c => (
          <div
            key={c.id}
            style={{
              borderTop: '1px solid var(--border)',
              padding: '0.75rem 0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {c.author_name || c.author_email}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {formatTimeAgo(c.created_at)}
                </span>
              </div>
              {!readOnly && (
                <button
                  disabled={cmt.deletingCommentId === c.id}
                  onClick={() => cmt.handleDeleteComment(c.id)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '0.7rem', padding: '0.15rem 0.3rem',
                    opacity: cmt.deletingCommentId === c.id ? 0.5 : 1,
                  }}
                  title="Delete note"
                >
                  &#10005;
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {renderMentionContent(c.content)}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: color || '#e0e0e0', marginTop: '0.1rem' }}>
        {value}
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{value || '—'}</span>
    </>
  )
}
