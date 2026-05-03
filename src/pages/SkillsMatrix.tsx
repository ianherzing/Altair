import { api } from '../lib/api'
import { LoadingState } from '../components/LoadingState'
import { useSkillsMatrixData } from '../hooks/useSkillsMatrixData'
import { useCurrentConsultant } from '../lib/useCurrentConsultant'

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

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading skills matrix..." />

  const cellWidth = 80
  const nameColWidth = 200
  const passionColWidth = 130
  const headerHeight = 60

  const cellStyle: React.CSSProperties = {
    width: cellWidth,
    minWidth: cellWidth,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRight: '1px solid var(--border-subtle)',
    borderBottom: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    outline: 'none',
    transition: 'background 100ms',
    userSelect: 'none',
  }

  const filterStyle: React.CSSProperties = {
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '0.3rem 0.5rem',
    fontSize: '0.8rem',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      {/* Title + controls -- fixed */}
      <div style={{ flexShrink: 0, padding: '0 0 0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Skills &amp; Passion Areas</h2>
            <button
              onClick={() => setShowInfo(true)}
              title="About skill ratings & passion areas"
              style={{
                background: 'transparent', border: '1px solid var(--border-subtle)',
                borderRadius: '50%', width: 22, height: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
                fontSize: '0.7rem', fontWeight: 700, fontStyle: 'italic',
                fontFamily: 'Georgia, serif', padding: 0, lineHeight: 1,
              }}
            >
              i
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select value={filterManager} onChange={e => setFilterManager(e.target.value)} style={filterStyle}>
              <option value="">All Managers</option>
              {managers.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filterMentor} onChange={e => setFilterMentor(e.target.value)} style={filterStyle}>
              <option value="">All Mentors</option>
              {mentorsList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              value={newSkillName}
              onChange={e => setNewSkillName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSkill()}
              placeholder="New skill name..."
              style={{ ...filterStyle, width: 150 }}
            />
            <button
              onClick={handleAddSkill}
              disabled={addingSkill || !newSkillName.trim()}
              style={{
                background: 'var(--brand-green-dark)', color: '#fff',
                border: 'none', padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                borderRadius: 4, cursor: 'pointer', opacity: addingSkill || !newSkillName.trim() ? 0.5 : 1,
              }}
            >
              + Skill
            </button>
            <span style={{ color: 'var(--border)', margin: '0 0.15rem' }}>|</span>
            <input
              value={newPassionName}
              onChange={e => setNewPassionName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPassion()}
              placeholder="New passion..."
              style={{ ...filterStyle, width: 120 }}
            />
            <button
              onClick={handleAddPassion}
              disabled={addingPassion || !newPassionName.trim()}
              style={{
                background: '#FD7E14', color: '#fff',
                border: 'none', padding: '0.35rem 0.75rem', fontSize: '0.8rem',
                borderRadius: 4, cursor: 'pointer', opacity: addingPassion || !newPassionName.trim() ? 0.5 : 1,
              }}
            >
              + Passion
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {[
              { rating: '1', label: 'Basic', color: '#7CB342' },
              { rating: '2', label: 'Proficient', color: '#FFA726' },
              { rating: '3', label: 'Expert', color: '#11C3DB' },
            ].map(r => (
              <span key={r.rating} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                background: `color-mix(in srgb, transparent 85%, ${r.color})`,
                border: `1px solid ${r.color}40`,
                borderRadius: 4, padding: '0.15rem 0.4rem',
              }}>
                <strong style={{ color: r.color }}>{r.rating}</strong>
                <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
              </span>
            ))}
          </div>
          <span style={{ color: 'var(--border)', fontSize: '0.8rem' }}>|</span>
          <span>{filtered.length} consultants &bull; {skills.length} skills</span>
        </div>
      </div>

      {/* Grid -- scrollable, fills remaining space */}
      <div ref={gridRef} style={{
        flex: 1,
        overflow: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 6,
        background: 'var(--bg-card)',
        minHeight: 0,
      }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
          {/* Header row with angled skill names */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 3 }}>
            {/* Name header */}
            <div style={{
              width: nameColWidth, minWidth: nameColWidth,
              height: headerHeight,
              padding: '0 0.75rem',
              display: 'flex', alignItems: 'flex-end', paddingBottom: '0.4rem',
              fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
              borderBottom: '2px solid var(--border)',
              borderRight: '1px solid var(--border-subtle)',
              position: 'sticky', left: 0, zIndex: 4,
              background: 'var(--bg-card)',
            }}>
              ENGINEER
            </div>
            {/* Util Target header */}
            <div style={{
              width: 65, minWidth: 65,
              height: headerHeight,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: '0.4rem',
              fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-secondary)',
              borderBottom: '2px solid var(--border)',
              borderRight: '1px solid var(--border-subtle)',
              background: 'color-mix(in srgb, var(--bg-card) 90%, #28A36A)',
            }}>
              UTIL %
            </div>
            {/* Passion header */}
            <div style={{
              width: passionColWidth, minWidth: passionColWidth,
              height: headerHeight,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              paddingBottom: '0.4rem',
              fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
              borderBottom: '2px solid var(--border)',
              borderRight: '1px solid var(--border-subtle)',
              background: 'color-mix(in srgb, var(--bg-card) 90%, #FD7E14)',
            }}>
              PASSION
            </div>
            {/* Skill headers -- horizontal wrapped */}
            {skills.map(s => (
              <div
                key={s.id}
                title={s.name}
                style={{
                  width: cellWidth, minWidth: cellWidth,
                  height: headerHeight,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: '0.3rem',
                  borderBottom: '2px solid var(--border)',
                  borderRight: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                }}
              >
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  wordBreak: 'break-word',
                  padding: '0 2px',
                }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>

          {/* Data rows */}
          {filtered.map((eng, rowIdx) => (
            <div key={eng.id} style={{
              display: 'flex',
              alignItems: 'stretch',
              minHeight: 36,
              background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
            }}>
              {/* Consultant name -- sticky left */}
              <div style={{
                width: nameColWidth, minWidth: nameColWidth,
                padding: '0.25rem 0.75rem',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                borderRight: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                position: 'sticky', left: 0, zIndex: 1,
                background: rowIdx % 2 === 0 ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-card) 97%, white)',
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {eng.full_name}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  {eng.title || ''}
                </span>
                {(() => {
                  const isOwnRow = currentConsultant?.id === eng.id
                  const canEditMentor = canWrite || isOwnRow
                  return canEditMentor ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.55rem', color: 'var(--brand-green)', opacity: 0.85 }}>
                    <span>Mentor:</span>
                    <select
                      value={eng.mentor || ''}
                      onChange={async (e) => {
                        const newMentor = e.target.value || null
                        const prev = eng.mentor
                        setConsultants(prev2 => prev2.map(en => en.id === eng.id ? { ...en, mentor: newMentor } : en))
                        try {
                          // Self-edit uses the JWT-scoped RPC; other rows (admin/leadership only) use the general RPC.
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
                      tabIndex={-1}
                      style={{
                        background: 'transparent', color: 'var(--brand-green)',
                        border: 'none', fontSize: '0.55rem',
                        cursor: 'pointer', padding: 0, outline: 'none',
                        colorScheme: 'dark', maxWidth: '10rem',
                      }}
                    >
                      <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>— None —</option>
                      {allActiveConsultants
                        .filter(m => m.id !== eng.id)
                        .map(m => (
                          <option key={m.id} value={m.full_name} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                            {m.full_name}
                          </option>
                        ))}
                      {eng.mentor && !allActiveConsultants.some(m => m.full_name === eng.mentor) && (
                        <option value={eng.mentor} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                          {eng.mentor}
                        </option>
                      )}
                    </select>
                  </span>
                ) : eng.mentor ? (
                  <span style={{ fontSize: '0.55rem', color: 'var(--brand-green)', opacity: 0.7 }}>
                    Mentor: {eng.mentor}
                  </span>
                ) : null
                })()}
              </div>

              {/* Util target cell */}
              <div style={{
                width: 65, minWidth: 65,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                {canWrite ? (
                  <input
                    type="number"
                    min="0"
                    max="100"
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
                    style={{
                      background: 'transparent', color: '#28A36A', border: 'none',
                      fontSize: '0.75rem', fontWeight: 600, textAlign: 'center',
                      width: '100%', padding: '0.25rem', outline: 'none',
                    }}
                  />
                ) : (
                  <span style={{ color: '#28A36A', fontSize: '0.75rem', fontWeight: 600 }}>
                    {eng.utilization_target}
                  </span>
                )}
              </div>

              {/* Passion area cell */}
              <div
                id={`cell-${rowIdx}-0`}
                tabIndex={0}
                onFocus={() => setFocusedCell({ consultantId: eng.id, skillId: 'passion' })}
                onBlur={() => setFocusedCell(null)}
                onKeyDown={e => handleKeyDown(e, rowIdx, 0)}
                style={{
                  width: passionColWidth, minWidth: passionColWidth,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRight: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  outline: focusedCell?.consultantId === eng.id && focusedCell?.skillId === 'passion' ? '2px solid var(--brand-green)' : 'none',
                  outlineOffset: -2,
                }}
              >
                <select
                  value={eng.passion_area_id || ''}
                  onChange={e => setPassion(eng.id, e.target.value || null)}
                  tabIndex={-1}
                  style={{
                    background: 'var(--bg-card)', color: 'var(--text-primary)',
                    border: 'none', fontSize: '0.7rem',
                    cursor: 'pointer', textAlign: 'center',
                    width: '100%', padding: '0.25rem',
                    outline: 'none', colorScheme: 'dark',
                  }}
                >
                  <option value="" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{'\u2014'}</option>
                  {passionAreas.map(pa => <option key={pa.id} value={pa.id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>{pa.name}</option>)}
                </select>
              </div>

              {/* Skill cells */}
              {skills.map((skill, colIdx) => {
                const key = `${eng.id}-${skill.id}`
                const rating = ratingsMap.get(key)
                const isSaving = saving === key
                const isFocused = focusedCell?.consultantId === eng.id && focusedCell?.skillId === skill.id
                const colors = ['', '#7CB342', '#FFA726', '#11C3DB']
                const labels = ['', '1', '2', '3']

                return (
                  <div
                    key={key}
                    id={`cell-${rowIdx}-${colIdx + 1}`}
                    tabIndex={0}
                    onClick={() => cycleRating(eng.id, skill.id)}
                    onFocus={() => setFocusedCell({ consultantId: eng.id, skillId: skill.id })}
                    onBlur={() => setFocusedCell(null)}
                    onKeyDown={e => handleKeyDown(e, rowIdx, colIdx + 1)}
                    style={{
                      ...cellStyle,
                      color: rating ? colors[rating] : 'var(--text-muted)',
                      opacity: isSaving ? 0.4 : 1,
                      outline: isFocused ? '2px solid var(--brand-green)' : 'none',
                      outlineOffset: -2,
                      background: rating ? `color-mix(in srgb, transparent 85%, ${colors[rating]})` : 'transparent',
                    }}
                  >
                    {rating ? labels[rating] : ''}
                  </div>
                )
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No consultants found{filterManager ? ` for manager "${filterManager}"` : ''}{filterMentor ? ` for mentor "${filterMentor}"` : ''}.
            </div>
          )}
        </div>
      </div>

      {/* Info dialog */}
      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '2rem', maxWidth: 600, width: '90%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Skill Ratings &amp; Passion Areas</h3>
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Skill Ratings
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[
                    { n: '1', color: '#7CB342', label: 'Basic', desc: 'Showing interest and needs to have an expert paired with them. Still learning the fundamentals.' },
                    { n: '2', color: '#FFA726', label: 'Proficient', desc: 'Can operate solo. Capable of executing engagements independently without expert pairing.' },
                    { n: '3', color: '#11C3DB', label: 'Expert', desc: 'Can teach others. Deep expertise and able to mentor consultants rated 1 or 2.' },
                  ].map(r => (
                    <div key={r.n} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: `color-mix(in srgb, transparent 85%, ${r.color})`,
                        border: `1px solid ${r.color}40`, borderRadius: 4,
                        width: 24, height: 24, fontWeight: 700, color: r.color, fontSize: '0.85rem', flexShrink: 0,
                      }}>{r.n}</span>
                      <div>
                        <strong style={{ color: r.color }}>{r.label}</strong> {'\u2014'} {r.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Passion Areas
                </div>
                <div>
                  Each consultant can have <strong style={{ color: 'var(--text-primary)' }}>one</strong> passion area. This represents the domain or technology they are most passionate about and want to grow in.
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Click a cell to cycle through ratings (1 {'\u2192'} 2 {'\u2192'} 3 {'\u2192'} clear), or press 1/2/3 on your keyboard. Use arrow keys or Tab to navigate.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowInfo(false)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
                  fontWeight: 500, borderRadius: 4, cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
