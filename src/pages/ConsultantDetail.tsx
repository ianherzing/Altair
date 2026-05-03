import React, { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { useIsPmoAdmin, useIsReadOnly } from '../lib/permissions'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'
import { HOURS_PER_DAY, getWorkingDaysInMonth, getHolidaysInMonth, distributeHoursToMonth, formatMonth } from '../lib/dateUtils'
import type { Consultant, Skill, ConsultantSkill, PassionArea, ConsultantCostRate, ProjectType, Holiday } from '../types/database'
import { EngagementHistoryModal } from '../components/EngagementHistoryModal'

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

const RATING_COLORS: Record<number, string> = {
  1: '#7CB342',
  2: '#FFA726',
  3: '#11C3DB',
}

const RATING_LABELS: Record<number, string> = {
  1: 'Learning',
  2: 'Proficient',
  3: 'Expert',
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
    // Join assignments with projects client-side
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
  // Parse as local date to avoid UTC timezone shift (e.g. Feb 27 UTC → Feb 26 CST)
  const offboardDateStr = isTerminated ? consultant!.offboarded_at!.slice(0, 10) : null
  const offboardDate = offboardDateStr ? new Date(offboardDateStr + 'T00:00:00') : null
  const dropOffDate = offboardDate ? new Date(offboardDate.getTime() + 14 * 86400000) : null
  const isInGracePeriod = isTerminated && dropOffDate && dropOffDate > new Date()

  // YTD utilization computation
  const utilization = useMemo(() => {
    if (!consultant) return null
    const now = new Date()
    const year = parseInt(utilYear)
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-based

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

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading consultant..." />
  if (!consultant) return <p>Consultant not found.</p>

  const skillMap = new Map(skills.map(s => [s.id, s.name]))
  const passionName = consultant.passion_area_id
    ? passionAreas.find(pa => pa.id === consultant.passion_area_id)?.name || '—'
    : '—'

  const engSkills = consultantSkills
    .map(es => ({ name: skillMap.get(es.skill_id) || '', rating: es.rating, id: es.skill_id }))
    .filter(s => s.name)
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))

  return (
    <div>
      <Link to="/consultants" style={{ color: 'var(--brand-green)', textDecoration: 'none', fontSize: '0.8rem' }}>
        &larr; Back to Consultants
      </Link>

      <div style={{ marginTop: '1rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{consultant.full_name}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{consultant.title || 'No title'}</span>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          style={{
            background: 'transparent',
            border: '1px solid var(--brand-green)',
            color: 'var(--brand-green)',
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          View 90-day History
        </button>
      </div>
      {showHistory && consultant && (
        <EngagementHistoryModal consultant={consultant} onClose={() => setShowHistory(false)} />
      )}

      {/* Terminated banner */}
      {isTerminated && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid #98242d',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ff6b6b' }}>
              Terminated on {offboardDate!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {isInGracePeriod && dropOffDate && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Drops from resourcing on {dropOffDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
            {!isInGracePeriod && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                No longer visible in resourcing view
              </div>
            )}
          </div>
          <button
            onClick={handleReinstate}
            disabled={saving}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
              borderRadius: 4,
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Reinstating...' : 'Reinstate Consultant'}
          </button>
        </div>
      )}

      {/* Terminate action (for active consultants) */}
      {!isTerminated && isPmoAdmin && (
        <div style={{ marginBottom: '1.5rem' }}>
          {!showTerminate ? (
            <button
              onClick={() => setShowTerminate(true)}
              style={{
                background: 'transparent',
                border: '1px solid #98242d',
                color: '#ff6b6b',
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Terminate Consultant
            </button>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid #98242d',
              borderRadius: 8,
              padding: '1rem 1.25rem',
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Set the termination date for {consultant.full_name}. They will remain visible in the resourcing view for 2 weeks after this date.
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                    Termination Date
                  </label>
                  <input
                    type="date"
                    value={terminationDate}
                    onChange={e => setTerminationDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
                  <button
                    onClick={() => setShowTerminate(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTerminate}
                    disabled={saving || !terminationDate}
                    style={{
                      background: '#98242d',
                      border: 'none',
                      color: '#fff',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Terminating...' : 'Confirm Termination'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <InfoCard label="Email" value={consultant.email} />
        <InfoCard label="Manager" value={consultant.manager || '—'} />
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1rem 1.25rem',
        }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
          }}>Mentor</div>
          {(() => {
            const isOwnProfile = currentConsultant?.id === consultant.id
            const canEditMentor = canWrite || isOwnProfile
            return canEditMentor ? (
            <select
              value={consultant.mentor || ''}
              onChange={async (e) => {
                const newMentor = e.target.value || null
                const prev = consultant.mentor
                setConsultant({ ...consultant, mentor: newMentor })
                try {
                  if (isOwnProfile && !canWrite) {
                    await api.updateOwnMentor(newMentor)
                  } else {
                    await api.updateConsultant(consultant.id, { mentor: newMentor })
                  }
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : 'Unknown error'
                  alert('Error updating mentor: ' + message)
                  setConsultant({ ...consultant, mentor: prev })
                }
              }}
              style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.95rem',
                fontWeight: 600, padding: '0.2rem 0.4rem', width: '100%',
              }}
            >
              <option value="">— None —</option>
              {mentorOptions
                .filter(m => m.id !== consultant.id)
                .map(m => (
                  <option key={m.id} value={m.full_name}>{m.full_name}</option>
                ))}
              {consultant.mentor && !mentorOptions.some(m => m.full_name === consultant.mentor) && (
                <option value={consultant.mentor}>{consultant.mentor}</option>
              )}
            </select>
          ) : (
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {consultant.mentor || '—'}
            </div>
          )
          })()}
        </div>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1rem 1.25rem',
        }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
          }}>Country</div>
          <select
            value={consultant.country || ''}
            onChange={async (e) => {
              const newCountry = e.target.value || null
              setConsultant({ ...consultant, country: newCountry })
              try {
                await api.updateConsultantCountry(consultant.id, newCountry ?? '')
              } catch (err: any) {
                alert('Error updating country: ' + (err.message || err))
                if (id) loadData(id)
              }
            }}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.95rem',
              fontWeight: 600, padding: '0.2rem 0.4rem', width: '100%',
            }}
          >
            <option value="">— Not set —</option>
            {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
        <InfoCard label="Passion Area" value={passionName} />
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1rem 1.25rem',
        }}>
          <div style={{
            fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem',
          }}>Util Target</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {canWrite ? (
              <input
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
                  } catch (err: any) {
                    alert('Error updating target: ' + (err.message || err))
                    if (id) loadData(id)
                  }
                }}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.95rem',
                  fontWeight: 600, padding: '0.2rem 0.4rem', width: '60px', textAlign: 'right',
                }}
              />
            ) : (
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {consultant.utilization_target}
              </span>
            )}
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>%</span>
          </div>
        </div>
        {isPmoAdmin && (
          <InfoCard
            label="Current Cost Rate"
            value={consultant.hourly_cost_rate ? `$${consultant.hourly_cost_rate}/hr` : 'Not set'}
            muted={!consultant.hourly_cost_rate}
          />
        )}
      </div>

      {/* YTD Utilization */}
      {utilization && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {utilYear === String(new Date().getFullYear()) ? 'YTD' : utilYear} Utilization:{' '}
              <span style={{ color: utilColorFn(utilization.ytdPct), fontSize: '1.1rem' }}>
                {utilization.ytdPct}%
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>
                ({utilization.ytdBillable}h / {utilization.ytdAvailable}h)
              </span>
              {utilization.target > 0 && (
                <span style={{
                  fontSize: '0.75rem', fontWeight: 400, marginLeft: '0.75rem',
                  color: utilization.ytdPct >= utilization.target ? '#28A36A' : '#F0642B',
                }}>
                  Target: {utilization.target}% {utilization.ytdPct >= utilization.target ? '\u2713' : '\u2717'}
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={utilYear}
                onChange={e => setUtilYear(e.target.value)}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.8rem',
                  padding: '0.3rem 0.5rem',
                }}
              >
                {Array.from({ length: new Date().getFullYear() - 2025 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={() => setUtilDrilldown(!utilDrilldown)}
                style={{
                  background: 'transparent', border: '1px solid var(--border-subtle)',
                  color: 'var(--brand-green)', padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem', borderRadius: 4, cursor: 'pointer',
                }}
              >
                {utilDrilldown ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
          </div>

          {/* Mini heat map bar */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: utilDrilldown ? '1rem' : 0 }}>
            {utilization.months.map(m => (
              <div
                key={m.key}
                title={`${m.label}: ${m.utilization}% (${m.billableHours}h / ${m.availableHours}h)`}
                style={{
                  flex: 1, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: m.utilization > 0
                    ? `${utilColorFn(m.utilization)}${m.isFuture ? '20' : '35'}`
                    : 'var(--bg-input)',
                  borderRadius: 3,
                  fontSize: '0.65rem', fontWeight: 600,
                  color: m.utilization > 0 ? utilColorFn(m.utilization) : 'var(--text-muted)',
                  borderLeft: m.isFuture && !utilization.months[utilization.months.indexOf(m) - 1]?.isFuture
                    ? '2px dashed var(--border)' : undefined,
                }}
              >
                {m.utilization > 0 ? `${m.utilization}%` : '\u2014'}
              </div>
            ))}
          </div>

          {/* Month labels under the bar */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {utilization.months.map(m => (
              <div key={m.key} style={{
                flex: 1, textAlign: 'center',
                fontSize: '0.55rem', color: m.isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                fontStyle: m.isFuture ? 'italic' : 'normal',
                paddingTop: '0.15rem',
              }}>
                {new Date(m.key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
              </div>
            ))}
          </div>

          {/* Detailed breakdown table */}
          {utilDrilldown && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Month</th>
                  <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Available</th>
                  <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Billable</th>
                  <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Utilization</th>
                </tr>
              </thead>
              <tbody>
                {utilization.months.map(m => {
                  const isExpanded = expandedMonth === m.key
                  const hasAssignments = m.assignments.length > 0
                  return (
                    <React.Fragment key={m.key}>
                      <tr
                        onClick={() => hasAssignments && setExpandedMonth(isExpanded ? null : m.key)}
                        style={{
                          opacity: m.isFuture ? 0.6 : 1,
                          cursor: hasAssignments ? 'pointer' : 'default',
                          background: isExpanded ? 'rgba(17, 195, 219, 0.05)' : undefined,
                        }}
                        onMouseEnter={e => { if (hasAssignments) e.currentTarget.style.background = 'rgba(17, 195, 219, 0.05)' }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = '' }}
                      >
                        <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)', fontStyle: m.isFuture ? 'italic' : 'normal' }}>
                          {hasAssignments && <span style={{ fontSize: '0.6rem', marginRight: '0.35rem', color: 'var(--text-muted)' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>}
                          {m.label} {m.isFuture ? '(planned)' : ''}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}>
                          {m.availableHours}h
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                            ({m.workingDays}d - {m.holidayDays}h)
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)', color: 'var(--brand-green)' }}>
                          {m.billableHours}h
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', color: utilColorFn(m.utilization) }}>
                          {m.utilization}%
                        </td>
                      </tr>
                      {isExpanded && m.assignments.map((a, i) => {
                        const typeColor = a.type === 'billable' ? '#00A86B' : a.type === 'pto' ? '#D6B25E' : '#0F9F8A'
                        const typeLabel = a.type === 'billable' ? 'Billable' : a.type === 'pto' ? 'PTO' : 'Non-Billable'
                        return (
                          <tr key={i} style={{ background: 'rgba(17, 195, 219, 0.03)' }}>
                            <td colSpan={2} style={{ padding: '0.3rem 0.5rem 0.3rem 1.75rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)' }}>
                              <Link to={`/projects/${a.projectId}`} style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>
                                {a.project}
                              </Link>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>{a.client}</span>
                            </td>
                            <td style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}>
                              <span style={{ color: typeColor, fontWeight: 600 }}>{a.hours}h</span>
                              <span style={{ color: typeColor, fontSize: '0.65rem', marginLeft: '0.25rem', opacity: 0.8 }}>{typeLabel}</span>
                            </td>
                            <td style={{ borderBottom: '1px solid var(--border-subtle)' }}></td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })}
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>YTD Total</td>
                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: 700 }}>{utilization.ytdAvailable}h</td>
                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--brand-green)' }}>{utilization.ytdBillable}h</td>
                  <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', textAlign: 'right', fontWeight: 700, color: utilColorFn(utilization.ytdPct) }}>{utilization.ytdPct}%</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Skills section */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Skills</h3>
        {engSkills.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            No skills assigned yet. Manage skills on the <Link to="/skills" style={{ color: 'var(--brand-green)' }}>Skills Matrix</Link> page.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {engSkills.map(s => (
              <div key={s.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: `color-mix(in srgb, transparent 88%, ${RATING_COLORS[s.rating]})`,
                border: `1px solid ${RATING_COLORS[s.rating]}30`,
                borderRadius: 6,
                padding: '0.4rem 0.75rem',
              }}>
                <span style={{ color: RATING_COLORS[s.rating], fontWeight: 600, fontSize: '0.85rem' }}>
                  {s.name}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  color: RATING_COLORS[s.rating],
                  opacity: 0.8,
                  fontWeight: 500,
                }}>
                  {RATING_LABELS[s.rating]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project History */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '1.5rem',
        marginTop: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Project History</h3>
          <select
            value={historyYear}
            onChange={e => setHistoryYear(e.target.value)}
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              borderRadius: 4, color: 'var(--text-primary)', fontSize: '0.8rem',
              padding: '0.3rem 0.5rem',
            }}
          >
            <option value="all">All Years</option>
            {Array.from({ length: new Date().getFullYear() - 2025 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        {projectHistory.filter(a => a.projects && a.projects.project_type !== 'pto').filter(a => {
          if (historyYear === 'all') return true
          const y = parseInt(historyYear)
          return a.start_date.startsWith(historyYear) || a.end_date.startsWith(historyYear) ||
            (new Date(a.start_date + 'T00:00:00').getFullYear() <= y && new Date(a.end_date + 'T00:00:00').getFullYear() >= y)
        }).length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
            No project assignments yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Project</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Client</th>
                <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Dates</th>
                <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Hours</th>
                <th style={{ textAlign: 'center', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {projectHistory.filter(a => a.projects && a.projects.project_type !== 'pto').filter(a => {
                if (historyYear === 'all') return true
                const y = parseInt(historyYear)
                return a.start_date.startsWith(historyYear) || a.end_date.startsWith(historyYear) ||
                  (new Date(a.start_date + 'T00:00:00').getFullYear() <= y && new Date(a.end_date + 'T00:00:00').getFullYear() >= y)
              }).map((a) => {
                const p = a.projects
                if (!p) return null
                const pType = p.project_type || 'billable'
                const typeColor = pType === 'pto' ? '#D6B25E' : pType === 'non_billable' ? '#0F9F8A' : '#00A86B'
                const typeLabel = pType === 'pto' ? 'PTO' : pType === 'non_billable' ? 'Non-Billable' : 'Billable'
                const today = new Date().toISOString().slice(0, 10)
                const isCurrent = a.start_date <= today && a.end_date >= today
                const isPast = a.end_date < today
                return (
                  <tr key={a.id}>
                    <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.85rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>
                      <Link to={`/projects/${p.id}`} style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>
                        {p.project_name}
                      </Link>
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                      {p.client_name}
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: typeColor, fontSize: '0.75rem', fontWeight: 600 }}>{typeLabel}</span>
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' }}>
                      {new Date(a.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' — '}
                      {new Date(a.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.85rem', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}>
                      {a.total_hours}h
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                      {isCurrent && (
                        <span style={{
                          background: 'rgba(40, 163, 106, 0.15)',
                          color: '#28A36A',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 10,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}>Active</span>
                      )}
                      {isPast && (
                        <span style={{
                          background: 'rgba(138, 90, 93, 0.2)',
                          color: 'var(--text-muted)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 10,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}>Completed</span>
                      )}
                      {!isCurrent && !isPast && (
                        <span style={{
                          background: 'rgba(17, 195, 219, 0.15)',
                          color: 'var(--brand-green)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 10,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                        }}>Upcoming</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Cost Rate History — PMO Admin only */}
      {isPmoAdmin && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          padding: '1.5rem',
          marginTop: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>Cost Rate History</h3>
            {!showAddRate && (
              <button
                onClick={() => {
                  setNewRate('')
                  setNewEffectiveDate(new Date().toISOString().slice(0, 10))
                  setShowAddRate(true)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--brand-green)',
                  color: 'var(--brand-green)',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Add Rate
              </button>
            )}
          </div>

          {/* Add rate form */}
          {showAddRate && (
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '1rem',
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                    Hourly Rate ($)
                  </label>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate}
                    onChange={e => setNewRate(e.target.value)}
                    placeholder="0.00"
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      width: '100px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', display: 'block', marginBottom: '0.25rem' }}>
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={newEffectiveDate}
                    onChange={e => setNewEffectiveDate(e.target.value)}
                    style={{
                      padding: '0.4rem 0.6rem',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setShowAddRate(false)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
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
                      } catch (err: any) {
                        alert('Error adding cost rate: ' + (err.message || err))
                      }
                      setSavingRate(false)
                    }}
                    style={{
                      background: 'var(--brand-green)',
                      border: 'none',
                      color: '#fff',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      borderRadius: 4,
                      cursor: 'pointer',
                      opacity: savingRate || !newRate || !newEffectiveDate ? 0.5 : 1,
                    }}
                  >
                    {savingRate ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rate history table */}
          {costRates.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
              No cost rates recorded. Click "Add Rate" to set one.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Rate</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Effective Date</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Added By</th>
                  <th style={{ width: '1%', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)' }}></th>
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
                      <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', fontWeight: 600, borderBottom: '1px solid var(--border-subtle)' }}>
                        ${cr.hourly_rate}/hr
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        {new Date(cr.effective_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        {isActive && (
                          <span style={{
                            background: 'rgba(40, 163, 106, 0.15)',
                            color: '#28A36A',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 10,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}>Active</span>
                        )}
                        {isScheduled && (
                          <span style={{
                            background: 'rgba(17, 195, 219, 0.15)',
                            color: 'var(--brand-green)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 10,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}>Scheduled</span>
                        )}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                        {cr.created_by || '—'}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete $${cr.hourly_rate}/hr rate effective ${cr.effective_date}?`)) return
                            try {
                              await api.deleteCostRate(cr.id)
                              if (id) await loadData(id)
                            } catch (err: any) {
                              alert('Error deleting cost rate: ' + (err.message || err))
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.4rem',
                            borderRadius: 4,
                          }}
                          title="Delete this rate"
                          onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function utilColorFn(pct: number): string {
  if (pct >= 85) return '#28A36A'
  if (pct >= 70) return '#7CB342'
  if (pct >= 50) return '#F0C42B'
  if (pct >= 30) return '#F0642B'
  return '#E63948'
}

function InfoCard({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 8,
      padding: '1rem 1.25rem',
      overflow: 'hidden',
    }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.25rem',
      }}>
        {label}
      </div>
      <div title={value} style={{
        fontSize: '1rem',
        fontWeight: 600,
        color: muted ? 'var(--text-muted)' : 'var(--text-primary)',
        fontStyle: muted ? 'italic' : 'normal',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  )
}
