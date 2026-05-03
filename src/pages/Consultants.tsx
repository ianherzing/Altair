import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { useConsultantsData } from '../hooks/useConsultantsData'
import {
  RATING_COLORS,
  labelStyle,
  inputStyle,
  cellInputStyle,
  navBtnStyle,
  filterCellStyle,
  filterInputStyle,
} from '../lib/consultantsStyles'
import type { Consultant, PassionArea } from '../types/database'

// These components live at module scope (not inside Consultants()) so that
// React keeps the same component identity across parent re-renders. If they
// were declared inside Consultants(), every setEditValue keystroke would
// remount the <input>, stealing focus after each character.

type EditingCell = { id: string; field: string } | null

function SortHeader({
  col, label, sortCol, sortDir, toggleSort,
}: {
  col: string; label: string
  sortCol: string; sortDir: 'asc' | 'desc'
  toggleSort: (col: string) => void
}) {
  const isActive = sortCol === col
  return (
    <th
      onClick={() => toggleSort(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {label} {isActive ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
    </th>
  )
}

function EditableCell({
  consultant, field, display, canEdit,
  editingCell, editValue, setEditValue, saveEdit, handleKeyDown, startEdit, inputRef,
}: {
  consultant: Consultant; field: string; display: string; canEdit: boolean
  editingCell: EditingCell
  editValue: string
  setEditValue: (v: string) => void
  saveEdit: () => void
  handleKeyDown: (e: React.KeyboardEvent) => void
  startEdit: (id: string, field: string, currentValue: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const isEditing = editingCell?.id === consultant.id && editingCell?.field === field
  if (isEditing) {
    return (
      <td>
        <input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          style={cellInputStyle}
        />
      </td>
    )
  }
  if (!canEdit) {
    return <td>{display}</td>
  }
  return (
    <td
      onDoubleClick={() => startEdit(consultant.id, field, display === '\u2014' ? '' : display)}
      style={{ cursor: 'pointer' }}
      title="Double-click to edit"
    >
      {display}
    </td>
  )
}

function PassionCell({
  consultant, displayName, editingCell, setEditingCell, savePassion, passionAreas,
}: {
  consultant: Consultant; displayName: string
  editingCell: EditingCell
  setEditingCell: (c: EditingCell) => void
  savePassion: (consultantId: string, passionAreaId: string | null) => Promise<void>
  passionAreas: PassionArea[]
}) {
  const isEditing = editingCell?.id === consultant.id && editingCell?.field === 'passion_area_id'
  if (isEditing) {
    return (
      <td>
        <select
          autoFocus
          value={consultant.passion_area_id || ''}
          onChange={e => savePassion(consultant.id, e.target.value || null)}
          onBlur={() => setEditingCell(null)}
          style={{ ...cellInputStyle, colorScheme: 'dark' }}
        >
          <option value="">{'\u2014'} None {'\u2014'}</option>
          {passionAreas.map(pa => <option key={pa.id} value={pa.id}>{pa.name}</option>)}
        </select>
      </td>
    )
  }
  return (
    <td
      onDoubleClick={() => setEditingCell({ id: consultant.id, field: 'passion_area_id' })}
      style={{ cursor: 'pointer' }}
      title="Double-click to edit"
    >
      {displayName}
    </td>
  )
}

function MentorCell({
  consultant, mentorOptions, canEditMentor, editingCell, setEditingCell, saveMentor,
}: {
  consultant: Consultant
  mentorOptions: Consultant[]
  canEditMentor: boolean
  editingCell: EditingCell
  setEditingCell: (c: EditingCell) => void
  saveMentor: (consultantId: string, newMentor: string | null) => Promise<void>
}) {
  const isEditing = editingCell?.id === consultant.id && editingCell?.field === 'mentor'
  const display = consultant.mentor || '\u2014'

  if (isEditing) {
    const hasStaleName = consultant.mentor && !mentorOptions.some(m => m.full_name === consultant.mentor)
    return (
      <td>
        <select
          autoFocus
          value={consultant.mentor || ''}
          onChange={e => saveMentor(consultant.id, e.target.value || null)}
          onBlur={() => setEditingCell(null)}
          style={{ ...cellInputStyle, colorScheme: 'dark' }}
        >
          <option value="">{'\u2014'} None {'\u2014'}</option>
          {mentorOptions
            .filter(m => m.id !== consultant.id)
            .map(m => (
              <option key={m.id} value={m.full_name}>{m.full_name}</option>
            ))}
          {hasStaleName && (
            <option value={consultant.mentor as string}>{consultant.mentor}</option>
          )}
        </select>
      </td>
    )
  }

  if (!canEditMentor) {
    return <td>{display}</td>
  }

  return (
    <td
      onClick={() => setEditingCell({ id: consultant.id, field: 'mentor' })}
      style={{ cursor: 'pointer' }}
      title="Click to change mentor"
    >
      {display}
      <span style={{ marginLeft: '0.35rem', color: 'var(--text-muted)', fontSize: '0.65rem' }}>{'\u25BE'}</span>
    </td>
  )
}

function SkillsCell({ skills }: { skills: { name: string; rating: number }[] }) {
  if (skills.length === 0) return <td style={{ color: 'var(--text-muted)' }}>{'\u2014'}</td>
  return (
    <td>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {skills.map(s => (
          <span key={s.name} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            background: `color-mix(in srgb, transparent 88%, ${RATING_COLORS[s.rating]})`,
            border: `1px solid ${RATING_COLORS[s.rating]}30`,
            borderRadius: 4, padding: '0.1rem 0.35rem',
            fontSize: '0.65rem', fontWeight: 500,
            color: RATING_COLORS[s.rating],
            whiteSpace: 'nowrap',
          }}>
            {s.name}
            <span style={{ opacity: 0.7, fontSize: '0.6rem' }}>{s.rating}</span>
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
    editingCell, setEditingCell,
    editValue, setEditValue,
    inputRef,
    sortCol, sortDir, toggleSort,
    filters, setFilters,
    includeTerminated, setIncludeTerminated,
    titleDropdownOpen, setTitleDropdownOpen,
    titleDropdownRef,
    skillDropdownOpen, setSkillDropdownOpen,
    skillDropdownRef,
    managers, mentors, titles,
    filtered, sorted,
    hasFilters,
    getConsultantSkills, getPassionName,
    handleCreate, startEdit, saveEdit, savePassion, saveMentor, handleKeyDown,
    loading, error, retry,
  } = useConsultantsData()

  const EMPTY_FORM = {
    full_name: '',
    email: '',
    title: '',
    manager: '',
    passion_area_id: '',
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading consultants..." />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Consultants ({filtered.length}{filtered.length !== consultants.length ? ` of ${consultants.length}` : ''})</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeTerminated}
              onChange={e => setIncludeTerminated(e.target.checked)}
              style={{ accentColor: '#98242d' }}
            />
            Include terminated
          </label>
          {hasFilters && (
            <button
              onClick={() => setFilters({ full_name: '', email: '', title: [], manager: '', mentor: '', passion: '', skill: [] })}
              style={{ ...navBtnStyle, fontSize: '0.7rem' }}
            >
              Clear Filters
            </button>
          )}
          <button
            onClick={() => {
              const rows = sorted.map(eng => ({
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
            style={{ ...navBtnStyle, fontSize: '0.7rem' }}
          >
            Export CSV
          </button>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Double-click cell to edit</span>
          <button onClick={() => { setForm(EMPTY_FORM); setShowForm(!showForm) }}>
            {showForm ? 'Cancel' : '+ New Consultant'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{
          background: 'var(--bg-card)',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '1rem',
        }}>
          <div>
            <label style={labelStyle}>Full Name *</label>
            <input style={inputStyle} required value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} required type="email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Title</label>
            <input style={inputStyle} value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Manager</label>
            <input style={inputStyle} value={form.manager}
              onChange={e => setForm({ ...form, manager: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Passion Area</label>
            <select style={{ ...inputStyle, colorScheme: 'dark' }} value={form.passion_area_id}
              onChange={e => setForm({ ...form, passion_area_id: e.target.value })}>
              <option value="">{'\u2014'} None {'\u2014'}</option>
              {passionAreas.map(pa => <option key={pa.id} value={pa.id}>{pa.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Manage skills on the Skills page
            </span>
            <button type="submit" disabled={saving} style={{ width: '100%' }}>
              {saving ? 'Saving...' : 'Add Consultant'}
            </button>
          </div>
        </form>
      )}

      {consultants.length === 0 && !showForm ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No consultants yet. Click "+ New Consultant" to add one, or they'll sync from your HR system once connected.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <SortHeader col="full_name" label="Name" sortCol={sortCol} sortDir={sortDir} toggleSort={toggleSort} />
              <SortHeader col="email" label="Email" sortCol={sortCol} sortDir={sortDir} toggleSort={toggleSort} />
              <SortHeader col="title" label="Title" sortCol={sortCol} sortDir={sortDir} toggleSort={toggleSort} />
              <SortHeader col="manager" label="Manager" sortCol={sortCol} sortDir={sortDir} toggleSort={toggleSort} />
              <SortHeader col="mentor" label="Mentor" sortCol={sortCol} sortDir={sortDir} toggleSort={toggleSort} />
              <th>Skills</th>
              <SortHeader col="passion" label="Passion Area" sortCol={sortCol} sortDir={sortDir} toggleSort={toggleSort} />
            </tr>
            <tr>
              <th style={filterCellStyle}>
                <input
                  placeholder="Filter..."
                  value={filters.full_name}
                  onChange={e => setFilters({ ...filters, full_name: e.target.value })}
                  style={filterInputStyle}
                />
              </th>
              <th style={filterCellStyle}>
                <input
                  placeholder="Filter..."
                  value={filters.email}
                  onChange={e => setFilters({ ...filters, email: e.target.value })}
                  style={filterInputStyle}
                />
              </th>
              <th style={filterCellStyle}>
                <div ref={titleDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setTitleDropdownOpen(o => !o)}
                    style={{
                      ...filterInputStyle,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      colorScheme: 'dark',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filters.title.length === 0 ? 'All' : `${filters.title.length} selected`}
                    </span>
                    <span style={{ fontSize: '0.5rem', marginLeft: '0.25rem' }}>{titleDropdownOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {titleDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      minWidth: '180px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      zIndex: 100,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      padding: '0.25rem 0',
                    }}>
                      {filters.title.length > 0 && (
                        <div
                          onClick={() => setFilters({ ...filters, title: [] })}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.65rem',
                            color: 'var(--brand-green)',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          Clear all
                        </div>
                      )}
                      {titles.map(t => {
                        const checked = filters.title.includes(t)
                        return (
                          <label
                            key={t}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.7rem',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? filters.title.filter(v => v !== t)
                                  : [...filters.title, t]
                                setFilters({ ...filters, title: next })
                              }}
                              style={{ accentColor: 'var(--brand-green)' }}
                            />
                            {t}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </th>
              <th style={filterCellStyle}>
                <select
                  value={filters.manager}
                  onChange={e => setFilters({ ...filters, manager: e.target.value })}
                  style={{ ...filterInputStyle, colorScheme: 'dark' }}
                >
                  <option value="">All</option>
                  {managers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </th>
              <th style={filterCellStyle}>
                <select
                  value={filters.mentor}
                  onChange={e => setFilters({ ...filters, mentor: e.target.value })}
                  style={{ ...filterInputStyle, colorScheme: 'dark' }}
                >
                  <option value="">All</option>
                  {mentors.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </th>
              <th style={filterCellStyle}>
                <div ref={skillDropdownRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setSkillDropdownOpen(o => !o)}
                    style={{
                      ...filterInputStyle,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      colorScheme: 'dark',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filters.skill.length === 0 ? 'All' : `${filters.skill.length} selected`}
                    </span>
                    <span style={{ fontSize: '0.5rem', marginLeft: '0.25rem' }}>{skillDropdownOpen ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {skillDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      minWidth: '160px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      zIndex: 100,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      padding: '0.25rem 0',
                    }}>
                      {filters.skill.length > 0 && (
                        <div
                          onClick={() => setFilters({ ...filters, skill: [] })}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.65rem',
                            color: 'var(--brand-green)',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-subtle)',
                          }}
                        >
                          Clear all
                        </div>
                      )}
                      {skills.map(s => {
                        const checked = filters.skill.includes(s.id)
                        return (
                          <label
                            key={s.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.7rem',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? filters.skill.filter(id => id !== s.id)
                                  : [...filters.skill, s.id]
                                setFilters({ ...filters, skill: next })
                              }}
                              style={{ accentColor: 'var(--brand-green)' }}
                            />
                            {s.name}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </th>
              <th style={filterCellStyle}>
                <select
                  value={filters.passion}
                  onChange={e => setFilters({ ...filters, passion: e.target.value })}
                  style={{ ...filterInputStyle, colorScheme: 'dark' }}
                >
                  <option value="">All</option>
                  {passionAreas.map(pa => <option key={pa.id} value={pa.id}>{pa.name}</option>)}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((eng) => {
              const isTerminated = eng.offboarded_at != null
              return (
              <tr key={eng.id} style={{ opacity: isTerminated ? 0.55 : 1 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Link to={`/consultants/${eng.id}`} style={{ color: isTerminated ? 'var(--text-muted)' : 'var(--brand-green)', textDecoration: 'none', fontWeight: 500 }}>
                      {eng.full_name}
                    </Link>
                    {isTerminated && (
                      <span style={{
                        fontSize: '0.55rem',
                        fontWeight: 600,
                        color: '#ff6b6b',
                        background: '#98242d30',
                        border: '1px solid #98242d50',
                        borderRadius: 3,
                        padding: '0.05rem 0.3rem',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                      }}>
                        Terminated
                      </span>
                    )}
                  </div>
                </td>
                <EditableCell
                  consultant={eng} field="email" display={eng.email} canEdit={canWrite}
                  editingCell={editingCell} editValue={editValue} setEditValue={setEditValue}
                  saveEdit={saveEdit} handleKeyDown={handleKeyDown} startEdit={startEdit} inputRef={inputRef}
                />
                <EditableCell
                  consultant={eng} field="title" display={eng.title || '\u2014'} canEdit={canWrite}
                  editingCell={editingCell} editValue={editValue} setEditValue={setEditValue}
                  saveEdit={saveEdit} handleKeyDown={handleKeyDown} startEdit={startEdit} inputRef={inputRef}
                />
                <EditableCell
                  consultant={eng} field="manager" display={eng.manager || '\u2014'} canEdit={canWrite}
                  editingCell={editingCell} editValue={editValue} setEditValue={setEditValue}
                  saveEdit={saveEdit} handleKeyDown={handleKeyDown} startEdit={startEdit} inputRef={inputRef}
                />
                <MentorCell
                  consultant={eng}
                  mentorOptions={mentorableConsultants}
                  canEditMentor={canWrite || currentConsultant?.id === eng.id}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  saveMentor={saveMentor}
                />
                <SkillsCell skills={getConsultantSkills(eng.id)} />
                <PassionCell
                  consultant={eng}
                  displayName={getPassionName(eng)}
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  savePassion={savePassion}
                  passionAreas={passionAreas}
                />
              </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
