import { useState } from 'react'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { formatMonth } from '../lib/dateUtils'
import { SavedViewBar } from '../components/SavedViewBar'
import { useCapacityData } from '../hooks/useCapacityData'
import {
  DEFAULT_BILL_RATE,
  COLOR_CAPACITY,
  COLOR_ASSIGNED,
  fmtHours,
  fmtDollars,
  fmtDollarsFull,
  fmtVal,
  fmtValFull,
  fmtAssignedVal,
  fmtAssignedValFull,
  fmtPct,
} from '../lib/capacityUtils'
import { btnStyle, activeBtn } from '../lib/capacityStyles'
import type { MonthBucket } from '../types/capacity'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Capacity() {
  const {
    viewMode, setViewMode,
    valueMode, setValueMode,
    selectedYear, setSelectedYear,
    yearPickerOpen, setYearPickerOpen,
    yearPickerRef,
    selectedMonths, setSelectedMonths,
    monthPickerOpen, setMonthPickerOpen,
    monthPickerRef,
    selectedPassionAreas, setSelectedPassionAreas,
    passionAreaPickerOpen, setPassionAreaPickerOpen,
    passionAreaPickerRef,
    passionAreas,
    showInfo, setShowInfo,
    availableYears,
    filteredMonthKeys,
    displayBuckets,
    totals,
    hasActiveFilters,
    getFilters,
    applyFilters,
    loading, error, retry,
  } = useCapacityData()

  // Drilldown modal state
  const [drilldown, setDrilldown] = useState<{ bucket: MonthBucket; type: 'capacity' | 'assigned' } | null>(null)

  function exportCapacityCsv() {
    const rows = displayBuckets.map(b => {
      const util = b.capacity > 0 ? Math.round((b.assigned / b.capacity) * 100) : 0
      return {
        Period: b.label,
        'Capacity (hrs)': Math.round(b.capacity),
        'Assigned (hrs)': Math.round(b.assigned),
        'Available (hrs)': Math.max(0, Math.round(b.capacity - b.assigned)),
        'Utilization %': util,
      }
    })
    const mode = viewMode === 'quarterly' ? 'quarterly' : 'monthly'
    downloadCsv(rows, `altair-capacity-${mode}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading capacity data..." />

  // SVG dimensions — dynamic width based on number of data points
  const chartH = 300
  const padL = 70
  const padR = 70
  const padT = 40
  const padB = 50
  const nPoints = displayBuckets.length
  const minPointSpacing = 140
  const chartW = padL + padR + Math.max((nPoints - 1) * minPointSpacing, minPointSpacing)
  const plotW = chartW - padL - padR
  const plotH = chartH - padT - padB
  const xStep = nPoints > 1 ? plotW / (nPoints - 1) : plotW / 2

  // Capacity-side uses flat DEFAULT_BILL_RATE (potential at standard rate).
  // Assigned-side uses per-project implied rate (real booked revenue) so it matches the Revenue dashboard.
  const capVal = (b: typeof displayBuckets[0]) => valueMode === 'revenue' ? b.capacity * DEFAULT_BILL_RATE : b.capacity
  const assVal = (b: typeof displayBuckets[0]) => valueMode === 'revenue' ? b.assignedRevenue : b.assigned
  const chartMax = displayBuckets.reduce((m, b) => Math.max(m, capVal(b), assVal(b)), 0) || 1

  // Compute points
  const points = displayBuckets.map((b, i) => {
    const x = nPoints > 1 ? padL + i * xStep : padL + plotW / 2
    const capY = padT + plotH - (capVal(b) / chartMax) * plotH
    const assY = padT + plotH - (assVal(b) / chartMax) * plotH
    return { x, capY, assY, bucket: b }
  })

  const baseline = padT + plotH

  // Area path builders
  function areaPath(pts: typeof points, getY: (p: typeof points[0]) => number): string {
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x} ${getY(pts[0])}`
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${getY(pts[i])}`
    }
    d += ` L ${pts[pts.length - 1].x} ${baseline}`
    d += ` L ${pts[0].x} ${baseline}`
    d += ' Z'
    return d
  }

  function linePath(pts: typeof points, getY: (p: typeof points[0]) => number): string {
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x} ${getY(pts[0])}`
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${getY(pts[i])}`
    }
    return d
  }

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => chartMax * pct)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>Capacity</h2>
          <button
            onClick={() => setShowInfo(true)}
            title="How this data is calculated"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '50%',
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              fontWeight: 700,
              fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              padding: 0,
              lineHeight: 1,
            }}
          >
            i
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Value mode toggle */}
          <button onClick={() => setValueMode('hours')} style={{ ...btnStyle, ...(valueMode === 'hours' ? activeBtn : {}) }}>Hours</button>
          <button onClick={() => setValueMode('revenue')} style={{ ...btnStyle, ...(valueMode === 'revenue' ? activeBtn : {}) }}>Revenue</button>

          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 0.25rem' }} />

          {/* Year filter */}
          <div ref={yearPickerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setYearPickerOpen(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>{selectedYear === 'all' ? 'All Years' : selectedYear}</span>
              <span style={{ fontSize: '0.5rem' }}>{yearPickerOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {yearPickerOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, minWidth: '120px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
                zIndex: 100, maxHeight: '240px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
              }}>
                <div
                  onClick={() => { setSelectedYear('all'); setYearPickerOpen(false) }}
                  style={{
                    padding: '0.35rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer',
                    color: selectedYear === 'all' ? 'var(--brand-green)' : 'var(--text-primary)',
                    fontWeight: selectedYear === 'all' ? 600 : 400,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  All Years
                </div>
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

          {/* Month filter */}
          <div ref={monthPickerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMonthPickerOpen(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>{selectedMonths.length === 0 ? 'All Months' : `${selectedMonths.length} months`}</span>
              <span style={{ fontSize: '0.5rem' }}>{monthPickerOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {monthPickerOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, minWidth: '160px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
                zIndex: 100, maxHeight: '240px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
              }}>
                {selectedMonths.length > 0 && (
                  <div onClick={() => setSelectedMonths([])} style={{
                    padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>Clear all</div>
                )}
                {filteredMonthKeys.map(m => {
                  const checked = selectedMonths.includes(m)
                  return (
                    <label key={m} style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <input type="checkbox" checked={checked}
                        onChange={() => setSelectedMonths(prev => checked ? prev.filter(v => v !== m) : [...prev, m])}
                        style={{ accentColor: 'var(--brand-green)' }} />
                      {formatMonth(m)}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Passion area filter */}
          <div ref={passionAreaPickerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setPassionAreaPickerOpen(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>{selectedPassionAreas.length === 0 ? 'All Passion Areas' : `${selectedPassionAreas.length} area${selectedPassionAreas.length > 1 ? 's' : ''}`}</span>
              <span style={{ fontSize: '0.5rem' }}>{passionAreaPickerOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {passionAreaPickerOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, minWidth: '200px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
                zIndex: 100, maxHeight: '240px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
              }}>
                {selectedPassionAreas.length > 0 && (
                  <div onClick={() => setSelectedPassionAreas([])} style={{
                    padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>Clear all</div>
                )}
                {passionAreas.map(pa => {
                  const checked = selectedPassionAreas.includes(pa.name)
                  return (
                    <label key={pa.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <input type="checkbox" checked={checked}
                        onChange={() => setSelectedPassionAreas(prev => checked ? prev.filter(v => v !== pa.name) : [...prev, pa.name])}
                        style={{ accentColor: 'var(--brand-green)' }} />
                      {pa.name}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* View mode toggle */}
          <button onClick={() => setViewMode('monthly')} style={{ ...btnStyle, ...(viewMode === 'monthly' ? activeBtn : {}) }}>Monthly</button>
          <button onClick={() => setViewMode('quarterly')} style={{ ...btnStyle, ...(viewMode === 'quarterly' ? activeBtn : {}) }}>Quarterly</button>
          <button onClick={exportCapacityCsv} style={btnStyle} title="Export as CSV">Export CSV</button>
          <SavedViewBar page="capacity" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={() => applyFilters({ viewMode: 'monthly', valueMode: 'hours', selectedYear: '2026', selectedMonths: [], selectedPassionAreas: [] })} />
        </div>
      </div>

      {/* Summary cards — Available and Utilization always compute from the active mode's
          Capacity and Assigned so the numbers tie out visually. */}
      {(() => {
        const capTotal = valueMode === 'revenue' ? totals.capacity * DEFAULT_BILL_RATE : totals.capacity
        const assTotal = valueMode === 'revenue' ? totals.assignedRevenue : totals.assigned
        const availTotal = Math.max(capTotal - assTotal, 0)
        const utilPct = capTotal > 0 ? (assTotal / capTotal) * 100 : 0
        return (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <SummaryCard label={valueMode === 'revenue' ? `Total Capacity (@ $${DEFAULT_BILL_RATE}/hr)` : 'Total Capacity'} value={fmtValFull(totals.capacity, valueMode)} />
            <SummaryCard label="Total Assigned" value={fmtAssignedValFull(totals.assigned, totals.assignedRevenue, valueMode)} color={COLOR_ASSIGNED} />
            <SummaryCard label="Available" value={valueMode === 'revenue' ? fmtDollarsFull(availTotal) : Math.round(availTotal).toLocaleString() + 'h'} color="#28A36A" />
            <SummaryCard label="Utilization" value={fmtPct(utilPct)} color={utilPct >= 80 ? '#F0642B' : 'var(--text-primary)'} />
          </div>
        )
      })()}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: COLOR_CAPACITY }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Capacity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: COLOR_ASSIGNED }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Assigned</span>
        </div>
      </div>

      {/* Area Chart */}
      {displayBuckets.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '3rem',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          No capacity data to chart for the selected period.
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '1.5rem',
          border: '1px solid var(--border-subtle)', overflowX: 'auto',
          display: 'flex', justifyContent: 'center',
        }}>
          <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block', maxWidth: '100%', height: 'auto' }}>
            {/* Grid lines */}
            {yTicks.map((val, i) => {
              const y = padT + plotH - (val / chartMax) * plotH
              return (
                <g key={i}>
                  <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} opacity={i === 0 ? 1 : 0.4} />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={10}>
                    {valueMode === 'revenue' ? fmtDollars(val) : fmtHours(val)}
                  </text>
                </g>
              )
            })}

            {nPoints > 0 && (
              <>
                {/* Capacity filled area */}
                <path
                  d={areaPath(points, p => p.capY)}
                  fill={COLOR_CAPACITY}
                  opacity={0.2}
                />
                {/* Assigned filled area */}
                <path
                  d={areaPath(points, p => p.assY)}
                  fill={COLOR_ASSIGNED}
                  opacity={0.25}
                />

                {/* Capacity line */}
                <path
                  d={linePath(points, p => p.capY)}
                  fill="none"
                  stroke={COLOR_CAPACITY}
                  strokeWidth={2.5}
                />
                {/* Assigned line */}
                <path
                  d={linePath(points, p => p.assY)}
                  fill="none"
                  stroke={COLOR_ASSIGNED}
                  strokeWidth={2.5}
                />

                {/* Data points + labels (clickable for drilldown) */}
                {points.map((p, i) => (
                  <g key={i}>
                    {/* Capacity — clickable hit area */}
                    <circle cx={p.x} cy={p.capY} r={12} fill="transparent" style={{ cursor: 'pointer' }}
                      onClick={() => setDrilldown({ bucket: p.bucket, type: 'capacity' })} />
                    <circle cx={p.x} cy={p.capY} r={3.5} fill={COLOR_CAPACITY} stroke="#fff" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                    <DataLabel x={p.x} y={p.capY} value={fmtVal(p.bucket.capacity, valueMode)} color={COLOR_CAPACITY} offset={-14}
                      onClick={() => setDrilldown({ bucket: p.bucket, type: 'capacity' })} />

                    {/* Assigned — clickable hit area */}
                    <circle cx={p.x} cy={p.assY} r={12} fill="transparent" style={{ cursor: 'pointer' }}
                      onClick={() => setDrilldown({ bucket: p.bucket, type: 'assigned' })} />
                    <circle cx={p.x} cy={p.assY} r={3.5} fill={COLOR_ASSIGNED} stroke="#fff" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                    <DataLabel x={p.x} y={p.assY} value={fmtAssignedVal(p.bucket.assigned, p.bucket.assignedRevenue, valueMode)} color={COLOR_ASSIGNED} offset={14}
                      onClick={() => setDrilldown({ bucket: p.bucket, type: 'assigned' })} />

                    {/* X-axis label */}
                    <text x={p.x} y={padT + plotH + 20} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
                      {p.bucket.label}
                    </text>
                  </g>
                ))}
              </>
            )}

            {/* Baseline */}
            <line x1={padL} x2={padL + plotW} y1={baseline} y2={baseline} stroke="var(--border)" strokeWidth={1} />
          </svg>
        </div>
      )}

      {/* Data table */}
      {displayBuckets.length > 0 && (
        <table style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>{viewMode === 'monthly' ? 'Month' : 'Quarter'}</th>
              <th style={{ textAlign: 'right', color: COLOR_CAPACITY }}>Capacity</th>
              <th style={{ textAlign: 'right', color: COLOR_ASSIGNED }}>Assigned</th>
              <th style={{ textAlign: 'right' }}>Available</th>
              <th style={{ textAlign: 'right' }}>Utilization %</th>
            </tr>
          </thead>
          <tbody>
            {displayBuckets.map(b => {
              const cap = valueMode === 'revenue' ? b.capacity * DEFAULT_BILL_RATE : b.capacity
              const ass = valueMode === 'revenue' ? b.assignedRevenue : b.assigned
              const available = Math.max(cap - ass, 0)
              const util = cap > 0 ? (ass / cap) * 100 : 0
              const availStr = valueMode === 'revenue' ? fmtDollarsFull(available) : Math.round(available).toLocaleString() + 'h'
              return (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td style={{ textAlign: 'right', color: COLOR_CAPACITY, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                    onClick={() => setDrilldown({ bucket: b, type: 'capacity' })}>{fmtValFull(b.capacity, valueMode)}</td>
                  <td style={{ textAlign: 'right', color: COLOR_ASSIGNED, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                    onClick={() => setDrilldown({ bucket: b, type: 'assigned' })}>{fmtAssignedValFull(b.assigned, b.assignedRevenue, valueMode)}</td>
                  <td style={{ textAlign: 'right' }}>{availStr}</td>
                  <td style={{ textAlign: 'right' }}>{fmtPct(util)}</td>
                </tr>
              )
            })}
            {(() => {
              const capTot = valueMode === 'revenue' ? totals.capacity * DEFAULT_BILL_RATE : totals.capacity
              const assTot = valueMode === 'revenue' ? totals.assignedRevenue : totals.assigned
              const availTot = Math.max(capTot - assTot, 0)
              const utilTot = capTot > 0 ? (assTot / capTot) * 100 : 0
              const availStr = valueMode === 'revenue' ? fmtDollarsFull(availTot) : Math.round(availTot).toLocaleString() + 'h'
              return (
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: COLOR_CAPACITY }}>{fmtValFull(totals.capacity, valueMode)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: COLOR_ASSIGNED }}>{fmtAssignedValFull(totals.assigned, totals.assignedRevenue, valueMode)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{availStr}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtPct(utilTot)}</td>
                </tr>
              )
            })()}
          </tbody>
        </table>
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
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>How This Data Is Calculated</h3>
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
                  Capacity (per month)
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Working Days = Weekdays in Month - Holidays (by country)<br />
                  Raw Hours = Working Days &times; 8 hrs/day &times; Util Target %<br />
                  PTO Hours = Approved PTO days &times; 8 hrs (synced from your HR system)<br />
                  Capacity Hours = Raw Hours - PTO Hours<br />
                  Team Capacity = Sum across all active consultants<br />
                  <br />
                  Each consultant's utilization target (default 80%) scales their<br />
                  available hours to reflect billable capacity. Approved PTO<br />
                  is then subtracted to show true available capacity.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Assigned (per month)
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Overlap Days = days assignment overlaps with month<br />
                  Total Days = full duration of assignment<br />
                  Month Hours = Total Assignment Hours &times; (Overlap Days / Total Days)<br />
                  Team Assigned = Sum across all assignments
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Revenue Mode
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Capacity $ = Capacity Hours &times; $325/hr (standard rate)<br />
                  Assigned $ = &Sigma; (Hours in Month &times; Project Implied Rate)<br />
                  Project Implied Rate = sow_amount / max(planned_hours, assigned_hours)<br />
                  <br />
                  Assigned $ matches the Revenue dashboard exactly. Capacity $<br />
                  prices idle hours at the $325 standard rate — it represents<br />
                  theoretical revenue at standard pricing, not booked work.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  Utilization
                </div>
                <div style={{ background: 'var(--bg-card-alt)', padding: '0.75rem', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Utilization % = (Assigned / Capacity) &times; 100<br />
                  <br />
                  In <b>Hours</b> mode this answers "how much of the fleet's<br />
                  time is booked?" — 99% means almost no idle hours.<br />
                  <br />
                  In <b>Revenue</b> mode this answers "how much of the dollar<br />
                  capacity at standard rate are we booking?" Because Assigned $<br />
                  uses real per-project rates and Capacity $ uses the flat $325<br />
                  standard, a gap here reflects effective discount vs standard<br />
                  pricing — not idle time.
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Example: a fully-booked fleet (99% hours utilization) can show 86% revenue utilization if the blended implied rate is $283/hr — the 13-point gap is the team working ~13% below the $325 standard, not idle capacity.
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Holidays are country-specific and only counted on weekdays. Consultant cost rates are sourced from your HR system when available.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button onClick={() => setShowInfo(false)} style={{ ...btnStyle }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Drilldown modal */}
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
              borderRadius: 8, padding: '1.5rem', maxWidth: 700, width: '90%',
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                {drilldown.bucket.label} — {drilldown.type === 'capacity' ? 'Capacity' : 'Assigned'} Breakdown
              </h3>
              <button
                onClick={() => setDrilldown(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {drilldown.type === 'capacity' ? (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {drilldown.bucket.capacityDetail.length} consultants &middot; Total: {fmtValFull(drilldown.bucket.capacity, valueMode)}
                </div>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Consultant</th>
                      <th style={{ textAlign: 'right' }}>Hours</th>
                      {valueMode === 'revenue' && <th style={{ textAlign: 'right' }}>Revenue</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.bucket.capacityDetail.map((d, i) => (
                      <tr key={i}>
                        <td>{d.consultantName}</td>
                        <td style={{ textAlign: 'right' }}>{Math.round(d.hours)}h</td>
                        {valueMode === 'revenue' && <td style={{ textAlign: 'right' }}>${Math.round(d.hours * DEFAULT_BILL_RATE).toLocaleString()}</td>}
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(drilldown.bucket.capacity)}h</td>
                      {valueMode === 'revenue' && <td style={{ textAlign: 'right' }}>${Math.round(drilldown.bucket.capacity * DEFAULT_BILL_RATE).toLocaleString()}</td>}
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {drilldown.bucket.assignedDetail.length} assignments &middot; Total: {fmtValFull(drilldown.bucket.assigned, valueMode)}
                </div>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Consultant</th>
                      <th style={{ textAlign: 'left' }}>Project</th>
                      <th style={{ textAlign: 'right' }}>Hours</th>
                      {valueMode === 'revenue' && <th style={{ textAlign: 'right' }}>Revenue</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {drilldown.bucket.assignedDetail.map((d, i) => (
                      <tr key={i}>
                        <td>{d.consultantName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{d.clientName ? `${d.clientName} — ` : ''}{d.projectName}</td>
                        <td style={{ textAlign: 'right' }}>{Math.round(d.hours)}h</td>
                        {valueMode === 'revenue' && <td style={{ textAlign: 'right' }}>${Math.round(d.revenue).toLocaleString()}</td>}
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                      <td>Total</td>
                      <td></td>
                      <td style={{ textAlign: 'right' }}>{Math.round(drilldown.bucket.assigned)}h</td>
                      {valueMode === 'revenue' && <td style={{ textAlign: 'right' }}>${Math.round(drilldown.bucket.assignedRevenue).toLocaleString()}</td>}
                    </tr>
                  </tbody>
                </table>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setDrilldown(null)} style={btnStyle}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function DataLabel({ x, y, value, color, offset, onClick }: {
  x: number; y: number; value: string; color: string; offset: number; onClick?: () => void
}) {
  const w = value.length * 6.5 + 10
  const ly = y + offset
  return (
    <g style={onClick ? { cursor: 'pointer' } : undefined} onClick={onClick}>
      <rect x={x - w / 2} y={ly - 9} width={w} height={16} rx={2} fill="var(--bg-card)" stroke={color} strokeWidth={0.5} opacity={0.9} />
      <text x={x} y={ly + 3} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>{value}</text>
    </g>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 8, padding: '1rem 1.5rem', minWidth: 140, flex: '1 1 0',
    }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || 'var(--text-primary)', marginTop: '0.25rem' }}>{value}</div>
    </div>
  )
}
