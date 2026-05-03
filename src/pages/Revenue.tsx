import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import { fmtCurrency, fmtShort, formatMonth, btnStyle, activeBtn } from '../lib/financeUtils'
import { statusCategory } from '../lib/revenueUtils'
import { useRevenueData } from '../hooks/useRevenueData'
import { CAT_COLORS, CAT_LABELS } from '../types/revenue'
import type { CatKey, RevenueProjectContribution } from '../types/revenue'

const fmt = fmtCurrency

export function Revenue() {
  const {
    loading, error, retry,
    viewMode, setViewMode,
    selectedMonths, setSelectedMonths,
    monthPickerOpen, setMonthPickerOpen, monthPickerRef,
    selectedYear, setSelectedYear,
    yearPickerOpen, setYearPickerOpen, yearPickerRef,
    filterPracticeManagers, setFilterPracticeManagers,
    showPMFilter, setShowPMFilter, pmFilterRef,
    drilldown, setDrilldown,
    availablePMs, filteredMonthKeys, availableYears,
    displayBuckets, openDrilldown, maxVal, totals,
    hasActiveFilters, getFilters, applyFilters,
  } = useRevenueData()

  // Build SVG area chart — dynamic width based on number of data points
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

  // Build stacked values: hard is bottom, soft_at_risk middle, soft_unconfirmed top
  const stackedPoints = displayBuckets.map((b, i) => {
    const x = nPoints > 1 ? padL + i * xStep : padL + plotW / 2
    const y0 = padT + plotH // baseline
    const hardH = (b.hard / maxVal) * plotH
    const arH = (b.soft_at_risk / maxVal) * plotH
    const ucH = (b.soft_unconfirmed / maxVal) * plotH
    return {
      x,
      yHard: y0 - hardH,
      yAtRisk: y0 - hardH - arH,
      yUnconfirmed: y0 - hardH - arH - ucH,
      baseline: y0,
      bucket: b,
    }
  })

  function areaPath(points: { x: number }[], getY: (p: typeof stackedPoints[0]) => number, getYBase: (p: typeof stackedPoints[0]) => number): string {
    if (points.length === 0) return ''
    const pts = stackedPoints
    // Forward path (top edge)
    let d = `M ${pts[0].x} ${getY(pts[0])}`
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x} ${getY(pts[i])}`
    }
    // Reverse path (bottom edge)
    for (let i = pts.length - 1; i >= 0; i--) {
      d += ` L ${pts[i].x} ${getYBase(pts[i])}`
    }
    d += ' Z'
    return d
  }

  // Y-axis tick values
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => maxVal * pct)

  function exportRevenueCsv() {
    const rows = displayBuckets.map(b => ({
      Period: b.label,
      'Soft (Unconfirmed)': Math.round(b.soft_unconfirmed * 100) / 100,
      'Soft (At Risk)': Math.round(b.soft_at_risk * 100) / 100,
      'Hard Scheduled': Math.round(b.hard * 100) / 100,
      Total: Math.round(b.total * 100) / 100,
    }))
    const mode = viewMode === 'quarterly' ? 'quarterly' : 'monthly'
    downloadCsv(rows, `altair-revenue-${mode}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading revenue..." />

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2>Revenue</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Practice Manager filter */}
          <div ref={pmFilterRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowPMFilter(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem', ...(filterPracticeManagers.size > 0 ? activeBtn : {}) }}>
              <span>{filterPracticeManagers.size > 0 ? `PMs (${filterPracticeManagers.size})` : 'All PMs'}</span>
              <span style={{ fontSize: '0.5rem' }}>{showPMFilter ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showPMFilter && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, minWidth: '200px',
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4,
                zIndex: 100, maxHeight: '280px', overflowY: 'auto', padding: '0.25rem 0', marginTop: 2,
              }}>
                {filterPracticeManagers.size > 0 && (
                  <div onClick={() => setFilterPracticeManagers(new Set())} style={{
                    padding: '0.3rem 0.5rem', fontSize: '0.7rem', color: 'var(--brand-green)',
                    cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  }}>Clear all</div>
                )}
                {availablePMs.map(pm => {
                  const checked = filterPracticeManagers.has(pm)
                  return (
                    <label key={pm} style={{
                      display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem', color: 'var(--text-primary)', cursor: 'pointer',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setFilterPracticeManagers(prev => {
                          const n = new Set(prev); if (checked) n.delete(pm); else n.add(pm); return n
                        })}
                        style={{ accentColor: 'var(--brand-green)' }} />
                      {pm}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
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
          <button onClick={() => setViewMode('monthly')} style={{ ...btnStyle, ...(viewMode === 'monthly' ? activeBtn : {}) }}>Monthly</button>
          <button onClick={() => setViewMode('quarterly')} style={{ ...btnStyle, ...(viewMode === 'quarterly' ? activeBtn : {}) }}>Quarterly</button>
          <button onClick={exportRevenueCsv} style={btnStyle} title="Export as CSV">Export CSV</button>
          <SavedViewBar page="revenue" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} />
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <SummaryCard label="Total Revenue" value={fmt(totals.total)} />
        <SummaryCard label={CAT_LABELS.soft_unconfirmed} value={fmt(totals.soft_unconfirmed)} color={CAT_COLORS.soft_unconfirmed} />
        <SummaryCard label={CAT_LABELS.soft_at_risk} value={fmt(totals.soft_at_risk)} color={CAT_COLORS.soft_at_risk} />
        <SummaryCard label={CAT_LABELS.hard} value={fmt(totals.hard)} color={CAT_COLORS.hard} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem' }}>
        {(['hard', 'soft_at_risk', 'soft_unconfirmed'] as CatKey[]).map(cat => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: CAT_COLORS[cat] }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{CAT_LABELS[cat]}</span>
          </div>
        ))}
      </div>

      {/* Stacked Area Chart */}
      {displayBuckets.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '3rem',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          No billable projects with SOW amounts and engagement dates to chart.
          <br />
          <span style={{ fontSize: '0.8rem' }}>Add SOW amounts and engagement start/end dates on the Projects page.</span>
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
              const y = padT + plotH - (val / maxVal) * plotH
              return (
                <g key={i}>
                  <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth={1} opacity={i === 0 ? 1 : 0.4} />
                  <text x={padL - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={10}>{fmtShort(val)}</text>
                </g>
              )
            })}

            {/* Stacked areas — bottom to top: hard (red), soft_at_risk (orange), soft_unconfirmed (green) */}
            {nPoints > 0 && (
              <>
                {/* Hard area (bottom) */}
                <path
                  d={areaPath(stackedPoints, p => p.yHard, p => p.baseline)}
                  fill={CAT_COLORS.hard} opacity={0.6}
                />
                {/* Soft At Risk area (middle) */}
                <path
                  d={areaPath(stackedPoints, p => p.yAtRisk, p => p.yHard)}
                  fill={CAT_COLORS.soft_at_risk} opacity={0.6}
                />
                {/* Soft Unconfirmed area (top) */}
                <path
                  d={areaPath(stackedPoints, p => p.yUnconfirmed, p => p.yAtRisk)}
                  fill={CAT_COLORS.soft_unconfirmed} opacity={0.6}
                />

                {/* Lines on top edges */}
                <polyline
                  points={stackedPoints.map(p => `${p.x},${p.yHard}`).join(' ')}
                  fill="none" stroke={CAT_COLORS.hard} strokeWidth={2}
                />
                <polyline
                  points={stackedPoints.map(p => `${p.x},${p.yAtRisk}`).join(' ')}
                  fill="none" stroke={CAT_COLORS.soft_at_risk} strokeWidth={2}
                />
                <polyline
                  points={stackedPoints.map(p => `${p.x},${p.yUnconfirmed}`).join(' ')}
                  fill="none" stroke={CAT_COLORS.soft_unconfirmed} strokeWidth={2}
                />

                {/* Data points + labels */}
                {stackedPoints.map((p, i) => (
                  <g key={i}>
                    {/* Total label at top — clickable to show all projects */}
                    <g
                      style={{ cursor: 'pointer' }}
                      onClick={() => openDrilldown(p.bucket.key, p.bucket.label, 'total')}
                    >
                      <text x={p.x} y={p.yUnconfirmed - 18} textAnchor="middle" fill="var(--text-primary)" fontSize={11} fontWeight={700}>
                        {fmt(p.bucket.total)}
                      </text>
                    </g>

                    {/* Individual value labels */}
                    {p.bucket.soft_unconfirmed > 0 && (
                      <>
                        <circle cx={p.x} cy={p.yUnconfirmed} r={3.5} fill={CAT_COLORS.soft_unconfirmed} stroke="#fff" strokeWidth={1} />
                        <DataLabel
                          x={p.x} y={p.yUnconfirmed} value={p.bucket.soft_unconfirmed}
                          color={CAT_COLORS.soft_unconfirmed} offset={-1}
                          onClick={() => openDrilldown(p.bucket.key, p.bucket.label, 'soft_unconfirmed')}
                        />
                      </>
                    )}
                    {p.bucket.soft_at_risk > 0 && (
                      <>
                        <circle cx={p.x} cy={p.yAtRisk} r={3.5} fill={CAT_COLORS.soft_at_risk} stroke="#fff" strokeWidth={1} />
                        <DataLabel
                          x={p.x} y={p.yAtRisk} value={p.bucket.soft_at_risk}
                          color={CAT_COLORS.soft_at_risk} offset={-1}
                          onClick={() => openDrilldown(p.bucket.key, p.bucket.label, 'soft_at_risk')}
                        />
                      </>
                    )}
                    {p.bucket.hard > 0 && (
                      <circle cx={p.x} cy={p.yHard} r={3.5} fill={CAT_COLORS.hard} stroke="#fff" strokeWidth={1} />
                    )}
                    {p.bucket.hard > 0 && (
                      <DataLabel
                        x={p.x} y={p.yHard} value={p.bucket.hard}
                        color={CAT_COLORS.hard} offset={12}
                        onClick={() => openDrilldown(p.bucket.key, p.bucket.label, 'hard')}
                      />
                    )}

                    {/* X-axis label */}
                    <text x={p.x} y={padT + plotH + 20} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
                      {p.bucket.label}
                    </text>
                  </g>
                ))}
              </>
            )}

            {/* Baseline */}
            <line x1={padL} x2={padL + plotW} y1={padT + plotH} y2={padT + plotH} stroke="var(--border)" strokeWidth={1} />
          </svg>
        </div>
      )}

      {/* Data table */}
      {displayBuckets.length > 0 && (
        <table style={{ marginTop: '1.5rem' }}>
          <thead>
            <tr>
              <th>{viewMode === 'monthly' ? 'Month' : 'Quarter'}</th>
              <th style={{ textAlign: 'right', color: CAT_COLORS.soft_unconfirmed }}>Soft (Unconfirmed)</th>
              <th style={{ textAlign: 'right', color: CAT_COLORS.soft_at_risk }}>Soft (At Risk)</th>
              <th style={{ textAlign: 'right', color: CAT_COLORS.hard }}>Hard Scheduled</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {displayBuckets.map(b => (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td style={{ textAlign: 'right', color: CAT_COLORS.soft_unconfirmed }}>
                  <span
                    className="drilldown-cell"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openDrilldown(b.key, b.label, 'soft_unconfirmed')}
                  >
                    {fmt(b.soft_unconfirmed)}
                  </span>
                </td>
                <td style={{ textAlign: 'right', color: CAT_COLORS.soft_at_risk }}>
                  <span
                    className="drilldown-cell"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openDrilldown(b.key, b.label, 'soft_at_risk')}
                  >
                    {fmt(b.soft_at_risk)}
                  </span>
                </td>
                <td style={{ textAlign: 'right', color: CAT_COLORS.hard }}>
                  <span
                    className="drilldown-cell"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openDrilldown(b.key, b.label, 'hard')}
                  >
                    {fmt(b.hard)}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  <span
                    className="drilldown-cell"
                    style={{ cursor: 'pointer' }}
                    onClick={() => openDrilldown(b.key, b.label, 'total')}
                  >
                    {fmt(b.total)}
                  </span>
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: CAT_COLORS.soft_unconfirmed }}>{fmt(totals.soft_unconfirmed)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: CAT_COLORS.soft_at_risk }}>{fmt(totals.soft_at_risk)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: CAT_COLORS.hard }}>{fmt(totals.hard)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(totals.total)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Hover underline style for drilldown cells */}
      <style>{`
        .drilldown-cell:hover {
          text-decoration: underline;
        }
      `}</style>

      {/* Drill-down Dialog */}
      {drilldown && (
        <DrilldownDialog
          label={drilldown.label}
          category={drilldown.category}
          contributions={drilldown.contributions}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  )
}

// Clickable data label with background box (like the reference image)
function DataLabel({ x, y, value, color, offset, onClick }: {
  x: number; y: number; value: number; color: string; offset: number; onClick?: () => void
}) {
  const text = fmt(value)
  const w = text.length * 6.5 + 10
  const ly = y + offset
  return (
    <g style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <rect x={x - w / 2} y={ly - 9} width={w} height={16} rx={2} fill="var(--bg-card)" stroke={color} strokeWidth={0.5} opacity={0.9} />
      <text x={x} y={ly + 3} textAnchor="middle" fill={color} fontSize={9} fontWeight={600}>{text}</text>
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

// Drill-down dialog component
function DrilldownDialog({ label, category, contributions, onClose }: {
  label: string
  category: CatKey | 'total'
  contributions: RevenueProjectContribution[]
  onClose: () => void
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, RevenueProjectContribution>()
    for (const c of contributions) {
      const existing = map.get(c.project_id)
      if (existing) {
        existing.amount += c.amount
      } else {
        map.set(c.project_id, { ...c })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.client_name.localeCompare(b.client_name) || b.amount - a.amount)
  }, [contributions])

  const total = grouped.reduce((sum, c) => sum + c.amount, 0)

  // Determine the accent color for the header
  const accentColor = category === 'total'
    ? 'var(--text-primary)'
    : CAT_COLORS[category]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, width: '100%', maxWidth: 700, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: accentColor }}>{label}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem 0.5rem',
              lineHeight: 1,
            }}
            title="Close"
          >
            &times;
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowY: 'auto', padding: '0.75rem 1.25rem 1.25rem' }}>
          {grouped.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
              No project contributions for this period.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Client</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Project Name</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((c) => {
                  const statusCat = statusCategory(c.status)
                  return (
                    <tr key={c.project_id}>
                      <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' }}>{c.client_name}</td>
                      <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)' }}>
                        <Link to={`/projects/${c.project_id}`} style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>{c.project_name}</Link>
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', color: CAT_COLORS[statusCat], borderBottom: '1px solid var(--border-subtle)' }}>{CAT_LABELS[statusCat]}</td>
                      <td style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}>{fmt(c.amount)}</td>
                    </tr>
                  )
                })}
                {/* Total row */}
                <tr>
                  <td colSpan={3} style={{ padding: '0.5rem 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', borderTop: '2px solid var(--border)' }}>Total</td>
                  <td style={{ padding: '0.5rem 0.5rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', borderTop: '2px solid var(--border)' }}>{fmt(total)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {/* Close button at bottom-right */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              onClick={onClose}
              style={{
                ...btnStyle,
                padding: '0.5rem 1.2rem',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
