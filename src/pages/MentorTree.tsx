import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { PageTitle, Button, MultiSelect, Badge, Dialog } from '../components/ui'
import { Users } from '../components/icons/geist'
import { MentorTreeSkeleton } from './MentorTreeSkeleton'
import { useIsReadOnly } from '../lib/permissions'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'
import { EngagementHistoryModal } from '../components/EngagementHistoryModal'
import { RATING_COLORS } from '../lib/consultantsStyles'
import { downloadCsv } from '../lib/csv'
import { buildTreeIndex } from '../lib/mentorTree'
import { joinConsultantSkills, buildCsvRows, flattenSubtreeWithGuides, type RatedSkill } from './mentorTreeLogic'
import type { Consultant } from '../types/database'
import './MentorTree.css'

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('')
}

function MentorCheckIcon() {
  return (
    <svg
      className="mt-mentor-check"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

interface RowProps {
  consultant: Consultant
  depth: number
  ancestors?: boolean[]
  isLastChild?: boolean
  isRoot: boolean
  skills: RatedSkill[]
  menteeCount: number
  isCurrent: boolean
  canEditMentor: boolean
  onEditMentor: (consultant: Consultant) => void
  onShowHistory: (consultant: Consultant) => void
}

function Row({
  consultant, depth, ancestors = [], isLastChild = true, isRoot, skills, menteeCount, isCurrent,
  canEditMentor, onEditMentor, onShowHistory,
}: RowProps) {
  const inactive = consultant.is_active === false
  return (
    <div className={`mt-row${isRoot ? ' mt-root' : ''}${isCurrent ? ' mt-me' : ''}${inactive ? ' mt-inactive' : ''}`}>
      <span className="mt-cn">
        {depth > 0 && (
          <span className="mt-guides" aria-hidden="true">
            {ancestors.map((hasNext, i) => (
              <span key={i} className={`mt-guide${hasNext ? ' mt-guide--rail' : ''}`} />
            ))}
            <span className={`mt-guide mt-guide--elbow${isLastChild ? ' mt-guide--last' : ''}`} />
          </span>
        )}
        <Link to={`/consultants/${consultant.id}`} className="mt-namelink" title={consultant.full_name}>
          <span className="mt-av">{initials(consultant.full_name)}</span>
          <span className="mt-nm">{consultant.full_name}</span>
        </Link>
        {isCurrent && <span className="mt-youchip">You</span>}
        <Button
          variant="ghost"
          size="sm"
          className="mt-editbtn"
          title="View 90-day history"
          aria-label={`View 90-day history for ${consultant.full_name}`}
          onClick={() => onShowHistory(consultant)}
        >
          History
        </Button>
        {canEditMentor && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-editbtn"
            title="Edit mentor"
            aria-label={`Edit mentor for ${consultant.full_name}`}
            onClick={() => onEditMentor(consultant)}
          >
            Edit mentor
          </Button>
        )}
      </span>

      <span className="mt-c2">
        {consultant.title
          ? <Badge variant="soft" tone="neutral">{consultant.title}</Badge>
          : <span className="mt-none">—</span>}
      </span>

      <span className="mt-c3">
        {consultant.passion_area
          ? <Badge variant="soft" tone="neutral">{consultant.passion_area}</Badge>
          : <span className="mt-none">No passion area</span>}
      </span>

      <span className="mt-c4">
        {skills.slice(0, 3).map(s => (
          <span
            key={s.name}
            className="mt-skill"
            style={{
              background: `color-mix(in srgb, transparent 88%, ${RATING_COLORS[s.rating]})`,
              border: `1px solid color-mix(in srgb, transparent 80%, ${RATING_COLORS[s.rating]})`,
              color: RATING_COLORS[s.rating],
            }}
          >
            {s.name}<b>{s.rating}</b>
          </span>
        ))}
      </span>

      <span className="mt-c5">
        {menteeCount > 0 && (
          <span className="mt-count" title={`${menteeCount} ${menteeCount === 1 ? 'mentee' : 'mentees'}`}>
            <Users size={11} />{menteeCount}
          </span>
        )}
      </span>
    </div>
  )
}

export function MentorTree() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [consultantSkills, setConsultantSkills] = useState<Awaited<ReturnType<typeof api.getConsultantSkills>>>([])
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof api.getSkills>>>([])
  const [selectedPassions, setSelectedPassions] = useState<string[]>([])
  const [editTarget, setEditTarget] = useState<Consultant | null>(null)
  const [draftMentor, setDraftMentor] = useState('')
  const [mentorSearch, setMentorSearch] = useState('')
  const [historyFor, setHistoryFor] = useState<Consultant | null>(null)
  const canWrite = !useIsReadOnly()
  const { consultant: currentConsultant } = useCurrentConsultant()

  const { loading, error, retry } = useLoadData(async () => {
    const roster = await api.getMentorableConsultants()
    setConsultants(roster)
    // finance_viewer can open this page but cannot read skills. Don't fail the tree.
    try {
      const [skillRows, skillCatalog] = await Promise.all([
        api.getConsultantSkills(),
        api.getSkills(),
      ])
      setConsultantSkills(skillRows)
      setSkills(skillCatalog)
    } catch (err) {
      console.error('Mentor tree skills unavailable:', err)
      setConsultantSkills([])
      setSkills([])
    }
  }, [], 8000)

  const { childrenOf, roots, unassigned, passionAreas } = useMemo(() => {
    const idx = buildTreeIndex(consultants)
    const passions = Array.from(
      new Set(idx.roots.map(r => r.passion_area).filter((p): p is string => !!p)),
    ).sort()
    return { ...idx, passionAreas: passions }
  }, [consultants])

  const skillsByConsultant = useMemo(
    () => joinConsultantSkills(consultantSkills, skills),
    [consultantSkills, skills],
  )

  const menteeCountByName = useMemo(() => {
    const m = new Map<string, number>()
    for (const [name, kids] of childrenOf) m.set(name, kids.length)
    return m
  }, [childrenOf])

  const mentorOptions = useMemo(() =>
    consultants
      .filter(c => c.is_active)
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [consultants],
  )

  const currentId = currentConsultant?.id ?? null

  const handleMentorChange = async (consultantId: string, newMentor: string | null) => {
    const target = consultants.find(c => c.id === consultantId)
    const prev = target?.mentor ?? null
    if (newMentor === prev) return
    setConsultants(list => list.map(c => (c.id === consultantId ? { ...c, mentor: newMentor } : c)))
    try {
      if (canWrite) {
        await api.updateConsultant(consultantId, { mentor: newMentor })
      } else if (consultantId === currentId) {
        await api.updateOwnMentor(newMentor)
      } else {
        throw new Error('Not authorized to edit this mentor')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert('Error updating mentor: ' + message)
      setConsultants(list => list.map(c => (c.id === consultantId ? { ...c, mentor: prev } : c)))
    }
  }

  function openMentorEdit(consultant: Consultant) {
    setEditTarget(consultant)
    setDraftMentor(consultant.mentor ?? '')
    setMentorSearch('')
  }

  const dialogMentorOptions = useMemo(() => {
    if (!editTarget) return [{ value: '', label: '— None —' }]
    const opts = [
      { value: '', label: '— None —' },
      ...mentorOptions
        .filter(m => m.id !== editTarget.id)
        .map(m => ({ value: m.full_name, label: m.full_name })),
    ]
    if (editTarget.mentor && !mentorOptions.some(m => m.full_name === editTarget.mentor)) {
      opts.push({ value: editTarget.mentor, label: editTarget.mentor })
    }
    return opts
  }, [editTarget, mentorOptions])

  const filteredMentorOptions = useMemo(() => {
    const q = mentorSearch.trim().toLowerCase()
    if (!q) return dialogMentorOptions
    return dialogMentorOptions.filter(o => o.value === '' || o.label.toLowerCase().includes(q))
  }, [dialogMentorOptions, mentorSearch])

  const matchesPassion = (c: Consultant) =>
    selectedPassions.length === 0 || (c.passion_area != null && selectedPassions.includes(c.passion_area))

  const visibleRoots = roots.filter(matchesPassion)
  const visibleUnassigned = unassigned.filter(matchesPassion)

  function exportCsv() {
    const seen = new Set<string>()
    const ordered: Consultant[] = []
    const push = (c: Consultant) => { if (!seen.has(c.id)) { seen.add(c.id); ordered.push(c) } }
    for (const root of visibleRoots) {
      push(root)
      for (const { consultant } of flattenSubtreeWithGuides(root.full_name, childrenOf)) push(consultant)
    }
    for (const c of visibleUnassigned) push(c)
    downloadCsv(buildCsvRows(ordered, skillsByConsultant, menteeCountByName), `altair-mentor-tree-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (error) {
    return <LoadingState loading={false} error={error} retry={retry} message="Loading mentor tree..." />
  }

  const activeCount = consultants.filter(c => c.is_active).length

  return (
    <div className="mt">
      <div className="mt-head">
        <PageTitle title="Mentor Tree" style={{ margin: 0 }} />
        {!loading && (
          <div className="mt-sub">
            <b>{visibleRoots.length}</b> {visibleRoots.length === 1 ? 'vertical' : 'verticals'}
            {' · '}<b>{activeCount}</b> active consultants
            {visibleUnassigned.length > 0 ? <>{' · '}<b>{visibleUnassigned.length}</b> unassigned</> : null}
          </div>
        )}
      </div>

      {loading ? (
        <MentorTreeSkeleton />
      ) : (
        <>
          <div className="mt-filters">
            <MultiSelect
              label="Passion Areas"
              options={passionAreas.map(p => ({ value: p, label: p }))}
              value={selectedPassions}
              onChange={setSelectedPassions}
            />
            <span className="mt-filters-spacer" aria-hidden="true" />
            <Button variant="ghost" size="sm" onClick={exportCsv} title="Export as CSV">Export CSV</Button>
            <SavedViewBar
              page="mentor-tree"
              getFilters={() => ({ passions: selectedPassions })}
              applyFilters={(f) => setSelectedPassions(Array.isArray(f.passions) ? (f.passions as string[]) : [])}
              hasActiveFilters={selectedPassions.length > 0}
              onClear={() => setSelectedPassions([])}
            />
          </div>

          <div className="mt-colhead">
            <span className="mt-c1">Consultant</span>
            <span className="mt-c2">Title</span>
            <span className="mt-c3">Passion area</span>
            <span className="mt-c4">Skills</span>
            <span className="mt-c5">Mentees</span>
          </div>

          {visibleRoots.length === 0 && visibleUnassigned.length === 0 ? (
            <div className="mt-empty">No mentor relationships found.</div>
          ) : (
            <>
              {visibleRoots.map(root => {
                const subtree = flattenSubtreeWithGuides(root.full_name, childrenOf)
                return (
                  <section key={root.id} className="mt-sect">
                    <div className="mt-stitle">
                      {root.full_name.split(' ')[0]}&apos;s Vertical
                      {root.passion_area ? ` (${root.passion_area})` : ''}
                    </div>
                    <div className="mt-box">
                      <Row
                        consultant={root}
                        depth={0}
                        isRoot
                        skills={skillsByConsultant.get(root.id) ?? []}
                        menteeCount={menteeCountByName.get(root.full_name) ?? 0}
                        isCurrent={currentId === root.id}
                        canEditMentor={canWrite || currentId === root.id}
                        onEditMentor={openMentorEdit}
                        onShowHistory={setHistoryFor}
                      />
                      {subtree.map(({ consultant, depth, ancestors, isLastChild }) => (
                        <Row
                          key={consultant.id}
                          consultant={consultant}
                          depth={depth}
                          ancestors={ancestors}
                          isLastChild={isLastChild}
                          isRoot={false}
                          skills={skillsByConsultant.get(consultant.id) ?? []}
                          menteeCount={menteeCountByName.get(consultant.full_name) ?? 0}
                          isCurrent={currentId === consultant.id}
                          canEditMentor={canWrite || currentId === consultant.id}
                          onEditMentor={openMentorEdit}
                          onShowHistory={setHistoryFor}
                        />
                      ))}
                      {subtree.length === 0 && (
                        <div className="mt-row">
                          <span className="mt-cn" style={{ color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: 'var(--space-5)' }}>
                            No current mentees.
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}

              {visibleUnassigned.length > 0 && (
                <section className="mt-sect">
                  <div className="mt-stitle">
                    Unassigned <span className="mt-stitle-note">· no mentor or mentor missing</span>
                  </div>
                  <div className="mt-box">
                    {visibleUnassigned.map(consultant => (
                      <Row
                        key={consultant.id}
                        consultant={consultant}
                        depth={0}
                        isRoot={false}
                        skills={skillsByConsultant.get(consultant.id) ?? []}
                        menteeCount={menteeCountByName.get(consultant.full_name) ?? 0}
                        isCurrent={currentId === consultant.id}
                        canEditMentor={canWrite || currentId === consultant.id}
                        onEditMentor={openMentorEdit}
                        onShowHistory={setHistoryFor}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <Dialog
        open={!!editTarget}
        onOpenChange={(next) => { if (!next) setEditTarget(null) }}
        title={`Change mentor — ${editTarget?.full_name ?? ''}`}
        width={420}
        footer={
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'auto' }}>
            <Button variant="secondary" size="sm" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                if (editTarget) await handleMentorChange(editTarget.id, draftMentor || null)
                setEditTarget(null)
              }}
            >
              Save
            </Button>
          </div>
        }
      >
        {editTarget && (
          <div className="mt-mentor-picker">
            <input
              type="text"
              className="mt-mentor-search"
              placeholder="Search consultants…"
              value={mentorSearch}
              onChange={e => setMentorSearch(e.target.value)}
              aria-label="Search consultants"
            />
            <div className="mt-mentor-list" role="listbox" aria-label="Mentor">
              {filteredMentorOptions.length === 0 ? (
                <div className="mt-mentor-empty">No matches</div>
              ) : (
                filteredMentorOptions.map(o => {
                  const selected = o.value === draftMentor
                  return (
                    <div
                      key={o.value || '__none__'}
                      role="option"
                      aria-selected={selected}
                      className={`mt-mentor-opt${selected ? ' mt-mentor-opt--sel' : ''}`}
                      onClick={() => setDraftMentor(o.value)}
                    >
                      <span className="mt-mentor-opt-label">{o.label}</span>
                      {selected && <MentorCheckIcon />}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </Dialog>

      {historyFor && (
        <EngagementHistoryModal
          consultant={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}
