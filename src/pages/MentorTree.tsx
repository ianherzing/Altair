import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useLoadData } from '../lib/useLoadData'
import { LoadingState } from '../components/LoadingState'
import { useIsReadOnly } from '../lib/permissions'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'
import { EngagementHistoryModal } from '../components/EngagementHistoryModal'
import { buildTreeIndex } from '../lib/mentorTree'
import type { Consultant } from '../types/database'

interface CardProps {
  consultant: Consultant
  canWrite: boolean
  isOwnCard: boolean
  mentorOptions: Consultant[]
  onMentorChange: (consultantId: string, newMentor: string | null) => void
  onShowHistory: (consultant: Consultant) => void
}

function ConsultantCard({
  consultant,
  canWrite,
  isOwnCard,
  mentorOptions,
  onMentorChange,
  onShowHistory,
}: CardProps) {
  const inactive = consultant.is_active === false
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const canEditThisCard = canWrite || isOwnCard

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <Link
        to={`/consultants/${consultant.id}`}
        className="mentor-tree-card"
        title={consultant.full_name}
        style={inactive ? { opacity: 0.7 } : undefined}
      >
        <div className="mentor-tree-card-name">{consultant.full_name}</div>
        <div className="mentor-tree-card-title">{consultant.title || '—'}</div>
        <div className="mentor-tree-card-divider" />
        <div className="mentor-tree-card-footer">
          <span>Passion</span>
          <span className="mentor-tree-card-team">{consultant.passion_area || '—'}</span>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onShowHistory(consultant)
        }}
        title="View 90-day history"
        style={{
          position: 'absolute',
          bottom: 4,
          right: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: '0.6rem',
          padding: '2px 4px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ⏱ History
      </button>
      {canEditThisCard && !editing && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setEditing(true)
          }}
          title="Edit mentor"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.6rem',
            padding: '2px 4px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ✎ Edit mentor
        </button>
      )}
      {canEditThisCard && editing && (
        <select
          autoFocus
          disabled={saving}
          defaultValue={consultant.mentor || ''}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onBlur={() => setEditing(false)}
          onChange={async (e) => {
            e.stopPropagation()
            const newMentor = e.target.value || null
            const prev = consultant.mentor ?? null
            if (newMentor === prev) {
              setEditing(false)
              return
            }
            setSaving(true)
            onMentorChange(consultant.id, newMentor)
            try {
              if (canWrite) {
                await api.updateConsultant(consultant.id, { mentor: newMentor })
              } else if (isOwnCard) {
                await api.updateOwnMentor(newMentor)
              } else {
                throw new Error('Not authorized to edit this mentor')
              }
              setEditing(false)
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Unknown error'
              alert('Error updating mentor: ' + message)
              onMentorChange(consultant.id, prev)
            } finally {
              setSaving(false)
            }
          }}
          style={{
            marginTop: 4,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: '0.75rem',
            padding: '0.2rem 0.3rem',
            width: '100%',
            colorScheme: 'dark',
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
      )}
    </div>
  )
}

interface SubtreeProps {
  consultant: Consultant
  childrenOf: Map<string, Consultant[]>
  cardProps: Omit<CardProps, 'consultant' | 'isOwnCard'>
  currentConsultantId: string | null
}

function Subtree({ consultant, childrenOf, cardProps, currentConsultantId }: SubtreeProps) {
  const kids = childrenOf.get(consultant.full_name) ?? []
  return (
    <div className="mentor-tree-subtree">
      <ConsultantCard
        consultant={consultant}
        isOwnCard={consultant.id === currentConsultantId}
        {...cardProps}
      />
      {kids.length > 0 && (
        <>
          <div className="mentor-tree-stem" />
          <div className={`mentor-tree-children-row ${kids.length === 1 ? 'mentor-tree-children-row-single' : ''}`}>
            {kids.map(child => (
              <div key={child.id} className="mentor-tree-child-col">
                <Subtree
                  consultant={child}
                  childrenOf={childrenOf}
                  cardProps={cardProps}
                  currentConsultantId={currentConsultantId}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function MentorTree() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [filterPassion, setFilterPassion] = useState('')
  const [historyFor, setHistoryFor] = useState<Consultant | null>(null)
  const isReadOnly = useIsReadOnly()
  const canWrite = !isReadOnly
  const { consultant: currentConsultant } = useCurrentConsultant()

  const { loading, error, retry } = useLoadData(async () => {
    const data = await api.getMentorableConsultants()
    setConsultants(data)
  }, [], 8000)

  const { childrenOf, roots, unassigned, passionAreas } = useMemo(() => {
    const idx = buildTreeIndex(consultants)
    const passions = Array.from(new Set(idx.roots.map(r => r.passion_area).filter((p): p is string => !!p))).sort()
    return { ...idx, passionAreas: passions }
  }, [consultants])

  const mentorOptions = useMemo(() =>
    consultants
      .filter(c => c.is_active)
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [consultants],
  )

  const handleMentorChange = (consultantId: string, newMentor: string | null) => {
    setConsultants(prev => prev.map(c =>
      c.id === consultantId ? { ...c, mentor: newMentor } : c,
    ))
  }

  const cardProps = {
    canWrite,
    mentorOptions,
    onMentorChange: handleMentorChange,
    onShowHistory: (c: Consultant) => setHistoryFor(c),
  }

  const visibleRoots = filterPassion
    ? roots.filter(r => r.passion_area === filterPassion)
    : roots

  const visibleUnassigned = filterPassion
    ? unassigned.filter(c => c.passion_area === filterPassion)
    : unassigned

  if (loading || error) {
    return <LoadingState loading={loading} error={error} retry={retry} message="Loading mentor tree..." />
  }

  const currentConsultantId = currentConsultant?.id ?? null
  const activeCount = consultants.filter(c => c.is_active).length

  return (
    <div>
      <style>{MENTOR_TREE_CSS}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Mentor Tree</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {visibleRoots.length} {visibleRoots.length === 1 ? 'vertical' : 'verticals'} · {activeCount} active consultants{visibleUnassigned.length > 0 ? ` · ${visibleUnassigned.length} unassigned` : ''}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={filterPassion}
            onChange={e => setFilterPassion(e.target.value)}
            style={{
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', padding: '0.4rem 0.6rem',
              borderRadius: 4, fontSize: '0.85rem', colorScheme: 'dark',
            }}
          >
            <option value="">All Passion Areas</option>
            {passionAreas.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {visibleRoots.length === 0 && visibleUnassigned.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No mentor relationships found.
        </div>
      ) : (
        <div className="mentor-tree-canvas">
          {visibleRoots.map(root => (
            <section key={root.id} className="mentor-tree-vertical">
              <div className="mentor-tree-vertical-label">
                {root.full_name.split(' ')[0]}'s Vertical
                {root.passion_area ? ` (${root.passion_area})` : ''}
              </div>
              <div className="mentor-tree-vertical-frame">
                <Subtree
                  consultant={root}
                  childrenOf={childrenOf}
                  cardProps={cardProps}
                  currentConsultantId={currentConsultantId}
                />
              </div>
            </section>
          ))}
          {visibleUnassigned.length > 0 && (
            <section className="mentor-tree-vertical">
              <div className="mentor-tree-vertical-label">
                Unassigned <span style={{ opacity: 0.6 }}>(no mentor or mentor missing)</span>
              </div>
              <div className="mentor-tree-vertical-frame">
                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem' }}>
                  {visibleUnassigned.map(consultant => (
                    <ConsultantCard
                      key={consultant.id}
                      consultant={consultant}
                      isOwnCard={consultant.id === currentConsultantId}
                      {...cardProps}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {historyFor && (
        <EngagementHistoryModal
          consultant={historyFor}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  )
}

const MENTOR_TREE_CSS = `
.mentor-tree-canvas {
  display: flex; flex-direction: column; gap: 2rem;
  overflow-x: auto; padding-bottom: 2rem;
}

.mentor-tree-vertical {
  display: flex; flex-direction: column; gap: 0.5rem;
}
.mentor-tree-vertical-label {
  font-size: 0.85rem; color: var(--text-muted); padding-left: 0.5rem;
}
.mentor-tree-vertical-frame {
  border: 1px solid var(--border-subtle); border-radius: 8px;
  padding: 1.5rem; background: rgba(255,255,255,0.015);
  width: max-content; min-width: 100%;
}

.mentor-tree-subtree {
  display: flex; flex-direction: column; align-items: center;
}

.mentor-tree-card {
  display: block; text-decoration: none; color: var(--text-primary);
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 8px; padding: 0.75rem 1rem;
  min-width: 180px; max-width: 220px;
  transition: border-color 0.15s, transform 0.1s;
}
.mentor-tree-card:hover {
  border-color: var(--brand-green, #11C3DB);
  transform: translateY(-1px);
}
.mentor-tree-card-name {
  font-size: 0.85rem; font-weight: 600; color: var(--text-primary);
}
.mentor-tree-card-title {
  font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;
}
.mentor-tree-card-divider {
  height: 1px; background: var(--border-subtle); margin: 0.5rem -1rem;
}
.mentor-tree-card-footer {
  display: flex; justify-content: space-between; font-size: 0.65rem;
  color: var(--text-muted);
}
.mentor-tree-card-team {
  color: var(--text-secondary, var(--text-primary)); font-weight: 500;
}

.mentor-tree-stem {
  width: 1px; height: 18px; background: var(--border);
}

.mentor-tree-children-row {
  display: flex; flex-direction: row; align-items: flex-start;
  position: relative;
}

.mentor-tree-child-col {
  display: flex; flex-direction: column; align-items: center;
  position: relative; padding: 18px 14px 0;
}
.mentor-tree-child-col::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0;
  height: 1px; background: var(--border);
}
.mentor-tree-child-col:first-child::after { left: 50%; }
.mentor-tree-child-col:last-child::after { right: 50%; }
.mentor-tree-children-row-single .mentor-tree-child-col::after { display: none; }
.mentor-tree-child-col::before {
  content: ''; position: absolute; top: 0; left: 50%;
  width: 1px; height: 18px; background: var(--border);
}
`