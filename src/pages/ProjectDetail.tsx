import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { LoadingState } from '../components/LoadingState'
import { StatusBadge } from '../components/StatusBadge'
import { SearchableSelect } from '../components/SearchableSelect'
import { TimelineGrid } from '../lib/TimelineGrid'
import { useIsReadOnly, useIsPmoAdmin } from '../lib/permissions'
import { formatWeek, calcBusinessDays } from '../lib/resourcingUtils'
import { countHolidaysInRangeArray, formatTimeAgo, renderMentionContent } from '../lib/projectDetailUtils'
import { EMPTY_ASSIGNMENT } from '../types/projectDetail'
import {
  formLabelStyle, formInputStyle,
  modalLabelStyle, modalInputStyle,
  NAME_COL, VISIBLE_WEEKS, ROW_H,
} from '../lib/projectDetailStyles'
import { useProjectDetailData } from '../hooks/useProjectDetailData'
import { useProjectDetailAssignments } from '../hooks/useProjectDetailAssignments'
import { useProjectDetailComments } from '../hooks/useProjectDetailComments'
import { PageTitle, Button, Dialog, DatePicker, SingleSelect } from '../components/ui'
import { ProjectDetailSkeleton } from './ProjectDetailSkeleton'
import './ProjectDetail.css'

const ArrowLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3 5 8l5 5" />
  </svg>
)
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 3 5 5-5 5" />
  </svg>
)

const PM_TITLES = ['Project Manager']
const PRACTICE_TITLES = ['Practice Manager', 'Senior Practice Manager']

type KeyDateField = 'kickoff_internal' | 'kickoff_external' | 'readout_meeting'
type ManagerField = 'project_manager' | 'practice_manager'

const KEY_DATE_FIELDS: readonly [KeyDateField, string][] = [
  ['kickoff_internal', 'Internal Kickoff'],
  ['kickoff_external', 'External Kickoff'],
  ['readout_meeting', 'Readout Meeting'],
]

export function ProjectDetail({ projectId: propId }: { projectId?: string } = {}) {
  const readOnly = useIsReadOnly()
  const isPmoAdmin = useIsPmoAdmin()
  const { id: paramId } = useParams<{ id: string }>()
  const id = propId || paramId

  const data = useProjectDetailData(id)
  const {
    project, assignments, consultants, holidays, comments,
    loading, error, retry, loadProject, loadAssignments, loadComments,
    setAssignments, mutatingRef,
  } = data

  const asg = useProjectDetailAssignments({
    id, readOnly, assignments, setAssignments, consultants, holidays,
    mutatingRef, loadAssignments, loadProject,
  })

  const cmt = useProjectDetailComments(id, loadComments, comments)

  const [sendingSchedulingEmail, setSendingSchedulingEmail] = useState(false)
  const [savingDate, setSavingDate] = useState<string | null>(null)

  if (error) return <LoadingState loading={false} error={error} retry={retry} message="Loading project..." />
  if (loading) return <ProjectDetailSkeleton />
  if (!project) return <p>Project not found.</p>

  const totalAssignedHours = assignments.reduce((sum, a) => sum + Number(a.total_hours), 0)
  const remainingHours = Number(project.planned_hours) - totalAssignedHours
  const impliedRate = totalAssignedHours > 0 ? Number(project.sow_amount) / totalAssignedHours : 0

  const totalCost = assignments.reduce((sum, a) => sum + Number(a.total_hours) * Number(a.consultants?.hourly_cost_rate || 0), 0)
  const sowAmount = Number(project.sow_amount || 0)
  const margin = sowAmount - totalCost
  const marginPct = (sowAmount && totalCost > 0) ? (margin / sowAmount) * 100 : null
  const fmtMoney = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const showEngagement = !!(
    project.external_id || project.client_contact_email || project.sla || project.notes
    || project.po_required || project.po_received || project.onsite_required
  )

  function managerOptions(titles: string[], current: string | null) {
    const names = consultants
      .filter(c => c.title != null && titles.includes(c.title))
      .map(c => c.full_name)
    if (current && !names.includes(current)) names.push(current)
    names.sort((a, b) => a.localeCompare(b))
    return [{ value: '', label: 'Unassigned' }, ...names.map(n => ({ value: n, label: n }))]
  }

  async function saveDate(field: KeyDateField, value: string | null) {
    setSavingDate(field)
    try {
      await api.updateProject({ id: project!.id, [field]: value })
      await loadProject()
    } catch (err) {
      console.error(`Error updating ${field}:`, err)
      alert('Error saving date: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingDate(null)
    }
  }

  async function saveManager(field: ManagerField, value: string) {
    const next = value || null
    if (next === (project![field] || null)) return
    try {
      await api.updateProject({ id: project!.id, [field]: next })
      await loadProject()
    } catch (err) {
      console.error(`Error updating ${field}:`, err)
      alert('Error saving: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  function applyHours(which: 'start_date' | 'end_date', value: string) {
    const updated = { ...asg.form, [which]: value }
    if (updated.start_date && updated.end_date) {
      const bdays = calcBusinessDays(updated.start_date, updated.end_date)
      const eng = updated.consultant_id ? consultants.find(en => en.id === updated.consultant_id) : null
      const hols = countHolidaysInRangeArray(holidays, eng?.country || null, updated.start_date, updated.end_date)
      updated.total_hours = String((bdays - hols) * 8)
    }
    asg.setForm(updated)
  }

  const assignReady = !!(asg.form.consultant_id && asg.form.start_date && asg.form.end_date && asg.form.total_hours)

  return (
    <div className="pd">
      <Link to="/projects" className="pd-back">&larr; Back to Projects</Link>

      <div className="pd-head">
        <PageTitle title={`${project.client_name} — ${project.project_name}`} style={{ margin: 0 }} />
        <span
          className="pd-uidchip"
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
        <div className="pd-dates">
          {project.engagement_start || '?'} <span className="arr">&rarr;</span> {project.engagement_end || '?'}
        </div>
      )}

      <div className="pd-dossier">
        <div className="pd-main">

          {assignments.length > 0 && (
            <div
              ref={asg.ganttRef}
              style={{
                background: 'var(--bg-content)', border: '1px solid var(--border-soft)',
                borderRadius: 'var(--radius-lg)', overflow: 'auto', marginBottom: 'var(--space-5)',
                userSelect: asg.dragging || asg.creating ? 'none' : 'auto',
                transform: 'translateZ(0)', contain: 'paint',
              }}
            >
              <div style={{ minWidth: NAME_COL + VISIBLE_WEEKS * 50, position: 'relative' }}>
                {asg.todayPct >= 0 && asg.todayPct <= 100 && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: 2,
                    left: `calc(${NAME_COL}px + (100% - ${NAME_COL}px) * ${asg.todayPct / 100})`,
                    background: 'var(--brand-cyan)', opacity: 0.6, zIndex: 3, pointerEvents: 'none',
                  }} />
                )}

                <div style={{ position: 'sticky', top: 0, zIndex: 6, background: 'var(--bg-content)' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{
                      width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-content)',
                      padding: '0.25rem 0.5rem', position: 'sticky', left: 0, zIndex: 5,
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 'var(--space-1)',
                      borderRight: '1px solid var(--border-soft)',
                    }}>
                      <Button variant="ghost" size="sm" icon={<ArrowLeftIcon />} aria-label="Previous weeks" onClick={() => asg.setWeekOffset(w => w - 4)} />
                      <Button variant="secondary" size="sm" onClick={() => asg.setWeekOffset(0)}>Today</Button>
                      <Button variant="ghost" size="sm" icon={<ArrowRightIcon />} aria-label="Next weeks" onClick={() => asg.setWeekOffset(w => w + 4)} />
                    </div>
                    <div style={{ flex: 1, display: 'flex' }}>
                      {asg.monthHeaders.map((mh, i) => (
                        <div key={i} style={{
                          flex: `0 0 ${(mh.span / VISIBLE_WEEKS) * 100}%`,
                          textAlign: 'center', padding: '0.5rem 0',
                          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)',
                          borderLeft: i > 0 ? '1px solid var(--border-soft)' : 'none',
                          whiteSpace: 'nowrap', overflow: 'hidden',
                        }}>
                          {mh.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{
                      width: NAME_COL, minWidth: NAME_COL, flexShrink: 0, background: 'var(--bg-content)',
                      padding: '0.4rem 1rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      position: 'sticky', left: 0, zIndex: 5, display: 'flex', alignItems: 'center',
                      borderRight: '1px solid var(--border-soft)',
                    }}>
                      Consultant
                    </div>
                    <div style={{ flex: 1, display: 'flex' }}>
                      {asg.weeks.map((w, i) => {
                        const isCurrentWeek = asg.today >= w && asg.today < new Date(w.getTime() + 7 * 86400000)
                        return (
                          <div key={i} style={{
                            flex: `0 0 ${100 / VISIBLE_WEEKS}%`, textAlign: 'center', padding: '0.4rem 0',
                            fontSize: '0.6rem', color: isCurrentWeek ? 'var(--brand-cyan)' : 'var(--text-muted)',
                            fontWeight: isCurrentWeek ? 700 : 400,
                            borderLeft: '1px solid var(--border-soft)', whiteSpace: 'nowrap', overflow: 'hidden',
                          }}>
                            {formatWeek(w)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {asg.assignmentsByConsultant.map(([engId, { name, assignments: engAssignments }]) => (
                  <div key={engId} style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)' }}>
                    <div style={{
                      width: NAME_COL, minWidth: NAME_COL, flexShrink: 0,
                      padding: '0.5rem 1rem', display: 'flex', alignItems: 'center',
                      fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)',
                      background: 'var(--bg-content)', position: 'sticky', left: 0, zIndex: 4,
                      borderRight: '1px solid var(--border-soft)',
                      boxShadow: '0 1px 0 0 var(--border-soft), 0 1px 0 0 var(--bg-content)',
                    }}>
                      {name}
                    </div>
                    <div style={{ flex: 1, position: 'relative', height: ROW_H, isolation: 'isolate' }}>
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

          <div className="pd-sect">
            <h3>Assignments <span className="cnt">({assignments.length})</span></h3>
            {!readOnly && (
              <Button variant="ghost" size="sm" onClick={() => { asg.setForm(EMPTY_ASSIGNMENT); asg.setShowForm(!asg.showForm) }}>
                {asg.showForm ? 'Cancel' : '+ Assign Consultant'}
              </Button>
            )}
          </div>

          {asg.showForm && (
            <form onSubmit={asg.handleAssign} className="pd-addform">
              <div>
                <label style={formLabelStyle}>Consultant *</label>
                <SingleSelect
                  value={asg.form.consultant_id}
                  onChange={v => asg.setForm({ ...asg.form, consultant_id: v })}
                  options={[...consultants]
                    .sort((a, b) => a.full_name.localeCompare(b.full_name))
                    .map(c => ({ value: c.id, label: c.full_name, meta: c.title ?? undefined }))}
                  placeholder="Select consultant…"
                  ariaLabel="Consultant"
                />
              </div>
              <div>
                <label style={formLabelStyle}>Start Date *</label>
                <DatePicker
                  value={asg.form.start_date}
                  ariaLabel="Start date"
                  onChange={v => applyHours('start_date', v || '')}
                />
              </div>
              <div>
                <label style={formLabelStyle}>End Date *</label>
                <DatePicker
                  value={asg.form.end_date}
                  ariaLabel="End date"
                  onChange={v => applyHours('end_date', v || '')}
                />
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
                <Button type="submit" variant="primary" loading={asg.saving} disabled={!assignReady} style={{ width: '100%' }}>
                  {asg.saving ? 'Saving...' : 'Assign'}
                </Button>
              </div>
            </form>
          )}

          {assignments.length === 0 && !asg.showForm ? (
            <p className="pd-empty">
              No consultants assigned yet. Click "+ Assign Consultant" to add one.
            </p>
          ) : (
            <div className="pd-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Consultant</th>
                    <th>Start</th>
                    <th>End</th>
                    <th className="num">Hours</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td><span className="pd-eng">{a.consultants?.full_name || 'Unknown'}</span></td>
                      <td className="pd-dt">{a.start_date}</td>
                      <td className="pd-dt">{a.end_date}</td>
                      <td className="num">{a.total_hours}</td>
                      <td className="pd-cell-muted">{a.notes || '—'}</td>
                      <td>
                        <span className="pd-rowact">
                          <Button variant="ghost" size="sm" onClick={() => asg.openEditModal(a)}>Edit</Button>
                          {!readOnly && (
                            <Button variant="danger" size="sm" onClick={() => asg.removeAssignment(a.id)}>Remove</Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pd-notescard" style={{ marginTop: 'var(--space-5)' }}>
            <div className="pd-sect pd-notescard-head">
              <h3>Notes <span className="cnt">({cmt.comments.length})</span></h3>
            </div>
            <div className="pd-composer">
              <div className="pd-vbox">
                <textarea
                  ref={cmt.commentInputRef}
                  className="pd-noteinput"
                  value={cmt.newComment}
                  onChange={cmt.handleCommentChange}
                  onKeyDown={cmt.handleCommentKeyDown}
                  placeholder="Add a note… Use @ to mention someone"
                  rows={2}
                />
                <div className="pd-vfoot">
                  <span className="pd-vhint"><b>@</b> to mention</span>
                  <Button
                    variant="primary"
                    size="sm"
                    loading={cmt.savingComment}
                    disabled={cmt.savingComment || !cmt.newComment.trim()}
                    onClick={() => { if (cmt.newComment.trim()) cmt.handleAddComment(project) }}
                  >
                    {cmt.savingComment ? 'Saving...' : 'Add Note'}
                  </Button>
                </div>
              </div>
              {cmt.showMentions && (() => {
                const filtered = cmt.mentionUsers.filter(u => u.display.toLowerCase().includes(cmt.mentionQuery))
                if (filtered.length === 0) return null
                return (
                  <div style={{
                    position: 'absolute', zIndex: 10, top: 70, left: 0,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', maxHeight: 200, overflow: 'auto', minWidth: 220,
                  }}>
                    {filtered.map((u, i) => (
                      <div
                        key={u.id}
                        onClick={() => cmt.insertMention(u)}
                        style={{
                          padding: '0.4rem 0.75rem', fontSize: 'var(--text-base)',
                          color: 'var(--text-primary)', cursor: 'pointer',
                          background: i === cmt.mentionIndex ? 'var(--bg-elevated)' : 'transparent',
                        }}
                      >
                        {u.display}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {cmt.comments.length === 0 ? (
              <div className="pd-empty-thread">No notes yet.</div>
            ) : (
              <div className="pd-thread">
                {cmt.comments.map(c => (
                  <div key={c.id} className="pd-item">
                    <span className="pd-av">{initials(c.author_name || c.author_email)}</span>
                    <div className="pd-item-col">
                      <div className="pd-item-line">
                        <span className="pd-item-who">{c.author_name || c.author_email}</span>
                        <span className="pd-item-ago">{formatTimeAgo(c.created_at)}</span>
                        {!readOnly && (
                          <span className="pd-item-del">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={cmt.deletingCommentId === c.id}
                              onClick={() => cmt.handleDeleteComment(c.id)}
                              title="Delete note"
                            >
                              &#10005;
                            </Button>
                          </span>
                        )}
                      </div>
                      <div className="pd-item-body">{renderMentionContent(c.content)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pd-rail">
          <div className="pd-panel">
            <div className="pd-ph"><span className="pd-eyebrow">Financials</span></div>
            <FinRow k="SOW Amount" v={project.sow_amount == null || !Number.isFinite(Number(project.sow_amount)) ? '—' : '$' + Number(project.sow_amount).toLocaleString()} />
            <FinRow k="Planned Hours" v={project.planned_hours == null ? '—' : String(project.planned_hours)} />
            <FinRow k="Assigned" v={String(totalAssignedHours)} />
            <FinRow k="Remaining" v={String(Number(remainingHours.toFixed(2)))}
              tone={remainingHours < 0 ? 'neg' : remainingHours === 0 ? 'cyan' : undefined} />
            <FinRow k="Implied Rate" v={impliedRate > 0 ? '$' + impliedRate.toFixed(2) + '/hr' : '—'} />
            {isPmoAdmin && (
              <>
                <FinRow divide k="Total Cost" v={totalCost > 0 ? fmtMoney(totalCost) : '—'} />
                <FinRow k="Margin" v={sowAmount > 0 ? fmtMoney(margin) : '—'}
                  tone={sowAmount > 0 ? (margin >= 0 ? 'pos' : 'neg') : undefined} />
                <FinRow k="Margin %" v={marginPct != null ? marginPct.toFixed(1) + '%' : '—'}
                  tone={marginPct == null ? undefined : (marginPct >= 0 ? 'pos' : 'neg')} />
              </>
            )}
            <ManagerRow
              label="Project Manager"
              name={project.project_manager}
              readOnly={readOnly}
              divide
              options={managerOptions(PM_TITLES, project.project_manager)}
              onChange={v => saveManager('project_manager', v)}
            />
            <ManagerRow
              label="Practice Manager"
              name={project.practice_manager}
              readOnly={readOnly}
              options={managerOptions(PRACTICE_TITLES, project.practice_manager)}
              onChange={v => saveManager('practice_manager', v)}
            />
          </div>

          {showEngagement && (
            <div className="pd-panel">
              <div className="pd-ph"><span className="pd-eyebrow">Engagement</span></div>
              <div className="pd-sf-grid">
                <EngField label="External ID" value={project.external_id} />
                <EngField label="Client Contact" value={project.client_contact_email} />
                <EngField label="SLA" value={project.sla} />
                <EngField label="Onsite" value={project.onsite_required ? 'Yes' : 'No'} />
                <EngField label="PO Required" value={project.po_required ? 'Yes' : 'No'} />
                <EngField label="PO Received" value={project.po_received ? 'Yes' : 'No'} />
                <EngField label="Notes" value={project.notes} multiline />
              </div>
            </div>
          )}

          <div className="pd-panel">
            <div className="pd-ph"><span className="pd-eyebrow">Key Dates</span></div>
            {KEY_DATE_FIELDS.map(([field, label]) => {
              const val = project[field] || ''
              return (
                <div key={field} className="pd-kd-row">
                  <span className="pd-kd-k">{label}</span>
                  {readOnly ? (
                    <span className="pd-kd-ro">{val || '—'}</span>
                  ) : (
                    <div style={{ width: 150, opacity: savingDate === field ? 0.6 : 1 }}>
                      <DatePicker
                        value={val}
                        onChange={(v) => saveDate(field, v || null)}
                        ariaLabel={label}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="pd-panel">
            <div className="pd-ph"><span className="pd-eyebrow">Scheduling Email</span></div>
            <div className="pd-sched-to">
              {project.client_contact_email
                ? `→ ${project.client_contact_email}`
                : 'No client contact email set for this project'}
            </div>
            <Button
              variant="primary"
              loading={sendingSchedulingEmail}
              disabled={sendingSchedulingEmail || !project.client_contact_email}
              style={{ width: '100%' }}
              onClick={async () => {
                if (!project.client_contact_email) return
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
            >
              {sendingSchedulingEmail ? 'Sending...' : 'Send Scheduling Email'}
            </Button>
          </div>
        </div>
      </div>

      {asg.editingAssignment && (
        <Dialog
          open={!!asg.editingAssignment}
          onOpenChange={(o) => { if (!o) asg.setEditingAssignment(null) }}
          title="Edit Assignment"
          description={asg.editingAssignment.consultant_name}
          width={420}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              {!readOnly ? (
                <Button variant="danger" onClick={asg.handleDeleteAssignment} loading={asg.savingEdit}>Delete</Button>
              ) : <span />}
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => asg.setEditingAssignment(null)}>
                  {readOnly ? 'Close' : 'Cancel'}
                </Button>
                {!readOnly && (
                  <Button variant="primary" onClick={() => asg.handleSaveEdit()} loading={asg.savingEdit}>Save</Button>
                )}
              </div>
            </div>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={modalLabelStyle}>Start Date</label>
              {readOnly ? (
                <div style={modalInputStyle}>{asg.editingAssignment.start_date || '—'}</div>
              ) : (
                <DatePicker value={asg.editingAssignment.start_date} ariaLabel="Start date" onChange={v => asg.updateEditDates('start_date', v || '')} />
              )}
            </div>
            <div>
              <label style={modalLabelStyle}>End Date</label>
              {readOnly ? (
                <div style={modalInputStyle}>{asg.editingAssignment.end_date || '—'}</div>
              ) : (
                <DatePicker value={asg.editingAssignment.end_date} ariaLabel="End date" align="right" onChange={v => asg.updateEditDates('end_date', v || '')} />
              )}
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={modalLabelStyle}>Total Hours</label>
            <input type="number" step="0.5" min="0.5"
              value={asg.editingAssignment.total_hours}
              onChange={e => asg.setEditingAssignment({ ...asg.editingAssignment!, total_hours: e.target.value })}
              style={{ ...modalInputStyle, width: 120 }} readOnly={readOnly} />
          </div>
          <div>
            <label style={modalLabelStyle}>Notes</label>
            <textarea
              value={asg.editingAssignment.notes}
              onChange={e => asg.setEditingAssignment({ ...asg.editingAssignment!, notes: e.target.value })}
              placeholder="Optional notes" rows={2}
              style={{ ...modalInputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              readOnly={readOnly} />
          </div>
        </Dialog>
      )}
    </div>
  )
}

function initials(nameOrEmail: string): string {
  const base = nameOrEmail.split('@')[0].trim()
  const parts = base.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

function ManagerChip({ name }: { name?: string | null }) {
  const assigned = !!name
  return (
    <span className={`pd-osm-chip${assigned ? '' : ' pd-osm-chip--empty'}`}>
      {assigned && <span className="pd-av pd-osm-av">{initials(name as string)}</span>}
      <span className="pd-osm-name">{assigned ? name : 'Unassigned'}</span>
    </span>
  )
}

function ManagerRow({ label, name, readOnly, options, onChange, divide }: {
  label: string
  name: string | null
  readOnly: boolean
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  divide?: boolean
}) {
  return (
    <div className={`pd-fin-row pd-osm-row${divide ? ' divide' : ''}`}>
      <span className="pd-fin-k">{label}</span>
      {readOnly ? (
        <ManagerChip name={name} />
      ) : (
        <SearchableSelect
          variant="ghost"
          value={name || ''}
          placeholder="Unassigned"
          options={options}
          renderTrigger={() => <ManagerChip name={name} />}
          onChange={onChange}
        />
      )}
    </div>
  )
}

function FinRow({ k, v, tone, divide }: { k: string; v: ReactNode; tone?: 'pos' | 'neg' | 'cyan'; divide?: boolean }) {
  return (
    <div className={`pd-fin-row${divide ? ' divide' : ''}`}>
      <span className="pd-fin-k">{k}</span>
      <span className={`pd-fin-v${tone ? ' ' + tone : ''}`}>{v}</span>
    </div>
  )
}

function EngField({ label, value, multiline }: { label: string; value: string | null | undefined; multiline?: boolean }) {
  if (multiline) {
    if (!value) return null
    return (
      <div className="pd-sf-block">
        <span className="pd-sf-block-k">{label}</span>
        <span className="pd-sf-block-v">{value}</span>
      </div>
    )
  }
  return (
    <>
      <span className="pd-sf-k">{label}</span>
      <span className="pd-sf-v">{value || '—'}</span>
    </>
  )
}
