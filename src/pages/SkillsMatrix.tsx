import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { api } from '../lib/api'
import { LoadingState } from '../components/LoadingState'
import { PageTitle, Button, Dialog, Input } from '../components/ui'
import { SearchableSelect } from '../components/SearchableSelect'
import { EngagementHistoryModal } from '../components/EngagementHistoryModal'
import { useSkillsMatrixData } from '../hooks/useSkillsMatrixData'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'
import type { Consultant } from '../types/database'
import { SkillsMatrixSkeleton } from './SkillsMatrixSkeleton'
import './SkillsMatrix.css'

/* 3-step semantic rating ramp — green (Basic) → yellow (Proficient) → cyan
   (Expert). No design token exists for a semantic skill ramp, so the literals
   live here and are applied via inline `background` (digit color = --bg-body via
   CSS), keeping every other .tsx/.css line token-only. */
const RATING_COLORS = ['#2BFF00', '#FFF500', '#00F5FF'] /* ds-allow: semantic skill-rating ramp (Basic/Proficient/Expert) — no token */
const RATING_LABELS = ['Basic', 'Proficient', 'Expert']
const RATING_DESC = [
  'Showing interest and needs to have an expert paired with them. Still learning the fundamentals.',
  'Can operate solo. Capable of executing engagements independently without expert pairing.',
  'Can teach others. Deep expertise and able to mentor consultants rated 1 or 2.',
]

const NAME_W = 232
const UTIL_W = 66
const PASSION_W = 168
const MIN_CELL_W = 84
const HEAD_H = 104

export function SkillsMatrix() {
  const { consultant: currentConsultant } = useCurrentConsultant()
  const {
    canWrite,
    allActiveConsultants,
    setConsultants,
    skills,
    passionAreas,
    filterManager, setFilterManager,
    filterMentor, setFilterMentor,
    saving,
    focusedCell, setFocusedCell,
    newSkillName, setNewSkillName,
    addingSkill,
    newPassionName, setNewPassionName,
    addingPassion,
    gridRef,
    showInfo, setShowInfo,
    ratingsMap,
    managers, mentorsList,
    filtered,
    cycleRating,
    setPassion,
    handleAddSkill,
    handleAddPassion,
    handleKeyDown,
    loading, error, retry,
  } = useSkillsMatrixData()

  const [historyConsultant, setHistoryConsultant] = useState<Consultant | null>(null)
  const [pulseKey, setPulseKey] = useState<string | null>(null)

  const [containerW, setContainerW] = useState(0)
  const setWrapRef = useCallback((node: HTMLDivElement | null) => {
    gridRef.current = node
    if (!node) return
    setContainerW(node.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => setContainerW(entries[0].contentRect.width))
    ro.observe(node)
    return () => ro.disconnect()
  }, [gridRef])
  const skillW = useMemo(() => {
    if (!containerW || skills.length === 0) return MIN_CELL_W
    const avail = containerW - NAME_W - UTIL_W - PASSION_W
    return Math.max(MIN_CELL_W, Math.floor(avail / skills.length))
  }, [containerW, skills.length])

  if (loading) return <SkillsMatrixSkeleton />
  if (error) return <LoadingState loading={false} error={error} retry={retry} message="Loading skills matrix..." />

  const tableWidth = NAME_W + UTIL_W + PASSION_W + skills.length * skillW

  const passionOptionsFor = (eng: Consultant) => {
    const opts = [{ value: '', label: '— None —' }, ...passionAreas.map(pa => ({ value: pa.id, label: pa.name }))]
    if (eng.passion_area_id && !passionAreas.some(pa => pa.id === eng.passion_area_id)) {
      opts.push({ value: eng.passion_area_id, label: eng.passion_area || '—' })
    }
    return opts
  }
  const mentorOptions = (eng: Consultant) => {
    const opts = [
      { value: '', label: '— None —' },
      ...allActiveConsultants.filter(m => m.id !== eng.id).map(m => ({ value: m.full_name, label: m.full_name })),
    ]
    if (eng.mentor && !allActiveConsultants.some(m => m.full_name === eng.mentor)) {
      opts.push({ value: eng.mentor, label: eng.mentor })
    }
    return opts
  }

  // The data hook still treats column 0 as the old passion cell (skills are
  // 1-based) and owns 1/2/3/0/Delete/space via setRating. This grid is
  // skills-only, so rating keys are translated and arrow/Tab stay local.
  function onSkillKeyDown(e: ReactKeyboardEvent, rowIdx: number, colIdx: number) {
    const ratingKey = e.key === '1' || e.key === '2' || e.key === '3' || e.key === '0' || e.key === 'Delete' || e.key === 'Backspace' || e.key === ' '
    if (ratingKey) {
      handleKeyDown(e, rowIdx, colIdx + 1)
      return
    }
    const totalCols = skills.length
    const totalRows = filtered.length
    if (totalCols === 0 || totalRows === 0) return
    let nextRow = rowIdx
    let nextCol = colIdx
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      nextCol++
      if (nextCol >= totalCols) { nextCol = 0; nextRow++ }
      if (nextRow >= totalRows) nextRow = 0
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      nextCol--
      if (nextCol < 0) { nextCol = totalCols - 1; nextRow-- }
      if (nextRow < 0) nextRow = totalRows - 1
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      nextCol = Math.min(nextCol + 1, totalCols - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      nextCol = Math.max(nextCol - 1, 0)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      nextRow = Math.min(nextRow + 1, totalRows - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      nextRow = Math.max(nextRow - 1, 0)
    } else {
      return
    }
    document.getElementById(`cell-${nextRow}-${nextCol}`)?.focus()
  }

  return (
    <div className="skm">
      <div className="skm-head">
        <div className="skm-titlewrap">
          <PageTitle title="Skills & Passion Areas" style={{ margin: 0 }} />
          <Button
            variant="ghost"
            size="sm"
            className="skm-info"
            aria-label="About skill ratings & passion areas"
            title="About skill ratings & passion areas"
            onClick={() => setShowInfo(true)}
          >
            i
          </Button>
        </div>
      </div>

      <div className="skm-filters">
        <SearchableSelect
          variant="ghost"
          value={filterManager}
          onChange={setFilterManager}
          options={[{ value: '', label: 'All Managers' }, ...managers.map(m => ({ value: m, label: m }))]}
          placeholder="Manager"
        />
        <SearchableSelect
          variant="ghost"
          value={filterMentor}
          onChange={setFilterMentor}
          options={[{ value: '', label: 'All Mentors' }, ...mentorsList.map(m => ({ value: m, label: m }))]}
          placeholder="Mentor"
        />
        <span className="skm-tdiv" aria-hidden="true" />
        <AddPopover
          title="Add a new skill column"
          placeholder="e.g. Threat Hunting"
          buttonLabel="Skill"
          value={newSkillName}
          onChange={setNewSkillName}
          onAdd={handleAddSkill}
          adding={addingSkill}
        />
        <AddPopover
          title="Add a new passion area"
          placeholder="e.g. AI/ML Security"
          buttonLabel="Passion"
          value={newPassionName}
          onChange={setNewPassionName}
          onAdd={handleAddPassion}
          adding={addingPassion}
        />

        <div className="skm-legend">
          {RATING_LABELS.map((label, i) => (
            <span className="skm-legend-i" key={label}>
              <span className="skm-legend-sw" style={{ background: RATING_COLORS[i] }}>{i + 1}</span>
              {label}
            </span>
          ))}
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>{filtered.length} consultants · {skills.length} skills</span>
        </div>
      </div>

      <div ref={setWrapRef} className="skm-wrap">
        {filtered.length === 0 ? (
          <div className="skm-empty-state">
            No consultants found
            {filterManager ? ` for manager "${filterManager}"` : ''}
            {filterMentor ? ` for mentor "${filterMentor}"` : ''}.
          </div>
        ) : (
          <table className="skm-table" style={{ width: tableWidth }}>
            <thead>
              <tr>
                <th className="skm-th-name" style={{ width: NAME_W, height: HEAD_H }}>
                  <div className="skm-corner">Consultant</div>
                </th>
                <th className="skm-th-util" style={{ width: UTIL_W }}>
                  <div className="skm-util-h">Util %</div>
                </th>
                <th className="skm-th-passion" style={{ width: PASSION_W }}>
                  <div className="skm-passion-h">Passion Area</div>
                </th>
                {skills.map(s => (
                  <th key={s.id} className="skm-th-skill" style={{ width: skillW }} title={s.name}>
                    <div className="skm-skill-h"><span>{s.name}</span></div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((eng, rowIdx) => {
                const isOwnRow = currentConsultant?.id === eng.id
                const canEditMentor = canWrite || isOwnRow
                return (
                  <tr key={eng.id} className={rowIdx % 2 ? 'skm-zebra' : undefined}>
                    <td className="skm-td-name">
                      <div className="skm-nm">
                        <div className="skm-nm-top">
                          <span className="skm-nm-name" title={eng.full_name}>{eng.full_name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="skm-hist"
                            title="Show last 90 days of engagements"
                            onClick={() => setHistoryConsultant(eng)}
                          >
                            HISTORY
                          </Button>
                        </div>
                        <span className="skm-nm-title">{eng.title || ''}</span>
                        {canEditMentor ? (
                          <span className={`skm-mentor${eng.mentor ? '' : ' skm-empty'}`}>
                            <span className="skm-mentor-l">Mentor:</span>
                            <SearchableSelect
                              variant="ghost"
                              value={eng.mentor || ''}
                              placeholder="add…"
                              options={mentorOptions(eng)}
                              onChange={async (val) => {
                                const newMentor = val || null
                                const prev = eng.mentor
                                setConsultants(prev2 => prev2.map(en => en.id === eng.id ? { ...en, mentor: newMentor } : en))
                                try {
                                  if (isOwnRow && !canWrite) {
                                    await api.updateOwnMentor(newMentor)
                                  } else {
                                    await api.updateConsultant(eng.id, { mentor: newMentor })
                                  }
                                } catch (err: unknown) {
                                  const message = err instanceof Error ? err.message : 'Unknown error'
                                  alert('Error updating mentor: ' + message)
                                  setConsultants(prev2 => prev2.map(en => en.id === eng.id ? { ...en, mentor: prev } : en))
                                }
                              }}
                              renderTrigger={({ value, selectedLabel }) => (
                                <span className="skm-mentor-trigger">
                                  <span className="skm-mentor-v">{value ? selectedLabel : 'add…'}</span>
                                  <span className="skm-mentor-chev" aria-hidden="true">▾</span>
                                </span>
                              )}
                            />
                          </span>
                        ) : eng.mentor ? (
                          <span className="skm-mentor">
                            <span className="skm-mentor-l">Mentor:</span>
                            <span className="skm-mentor-v" style={{ color: 'var(--text-secondary)' }}>{eng.mentor}</span>
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="skm-td-util">
                      {canWrite ? (
                        <input
                          className="skm-util-input"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={eng.utilization_target}
                          onChange={async (e) => {
                            const val = parseInt(e.target.value)
                            if (isNaN(val) || val < 0 || val > 100) return
                            setConsultants(prev => prev.map(en => en.id === eng.id ? { ...en, utilization_target: val } : en))
                            try {
                              await api.updateConsultantUtilizationTarget(eng.id, val)
                            } catch (err: unknown) {
                              const message = err instanceof Error ? err.message : 'Unknown error'
                              console.error(err)
                              alert('Error saving target: ' + message)
                            }
                          }}
                        />
                      ) : (
                        <span className="skm-util-plain">{eng.utilization_target}</span>
                      )}
                    </td>

                    <td className="skm-td-passion">
                      <SearchableSelect
                        variant="ghost"
                        value={eng.passion_area_id || ''}
                        placeholder="+ Passion"
                        options={passionOptionsFor(eng)}
                        onChange={val => setPassion(eng.id, val || null)}
                        renderTrigger={({ value, selectedLabel }) => (
                          <span className={`skm-pa${value ? '' : ' skm-empty'}`}>
                            <span className="skm-pa-txt">{value ? selectedLabel : '+ Passion'}</span>
                            <span className="skm-pa-chev" aria-hidden="true">▼</span>
                          </span>
                        )}
                      />
                    </td>

                    {skills.map((skill, colIdx) => {
                      const key = `${eng.id}-${skill.id}`
                      const rating = ratingsMap.get(key)
                      const isSaving = saving === key
                      const isFocused = focusedCell?.consultantId === eng.id && focusedCell?.skillId === skill.id
                      return (
                        <td
                          key={key}
                          id={`cell-${rowIdx}-${colIdx}`}
                          tabIndex={0}
                          className={`skm-cell${isFocused ? ' skm-focus' : ''}${isSaving ? ' skm-saving' : ''}`}
                          onClick={() => { setPulseKey(key); cycleRating(eng.id, skill.id) }}
                          onFocus={() => setFocusedCell({ consultantId: eng.id, skillId: skill.id })}
                          onBlur={() => setFocusedCell(null)}
                          onKeyDown={e => onSkillKeyDown(e, rowIdx, colIdx)}
                        >
                          {rating ? (
                            <span
                              className={`skm-swatch${pulseKey === key ? ' skm-swatch--pop' : ''}`}
                              style={{ background: RATING_COLORS[rating - 1] }}
                              onAnimationEnd={() => setPulseKey(k => (k === key ? null : k))}
                            >
                              {rating}
                            </span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog
        open={showInfo}
        onOpenChange={setShowInfo}
        title="Skill Ratings & Passion Areas"
        ariaLabel="About skill ratings and passion areas"
        width={560}
        footer={<><span /><Button variant="secondary" size="sm" onClick={() => setShowInfo(false)}>Close</Button></>}
      >
        <div className="skm-info-dialog">
          <div className="skm-info-grp">
            <h4>Skill Ratings</h4>
            {RATING_LABELS.map((label, i) => (
              <div className="skm-rlevel" key={label}>
                <span className="skm-rbadge" style={{ background: RATING_COLORS[i] }}>{i + 1}</span>
                <div className="skm-rlevel-t"><strong>{label}</strong> — {RATING_DESC[i]}</div>
              </div>
            ))}
          </div>
          <div className="skm-info-grp">
            <h4>Passion Areas</h4>
            <div>
              Each consultant can have <strong style={{ color: 'var(--text-primary)' }}>one</strong> passion area. This
              represents the domain or technology they are most passionate about and want to grow in.
            </div>
          </div>
          <div className="skm-info-hint">
            Click a cell to cycle through ratings (1 → 2 → 3 → clear), or press 1/2/3 on your keyboard. Use arrow keys or Tab to navigate.
          </div>
        </div>
      </Dialog>

      {historyConsultant && (
        <EngagementHistoryModal
          consultant={historyConsultant}
          onClose={() => setHistoryConsultant(null)}
        />
      )}
    </div>
  )
}

interface AddPopoverProps {
  title: string
  placeholder: string
  buttonLabel: string
  value: string
  onChange: (next: string) => void
  onAdd: () => void
  adding: boolean
}

function AddPopover({ title, placeholder, buttonLabel, value, onChange, onAdd, adding }: AddPopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function submit() {
    if (!value.trim() || adding) return
    onAdd()
  }

  return (
    <div className="skm-addwrap" ref={rootRef}>
      <Button
        variant="ghost"
        size="sm"
        className="kanban-ghost"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="skm-add-plus" aria-hidden="true">+</span>{buttonLabel}
      </Button>
      {open && (
        <div className="skm-addpop" role="dialog" aria-label={title}>
          <div className="skm-addpop-t">{title}</div>
          <div className="skm-addpop-row">
            <Input
              autoFocus
              value={value}
              placeholder={placeholder}
              autoComplete="off"
              onChange={e => onChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
            />
            <Button variant="primary" size="sm" onClick={submit} loading={adding} disabled={!value.trim()}>Add</Button>
          </div>
          <div className="skm-addpop-hint">↵ to add · esc to cancel</div>
        </div>
      )}
    </div>
  )
}
