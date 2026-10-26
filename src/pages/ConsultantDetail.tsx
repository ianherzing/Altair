import React, { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button, DatePicker } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { useIsPmoAdmin, useIsReadOnly } from '../lib/permissions'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'
import { HOURS_PER_DAY, getWorkingDaysInMonth, getHolidaysInMonth, distributeHoursToMonth, formatMonth } from '../lib/dateUtils'
import type { Consultant, Skill, ConsultantSkill, PassionArea, ConsultantCostRate, ProjectType, Holiday } from '../types/database'
import { EngagementHistoryModal } from '../components/EngagementHistoryModal'
import { ConsultantDetailSkeleton } from './ConsultantDetailSkeleton'
import './ConsultantDetail.css'

const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
  BR: 'Brazil',
  CA: 'Canada',
  ES: 'Spain',
  IE: 'Ireland',
  NZ: 'New Zealand',
  SG: 'Singapore',
  AE: 'UAE (Dubai)',
  UK: 'United Kingdom',
}

/* ds-allow: semantic skill-rating ramp — no token */
const RATING_COLORS: Record<number, string> = { 1: '#2BFF00', 2: '#FFF500', 3: '#00F5FF' }

const RATING_LABELS: Record<number, string> = {
  1: 'Learning',
  2: 'Proficient',
  3: 'Expert',
}

function projectTypeColor(type: string): string {
  if (type === 'pto') return 'var(--bar-pto)'
  if (type === 'non_billable') return 'var(--bar-nonbill)'
  return 'var(--brand-cyan)'
}
function projectTypeLabel(type: string): string {
  if (type === 'pto') return 'PTO'
  if (type === 'non_billable') return 'Non-Billable'
  return 'Billable'
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function ConsultantDetail() {
  const { id } = useParams<{ id: string }>()
  const isPmoAdmin = useIsPmoAdmin()
  const canWrite = !useIsReadOnly()
  const { consultant: currentConsultant } = useCurrentConsultant()
  const [consultant, setConsultant] = useState<Consultant | null>(null)
  const [mentorOptions, setMentorOptions] = useState<{ id: string; full_name: string }[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [consultantSkills, setConsultantSkills] = useState<ConsultantSkill[]>([])
  const [passionAreas, setPassionAreas] = useState<PassionArea[]>([])
  const [showTerminate, setShowTerminate] = useState(false)
  const [terminationDate, setTerminationDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [costRates, setCostRates] = useState<ConsultantCostRate[]>([])
  const [showAddRate, setShowAddRate] = useState(false)
  const [newRate, setNewRate] = useState('')
  const [newEffectiveDate, setNewEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [savingRate, setSavingRate] = useState(false)
  const [projectHistory, setProjectHistory] = useState<Array<{
    id: string
    start_date: string
    end_date: string
    total_hours: number
    projects: { id: string; client_name: string; project_name: string; project_type: ProjectType; status: string } | null
  }>>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [utilDrilldown, setUtilDrilldown] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [utilYear, setUtilYear] = useState(() => String(new Date().getFullYear()))
  const [historyYear, setHistoryYear] = useState<string>('all')
  const [showHistory, setShowHistory] = useState(false)

  async function loadData(engId: string) {
    const [consultants, allActive, allSkills, allConsultantSkills, allPassionAreas, crData, assignments, projects, holData] = await Promise.all([
      api.getConsultants({ id: `eq.${engId}` }),
      api.getMentorableConsultants(),
      api.getSkills(),
      api.getConsultantSkills(),
      api.getPassionAreas(),
      isPmoAdmin ? api.getCostRates({ consultant_id: `eq.${engId}`, order: 'effective_date.desc' }) : Promise.resolve([]),
      api.getAssignments({ consultant_id: `eq.${engId}`, order: 'start_date.desc' }),
      api.getProjects(),
      api.getHolidays(),
    ])
    setConsultant(consultants[0] || null)
    setMentorOptions(
      allActive
        .slice()
        .sort((a: Consultant, b: Consultant) => a.full_name.localeCompare(b.full_name))
        .map((e: Consultant) => ({ id: e.id, full_name: e.full_name }))
    )
    setSkills(allSkills.filter((s: Skill) => s.is_active))
    setConsultantSkills(allConsultantSkills.filter((es: ConsultantSkill) => es.consultant_id === engId))
    setPassionAreas(allPassionAreas.filter((pa: PassionArea) => pa.is_active))
    setCostRates(crData)
    const projectMap = new Map(projects.map(p => [p.id, p]))
    setProjectHistory(assignments.map(a => ({
      id: a.id,
      start_date: a.start_date,
      end_date: a.end_date,
      total_hours: a.total_hours,
      projects: projectMap.get(a.project_id) ? {
        id: projectMap.get(a.project_id)!.id,
        client_name: projectMap.get(a.project_id)!.client_name,
        project_name: projectMap.get(a.project_id)!.project_name,
        project_type: projectMap.get(a.project_id)!.project_type as ProjectType,
        status: projectMap.get(a.project_id)!.status,
      } : null,
    })))
    setHolidays(holData)
  }

  const { loading, error, retry } = useLoadData(async () => {
    if (!id) return
    await loadData(id)
  }, [id], 8000)

  async function handleTerminate() {
    if (!id || !terminationDate) return
    setSaving(true)
    try {
      await api.updateConsultant(id, { is_active: false, offboarded_at: terminationDate })
      await loadData(id)
    } catch (err) {
      console.error('Error terminating consultant:', err)
    }
    setSaving(false)
    setShowTerminate(false)
  }

  async function handleReinstate() {
    if (!id) return
    setSaving(true)
    try {
      await api.updateConsultant(id, { is_active: true, offboarded_at: null })
      await loadData(id)
    } catch (err) {
      console.error('Error reinstating consultant:', err)
    }
    setSaving(false)
  }

  const isTerminated = consultant?.offboarded_at != null
  const offboardDateStr = isTerminated ? consultant!.offboarded_at!.slice(0, 10) : null
  const offboardDate = offboardDateStr ? new Date(offboardDateStr + 'T00:00:00') : null
  const dropOffDate = offboardDate ? new Date(offboardDate.getTime() + 14 * 86400000) : null
  const isInGracePeriod = isTerminated && dropOffDate && dropOffDate > new Date()

  const utilization = useMemo(() => {
    if (!consultant) return null
    const now = new Date()
    const year = parseInt(utilYear)
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const months: Array<{
      key: string
      label: string
      billableHours: number
      availableHours: number
      utilization: number
      isFuture: boolean
      workingDays: number
      holidayDays: number
      assignments: { project: string; client: string; hours: number; type: string; projectId: string }[]
    }> = []

    let ytdBillable = 0
    let ytdAvailable = 0

    for (let m = 0; m < 12; m++) {
      const mk = `${year}-${String(m + 1).padStart(2, '0')}`
      const workingDays = getWorkingDaysInMonth(year, m)
      const holidayDays = getHolidaysInMonth(holidays, consultant.country, year, m)
      const availableHours = (workingDays - holidayDays) * HOURS_PER_DAY

      let billableHours = 0
      const monthAssignments: typeof months[0]['assignments'] = []
      for (const a of projectHistory) {
        if (!a.projects) continue
        const hours = distributeHoursToMonth(a, year, m)
        if (hours === 0) continue
        monthAssignments.push({
          project: a.projects.project_name,
          client: a.projects.client_name,
          hours: Math.round(hours * 10) / 10,
          type: a.projects.project_type,
          projectId: a.projects.id,
        })
        if (a.projects.project_type === 'billable') billableHours += hours
      }
      billableHours = Math.round(billableHours * 10) / 10
      const isFuture = year > currentYear || (year === currentYear && m > currentMonth)
      const pct = availableHours > 0 ? Math.round((billableHours / availableHours) * 100) : 0

      months.push({
        key: mk,
        label: formatMonth(mk),
        billableHours,
        availableHours: Math.round(availableHours * 10) / 10,
        utilization: pct,
        isFuture,
        workingDays,
        holidayDays,
        assignments: monthAssignments.sort((a, b) => b.hours - a.hours),
      })

      if (!isFuture) {
        ytdBillable += billableHours
        ytdAvailable += availableHours
      }
    }

    const ytdPct = ytdAvailable > 0 ? Math.round((ytdBillable / ytdAvailable) * 100) : 0

    return { months, ytdPct, ytdBillable, ytdAvailable, target: consultant.utilization_target }
  }, [consultant, holidays, projectHistory, utilYear])

  if (loading) return <ConsultantDetailSkeleton />
  if (error) return <LoadingState loading={false} error={error} retry={retry} message="Loading consultant..." />
  if (!consultant) return <p>Consultant not found.</p>

  const skillMap = new Map(skills.map(s => [s.id, s.name]))
  const passionName = consultant.passion_area_id
    ? passionAreas.find(pa => pa.id === consultant.passion_area_id)?.name || consultant.passion_area || '—'
    : '—'

  const engSkills = consultantSkills
    .map(es => ({ name: skillMap.get(es.skill_id) || '', rating: es.rating, id: es.skill_id }))
    .filter(s => s.name)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))

  const isOwnProfile = currentConsultant?.id === consultant.id
  const canEditMentor = canWrite || isOwnProfile
  const mentorOpts = [
    { value: '', label: 'Unassigned' },
    ...mentorOptions.filter(m => m.id !== consultant.id).map(m => ({ value: m.full_name, label: m.full_name })),
  ]
  if (consultant.mentor && !mentorOptions.some(m => m.full_name === consultant.mentor)) {
    mentorOpts.push({ value: consultant.mentor, label: consultant.mentor })
  }
  const countryOpts = [
    { value: '', label: 'Not set' },
    ...Object.entries(COUNTRY_LABELS).map(([code, label]) => ({ value: code, label })),
  ]
  const yearOpts = Array.from({ length: new Date().getFullYear() - 2025 }, (_, i) => String(new Date().getFullYear() - i)).map(y => ({ value: y, label: y }))
  const historyYearOpts = [{ value: 'all', label: 'All Years' }, ...yearOpts]

  const histMatch = (a: typeof projectHistory[number]) => {
    if (historyYear === 'all') return true
    const y = parseInt(historyYear)
    return a.start_date.startsWith(historyYear) || a.end_date.startsWith(historyYear) ||
      (new Date(a.start_date + 'T00:00:00').getFullYear() <= y && new Date(a.end_date + 'T00:00:00').getFullYear() >= y)
  }
  const visibleHistory = projectHistory.filter(a => a.projects && a.projects.project_type !== 'pto').filter(histMatch)

  const fmtLongDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const utilYearLabel = utilYear === String(new Date().getFullYear()) ? 'YTD' : utilYear

  return (
    <div className="ed">
      <Link to="/consultants" className="ed-back">&larr; Back to Consultants</Link>

      <div className="ed-head">
        <PageTitle title={consultant.full_name} style={{ margin: 0 }} />
        {isTerminated ? (
          <span className="ed-badge ed-badge--term"><span className="ed-dot" />Terminated</span>
        ) : (
          <span className="ed-badge"><span className="ed-dot" />Active</span>
        )}
        <span className="ed-subtitle">{consultant.title || 'No title'}</span>
        <span className="ed-headspacer" />
        <Button variant="ghost" size="sm" onClick={() => setShowHistory(true)}>
          90-day History
        </Button>
        {!isTerminated && isPmoAdmin && !showTerminate && (
          <Button
            variant="ghost"
            size="sm"
            className="ed-term-btn"
            icon={
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 14V2.5M3 3h8l-1.5 3L11 9H3" />
              </svg>
            }
            onClick={() => setShowTerminate(true)}
          >
            Terminate Consultant
          </Button>
        )}
      </div>

      {showHistory && (
        <EngagementHistoryModal consultant={consultant} onClose={() => setShowHistory(false)} />
      )}

      {isTerminated && (
        <div className="ed-term-banner">
          <div>
            <div className="ed-term-title">
              Terminated on {fmtLongDate(offboardDate!)}
            </div>
            {isInGracePeriod && dropOffDate ? (
              <div className="ed-term-sub">Drops from resourcing on {fmtLongDate(dropOffDate)}</div>
            ) : (
              <div className="ed-term-sub">No longer visible in resourcing view</div>
            )}
          </div>
          <Button variant="ghost" size="sm" disabled={saving} onClick={handleReinstate}>
            {saving ? 'Reinstating…' : 'Reinstate Consultant'}
          </Button>
        </div>
      )}

      {!isTerminated && isPmoAdmin && showTerminate && (
        <div className="ed-term-form">
          <div className="ed-term-form-note">
            Set the termination date for {consultant.full_name}. They will remain visible in the resourcing view for 2 weeks after this date.
          </div>
          <div className="ed-term-form-row">
            <div className="ed-field">
              <label className="ed-field-label">Termination date</label>
              <DatePicker value={terminationDate} onChange={(v) => setTerminationDate(v)} ariaLabel="Termination date" />
            </div>
            <div className="ed-term-form-actions">
              <Button variant="secondary" size="sm" onClick={() => setShowTerminate(false)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={saving} disabled={saving || !terminationDate} onClick={handleTerminate}>
                {saving ? 'Terminating…' : 'Confirm Termination'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="ed-dossier">
        <div className="ed-rail">
          <div className="ed-panel">
            <div className="ed-ph"><span className="ed-eyebrow">Profile</span></div>
            <div className="ed-frow">
              <span className="ed-k">Email</span>
              <span className="ed-v ed-v--sans" title={consultant.email}>{consultant.email}</span>
            </div>
            <div className="ed-frow">
              <span className="ed-k">Manager</span>
              <span className={`ed-v ed-v--sans${consultant.manager ? '' : ' ed-v--muted'}`}>{consultant.manager || '—'}</span>
            </div>
            <div className="ed-frow">
              <span className="ed-k">Passion Area</span>
              {consultant.passion_area_id
                ? <span className="ed-passion-pill">{passionName}</span>
                : <span className="ed-v ed-v--sans ed-v--muted">—</span>}
            </div>
          </div>

          <div className="ed-panel">
            <div className="ed-editrow">
              <span className="ed-k">Mentor</span>
              {canEditMentor ? (
                <div className="ed-edit-select">
                  <SearchableSelect
                    variant="ghost"
                    value={consultant.mentor || ''}
                    placeholder="Unassigned"
                    options={mentorOpts}
                    onChange={async (val) => {
                      const newMentor = val || null
                      const prev = consultant.mentor
                      setConsultant({ ...consultant, mentor: newMentor })
                      try {
                        if (isOwnProfile && !canWrite) {
                          await api.updateOwnMentor(newMentor)
                        } else {
                          await api.updateConsultant(consultant.id, { mentor: newMentor })
                        }
                      } catch (err: unknown) {
                        alert('Error updating mentor: ' + errMessage(err))
                        setConsultant({ ...consultant, mentor: prev })
                      }
                    }}
                  />
                </div>
              ) : (
                <span className={`ed-v ed-v--sans${consultant.mentor ? '' : ' ed-v--muted'}`}>{consultant.mentor || '—'}</span>
              )}
            </div>
            <div className="ed-editrow">
              <span className="ed-k">Country</span>
              <div className="ed-edit-select">
                <SearchableSelect
                  variant="ghost"
                  value={consultant.country || ''}
                  placeholder="Not set"
                  options={countryOpts}
                  onChange={async (val) => {
                    const newCountry = val || null
                    setConsultant({ ...consultant, country: newCountry })
                    try {
                      await api.updateConsultantCountry(consultant.id, newCountry ?? '')
                    } catch (err: unknown) {
                      alert('Error updating country: ' + errMessage(err))
                      if (id) loadData(id)
                    }
                  }}
                />
              </div>
            </div>
            <div className="ed-editrow">
              <span className="ed-k">Util Target</span>
              {canWrite ? (
                <span className="ed-numfield">
                  <input
                    className="no-spinner"
                    type="number"
                    min="0"
                    max="100"
                    value={consultant.utilization_target}
                    onChange={async (e) => {
                      const val = parseInt(e.target.value)
                      if (isNaN(val) || val < 0 || val > 100) return
                      setConsultant({ ...consultant, utilization_target: val })
                      try {
                        await api.updateConsultantUtilizationTarget(consultant.id, val)
                      } catch (err: unknown) {
                        alert('Error updating target: ' + errMessage(err))
                        if (id) loadData(id)
                      }
                    }}
                  />
                  <span className="ed-numfield-suffix">%</span>
                </span>
              ) : (
                <span className="ed-v">{consultant.utilization_target}%</span>
              )}
            </div>
          </div>

          <div className="ed-panel">
            <div className="ed-ph"><span className="ed-eyebrow">Skills · {engSkills.length}</span></div>
            {engSkills.length === 0 ? (
              <p className="ed-skills-empty">
                No skills yet — manage on the <Link to="/skills" className="ed-plink">Skills Matrix</Link>.
              </p>
            ) : (
              <div className="ed-skills">
                {engSkills.map(s => (
                  <span
                    key={s.id}
                    className="ed-skill"
                    style={{
                      background: `color-mix(in srgb, transparent 88%, ${RATING_COLORS[s.rating]})`,
                      border: `1px solid color-mix(in srgb, transparent 80%, ${RATING_COLORS[s.rating]})`,
                      color: RATING_COLORS[s.rating],
                    }}
                  >
                    {s.name}
                    <span className="ed-skill-rl">{RATING_LABELS[s.rating]}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {utilization && (
            <div className="ed-panel">
              <div className="ed-ph">
                <span className="ed-eyebrow">Utilization · {utilYearLabel}</span>
                {utilization.target > 0 && (
                  <span className={`ed-util-target${utilization.ytdPct >= utilization.target ? ' ok' : ' under'}`}>
                    Target {utilization.target}% {utilization.ytdPct >= utilization.target ? '✓' : '✗'}
                  </span>
                )}
              </div>
              <div className="ed-ru-pct" style={{ color: utilColorFn(utilization.ytdPct) }}>{utilization.ytdPct}%</div>
              <div className="ed-ru-meta">{utilization.ytdBillable}h / {utilization.ytdAvailable}h billable</div>
              <div className="ed-ru-bar">
                {utilization.months.map(m => (
                  <div
                    key={m.key}
                    className="ed-ru-cell"
                    title={`${m.label}: ${m.utilization}% (${m.billableHours}h / ${m.availableHours}h)`}
                    style={{
                      background: m.utilization > 0
                        ? `color-mix(in srgb, transparent ${m.isFuture ? 80 : 62}%, ${utilColorFn(m.utilization)})`
                        : 'var(--bg-input)',
                    }}
                  />
                ))}
              </div>
              <div className="ed-ru-labels">
                {utilization.months.map(m => (
                  <span key={m.key} className={m.isFuture ? 'future' : undefined}>
                    {new Date(m.key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'narrow' })}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isPmoAdmin && (
            <div className="ed-panel">
              <div className="ed-ph"><span className="ed-eyebrow">Cost</span></div>
              <div className="ed-frow">
                <span className="ed-k">Current Rate</span>
                <span className={`ed-v${consultant.hourly_cost_rate ? '' : ' ed-v--muted'}`}>
                  {consultant.hourly_cost_rate ? `$${consultant.hourly_cost_rate}/hr` : 'Not set'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="ed-main">
          {utilization && (
            <>
              <div className="ed-sect">
                <h3>Monthly Breakdown</h3>
                <div className="ed-tools">
                  <SearchableSelect
                    variant="ghost"
                    value={utilYear}
                    options={yearOpts}
                    onChange={setUtilYear}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setUtilDrilldown(!utilDrilldown)}>
                    {utilDrilldown ? 'Hide breakdown' : 'Show breakdown'}
                  </Button>
                </div>
              </div>
              {utilDrilldown && (
                <div className="ed-tbl-wrap">
                  <table className="ed-util-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th className="num">Available</th>
                        <th className="num">Billable</th>
                        <th className="num">Utilization</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilization.months.map(m => {
                        const isExpanded = expandedMonth === m.key
                        const hasAssignments = m.assignments.length > 0
                        return (
                          <React.Fragment key={m.key}>
                            <tr
                              className={`ed-util-row${m.isFuture ? ' is-future' : ''}${hasAssignments ? ' is-clickable' : ''}${isExpanded ? ' is-expanded' : ''}`}
                              onClick={() => hasAssignments && setExpandedMonth(isExpanded ? null : m.key)}
                            >
                              <td>
                                {hasAssignments && <span className="ed-util-caret">{isExpanded ? '▼' : '▶'}</span>}
                                {m.label}{m.isFuture ? ' (planned)' : ''}
                              </td>
                              <td className="num">
                                {m.availableHours}h
                                <span className="ed-util-sub">({m.workingDays}d − {m.holidayDays}h)</span>
                              </td>
                              <td className="num ed-util-bill">{m.billableHours}h</td>
                              <td className="num ed-util-pct" style={{ color: utilColorFn(m.utilization) }}>{m.utilization}%</td>
                            </tr>
                            {isExpanded && m.assignments.map((a, i) => {
                              const typeColor = projectTypeColor(a.type)
                              return (
                                <tr key={i} className="ed-util-asg">
                                  <td colSpan={2}>
                                    <Link to={`/projects/${a.projectId}`} className="ed-plink">{a.project}</Link>
                                    <span className="ed-util-asg-client">{a.client}</span>
                                  </td>
                                  <td className="num" style={{ color: typeColor }}>
                                    {a.hours}h
                                    <span className="ed-util-asg-type">{projectTypeLabel(a.type)}</span>
                                  </td>
                                  <td />
                                </tr>
                              )
                            })}
                          </React.Fragment>
                        )
                      })}
                      <tr className="ed-util-total">
                        <td>YTD Total</td>
                        <td className="num">{utilization.ytdAvailable}h</td>
                        <td className="num ed-util-bill">{utilization.ytdBillable}h</td>
                        <td className="num" style={{ color: utilColorFn(utilization.ytdPct) }}>{utilization.ytdPct}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          <div className="ed-sect">
            <h3>Project History <span className="ed-cnt">({visibleHistory.length})</span></h3>
            <div className="ed-tools">
              <SearchableSelect
                variant="ghost"
                value={historyYear}
                options={historyYearOpts}
                onChange={setHistoryYear}
              />
            </div>
          </div>
          {visibleHistory.length === 0 ? (
            <p className="ed-empty">No project assignments yet.</p>
          ) : (
            <div className="ed-tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="grow">Project</th>
                    <th>Client</th>
                    <th className="ctr">Type</th>
                    <th>Dates</th>
                    <th className="num">Hours</th>
                    <th className="ctr">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((a) => {
                    const p = a.projects!
                    const pType = p.project_type || 'billable'
                    const today = new Date().toISOString().slice(0, 10)
                    const isCurrent = a.start_date <= today && a.end_date >= today
                    const isPast = a.end_date < today
                    const statusCls = isCurrent ? 'active' : isPast ? 'done' : 'up'
                    const statusLabel = isCurrent ? 'Active' : isPast ? 'Completed' : 'Upcoming'
                    return (
                      <tr key={a.id}>
                        <td className="grow"><Link to={`/projects/${p.id}`} className="ed-plink" title={p.project_name}>{p.project_name}</Link></td>
                        <td>{p.client_name}</td>
                        <td className="ctr">
                          <span className="ed-ptype" style={{ color: projectTypeColor(pType) }}>{projectTypeLabel(pType)}</span>
                        </td>
                        <td className="ed-dt">
                          {new Date(a.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' — '}
                          {new Date(a.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="num ed-hrs">{a.total_hours}h</td>
                        <td className="ctr"><span className={`ed-pill ed-pill--${statusCls}`}>{statusLabel}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isPmoAdmin && (
            <>
              <div className="ed-sect">
                <h3>Cost Rate History <span className="ed-cnt">({costRates.length})</span></h3>
                {!showAddRate && (
                  <div className="ed-tools">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewRate('')
                        setNewEffectiveDate(new Date().toISOString().slice(0, 10))
                        setShowAddRate(true)
                      }}
                    >
                      + Add Rate
                    </Button>
                  </div>
                )}
              </div>

              {showAddRate && (
                <div className="ed-rate-form">
                  <div className="ed-field">
                    <label className="ed-field-label">Hourly rate ($)</label>
                    <input
                      autoFocus
                      type="number"
                      step="0.01"
                      min="0"
                      className="ed-rate-input"
                      value={newRate}
                      onChange={e => setNewRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="ed-field">
                    <label className="ed-field-label">Effective date</label>
                    <DatePicker value={newEffectiveDate} onChange={(v) => setNewEffectiveDate(v)} ariaLabel="Effective date" />
                  </div>
                  <div className="ed-rate-form-actions">
                    <Button variant="secondary" size="sm" onClick={() => setShowAddRate(false)}>Cancel</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={savingRate}
                      disabled={savingRate || !newRate || !newEffectiveDate}
                      onClick={async () => {
                        const val = parseFloat(newRate)
                        if (isNaN(val) || val < 0) return
                        setSavingRate(true)
                        try {
                          await api.addCostRate({
                            consultant_id: consultant.id,
                            hourly_rate: val,
                            effective_date: newEffectiveDate,
                          })
                          setShowAddRate(false)
                          if (id) await loadData(id)
                        } catch (err: unknown) {
                          alert('Error adding cost rate: ' + errMessage(err))
                        }
                        setSavingRate(false)
                      }}
                    >
                      {savingRate ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              )}

              {costRates.length === 0 ? (
                <p className="ed-empty">No cost rates recorded. Click "Add Rate" to set one.</p>
              ) : (
                <div className="ed-tbl-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rate</th>
                        <th>Effective Date</th>
                        <th>Status</th>
                        <th>Added By</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {costRates.map((cr) => {
                        const today = new Date().toISOString().slice(0, 10)
                        const isActive = cr.effective_date <= today &&
                          !costRates.some(other => other.effective_date > cr.effective_date && other.effective_date <= today)
                        const isScheduled = cr.effective_date > today
                        return (
                          <tr key={cr.id}>
                            <td className="ed-hrs">${cr.hourly_rate}/hr</td>
                            <td className="ed-dt">
                              {new Date(cr.effective_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td>
                              {isActive && <span className="ed-pill ed-pill--active">Active</span>}
                              {isScheduled && <span className="ed-pill ed-pill--up">Scheduled</span>}
                            </td>
                            <td className="ed-cell-muted">{cr.created_by || '—'}</td>
                            <td className="num">
                              <span className="ed-rowact">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="ed-xdel"
                                  title="Delete this rate"
                                  onClick={async () => {
                                    if (!confirm(`Delete $${cr.hourly_rate}/hr rate effective ${cr.effective_date}?`)) return
                                    try {
                                      await api.deleteCostRate(cr.id)
                                      if (id) await loadData(id)
                                    } catch (err: unknown) {
                                      alert('Error deleting cost rate: ' + errMessage(err))
                                    }
                                  }}
                                >
                                  &times;
                                </Button>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ds-allow: semantic utilization heat ramp — no token */
function utilColorFn(pct: number): string {
  if (pct >= 85) return '#28A36A'
  if (pct >= 70) return '#7CB342'
  if (pct >= 50) return '#F0C42B'
  if (pct >= 30) return '#F0642B'
  return '#B65540'
}
