import { Link } from 'react-router-dom'
import { HOURS_PER_DAY, formatMonth, formatMonthShort } from '../lib/dateUtils'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { useUtilizationData } from '../hooks/useUtilizationData'
import {
  utilColor,
  cellBg,
  cellTextColor,
  UTIL_LEGEND_RANGES,
  assignmentTypeColor,
  assignmentTypeLabel,
} from '../lib/utilizationUtils'
import {
  btnStyle,
  dropdownStyle,
  checkboxLabelStyle,
  thStyle,
  tdStyle,
  NAME_COL_WIDTH,
  CELL_WIDTH,
  YTD_COL_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
} from '../lib/utilizationStyles'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Utilization() {
  const {
    consultants,
    loading,
    error,
    retry,
    selectedYear,
    setSelectedYear,
    filterManagers,
    setFilterManagers,
    filterConsultants: filterConsultantsState,
    setFilterConsultants,
    yearPickerOpen,
    setYearPickerOpen,
    yearPickerRef,
    managerPickerOpen,
    setManagerPickerOpen,
    managerPickerRef,
    consultantPickerOpen,
    setConsultantPickerOpen,
    consultantPickerRef,
    drilldown,
    setDrilldown,
    showInfo,
    setShowInfo,
    handleSort,
    sortCol,
    sortAsc,
    availableYears,
    monthKeys,
    managers,
    filteredConsultants,
    currentMonthKey,
    gridData,
    ytdData,
    orgAverages,
    orgYtd,
    sortedConsultants,
    hasActiveFilters,
    openDrilldown,
    exportCsv,
    getFilters,
    applyFilters,
  } = useUtilizationData()

  /* ---------- Render ---------- */

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading utilization data..." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '0 0 0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Utilization</h2>
            <button
              onClick={() => setShowInfo(true)}
              title="How utilization is calculated"
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
            {/* Year picker */}
            <div ref={yearPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setYearPickerOpen(o => !o)}
                style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>{selectedYear}</span>
                <span style={{ fontSize: '0.5rem' }}>{yearPickerOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {yearPickerOpen && (
                <div style={dropdownStyle}>
                  {availableYears.map(y => (
                    <div
                      key={y}
                      onClick={() => { setSelectedYear(y); setYearPickerOpen(false) }}
                      style={{
                        padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer',
                        color: selectedYear === y ? 'var(--brand-green)' : 'var(--text-primary)',
                        fontWeight: selectedYear === y ? 600 : 400,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {y}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manager multiselect */}
            <div ref={managerPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setManagerPickerOpen(o => !o)}
                style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>{filterManagers.length === 0 ? 'All Managers' : `${filterManagers.length} manager${filterManagers.length > 1 ? 's' : ''}`}</span>
                <span style={{ fontSize: '0.5rem' }}>{managerPickerOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {managerPickerOpen && (
                <div style={dropdownStyle}>
                  {filterManagers.length > 0 && (
                    <div onClick={() => setFilterManagers([])} style={{
                      padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    }}>Clear all</div>
                  )}
                  {managers.map(m => {
                    const checked = filterManagers.includes(m)
                    return (
                      <label key={m} style={checkboxLabelStyle}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <input type="checkbox" checked={checked}
                          onChange={() => setFilterManagers(prev => checked ? prev.filter(v => v !== m) : [...prev, m])}
                          style={{ accentColor: 'var(--brand-green)' }} />
                        {m}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Consultant multiselect */}
            <div ref={consultantPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setConsultantPickerOpen(o => !o)}
                style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>{filterConsultantsState.length === 0 ? 'All Consultants' : `${filterConsultantsState.length} consultant${filterConsultantsState.length > 1 ? 's' : ''}`}</span>
                <span style={{ fontSize: '0.5rem' }}>{consultantPickerOpen ? '\u25B2' : '\u25BC'}</span>
              </button>
              {consultantPickerOpen && (
                <div style={{ ...dropdownStyle, maxHeight: '320px' }}>
                  {filterConsultantsState.length > 0 && (
                    <div onClick={() => setFilterConsultants([])} style={{
                      padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                      cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                    }}>Clear all</div>
                  )}
                  {consultants.map(e => {
                    const checked = filterConsultantsState.includes(e.id)
                    return (
                      <label key={e.id} style={checkboxLabelStyle}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <input type="checkbox" checked={checked}
                          onChange={() => setFilterConsultants(prev => checked ? prev.filter(v => v !== e.id) : [...prev, e.id])}
                          style={{ accentColor: 'var(--brand-green)' }} />
                        {e.full_name}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <button onClick={exportCsv} style={btnStyle} title="Export as CSV">Export CSV</button>
            <SavedViewBar page="utilization" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={() => applyFilters({ selectedYear: String(new Date().getFullYear()), filterManagers: [], filterConsultants: [], sortCol: 'name', sortAsc: true })} />
          </div>
        </div>

        {/* Legend + summary */}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {UTIL_LEGEND_RANGES.map(r => (
              <span key={r.pct} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                background: cellBg(r.pct, false),
                border: `1px solid ${utilColor(r.pct)}40`,
                borderRadius: 4, padding: '0.15rem 0.4rem',
              }}>
                <strong style={{ color: utilColor(r.pct) }}>{r.label}</strong>
              </span>
            ))}
          </div>
          <span style={{ color: 'var(--border)', fontSize: '0.8rem' }}>|</span>
          <span>{filteredConsultants.length} consultants</span>
          <span style={{ color: 'var(--border)', fontSize: '0.8rem' }}>|</span>
          <span>Org YTD: <strong style={{ color: utilColor(orgYtd) }}>{orgYtd}%</strong></span>
          <span style={{ color: 'var(--border)', fontSize: '0.8rem' }}>|</span>
          <span style={{ fontStyle: 'italic' }}>Future months shown with lighter shading</span>
        </div>
      </div>

      {/* Grid */}
      <div style={{
        flex: 1, overflow: 'auto',
        border: '1px solid var(--border)', borderRadius: 6,
        background: 'var(--bg-card)', minHeight: 0,
        marginTop: '0.5rem',
      }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column' }}>
          {/* Header row */}
          <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 3 }}>
            {/* Name header */}
            <div
              onClick={() => handleSort('name')}
              style={{
                width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH, height: HEADER_HEIGHT,
                padding: '0 0.75rem',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
                borderBottom: '2px solid var(--border)',
                borderRight: '1px solid var(--border-subtle)',
                position: 'sticky', left: 0, zIndex: 4,
                background: 'var(--bg-card)',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              CONSULTANT {sortCol === 'name' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
            </div>

            {/* Month headers */}
            {monthKeys.map(mk => {
              const isFuture = mk > currentMonthKey
              return (
                <div
                  key={mk}
                  onClick={() => handleSort(mk)}
                  style={{
                    width: CELL_WIDTH, minWidth: CELL_WIDTH, height: HEADER_HEIGHT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 600,
                    color: isFuture ? 'var(--text-muted)' : 'var(--text-secondary)',
                    borderBottom: '2px solid var(--border)',
                    borderRight: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    cursor: 'pointer', userSelect: 'none',
                    fontStyle: isFuture ? 'italic' : 'normal',
                  }}
                >
                  {formatMonthShort(mk)}
                  {sortCol === mk ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}
                </div>
              )
            })}

            {/* YTD header */}
            <div
              onClick={() => handleSort('ytd')}
              style={{
                width: YTD_COL_WIDTH, minWidth: YTD_COL_WIDTH, height: HEADER_HEIGHT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-primary)',
                borderBottom: '2px solid var(--border)',
                borderRight: '1px solid var(--border-subtle)',
                background: 'color-mix(in srgb, var(--bg-card) 92%, var(--brand-green))',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              YTD {sortCol === 'ytd' ? (sortAsc ? '\u25B2' : '\u25BC') : ''}
            </div>
          </div>

          {/* Data rows */}
          {sortedConsultants.map((eng, rowIdx) => {
            const ytd = ytdData.get(eng.id)
            return (
              <div key={eng.id} style={{
                display: 'flex',
                background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
              }}>
                {/* Consultant name — sticky left */}
                <div style={{
                  width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH, height: ROW_HEIGHT,
                  padding: '0 0.75rem',
                  display: 'flex', alignItems: 'center',
                  borderRight: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  position: 'sticky', left: 0, zIndex: 1,
                  background: rowIdx % 2 === 0 ? 'var(--bg-card)' : 'color-mix(in srgb, var(--bg-card) 97%, white)',
                }}>
                  <Link
                    to={`/consultants/${eng.id}`}
                    style={{
                      fontSize: '0.8rem', fontWeight: 600, color: 'var(--brand-green)',
                      textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    title={`${eng.full_name}${eng.manager ? ` (${eng.manager})` : ''}`}
                  >
                    {eng.full_name}
                  </Link>
                </div>

                {/* Month cells */}
                {monthKeys.map(mk => {
                  const cell = gridData.get(eng.id)?.get(mk)
                  const pct = cell?.utilization ?? 0
                  const isFuture = cell?.isFuture ?? false
                  return (
                    <div
                      key={mk}
                      onClick={() => openDrilldown(eng, mk)}
                      style={{
                        width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRight: '1px solid var(--border-subtle)',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: cellBg(pct, isFuture),
                        color: cellTextColor(pct),
                        fontSize: '0.8rem', fontWeight: 600,
                        cursor: 'pointer', userSelect: 'none',
                        borderLeft: isFuture && mk === monthKeys.find(k => k > currentMonthKey)
                          ? '2px dashed var(--border)' : undefined,
                      }}
                      title={`${eng.full_name} — ${formatMonth(mk)}: ${pct}% (${cell?.billableHours ?? 0}h / ${cell?.availableHours ?? 0}h)`}
                    >
                      {pct > 0 ? `${pct}%` : '\u2014'}
                    </div>
                  )
                })}

                {/* YTD cell */}
                <div
                  title={`YTD: ${ytd?.utilization ?? 0}% — Target: ${eng.utilization_target}%`}
                  style={{
                    width: YTD_COL_WIDTH, minWidth: YTD_COL_WIDTH, height: ROW_HEIGHT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem',
                    borderRight: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: `color-mix(in srgb, ${cellBg(ytd?.utilization ?? 0, false)} 60%, color-mix(in srgb, var(--bg-card) 92%, var(--brand-green)))`,
                    color: cellTextColor(ytd?.utilization ?? 0),
                    fontSize: '0.85rem', fontWeight: 700,
                  }}
                >
                  {ytd && ytd.utilization > 0 ? `${ytd.utilization}%` : '\u2014'}
                  {ytd && ytd.utilization > 0 && (
                    <span style={{
                      fontSize: '0.6rem',
                      color: ytd.utilization >= eng.utilization_target ? '#28A36A' : '#F0642B',
                    }}>
                      {ytd.utilization >= eng.utilization_target ? '\u2713' : '\u2717'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {/* Org average row */}
          <div style={{
            display: 'flex',
            position: 'sticky', bottom: 0, zIndex: 2,
            borderTop: '2px solid var(--border)',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH, height: ROW_HEIGHT,
              padding: '0 0.75rem',
              display: 'flex', alignItems: 'center',
              borderRight: '1px solid var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              position: 'sticky', left: 0, zIndex: 3,
              background: 'var(--bg-card)',
              fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)',
            }}>
              Org Average
            </div>
            {monthKeys.map(mk => {
              const pct = orgAverages.get(mk) ?? 0
              const isFuture = mk > currentMonthKey
              return (
                <div
                  key={mk}
                  style={{
                    width: CELL_WIDTH, minWidth: CELL_WIDTH, height: ROW_HEIGHT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRight: '1px solid var(--border-subtle)',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: pct > 0
                      ? `color-mix(in srgb, var(--bg-card) ${isFuture ? '80%' : '65%'}, ${utilColor(pct)})`
                      : 'var(--bg-card)',
                    color: cellTextColor(pct),
                    fontSize: '0.8rem', fontWeight: 700,
                  }}
                >
                  {pct > 0 ? `${pct}%` : '\u2014'}
                </div>
              )
            })}
            <div style={{
              width: YTD_COL_WIDTH, minWidth: YTD_COL_WIDTH, height: ROW_HEIGHT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRight: '1px solid var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              background: orgYtd > 0
                ? `color-mix(in srgb, color-mix(in srgb, var(--bg-card) 92%, var(--brand-green)) 65%, ${utilColor(orgYtd)})`
                : 'color-mix(in srgb, var(--bg-card) 92%, var(--brand-green))',
              color: cellTextColor(orgYtd),
              fontSize: '0.85rem', fontWeight: 700,
            }}>
              {orgYtd > 0 ? `${orgYtd}%` : '\u2014'}
            </div>
          </div>

          {filteredConsultants.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No consultants found for the selected filters.
            </div>
          )}
        </div>
      </div>

      {/* Drilldown panel */}
      {drilldown && (
        <div
          onClick={() => setDrilldown(null)}
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
              borderRadius: 8, padding: '2rem', maxWidth: 650, width: '90%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                {drilldown.consultantName} — {drilldown.monthLabel}
              </h3>
              <button
                onClick={() => setDrilldown(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}
              >
                &times;
              </button>
            </div>

            {/* The math */}
            <div style={{
              background: 'var(--bg-input)', borderRadius: 6, padding: '1rem 1.25rem',
              marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: 1.8,
              fontFamily: 'monospace',
            }}>
              <div>Working Days: <strong>{drilldown.workingDays}</strong></div>
              <div>Holidays (country): <strong style={{ color: '#F0642B' }}>-{drilldown.holidayDays}</strong></div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.25rem', marginTop: '0.25rem' }}>
                Available Days: <strong>{drilldown.workingDays - drilldown.holidayDays}</strong> &times; {HOURS_PER_DAY}h = <strong>{drilldown.availableHours}h</strong>
              </div>
              <div>Billable Hours: <strong style={{ color: 'var(--brand-green)' }}>{drilldown.billableHours}h</strong></div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.25rem', marginTop: '0.25rem', fontSize: '1rem' }}>
                Utilization: <strong style={{ color: utilColor(drilldown.utilization) }}>{drilldown.utilization}%</strong>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  ({drilldown.billableHours}h / {drilldown.availableHours}h)
                </span>
              </div>
            </div>

            {/* Assignments table */}
            {drilldown.assignments.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Project</th>
                    <th style={thStyle}>Client</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Type</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.assignments.map((a, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{a.project}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{a.client}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ color: assignmentTypeColor(a.type), fontSize: '0.75rem', fontWeight: 600 }}>{assignmentTypeLabel(a.type)}</span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{a.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No assignments this month.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setDrilldown(null)} style={btnStyle}>Close</button>
            </div>
          </div>
        </div>
      )}

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
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>How Utilization Is Calculated</h3>
              <button
                onClick={() => setShowInfo(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Utilization Formula
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Utilization % = Billable Hours / Available Hours &times; 100
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Available Hours (per month)
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Working Days = Weekdays in Month - Holidays (by country)<br />
                  Available Hours = Working Days &times; 8 hrs/day
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Billable Hours (per month)
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Sum of hours from all assignments where project type = &quot;billable&quot;<br />
                  Hours are distributed proportionally across months based on overlap
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  What Counts Against Utilization
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  Non-billable and PTO assignments consume available time but do <strong style={{ color: 'var(--text-primary)' }}>not</strong> count
                  as billable hours, reducing utilization.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  YTD Column
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  Year-to-date utilization through the current month. For past years, includes all 12 months.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Future Months
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  Months after the current month show <strong style={{ color: 'var(--text-primary)' }}>planned</strong> utilization
                  based on current assignments. Displayed with lighter shading.
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Click any cell to see the detailed breakdown including all assignments and holiday deductions.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowInfo(false)} style={btnStyle}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
