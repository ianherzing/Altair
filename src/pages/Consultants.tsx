import { useState } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { SearchableSelect } from '../components/SearchableSelect'
import { PageTitle, Button, MultiSelect, Dialog, Field, Input } from '../components/ui'
import { useConsultantsData } from '../hooks/useConsultantsData'
import type { Consultant, PassionArea } from '../types/database'
import './Consultants.css'

/* ds-allow: semantic skill-rating ramp (Basic/Proficient/Expert) — no token */
const RATING_COLORS: Record<number, string> = { 1: '#2BFF00', 2: '#FFF500', 3: '#00F5FF' }

const EMPTY_FORM = {
  full_name: '',
  email: '',
  title: '',
  manager: '',
  passion_area_id: '',
}

const EMPTY_FILTERS = {
  full_name: '',
  email: '',
  title: [] as string[],
  manager: '',
  mentor: '',
  passion: '',
  skill: [] as string[],
}

function DownloadIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2v8M5 7l3 3 3-3" /><path d="M3 12.5h10" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function MentorCell({
  consultant, mentorOptions, canEditMentor, saveMentor,
}: {
  consultant: Consultant
  mentorOptions: Consultant[]
  canEditMentor: boolean
  saveMentor: (consultantId: string, newMentor: string | null) => Promise<void>
}) {
  const display = consultant.mentor || '—'
  if (!canEditMentor) {
    return <td className={consultant.mentor ? undefined : 'projects-muted'}>{display}</td>
  }
  const options = [
    { value: '', label: '— None —' },
    ...mentorOptions.filter(m => m.id !== consultant.id).map(m => ({ value: m.full_name, label: m.full_name })),
  ]
  if (consultant.mentor && !mentorOptions.some(m => m.full_name === consultant.mentor)) {
    options.push({ value: consultant.mentor, label: consultant.mentor })
  }
  return (
    <td>
      <div className="consultants-cell-select">
        <SearchableSelect
          variant="ghost"
          value={consultant.mentor || ''}
          options={options}
          placeholder="— None —"
          onChange={val => saveMentor(consultant.id, val || null)}
        />
      </div>
    </td>
  )
}

function PassionCell({
  consultant, displayName, canWrite, passionAreas, savePassion,
}: {
  consultant: Consultant
  displayName: string
  canWrite: boolean
  passionAreas: PassionArea[]
  savePassion: (consultantId: string, passionAreaId: string | null) => Promise<void>
}) {
  if (!canWrite) {
    return (
      <td>
        {consultant.passion_area_id
          ? <span className="consultants-passion-pill">{displayName}</span>
          : <span className="projects-muted">{displayName}</span>}
      </td>
    )
  }
  const options = [
    { value: '', label: '— None —' },
    ...passionAreas.map(pa => ({ value: pa.id, label: pa.name })),
  ]
  if (consultant.passion_area_id && !passionAreas.some(pa => pa.id === consultant.passion_area_id)) {
    options.push({ value: consultant.passion_area_id, label: displayName })
  }
  return (
    <td>
      <div className="consultants-cell-select consultants-passion-cell">
        <SearchableSelect
          variant="ghost"
          value={consultant.passion_area_id || ''}
          options={options}
          placeholder="+ Passion"
          onChange={val => savePassion(consultant.id, val || null)}
          renderTrigger={({ value, selectedLabel }) => (
            <span className={`consultants-passion-pill${value ? '' : ' is-empty'}`}>
              <span className="consultants-passion-txt">{value ? selectedLabel : '+ Passion'}</span>
              <span className="consultants-passion-chev" aria-hidden="true">▼</span>
            </span>
          )}
        />
      </div>
    </td>
  )
}

function SkillsCell({ skills }: { skills: { name: string; rating: number }[] }) {
  if (skills.length === 0) return <td className="projects-muted">{'—'}</td>
  return (
    <td className="consultants-skills-cell">
      <div className="consultants-skills">
        {skills.map(s => (
          <span key={s.name} className="consultants-skill" style={{
            background: `color-mix(in srgb, transparent 88%, ${RATING_COLORS[s.rating]})`,
            border: `1px solid color-mix(in srgb, transparent 80%, ${RATING_COLORS[s.rating]})`,
            color: RATING_COLORS[s.rating],
          }}>
            {s.name}
            <b>{s.rating}</b>
          </span>
        ))}
      </div>
    </td>
  )
}

export function Consultants() {
  const {
    consultants, skills, passionAreas, mentorableConsultants,
    currentConsultant, canWrite,
    showForm, setShowForm,
    form, setForm,
    saving,
    sortCol, sortDir, toggleSort,
    filters, setFilters,
    includeTerminated, setIncludeTerminated,
    managers, mentors, titles,
    sorted,
    hasFilters,
    getConsultantSkills, getPassionName,
    handleCreate, savePassion, saveMentor,
    loading, error, retry,
  } = useConsultantsData()

  // The data hook still filters name and email separately. One search box
  // matches either, applied on top of the hook's other filters.
  const [search, setSearch] = useState('')

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading consultants..." />

  const q = search.trim().toLowerCase()
  const visible = q
    ? sorted.filter(eng => eng.full_name.toLowerCase().includes(q) || (eng.email || '').toLowerCase().includes(q))
    : sorted
  const filtersActive = Boolean(hasFilters) || q.length > 0

  function clearFilters() {
    setSearch('')
    setFilters(EMPTY_FILTERS)
  }

  const sortableCols: { key: string; label: string }[] = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'title', label: 'Title' },
    { key: 'manager', label: 'Manager' },
    { key: 'mentor', label: 'Mentor' },
  ]

  return (
    <div className="projects-page">
      <div className="projects-page__head">
        <PageTitle
          title="Consultants"
          meta={`(${visible.length}${visible.length !== consultants.length ? ` of ${consultants.length}` : ''})`}
          style={{ margin: 0 }}
        />
        <div className="projects-toolbar-tabs">
          <Button
            variant="ghost"
            size="sm"
            className="view-tab"
            icon={<DownloadIcon />}
            onClick={() => {
              const rows = visible.map(eng => ({
                Name: eng.full_name,
                Email: eng.email,
                Title: eng.title || '',
                Manager: eng.manager || '',
                Mentor: eng.mentor || '',
                'Passion Area': getPassionName(eng),
                Skills: getConsultantSkills(eng.id).map(s => `${s.name} (${s.rating})`).join('; '),
                Status: eng.offboarded_at ? 'Terminated' : 'Active',
                ...(eng.offboarded_at ? { 'Terminated On': eng.offboarded_at } : {}),
              }))
              downloadCsv(rows, `altair-consultants-${new Date().toISOString().slice(0, 10)}.csv`)
            }}
          >
            Export CSV
          </Button>
          {canWrite && (
            <Button
              variant="ghost"
              size="sm"
              className="view-tab"
              icon={<PlusIcon />}
              onClick={() => { setForm(EMPTY_FORM); setShowForm(true) }}
            >
              New Consultant
            </Button>
          )}
        </div>
      </div>

      <div className="projects-filters">
        <input
          className="kanban-ghost projects-search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search consultants"
        />

        <span className="projects-toolbar-divider" aria-hidden="true" />

        <SearchableSelect
          variant="ghost"
          value={filters.manager}
          onChange={v => setFilters({ ...filters, manager: v })}
          options={[{ value: '', label: 'All Managers' }, ...managers.map(m => ({ value: m, label: m }))]}
          placeholder="All Managers"
          style={{ minWidth: 150 }}
        />
        <SearchableSelect
          variant="ghost"
          value={filters.mentor}
          onChange={v => setFilters({ ...filters, mentor: v })}
          options={[{ value: '', label: 'All Mentors' }, ...mentors.map(m => ({ value: m, label: m }))]}
          placeholder="All Mentors"
          style={{ minWidth: 150 }}
        />
        <SearchableSelect
          variant="ghost"
          value={filters.passion}
          onChange={v => setFilters({ ...filters, passion: v })}
          options={[{ value: '', label: 'All Passion Areas' }, ...passionAreas.map(pa => ({ value: pa.id, label: pa.name }))]}
          placeholder="All Passion Areas"
          style={{ minWidth: 170 }}
        />
        <MultiSelect
          label="Titles"
          options={titles.map(t => ({ value: t, label: t }))}
          value={filters.title}
          onChange={next => setFilters({ ...filters, title: next })}
        />
        <MultiSelect
          label="Skills"
          options={skills.map(s => ({ value: s.id, label: s.name }))}
          value={filters.skill}
          onChange={next => setFilters({ ...filters, skill: next })}
        />
        {filtersActive && (
          <Button variant="ghost" size="sm" className="kanban-ghost" onClick={clearFilters}>
            Clear Filters
          </Button>
        )}

        <span style={{ marginLeft: 'auto' }} aria-hidden="true" />

        {canWrite && (
          <Button
            variant="ghost"
            size="sm"
            className={`kanban-ghost consultants-include${includeTerminated ? ' consultants-include--on' : ''}`}
            aria-pressed={includeTerminated}
            onClick={() => setIncludeTerminated(!includeTerminated)}
          >
            <span className="consultants-include__box">{includeTerminated && <CheckIcon />}</span>
            Include terminated
          </Button>
        )}
      </div>

      <Dialog
        open={showForm}
        onOpenChange={setShowForm}
        title="New Consultant"
        description="Add a team member to the roster. They'll also sync from your HR system once connected."
        width={600}
        footer={
          <>
            <span className="consultants-foot-hint">Manage skills on the Skills page</span>
            <div className="consultants-foot-actions">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button variant="primary" type="submit" form="new-consultant-form" loading={saving}>
                {saving ? 'Saving…' : 'Add Consultant'}
              </Button>
            </div>
          </>
        }
      >
        <form id="new-consultant-form" onSubmit={handleCreate} className="consultants-form-grid">
          <Field label="Full name">
            <Input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Title">
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Manager">
            <Input value={form.manager} onChange={e => setForm({ ...form, manager: e.target.value })} />
          </Field>
          <div className="consultants-form-span2">
            <span className="consultants-field-label">Passion area</span>
            <SearchableSelect
              value={form.passion_area_id}
              onChange={v => setForm({ ...form, passion_area_id: v })}
              options={[{ value: '', label: '— None —' }, ...passionAreas.map(pa => ({ value: pa.id, label: pa.name }))]}
              placeholder="— None —"
            />
          </div>
        </form>
      </Dialog>

      {consultants.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No consultants yet. Click "New Consultant" to add one, or they'll sync from your HR system once connected.
        </p>
      ) : (
        <div className="projects-table-wrap">
          <table>
            <thead>
              <tr>
                {sortableCols.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}>
                    {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
                <th>Skills</th>
                <th onClick={() => toggleSort('passion')}>
                  Passion Area {sortCol === 'passion' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((eng) => {
                const isTerminated = eng.offboarded_at != null
                return (
                  <tr key={eng.id} className={isTerminated ? 'consultants-row--terminated' : undefined}>
                    <td>
                      <div className="consultants-name-cell">
                        <Link to={`/consultants/${eng.id}`} className={`consultants-name${isTerminated ? ' consultants-name--terminated' : ''}`}>
                          {eng.full_name}
                        </Link>
                        {isTerminated && <span className="consultants-tag-term">Terminated</span>}
                      </div>
                    </td>
                    <td className="consultants-email">{eng.email}</td>
                    <td className={eng.title ? undefined : 'projects-muted'}>{eng.title || '—'}</td>
                    <td className={eng.manager ? undefined : 'projects-muted'}>{eng.manager || '—'}</td>
                    <MentorCell
                      consultant={eng}
                      mentorOptions={mentorableConsultants}
                      canEditMentor={canWrite || currentConsultant?.id === eng.id}
                      saveMentor={saveMentor}
                    />
                    <SkillsCell skills={getConsultantSkills(eng.id)} />
                    <PassionCell
                      consultant={eng}
                      displayName={getPassionName(eng)}
                      canWrite={canWrite}
                      passionAreas={passionAreas}
                      savePassion={savePassion}
                    />
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="consultants-empty-row">No consultants match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
