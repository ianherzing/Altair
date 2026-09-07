import { useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { downloadCsv } from '../lib/csv'
import { LoadingState } from '../components/LoadingState'
import { SavedViewBar } from '../components/SavedViewBar'
import {
  fmtCurrencyWhole, fmtCurrency, fmtPct, formatMonth,
  btnStyle, activeBtn, dropdownStyle, clearStyle, checkboxLabelStyle, pickItemStyle, thStyle, tdStyle,
} from '../lib/financeUtils'
import { COLOR_REVENUE, COLOR_COST, COLOR_MARGIN_POS, COLOR_MARGIN_NEG } from '../lib/marginUtils'
import { useMarginData } from '../hooks/useMarginData'
import type { MarginMonthBucket, MarginProjectContribution } from '../types/margin'

type BucketSortKey = 'period' | 'revenue' | 'cost' | 'margin' | 'pct'
type ProjectSortKey = 'client' | 'project' | 'revenue' | 'cost' | 'margin' | 'pct'
type SortDir = 'asc' | 'desc'

interface ProjectAggRow {
  project_id: string
  client_name: string
  project_name: string
  revenue: number
  cost: number
  margin: number
}

const fmt = fmtCurrencyWhole
const fmtFull = fmtCurrency

export function Margin() {
  const {
    loading, error, retry,
    viewMode, setViewMode,
    selectedMonths, setSelectedMonths,
    monthPickerOpen, setMonthPickerOpen, monthPickerRef,
    selectedYear, setSelectedYear,
    yearPickerOpen, setYearPickerOpen, yearPickerRef,
    filterClients, setFilterClients,
    showClientFilter, setShowClientFilter, clientFilterRef,
    filterProjects, setFilterProjects,
    showProjectFilter, setShowProjectFilter, projectFilterRef,
    filterPracticeManagers, setFilterPracticeManagers,
    showPMFilter, setShowPMFilter, pmFilterRef,
    drilldown, setDrilldown,
    availableClients, availableProjectNames, availablePMs,
    filteredMonthKeys, availableYears,
    displayBuckets, displayContributionMap, openDrilldown,
    totals, totalMarginPct,
    hasActiveFilters, getFilters, applyFilters,
  } = useMarginData()

  const [bucketSort, setBucketSort] = useState<{ key: BucketSortKey; dir: SortDir }>({ key: 'period', dir: 'asc' })
  const [projectSort, setProjectSort] = useState<{ key: ProjectSortKey; dir: SortDir }>({ key: 'margin', dir: 'desc' })

  function bucketPct(b: MarginMonthBucket) { return b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0 }

  const sortedBuckets = useMemo(() => {
    const arr = [...displayBuckets]
    const dir = bucketSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (bucketSort.key) {
        case 'period':  return dir * a.key.localeCompare(b.key)
        case 'revenue': return dir * (a.revenue - b.revenue)
        case 'cost':    return dir * (a.cost - b.cost)
        case 'margin':  return dir * (a.margin - b.margin)
        case 'pct':     return dir * (bucketPct(a) - bucketPct(b))
      }
    })
    return arr
  }, [displayBuckets, bucketSort])

  const projectRows: ProjectAggRow[] = useMemo(() => {
    const acc = new Map<string, ProjectAggRow>()
    for (const b of displayBuckets) {
      const contribs = displayContributionMap.get(b.key) || []
      for (const c of contribs) {
        const existing = acc.get(c.project_id)
        if (existing) {
          existing.revenue += c.sow_amount
          existing.cost += c.cost
          existing.margin = existing.revenue - existing.cost
        } else {
          acc.set(c.project_id, {
            project_id: c.project_id,
            client_name: c.client_name,
            project_name: c.project_name,
            revenue: c.sow_amount,
            cost: c.cost,
            margin: c.sow_amount - c.cost,
          })
        }
      }
    }
    return Array.from(acc.values())
  }, [displayBuckets, displayContributionMap])

  const sortedProjectRows = useMemo(() => {
    const arr = [...projectRows]
    const dir = projectSort.dir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (projectSort.key) {
        case 'client':  return dir * a.client_name.localeCompare(b.client_name)
        case 'project': return dir * a.project_name.localeCompare(b.project_name)
        case 'revenue': return dir * (a.revenue - b.revenue)
        case 'cost':    return dir * (a.cost - b.cost)
        case 'margin':  return dir * (a.margin - b.margin)
        case 'pct': {
          const pa = a.revenue > 0 ? a.margin / a.revenue : 0
          const pb = b.revenue > 0 ? b.margin / b.revenue : 0
          return dir * (pa - pb)
        }
      }
    })
    return arr
  }, [projectRows, projectSort])

  const projectTotals = useMemo(() => projectRows.reduce(
    (t, r) => ({ revenue: t.revenue + r.revenue, cost: t.cost + r.cost, margin: t.margin + r.margin }),
    { revenue: 0, cost: 0, margin: 0 },
  ), [projectRows])

  function toggleBucketSort(key: BucketSortKey) {
    setBucketSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'period' ? 'asc' : 'desc' })
  }
  function toggleProjectSort(key: ProjectSortKey) {
    setProjectSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: (key === 'client' || key === 'project') ? 'asc' : 'desc' })
  }
  function bucketSortIndicator(key: BucketSortKey) { return bucketSort.key === key ? (bucketSort.dir === 'asc' ? ' ▲' : ' ▼') : '' }
  function projectSortIndicator(key: ProjectSortKey) { return projectSort.key === key ? (projectSort.dir === 'asc' ? ' ▲' : ' ▼') : '' }

  function exportMarginCsv() {
    const rows = displayBuckets.map(b => ({
      Period: b.label,
      Revenue: Math.round(b.revenue * 100) / 100,
      Cost: Math.round(b.cost * 100) / 100,
      Margin: Math.round(b.margin * 100) / 100,
      'Margin %': b.revenue > 0 ? Math.round((b.margin / b.revenue) * 1000) / 10 : 0,
    }))
    const mode = viewMode === 'quarterly' ? 'quarterly' : 'monthly'
    downloadCsv(rows, `altair-margin-${mode}-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  if (loading || error) return <LoadingState loading={loading} error={error} retry={retry} message="Loading margin data..." />

  const marginColor = totals.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2>Margin</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Client filter */}
          <div ref={clientFilterRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowClientFilter(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem', ...(filterClients.size > 0 ? activeBtn : {}) }}>
              <span>{filterClients.size > 0 ? `Clients (${filterClients.size})` : 'All Clients'}</span>
              <span style={{ fontSize: '0.5rem' }}>{showClientFilter ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showClientFilter && (
              <div style={dropdownStyle}>
                {filterClients.size > 0 && (
                  <div onClick={() => setFilterClients(new Set())} style={clearStyle}>Clear all</div>
                )}
                {availableClients.map(c => {
                  const checked = filterClients.has(c)
                  return (
                    <label key={c} style={checkboxLabelStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setFilterClients(prev => { const n = new Set(prev); if (checked) n.delete(c); else n.add(c); return n })}
                        style={{ accentColor: 'var(--brand-green)' }} />
                      {c}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Project filter */}
          <div ref={projectFilterRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowProjectFilter(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem', ...(filterProjects.size > 0 ? activeBtn : {}) }}>
              <span>{filterProjects.size > 0 ? `Projects (${filterProjects.size})` : 'All Projects'}</span>
              <span style={{ fontSize: '0.5rem' }}>{showProjectFilter ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showProjectFilter && (
              <div style={dropdownStyle}>
                {filterProjects.size > 0 && (
                  <div onClick={() => setFilterProjects(new Set())} style={clearStyle}>Clear all</div>
                )}
                {availableProjectNames.map(p => {
                  const checked = filterProjects.has(p.id)
                  return (
                    <label key={p.id} style={checkboxLabelStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setFilterProjects(prev => { const n = new Set(prev); if (checked) n.delete(p.id); else n.add(p.id); return n })}
                        style={{ accentColor: 'var(--brand-green)' }} />
                      {p.label}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Practice Manager filter */}
          <div ref={pmFilterRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowPMFilter(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem', ...(filterPracticeManagers.size > 0 ? activeBtn : {}) }}>
              <span>{filterPracticeManagers.size > 0 ? `PMs (${filterPracticeManagers.size})` : 'All PMs'}</span>
              <span style={{ fontSize: '0.5rem' }}>{showPMFilter ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showPMFilter && (
              <div style={dropdownStyle}>
                {filterPracticeManagers.size > 0 && (
                  <div onClick={() => setFilterPracticeManagers(new Set())} style={clearStyle}>Clear all</div>
                )}
                {availablePMs.map(pm => {
                  const checked = filterPracticeManagers.has(pm)
                  return (
                    <label key={pm} style={checkboxLabelStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setFilterPracticeManagers(prev => { const n = new Set(prev); if (checked) n.delete(pm); else n.add(pm); return n })}
                        style={{ accentColor: 'var(--brand-green)' }} />
                      {pm}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button onClick={() => { setFilterClients(new Set()); setFilterProjects(new Set()); setFilterPracticeManagers(new Set()) }}
              style={{ ...btnStyle, color: 'var(--brand-green)' }}>Clear Filters</button>
          )}

          <div style={{ width: 1, height: 20, background: 'var(--border-subtle)', margin: '0 0.15rem' }} />

          {/* Year filter */}
          <div ref={yearPickerRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setYearPickerOpen(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>{selectedYear === 'all' ? 'All Years' : selectedYear}</span>
              <span style={{ fontSize: '0.5rem' }}>{yearPickerOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {yearPickerOpen && (
              <div style={dropdownStyle}>
                <div onClick={() => { setSelectedYear('all'); setYearPickerOpen(false) }}
                  style={{ ...pickItemStyle, color: selectedYear === 'all' ? 'var(--brand-green)' : 'var(--text-primary)', fontWeight: selectedYear === 'all' ? 600 : 400 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>All Years</div>
                {availableYears.map(y => (
                  <div key={y} onClick={() => { setSelectedYear(y); setYearPickerOpen(false) }}
                    style={{ ...pickItemStyle, color: selectedYear === y ? 'var(--brand-green)' : 'var(--text-primary)', fontWeight: selectedYear === y ? 600 : 400 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{y}</div>
                ))}
              </div>
            )}
          </div>

          {/* Month filter */}
          <div ref={monthPickerRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setMonthPickerOpen(o => !o)}
              style={{ ...btnStyle, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>{selectedMonths.length === 0 ? 'All Months' : `${selectedMonths.length} months`}</span>
              <span style={{ fontSize: '0.5rem' }}>{monthPickerOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {monthPickerOpen && (
              <div style={dropdownStyle}>
                {selectedMonths.length > 0 && (
                  <div onClick={() => setSelectedMonths([])} style={clearStyle}>Clear all</div>
                )}
                {filteredMonthKeys.map(m => {
                  const checked = selectedMonths.includes(m)
                  return (
                    <label key={m} style={checkboxLabelStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-input)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
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
          <button onClick={exportMarginCsv} style={btnStyle} title="Export as CSV">Export CSV</button>
          <SavedViewBar page="margin" getFilters={getFilters} applyFilters={applyFilters} hasActiveFilters={hasActiveFilters} onClear={() => applyFilters({ viewMode: 'monthly', selectedYear: '2026', selectedMonths: [], filterClients: [], filterProjects: [], filterPracticeManagers: [] })} />
        </div>
      </div>

      {/* Grand total summary cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <SummaryCard label="Total Revenue" value={fmt(totals.revenue)} />
        <SummaryCard label="Total Cost" value={fmt(totals.cost)} color={COLOR_COST} />
        <SummaryCard label="Total Margin" value={fmt(totals.margin)} color={marginColor} />
        <SummaryCard label="Margin %" value={totalMarginPct != null ? fmtPct(totalMarginPct) : '\u2014'}
          color={totalMarginPct != null ? (totalMarginPct >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG) : undefined} />
      </div>

      {/* Divider between totals and monthly cards */}
      <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: '1.5rem' }} />

      {/* Monthly/Quarterly big number cards */}
      {displayBuckets.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '3rem',
          textAlign: 'center', color: 'var(--text-muted)',
        }}>
          No billable projects with SOW amounts and engagement dates.
          <br />
          <span style={{ fontSize: '0.8rem' }}>Add SOW amounts and engagement start/end dates on the Projects page.</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {displayBuckets.map(b => {
            const pct = b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0
            const mColor = b.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG
            return (
              <div key={b.key}
                onClick={() => openDrilldown(b.key, b.label)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                  borderRadius: 8, padding: '1.25rem', cursor: 'pointer',
                  transition: 'border-color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-green)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {b.label}
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: mColor, marginBottom: '0.5rem' }}>
                  {fmt(b.margin)}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, marginLeft: '0.4rem', color: mColor }}>
                    ({fmtPct(pct)})
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Rev </span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(b.revenue)}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Cost </span>
                    <span style={{ color: COLOR_COST, fontWeight: 600 }}>{fmt(b.cost)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Data table */}
      {displayBuckets.length > 0 && (
        <table style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th onClick={() => toggleBucketSort('period')} style={sortableThStyle}>{viewMode === 'monthly' ? 'Month' : 'Quarter'}{bucketSortIndicator('period')}</th>
              <th onClick={() => toggleBucketSort('revenue')} style={{ ...sortableThStyle, textAlign: 'right', color: COLOR_REVENUE }}>Revenue{bucketSortIndicator('revenue')}</th>
              <th onClick={() => toggleBucketSort('cost')} style={{ ...sortableThStyle, textAlign: 'right', color: COLOR_COST }}>Cost{bucketSortIndicator('cost')}</th>
              <th onClick={() => toggleBucketSort('margin')} style={{ ...sortableThStyle, textAlign: 'right' }}>Margin{bucketSortIndicator('margin')}</th>
              <th onClick={() => toggleBucketSort('pct')} style={{ ...sortableThStyle, textAlign: 'right' }}>Margin %{bucketSortIndicator('pct')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedBuckets.map(b => {
              const pct = b.revenue > 0 ? (b.margin / b.revenue) * 100 : 0
              const mColor = b.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG
              return (
                <tr key={b.key}>
                  <td>{b.label}</td>
                  <td style={{ textAlign: 'right', color: COLOR_REVENUE }}>
                    <span className="drilldown-cell" style={{ cursor: 'pointer' }}
                      onClick={() => openDrilldown(b.key, b.label)}>{fmtFull(b.revenue)}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: COLOR_COST }}>
                    <span className="drilldown-cell" style={{ cursor: 'pointer' }}
                      onClick={() => openDrilldown(b.key, b.label)}>{fmtFull(b.cost)}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: mColor }}>
                    <span className="drilldown-cell" style={{ cursor: 'pointer' }}
                      onClick={() => openDrilldown(b.key, b.label)}>{fmtFull(b.margin)}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: mColor }}>{fmtPct(pct)}</td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td style={{ fontWeight: 700 }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: COLOR_REVENUE }}>{fmtFull(totals.revenue)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: COLOR_COST }}>{fmtFull(totals.cost)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: marginColor }}>{fmtFull(totals.margin)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: marginColor }}>{totalMarginPct != null ? fmtPct(totalMarginPct) : '\u2014'}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Margin per Project — totals across the active filter scope */}
      {projectRows.length > 0 && (
        <div style={{ marginTop: '2.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Margin per Project</h3>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th onClick={() => toggleProjectSort('client')} style={sortableThStyle}>Client{projectSortIndicator('client')}</th>
                <th onClick={() => toggleProjectSort('project')} style={sortableThStyle}>Project{projectSortIndicator('project')}</th>
                <th onClick={() => toggleProjectSort('revenue')} style={{ ...sortableThStyle, textAlign: 'right', color: COLOR_REVENUE }}>Revenue{projectSortIndicator('revenue')}</th>
                <th onClick={() => toggleProjectSort('cost')} style={{ ...sortableThStyle, textAlign: 'right', color: COLOR_COST }}>Cost{projectSortIndicator('cost')}</th>
                <th onClick={() => toggleProjectSort('margin')} style={{ ...sortableThStyle, textAlign: 'right' }}>Margin{projectSortIndicator('margin')}</th>
                <th onClick={() => toggleProjectSort('pct')} style={{ ...sortableThStyle, textAlign: 'right' }}>Margin %{projectSortIndicator('pct')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProjectRows.map(r => {
                const pct = r.revenue > 0 ? (r.margin / r.revenue) * 100 : 0
                const mColor = r.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG
                const isLegacy = r.project_id.startsWith('legacy:')
                return (
                  <tr key={r.project_id}>
                    <td>{r.client_name}</td>
                    <td>
                      {isLegacy
                        ? <span>{r.project_name}</span>
                        : <Link to={`/projects/${r.project_id}`} style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>{r.project_name}</Link>}
                    </td>
                    <td style={{ textAlign: 'right', color: COLOR_REVENUE }}>{fmtFull(r.revenue)}</td>
                    <td style={{ textAlign: 'right', color: COLOR_COST }}>{fmtFull(r.cost)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: mColor }}>{fmtFull(r.margin)}</td>
                    <td style={{ textAlign: 'right', color: mColor }}>{fmtPct(pct)}</td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ fontWeight: 700 }}>Total ({projectRows.length} projects)</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: COLOR_REVENUE }}>{fmtFull(projectTotals.revenue)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: COLOR_COST }}>{fmtFull(projectTotals.cost)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: projectTotals.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG }}>{fmtFull(projectTotals.margin)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: projectTotals.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG }}>{projectTotals.revenue > 0 ? fmtPct((projectTotals.margin / projectTotals.revenue) * 100) : '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <style>{`.drilldown-cell:hover { text-decoration: underline; }`}</style>

      {/* Drill-down Dialog */}
      {drilldown && (
        <DrilldownDialog label={drilldown.label} contributions={drilldown.contributions} onClose={() => setDrilldown(null)} />
      )}
    </div>
  )
}

const sortableThStyle: CSSProperties = {
  cursor: 'pointer',
  userSelect: 'none',
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

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

function DrilldownDialog({ label, contributions, onClose }: {
  label: string; contributions: MarginProjectContribution[]; onClose: () => void
}) {
  const totalRevenue = contributions.reduce((sum, c) => sum + c.sow_amount, 0)
  const totalCost = contributions.reduce((sum, c) => sum + c.cost, 0)
  const totalMargin = totalRevenue - totalCost
  const totalPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0
  const fmtD = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
        width: '100%', maxWidth: 800, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{label} — Project Breakdown</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem 0.5rem', lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0.75rem 1.25rem 1.25rem' }}>
          {contributions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No project contributions for this period.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Project</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cost</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Margin</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c, i) => {
                  const pct = c.sow_amount > 0 ? (c.margin / c.sow_amount) * 100 : 0
                  const mColor = c.margin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG
                  return (
                    <tr key={`${c.project_id}-${i}`}>
                      <td style={tdStyle}>{c.client_name}</td>
                      <td style={tdStyle}>
                        <Link to={`/projects/${c.project_id}`} style={{ color: 'var(--brand-green)', textDecoration: 'none' }}>{c.project_name}</Link>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtD(c.sow_amount)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: COLOR_COST }}>{fmtD(c.cost)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: mColor, fontWeight: 600 }}>{fmtD(c.margin)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: mColor }}>{fmtPct(pct)}</td>
                    </tr>
                  )
                })}
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, fontWeight: 700, borderTop: '2px solid var(--border)' }}>Total</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border)' }}>{fmtD(totalRevenue)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: COLOR_COST, borderTop: '2px solid var(--border)' }}>{fmtD(totalCost)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: totalMargin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG, borderTop: '2px solid var(--border)' }}>{fmtD(totalMargin)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: totalMargin >= 0 ? COLOR_MARGIN_POS : COLOR_MARGIN_NEG, borderTop: '2px solid var(--border)' }}>{fmtPct(totalPct)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={onClose} style={{ ...btnStyle, padding: '0.5rem 1.2rem' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}
